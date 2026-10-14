import crypto from 'node:crypto';
import { tx, audit, nowIso, getSettings } from './db.js';
import { fail } from './http.js';
import { formatMoney } from './payments.js';

const PAID_STATES = ['paid', 'partially_refunded', 'refunded'];
const OPEN_STATES = ['pending', 'awaiting_confirmation'];

export function newOrderNo() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `KT${ymd}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// 결제 진행 중 좌석: 시간이 지난 임시 확보는 자동 해제
export function expireHolds(db) {
  db.prepare(`UPDATE orders SET status = 'expired', updated_at = ?
              WHERE status = 'pending' AND hold_expires_at IS NOT NULL AND hold_expires_at < ?`).run(nowIso(), nowIso());
}

export function seatInfo(db, sectionId, excludeOrderId = 0) {
  const section = db.prepare('SELECT capacity FROM sections WHERE id = ?').get(sectionId);
  const enrolled = db.prepare("SELECT COUNT(*) n FROM enrollments WHERE section_id = ? AND status = 'active'").get(sectionId).n;
  const held = db.prepare(`SELECT COUNT(*) n FROM orders WHERE section_id = ? AND id != ?
                           AND status IN ('pending','awaiting_confirmation') AND hold_expires_at > ?`)
    .get(sectionId, excludeOrderId, nowIso()).n;
  const capacity = section ? section.capacity : 0;
  return { capacity, enrolled, held, remaining: Math.max(0, capacity - enrolled - held) };
}

// 과정·반이 '신청 가능한 상태'인지 판정 — 가격·일정 미정이면 결제 차단
export function sectionPurchasable(db, section, course) {
  const reasons = [];
  if (!course || course.status !== 'published') reasons.push('course_unavailable');
  if (!section || section.status !== 'open') reasons.push('section_closed');
  if (course && (course.price_amount === null || course.price_amount === undefined || course.price_amount <= 0)) reasons.push('price_tbd');
  if (section && section.format !== 'recorded') {
    const n = db.prepare('SELECT COUNT(*) n FROM class_sessions WHERE section_id = ?').get(section.id).n;
    if (n === 0) reasons.push('schedule_tbd');
  }
  if (course && !String(course.refund_policy_ko || '').trim()) reasons.push('refund_policy_tbd');
  // 이용약관·개인정보 처리방침이 게시되기 전에는 결제를 받지 않음
  const st = getSettings(db);
  if (!String(st.terms_ko || '').trim() || !String(st.privacy_ko || '').trim()) reasons.push('legal_tbd');
  if (section?.enroll_deadline && section.enroll_deadline < nowIso()) reasons.push('deadline_passed');
  return reasons;
}

function loadSectionCourse(db, sectionId) {
  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId);
  const course = section ? db.prepare('SELECT * FROM courses WHERE id = ?').get(section.course_id) : null;
  return { section, course };
}

export function createOrder(db, payments, config, user, input) {
  const provider = payments.active();
  if (!provider.configured) fail(409, 'payment_unavailable');
  return tx(db, () => {
    expireHolds(db);
    const existing = db.prepare('SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?').get(user.id, input.idempotencyKey);
    if (existing) return { order: existing, reused: true };

    const { section, course } = loadSectionCourse(db, input.sectionId);
    const reasons = sectionPurchasable(db, section, course);
    if (reasons.length) fail(409, reasons[0]);

    const enrolled = db.prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND section_id = ? AND status = 'active'").get(user.id, section.id);
    if (enrolled) fail(409, 'already_enrolled');

    const holdUntil = new Date(Date.now() + config.seatHoldMinutes * 60e3).toISOString();
    const open = db.prepare(`SELECT * FROM orders WHERE user_id = ? AND section_id = ? AND status IN ('pending','failed','expired')
                             ORDER BY id DESC`).get(user.id, section.id);
    if (open) {
      // 같은 반에 진행 중이거나 실패한 주문이 있으면 재사용 (중복 주문 방지, 신청 정보 갱신)
      if (open.status !== 'pending' || open.hold_expires_at < nowIso()) {
        if (seatInfo(db, section.id, open.id).remaining <= 0) fail(409, 'sold_out');
      }
      db.prepare(`UPDATE orders SET applicant = ?, consents = ?, amount = ?, currency = ?, refund_policy_snapshot = ?,
                  status = 'pending', hold_expires_at = ?, failure_reason = NULL, provider = ?, updated_at = ? WHERE id = ?`)
        .run(JSON.stringify(input.applicant), JSON.stringify(input.consents), course.price_amount, course.currency,
          refundPolicyText(course), holdUntil, provider.name, nowIso(), open.id);
      return { order: db.prepare('SELECT * FROM orders WHERE id = ?').get(open.id), reused: true };
    }

    if (seatInfo(db, section.id).remaining <= 0) fail(409, 'sold_out');
    const orderNo = newOrderNo();
    db.prepare(`INSERT INTO orders(order_no, user_id, section_id, course_id, amount, currency, provider, applicant, consents,
                refund_policy_snapshot, idempotency_key, hold_expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(orderNo, user.id, section.id, course.id, course.price_amount, course.currency, provider.name,
        JSON.stringify(input.applicant), JSON.stringify(input.consents), refundPolicyText(course), input.idempotencyKey, holdUntil);
    const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
    audit(db, user, 'order.create', orderNo, { amount: order.amount, currency: order.currency, sectionId: section.id });
    return { order, reused: false, course };
  });
}

function refundPolicyText(course) {
  return JSON.stringify({ ko: course.refund_policy_ko || '', en: course.refund_policy_en || '' });
}

export function ownOrder(db, user, orderNo) {
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
  // 다른 학습자의 주문은 존재 여부도 알리지 않음
  if (!order || order.user_id !== user.id) fail(404, 'not_found');
  return order;
}

export function startPayment(db, payments, config, user, orderNo) {
  const provider = payments.active();
  if (!provider.configured) fail(409, 'payment_unavailable');
  return tx(db, () => {
    expireHolds(db);
    const order = ownOrder(db, user, orderNo);
    if (!['pending', 'failed', 'expired'].includes(order.status)) fail(409, 'order_not_payable');
    const { section, course } = loadSectionCourse(db, order.section_id);
    const reasons = sectionPurchasable(db, section, course);
    if (reasons.length) fail(409, reasons[0]);
    // 결제 시작 시점의 가격을 서버가 다시 확정 (브라우저가 보낸 금액은 사용하지 않음)
    const amount = course.price_amount;
    const holdValid = order.status === 'pending' && order.hold_expires_at > nowIso();
    if (!holdValid && seatInfo(db, section.id, order.id).remaining <= 0) fail(409, 'sold_out');
    const attempt = order.attempt + 1;
    const providerOrderId = `${order.order_no}-${attempt}`;
    const holdUntil = new Date(Date.now() + config.seatHoldMinutes * 60e3).toISOString();
    db.prepare(`UPDATE orders SET status = 'pending', attempt = ?, provider_order_id = ?, provider = ?, amount = ?, currency = ?,
                hold_expires_at = ?, failure_reason = NULL, updated_at = ? WHERE id = ?`)
      .run(attempt, providerOrderId, provider.name, amount, course.currency, holdUntil, nowIso(), order.id);
    const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    const checkout = provider.checkout(fresh, {
      orderName: course.title_ko, email: user.email, customerKey: `user_${user.id}`, paymentLinkUrl: course.payment_link_url
    });
    if (checkout.type === 'unavailable') fail(409, checkout.reason);
    return { order: fresh, checkout, live: provider.live, holdExpiresAt: holdUntil };
  });
}

/** 결제창 복귀 후 승인: 복귀 자체로는 완료 처리하지 않고, 금액 검증 → 결제사 승인 → 결과 반영 */
export async function confirmPayment(db, payments, user, { paymentKey, orderId, amount }) {
  const order = db.prepare('SELECT * FROM orders WHERE provider_order_id = ?').get(String(orderId || ''));
  if (!order || order.user_id !== user.id) fail(404, 'not_found');
  if (PAID_STATES.includes(order.status)) return { order, duplicate: true };

  const provider = payments.get(order.provider);
  const claimed = Number(amount);
  if (!Number.isFinite(claimed) || claimed !== order.amount) {
    tx(db, () => {
      db.prepare("UPDATE orders SET status = 'failed', failure_reason = 'amount_mismatch', hold_expires_at = NULL, updated_at = ? WHERE id = ? AND status IN ('pending','expired')")
        .run(nowIso(), order.id);
      audit(db, user, 'payment.amount_mismatch', order.order_no, { claimed: amount, expected: order.amount });
    });
    fail(400, 'amount_mismatch');
  }
  if (!['pending', 'expired'].includes(order.status)) fail(409, 'order_not_payable');

  // 임시 확보 시간이 지났다면 남은 좌석을 다시 확인 — 좌석이 없으면 승인 요청 자체를 하지 않아 청구되지 않음
  if (!(order.hold_expires_at > nowIso()) && seatInfo(db, order.section_id, order.id).remaining <= 0) {
    markFailed(db, user, order, 'seat_unavailable');
    fail(409, 'sold_out');
  }

  const result = await provider.confirm({ paymentKey: String(paymentKey || ''), orderId: order.provider_order_id, amount: order.amount, currency: order.currency });
  if (!result.ok) {
    markFailed(db, user, order, result.code || 'confirm_failed');
    fail(402, 'payment_failed', result.code);
  }
  if (result.amount !== order.amount || result.currency !== order.currency) {
    markFailed(db, user, order, 'provider_amount_mismatch');
    audit(db, user, 'payment.provider_amount_mismatch', order.order_no, { result });
    fail(400, 'amount_mismatch');
  }
  return applyPaid(db, order.id, { paymentKey: result.paymentKey, actor: user, source: 'confirm' });
}

export function markFailed(db, actor, order, reason) {
  tx(db, () => {
    db.prepare(`UPDATE orders SET status = 'failed', failure_reason = ?, hold_expires_at = NULL, updated_at = ?
                WHERE id = ? AND status IN ('pending','expired')`).run(String(reason).slice(0, 100), nowIso(), order.id);
    audit(db, actor, 'payment.failed', order.order_no, { reason });
  });
}

/** 결제 완료 반영 + 수강 권한 부여 (중복 호출·중복 통지에도 1회만 반영) */
export function applyPaid(db, orderId, { paymentKey = null, reference = null, actor, source }) {
  return tx(db, () => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (PAID_STATES.includes(order.status)) return { order, duplicate: true };
    const holdValid = OPEN_STATES.includes(order.status) && order.hold_expires_at > nowIso();
    const overCapacity = !holdValid && seatInfo(db, order.section_id, order.id).remaining <= 0;
    db.prepare(`UPDATE orders SET status = 'paid', paid_at = ?, provider_payment_key = COALESCE(?, provider_payment_key),
                provider_reference = COALESCE(?, provider_reference), hold_expires_at = NULL, needs_review = ?, failure_reason = NULL, updated_at = ?
                WHERE id = ?`)
      .run(nowIso(), paymentKey, reference, overCapacity ? 'over_capacity' : null, nowIso(), order.id);
    db.prepare("INSERT OR IGNORE INTO enrollments(user_id, section_id, order_id, status) VALUES (?, ?, ?, 'active')")
      .run(order.user_id, order.section_id, order.id);
    audit(db, actor, 'payment.paid', order.order_no, { source, amount: order.amount, currency: order.currency, overCapacity });
    audit(db, actor, 'enrollment.grant', order.order_no, { sectionId: order.section_id, userId: order.user_id });
    return { order: db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id), duplicate: false, newlyPaid: true };
  });
}

/** 결제사 웹훅: 본문을 믿지 않고 결제사에 직접 조회한 결과로만 처리 */
export async function handleWebhook(db, payments, providerName, body) {
  const provider = payments.get(providerName);
  if (!provider || !provider.configured) fail(404, 'unknown_provider');
  const paymentKey = String(body?.data?.paymentKey || body?.paymentKey || '');
  if (!paymentKey) fail(400, 'missing_payment_key');
  const order0 = db.prepare('SELECT currency FROM orders WHERE provider_payment_key = ? OR provider_order_id = ?')
    .get(paymentKey, String(body?.data?.orderId || body?.orderId || ''));
  const verified = await provider.fetch(paymentKey, order0?.currency);
  if (!verified) fail(404, 'payment_not_found');

  const eventKey = `${paymentKey}:${verified.status}:${verified.cancelledAmount || 0}`;
  const inserted = db.prepare('INSERT OR IGNORE INTO payment_events(provider, event_key, order_no, kind, payload) VALUES (?, ?, ?, ?, ?)')
    .run(providerName, eventKey, verified.orderId, 'webhook', JSON.stringify(body).slice(0, 4000));
  if (inserted.changes === 0) return { duplicate: true };

  const order = db.prepare('SELECT * FROM orders WHERE provider_order_id = ?').get(verified.orderId);
  if (!order) return { ignored: 'unknown_order' };
  const system = { id: null, email: `webhook:${providerName}` };
  let result;
  if (verified.status === 'DONE') {
    if (verified.amount !== order.amount || verified.currency !== order.currency) {
      audit(db, system, 'payment.webhook_amount_mismatch', order.order_no, { verified });
      tx(db, () => db.prepare("UPDATE orders SET needs_review = 'amount_mismatch', updated_at = ? WHERE id = ?").run(nowIso(), order.id));
      result = { flagged: 'amount_mismatch' };
    } else {
      result = applyPaid(db, order.id, { paymentKey, actor: system, source: 'webhook' });
    }
  } else if (['CANCELED', 'PARTIAL_CANCELED'].includes(verified.status)) {
    result = syncRefunded(db, order.id, verified.cancelledAmount, system);
  } else if (['ABORTED', 'EXPIRED'].includes(verified.status)) {
    markFailed(db, system, order, verified.status.toLowerCase());
    result = { failed: true };
  }
  db.prepare('UPDATE payment_events SET result = ? WHERE provider = ? AND event_key = ?')
    .run(JSON.stringify(result || {}), providerName, eventKey);
  return result || {};
}

/** 환불 금액 반영: 누적 환불액 기준(멱등). 전체 환불 또는 권한 회수 지정 시 수강 권한 회수 */
export function syncRefunded(db, orderId, totalRefunded, actor, { revokeAccess = false } = {}) {
  return tx(db, () => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (totalRefunded <= order.refunded_amount) return { order, duplicate: true };
    if (totalRefunded > order.amount) fail(400, 'exceeds_paid_amount');
    const full = totalRefunded === order.amount;
    db.prepare('UPDATE orders SET refunded_amount = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(totalRefunded, full ? 'refunded' : 'partially_refunded', nowIso(), order.id);
    audit(db, actor, full ? 'refund.full' : 'refund.partial', order.order_no, { totalRefunded, previous: order.refunded_amount });
    if (full || revokeAccess) {
      const r = db.prepare("UPDATE enrollments SET status = 'revoked' WHERE order_id = ? AND status = 'active'").run(order.id);
      if (r.changes) audit(db, actor, 'enrollment.revoke', order.order_no, { reason: full ? 'full_refund' : 'policy' });
    }
    return { order: db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id) };
  });
}

/** 관리자 환불 처리: 결제사 API 취소 또는 (결제 링크 등) 외부 환불 완료 기록 */
export async function processRefund(db, payments, admin, requestId, { approve, amount, revokeAccess, note, manualReference }) {
  const reqRow = db.prepare('SELECT * FROM refund_requests WHERE id = ?').get(requestId);
  if (!reqRow) fail(404, 'not_found');
  if (!['requested', 'approved', 'failed'].includes(reqRow.status)) fail(409, 'already_decided');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(reqRow.order_id);
  const setReq = (status, extra = {}) => db.prepare(`UPDATE refund_requests SET status = ?, approved_amount = COALESCE(?, approved_amount),
      revoke_access = COALESCE(?, revoke_access), admin_note = ?, updated_at = ? WHERE id = ?`)
    .run(status, extra.amount ?? null, extra.revoke ?? null, String(note || '').slice(0, 1000), nowIso(), requestId);

  if (!approve) {
    tx(db, () => { setReq('rejected'); audit(db, admin, 'refund.reject', order.order_no, { requestId, note }); });
    return { status: 'rejected', order };
  }
  const remaining = order.amount - order.refunded_amount;
  if (!Number.isInteger(amount) || amount <= 0 || amount > remaining) fail(400, 'invalid_refund_amount');
  const provider = payments.get(order.provider);

  let total;
  if (provider?.supportsApiRefund && order.provider_payment_key) {
    const r = await provider.cancel(order.provider_payment_key, amount, note, order.currency);
    if (!r.ok) {
      tx(db, () => { setReq('failed', { amount }); audit(db, admin, 'refund.provider_failed', order.order_no, { code: r.code }); });
      fail(502, 'refund_failed', r.code);
    }
    total = r.cancelledAmount;
  } else {
    if (!manualReference) fail(400, 'manual_reference_required');
    total = order.refunded_amount + amount;
    audit(db, admin, 'refund.manual_record', order.order_no, { amount, manualReference });
  }
  const synced = syncRefunded(db, order.id, total, admin, { revokeAccess: !!revokeAccess });
  tx(db, () => setReq('processed', { amount, revoke: revokeAccess ? 1 : 0 }));
  return { status: 'processed', order: synced.order, refunded: formatMoney(amount, order.currency) };
}
