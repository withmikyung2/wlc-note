import { getSettings, setSetting, audit, tx, nowIso } from '../db.js';
import { fail, str, int, safeUrl, EMAIL_RE } from '../http.js';
import { newTotpSecret, verifyTotp } from '../auth.js';
import { serializeCourse, serializeSection, serializeOrder } from '../serialize.js';
import { applyPaid, processRefund, expireHolds } from '../orders.js';
import { toMinor, toMajor, formatMoney } from '../payments.js';
import { DEFAULT_SETTINGS } from '../seed.js';

const TEXT_SETTINGS = Object.keys(DEFAULT_SETTINGS).filter((k) => k !== 'reference_rates');
const FORMATS = ['group', 'private', 'recorded'];
const PURPOSES = ['study', 'daily', 'work', 'friends', 'travel', 'family', 'culture', 'hobby'];

function validTimezone(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

export function launchChecklist(db, ctx) {
  const s = getSettings(db);
  const p = ctx.payments.active();
  const courses = db.prepare("SELECT * FROM courses WHERE status = 'published'").all();
  const filled = (k) => !!String(s[k] || '').trim();
  return [
    { key: 'org_info', ok: ['org_name', 'representative', 'business_reg_no', 'address', 'contact_email', 'phone'].every(filled), area: 'business' },
    { key: 'mail_order_reg', ok: filled('mail_order_reg_no'), area: 'business' },
    { key: 'terms', ok: filled('terms_ko') && filled('terms_en'), area: 'legal' },
    { key: 'privacy', ok: filled('privacy_ko') && filled('privacy_en') && filled('privacy_officer'), area: 'legal' },
    { key: 'refund_general', ok: filled('refund_general_ko'), area: 'legal' },
    { key: 'instructor', ok: db.prepare('SELECT COUNT(*) n FROM instructors WHERE published = 1').get().n > 0, area: 'content' },
    { key: 'course_prices', ok: courses.length > 0 && courses.every((c) => c.price_amount > 0), area: 'content' },
    { key: 'course_refund', ok: courses.length > 0 && courses.every((c) => String(c.refund_policy_ko || '').trim()), area: 'content' },
    { key: 'schedules', ok: db.prepare("SELECT COUNT(*) n FROM sections WHERE status = 'open'").get().n > 0, area: 'content' },
    { key: 'payment_contract', ok: p.configured && p.live, area: 'payment', detail: p.name },
    { key: 'settlement_account', ok: !!s.checklist_settlement_account, area: 'payment', manual: true },
    { key: 'payment_webhook', ok: !!s.checklist_webhook_registered, area: 'payment', manual: true },
    { key: 'email_service', ok: ctx.mailer.configured, area: 'email' },
    { key: 'domain_https', ok: ctx.config.publicBaseUrl.startsWith('https://'), area: 'infra' },
    { key: 'admin_mfa', ok: db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND totp_enabled = 0").get().n === 0, area: 'security' },
    { key: 'backup', ok: !!s.checklist_backup, area: 'infra', manual: true }
  ];
}

export function registerAdmin(router, ctx) {
  const { db, config, payments, mailer } = ctx;
  const A = (handler) => (req, res, c) => { ctx.requireAdmin(c.user); return handler(req, res, c); };
  const site = () => getSettings(db).site_name_ko || 'Korean Together';

  // MFA 설정은 관리자 본인만 (MFA 미설정 상태에서도 접근 가능해야 하므로 role 만 확인)
  router.post('/api/auth/mfa/setup', (req, res, { user }) => {
    if (!user || user.role !== 'admin') fail(403, 'forbidden');
    if (user.totp_enabled) fail(409, 'mfa_already_enabled');
    const secret = newTotpSecret();
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, user.id);
    const label = encodeURIComponent(`${site()}:${user.email}`);
    return { secret, otpauth: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(site())}` };
  });
  router.post('/api/auth/mfa/enable', (req, res, { body, user }) => {
    if (!user || user.role !== 'admin') fail(403, 'forbidden');
    const row = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(user.id);
    if (!row.totp_secret || !verifyTotp(row.totp_secret, body.code)) fail(400, 'invalid_otp');
    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
    db.prepare('UPDATE sessions SET mfa_passed = 1 WHERE user_id = ?').run(user.id);
    audit(db, user, 'admin.mfa_enabled', user.email);
    return { ok: true };
  });

  // ── 현황 ─────────────────────────────────
  router.get('/api/admin/overview', A(() => {
    expireHolds(db);
    const sales = db.prepare(`SELECT currency, SUM(amount) gross, SUM(refunded_amount) refunded, COUNT(*) n FROM orders
                              WHERE status IN ('paid','partially_refunded','refunded') GROUP BY currency`).all()
      .map((r) => ({ ...r, net: r.gross - r.refunded, netText: formatMoney(r.gross - r.refunded, r.currency), grossText: formatMoney(r.gross, r.currency) }));
    const count = (sql, ...a) => db.prepare(sql).get(...a).n;
    const p = payments.active();
    return {
      sales,
      learners: count("SELECT COUNT(*) n FROM users WHERE role = 'learner'"),
      activeEnrollments: count("SELECT COUNT(*) n FROM enrollments WHERE status = 'active'"),
      pendingOrders: count("SELECT COUNT(*) n FROM orders WHERE status IN ('pending','awaiting_confirmation')"),
      awaitingConfirmation: count("SELECT COUNT(*) n FROM orders WHERE status = 'awaiting_confirmation'"),
      needsReview: count('SELECT COUNT(*) n FROM orders WHERE needs_review IS NOT NULL'),
      openRefunds: count("SELECT COUNT(*) n FROM refund_requests WHERE status IN ('requested','approved','failed')"),
      openInquiries: count("SELECT COUNT(*) n FROM inquiries WHERE status = 'open'"),
      bySection: db.prepare(`SELECT c.title_ko course, s.id sectionId, s.label_ko label, s.capacity,
                               (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = s.id AND e.status = 'active') enrolled
                             FROM sections s JOIN courses c ON c.id = s.course_id ORDER BY c.sort, s.id`).all(),
      integrations: {
        payment: { mode: p.name, configured: p.configured, live: p.live, implemented: p.implemented !== false,
          toss: { configured: payments.get('toss').configured, live: payments.get('toss').live },
          eximbay: { hasKeys: payments.get('eximbay').hasKeys, implemented: false } },
        email: { provider: mailer.providerName, configured: mailer.configured },
        mfaRequired: config.adminRequireMfa,
        baseUrl: config.publicBaseUrl
      },
      checklist: launchChecklist(db, ctx)
    };
  }));

  // ── 사이트·운영기관 설정 ──────────────────
  router.get('/api/admin/settings', A(() => ({ settings: getSettings(db) })));
  router.put('/api/admin/settings', A((req, res, { body, user }) => {
    const changed = [];
    for (const k of TEXT_SETTINGS) {
      if (k in body) { setSetting(db, k, str(body[k], k.startsWith('terms') || k.startsWith('privacy_') || k.startsWith('refund') ? 50000 : 500)); changed.push(k); }
    }
    for (const k of ['checklist_settlement_account', 'checklist_webhook_registered', 'checklist_backup']) {
      if (k in body) { setSetting(db, k, !!body[k]); changed.push(k); }
    }
    if (body.reference_rates && typeof body.reference_rates === 'object') {
      const rates = {};
      for (const [cur, v] of Object.entries(body.reference_rates)) {
        if (/^[A-Z]{3}_[A-Z]{3}$/.test(cur) && Number(v) > 0) rates[cur] = Number(v);
      }
      setSetting(db, 'reference_rates', rates);
      changed.push('reference_rates');
    }
    audit(db, user, 'settings.update', 'settings', { changed });
    return { settings: getSettings(db) };
  }));

  // ── 강사 ─────────────────────────────────
  const instructorFields = (b) => [str(b.name_ko, 80), str(b.name_en, 80), str(b.bio_ko, 4000), str(b.bio_en, 4000),
    str(b.qualifications, 2000), str(b.career, 4000), b.photo_url ? safeUrl(b.photo_url) : '', b.published ? 1 : 0];
  router.get('/api/admin/instructors', A(() => ({ instructors: db.prepare('SELECT * FROM instructors ORDER BY id').all() })));
  router.post('/api/admin/instructors', A((req, res, { body, user }) => {
    const r = db.prepare(`INSERT INTO instructors(name_ko, name_en, bio_ko, bio_en, qualifications, career, photo_url, published)
                          VALUES (?,?,?,?,?,?,?,?)`).run(...instructorFields(body));
    audit(db, user, 'instructor.create', r.lastInsertRowid);
    return { id: r.lastInsertRowid };
  }));
  router.put('/api/admin/instructors/:id', A((req, res, { params, body, user }) => {
    db.prepare(`UPDATE instructors SET name_ko=?, name_en=?, bio_ko=?, bio_en=?, qualifications=?, career=?, photo_url=?, published=? WHERE id=?`)
      .run(...instructorFields(body), int(params.id));
    audit(db, user, 'instructor.update', params.id);
    return { ok: true };
  }));
  router.delete('/api/admin/instructors/:id', A((req, res, { params, user }) => {
    db.prepare('DELETE FROM instructors WHERE id = ?').run(int(params.id));
    audit(db, user, 'instructor.delete', params.id);
    return { ok: true };
  }));

  // ── 과정 ─────────────────────────────────
  router.get('/api/admin/courses', A(() => ({
    courses: db.prepare('SELECT * FROM courses ORDER BY sort, id').all().map((c) => serializeCourse(db, c, { admin: true }))
  })));

  function courseValues(b) {
    const currency = /^[A-Z]{3}$/.test(b.currency) ? b.currency : 'KRW';
    const price = b.price === '' || b.price === null || b.price === undefined ? null : Number(b.price);
    if (price !== null && !(price > 0)) fail(400, 'invalid_price');
    const list = (v, allowed) => JSON.stringify((Array.isArray(v) ? v : []).filter((x) => allowed.includes(x)));
    const lines = (v) => JSON.stringify((Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => str(x, 300)).filter(Boolean));
    return {
      slug: str(b.slug, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'course-' + Date.now(),
      sort: int(b.sort ?? 0, { min: 0, max: 999 }), category: str(b.category, 30) || 'general',
      title_ko: str(b.title_ko, 120), title_en: str(b.title_en, 120), summary_ko: str(b.summary_ko, 1000), summary_en: str(b.summary_en, 1000),
      level_ko: str(b.level_ko, 200), level_en: str(b.level_en, 200), prerequisites_ko: str(b.prerequisites_ko, 500), prerequisites_en: str(b.prerequisites_en, 500),
      goals_ko: lines(b.goals_ko), goals_en: lines(b.goals_en), formats: list(b.formats, FORMATS), purposes: list(b.purposes, PURPOSES),
      level_min: int(b.level_min ?? 0, { min: 0, max: 4 }), level_max: int(b.level_max ?? 4, { min: 0, max: 4 }),
      session_count: int(b.session_count, { min: 1, max: 500, allowNull: true }),
      minutes_per_session: int(b.minutes_per_session, { min: 5, max: 600, allowNull: true }),
      instructor_id: int(b.instructor_id, { min: 1, allowNull: true }),
      materials_ko: str(b.materials_ko, 2000), materials_en: str(b.materials_en, 2000),
      refund_policy_ko: str(b.refund_policy_ko, 5000), refund_policy_en: str(b.refund_policy_en, 5000),
      price_amount: price === null ? null : toMinor(price, currency), currency,
      payment_link_url: b.payment_link_url ? safeUrl(b.payment_link_url) : '',
      status: b.status === 'draft' ? 'draft' : 'published'
    };
  }

  function saveLessons(courseId, lessons) {
    if (!Array.isArray(lessons)) return;
    db.prepare('DELETE FROM lessons WHERE course_id = ?').run(courseId);
    const ins = db.prepare('INSERT INTO lessons(course_id, no, title_ko, title_en) VALUES (?,?,?,?)');
    lessons.filter((l) => str(l.title_ko || l.ko, 200)).forEach((l, i) => ins.run(courseId, i + 1, str(l.title_ko || l.ko, 200), str(l.title_en || l.en, 200)));
  }

  router.post('/api/admin/courses', A((req, res, { body, user }) => {
    const v = courseValues(body);
    if (!v.title_ko) fail(400, 'missing_fields');
    const cols = Object.keys(v);
    const id = tx(db, () => {
      const r = db.prepare(`INSERT INTO courses(${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...Object.values(v));
      saveLessons(r.lastInsertRowid, body.lessons);
      return r.lastInsertRowid;
    });
    audit(db, user, 'course.create', id, { price: v.price_amount, currency: v.currency });
    return { id };
  }));

  router.put('/api/admin/courses/:id', A((req, res, { params, body, user }) => {
    const id = int(params.id);
    const before = db.prepare('SELECT price_amount, currency, payment_link_url FROM courses WHERE id = ?').get(id);
    if (!before) fail(404, 'not_found');
    const v = courseValues(body);
    tx(db, () => {
      db.prepare(`UPDATE courses SET ${Object.keys(v).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(v), id);
      saveLessons(id, body.lessons);
    });
    audit(db, user, 'course.update', id, {
      priceChanged: before.price_amount !== v.price_amount || before.currency !== v.currency ? { from: before.price_amount, to: v.price_amount, currency: v.currency } : undefined,
      paymentLinkChanged: before.payment_link_url !== v.payment_link_url || undefined
    });
    return { ok: true };
  }));

  router.delete('/api/admin/courses/:id', A((req, res, { params, user }) => {
    const id = int(params.id);
    if (db.prepare('SELECT 1 FROM orders WHERE course_id = ?').get(id)) fail(409, 'has_orders');
    db.prepare('DELETE FROM courses WHERE id = ?').run(id);
    audit(db, user, 'course.delete', id);
    return { ok: true };
  }));

  // ── 개설반·시간표 ─────────────────────────
  function sectionValues(b) {
    const tz = str(b.timezone, 60) || 'Asia/Seoul';
    if (!validTimezone(tz)) fail(400, 'invalid_timezone');
    return [str(b.label_ko, 120), str(b.label_en, 120), FORMATS.includes(b.format) ? b.format : 'group', tz,
      int(b.capacity ?? 6, { min: 1, max: 500 }), b.enroll_deadline ? new Date(b.enroll_deadline).toISOString() : null,
      ['open', 'closed', 'draft'].includes(b.status) ? b.status : 'draft'];
  }
  router.post('/api/admin/sections', A((req, res, { body, user }) => {
    const courseId = int(body.course_id, { min: 1 });
    const r = db.prepare('INSERT INTO sections(course_id, label_ko, label_en, format, timezone, capacity, enroll_deadline, status) VALUES (?,?,?,?,?,?,?,?)')
      .run(courseId, ...sectionValues(body));
    audit(db, user, 'section.create', r.lastInsertRowid, { courseId });
    return { id: r.lastInsertRowid };
  }));
  router.put('/api/admin/sections/:id', A((req, res, { params, body, user }) => {
    const id = int(params.id);
    const v = sectionValues(body);
    const enrolled = db.prepare("SELECT COUNT(*) n FROM enrollments WHERE section_id = ? AND status = 'active'").get(id).n;
    if (v[4] < enrolled) fail(409, 'capacity_below_enrolled');
    db.prepare('UPDATE sections SET label_ko=?, label_en=?, format=?, timezone=?, capacity=?, enroll_deadline=?, status=? WHERE id=?').run(...v, id);
    audit(db, user, 'section.update', id, { capacity: v[4], status: v[6] });
    return { ok: true };
  }));
  router.delete('/api/admin/sections/:id', A((req, res, { params, user }) => {
    const id = int(params.id);
    if (db.prepare('SELECT 1 FROM orders WHERE section_id = ?').get(id)) fail(409, 'has_orders');
    db.prepare('DELETE FROM sections WHERE id = ?').run(id);
    audit(db, user, 'section.delete', id);
    return { ok: true };
  }));
  // 회차 일정 + 화상수업 링크 (회차 번호 기준으로 갱신, 출석 기록 보존)
  router.put('/api/admin/sections/:id/sessions', A((req, res, { params, body, user }) => {
    const id = int(params.id);
    const list = Array.isArray(body.sessions) ? body.sessions : [];
    tx(db, () => {
      const keep = [];
      list.forEach((s, i) => {
        const no = i + 1;
        const t = new Date(s.startsAt);
        if (Number.isNaN(t.getTime())) fail(400, 'invalid_datetime');
        keep.push(no);
        db.prepare(`INSERT INTO class_sessions(section_id, no, starts_at, meeting_url) VALUES (?,?,?,?)
                    ON CONFLICT(section_id, no) DO UPDATE SET starts_at = excluded.starts_at, meeting_url = excluded.meeting_url`)
          .run(id, no, t.toISOString(), s.meetingUrl ? safeUrl(s.meetingUrl) : '');
      });
      db.prepare(`DELETE FROM class_sessions WHERE section_id = ? AND no NOT IN (${keep.map(() => '?').join(',') || 'NULL'})`).run(id, ...keep);
    });
    audit(db, user, 'section.sessions_update', id, { count: list.length });
    return { section: serializeSection(db, db.prepare('SELECT * FROM sections WHERE id = ?').get(id),
      db.prepare('SELECT c.* FROM courses c JOIN sections s ON s.course_id = c.id WHERE s.id = ?').get(id), { admin: true }) };
  }));
  router.post('/api/admin/sections/:id/notify', A(async (req, res, { params, body, user }) => {
    const text = str(body.text, 4000);
    if (!text) fail(400, 'missing_fields');
    const rows = db.prepare(`SELECT u.email FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.section_id = ? AND e.status = 'active'`).all(int(params.id));
    const statuses = [];
    for (const r of rows) statuses.push(await mailer.send(db, r.email, 'schedule_notice', { site: site(), text }));
    audit(db, user, 'section.notify', params.id, { recipients: rows.length });
    return { recipients: rows.length, statuses };
  }));

  // ── 학습자·주문·수강 ───────────────────────
  router.get('/api/admin/learners', A(() => ({
    learners: db.prepare(`SELECT u.id, u.email, u.display_name, u.timezone, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) orders,
        (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status = 'active') active
      FROM users u WHERE u.role = 'learner' ORDER BY u.id DESC`).all()
  })));

  router.get('/api/admin/orders', A((req, res, { query }) => {
    expireHolds(db);
    const status = query.get('status');
    const rows = status
      ? db.prepare('SELECT o.*, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.status = ? ORDER BY o.id DESC').all(status)
      : db.prepare('SELECT o.*, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 500').all();
    return { orders: rows.map((o) => ({ ...serializeOrder(db, o), email: o.email, enrollment: db.prepare('SELECT id, status FROM enrollments WHERE order_id = ?').get(o.id) || null })) };
  }));

  // 결제 링크·계좌 등 자동 확인이 안 되는 결제: 결제내역 확인 후 관리자가 승인
  router.post('/api/admin/orders/:orderNo/confirm-manual', A(async (req, res, { params, body, user }) => {
    const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(params.orderNo);
    if (!order) fail(404, 'not_found');
    const reference = str(body.reference, 200);
    if (!reference) fail(400, 'reference_required');
    const paidMajor = Number(body.paidAmount);
    if (toMinor(paidMajor, order.currency) !== order.amount) fail(400, 'amount_mismatch');
    if (!['pending', 'awaiting_confirmation', 'expired', 'failed'].includes(order.status)) fail(409, 'order_not_payable');
    const r = applyPaid(db, order.id, { reference, actor: user, source: 'manual' });
    if (r.newlyPaid) {
      const u = db.prepare('SELECT email FROM users WHERE id = ?').get(order.user_id);
      const c = db.prepare('SELECT title_ko FROM courses WHERE id = ?').get(order.course_id);
      await mailer.send(db, u.email, 'payment_paid', { site: site(), course: c.title_ko, orderNo: order.order_no, amount: formatMoney(order.amount, order.currency) });
    }
    return { order: serializeOrder(db, r.order), duplicate: r.duplicate };
  }));

  router.post('/api/admin/orders/:orderNo/resolve-review', A((req, res, { params, body, user }) => {
    const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(params.orderNo);
    if (!order) fail(404, 'not_found');
    db.prepare('UPDATE orders SET needs_review = NULL, updated_at = ? WHERE id = ?').run(nowIso(), order.id);
    audit(db, user, 'order.review_resolved', order.order_no, { was: order.needs_review, note: str(body.note, 500) });
    return { ok: true };
  }));

  // 관리자가 직접 시작하는 환불 (요청 없이) — 요청 기록을 만들어 같은 절차로 처리
  router.post('/api/admin/orders/:orderNo/refund', A(async (req, res, { params, body, user }) => {
    const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(params.orderNo);
    if (!order || !['paid', 'partially_refunded'].includes(order.status)) fail(409, 'not_refundable');
    const r = db.prepare('INSERT INTO refund_requests(order_id, user_id, reason) VALUES (?,?,?)').run(order.id, order.user_id, '[관리자] ' + str(body.note, 500));
    const out = await processRefund(db, payments, user, r.lastInsertRowid, {
      approve: true, amount: toMinor(body.amount, order.currency), revokeAccess: !!body.revokeAccess, note: str(body.note, 500), manualReference: str(body.manualReference, 200)
    });
    await notifyRefund(out.order, 'processed', toMinor(body.amount, order.currency), body.note);
    return { order: serializeOrder(db, out.order) };
  }));

  router.post('/api/admin/enrollments/:id/:action', A((req, res, { params, body, user }) => {
    if (!['revoke', 'restore'].includes(params.action)) fail(404, 'not_found');
    const e = db.prepare('SELECT e.*, o.order_no, o.status ostatus FROM enrollments e JOIN orders o ON o.id = e.order_id WHERE e.id = ?').get(int(params.id));
    if (!e) fail(404, 'not_found');
    if (params.action === 'restore' && e.ostatus === 'refunded') fail(409, 'order_refunded');
    db.prepare('UPDATE enrollments SET status = ? WHERE id = ?').run(params.action === 'revoke' ? 'revoked' : 'active', e.id);
    audit(db, user, `enrollment.${params.action}`, e.order_no, { reason: str(body.reason, 500) });
    return { ok: true };
  }));

  // ── 취소·환불 ─────────────────────────────
  router.get('/api/admin/refunds', A(() => ({
    refunds: db.prepare(`SELECT r.*, o.order_no, o.amount, o.refunded_amount, o.currency, o.provider, o.status order_status, u.email
      FROM refund_requests r JOIN orders o ON o.id = r.order_id JOIN users u ON u.id = r.user_id ORDER BY r.id DESC`).all()
      .map((r) => ({ ...r, amountMajor: toMajor(r.amount, r.currency), refundedMajor: toMajor(r.refunded_amount, r.currency),
        approvedMajor: r.approved_amount != null ? toMajor(r.approved_amount, r.currency) : null,
        refundPolicy: JSON.parse(db.prepare('SELECT refund_policy_snapshot s FROM orders WHERE order_no = ?').get(r.order_no).s || '{}') }))
  })));

  router.post('/api/admin/refunds/:id', A(async (req, res, { params, body, user }) => {
    const reqRow = db.prepare('SELECT r.*, o.currency FROM refund_requests r JOIN orders o ON o.id = r.order_id WHERE r.id = ?').get(int(params.id));
    if (!reqRow) fail(404, 'not_found');
    const amount = body.approve ? toMinor(body.amount, reqRow.currency) : null;
    const out = await processRefund(db, payments, user, reqRow.id, {
      approve: !!body.approve, amount, revokeAccess: !!body.revokeAccess, note: str(body.note, 1000), manualReference: str(body.manualReference, 200)
    });
    await notifyRefund(out.order, out.status, amount, body.note);
    return { status: out.status, order: serializeOrder(db, out.order) };
  }));

  async function notifyRefund(order, status, amount, note) {
    const u = db.prepare('SELECT email FROM users WHERE id = ?').get(order.user_id);
    await mailer.send(db, u.email, 'refund_result', {
      site: site(), orderNo: order.order_no, status: status === 'rejected' ? '반려 Rejected' : '처리 완료 Processed',
      amount: amount ? formatMoney(amount, order.currency) : '-', note: str(note, 1000)
    });
  }

  // ── 학습 자료·출석·진도 ───────────────────
  router.get('/api/admin/materials', A(() => ({ materials: db.prepare('SELECT * FROM materials ORDER BY course_id, lesson_no, id').all() })));
  router.post('/api/admin/materials', A((req, res, { body, user }) => {
    if (!body.rights_confirmed) fail(400, 'rights_confirmation_required');
    const r = db.prepare('INSERT INTO materials(course_id, section_id, lesson_no, kind, title, url, rights_confirmed) VALUES (?,?,?,?,?,?,1)')
      .run(int(body.course_id, { min: 1 }), int(body.section_id, { min: 1, allowNull: true }), int(body.lesson_no, { min: 1, allowNull: true }),
        ['file', 'recording', 'link'].includes(body.kind) ? body.kind : 'file', str(body.title, 200) || fail(400, 'missing_fields'), safeUrl(body.url) || fail(400, 'invalid_url'));
    audit(db, user, 'material.create', r.lastInsertRowid);
    return { id: r.lastInsertRowid };
  }));
  router.delete('/api/admin/materials/:id', A((req, res, { params, user }) => {
    db.prepare('DELETE FROM materials WHERE id = ?').run(int(params.id));
    audit(db, user, 'material.delete', params.id);
    return { ok: true };
  }));

  router.get('/api/admin/review-items', A(() => ({ items: db.prepare('SELECT * FROM review_items ORDER BY course_id, lesson_no, id').all() })));
  router.post('/api/admin/review-items', A((req, res, { body }) => {
    const choices = (Array.isArray(body.choices) ? body.choices : String(body.choices || '').split('\n')).map((c) => str(c, 200)).filter(Boolean);
    if (choices.length < 2) fail(400, 'missing_fields');
    const r = db.prepare('INSERT INTO review_items(course_id, lesson_no, prompt, choices, answer) VALUES (?,?,?,?,?)')
      .run(int(body.course_id, { min: 1 }), int(body.lesson_no, { min: 1, allowNull: true }), str(body.prompt, 500), JSON.stringify(choices), int(body.answer ?? 0, { min: 0, max: choices.length - 1 }));
    return { id: r.lastInsertRowid };
  }));
  router.delete('/api/admin/review-items/:id', A((req, res, { params }) => {
    db.prepare('DELETE FROM review_items WHERE id = ?').run(int(params.id));
    return { ok: true };
  }));

  router.get('/api/admin/sections/:id/roster', A((req, res, { params }) => {
    const id = int(params.id);
    const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(id);
    if (!section) fail(404, 'not_found');
    const sessions = db.prepare('SELECT id, no, starts_at FROM class_sessions WHERE section_id = ? ORDER BY no').all(id);
    const lessonTotal = db.prepare('SELECT COUNT(*) n FROM lessons WHERE course_id = ?').get(section.course_id).n;
    const learners = db.prepare(`SELECT e.id enrollment_id, e.status, u.id user_id, u.email, u.display_name
      FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.section_id = ? ORDER BY u.email`).all(id).map((l) => ({
      ...l,
      attendance: Object.fromEntries(db.prepare('SELECT session_id, status FROM attendance WHERE user_id = ? AND session_id IN (SELECT id FROM class_sessions WHERE section_id = ?)')
        .all(l.user_id, id).map((a) => [a.session_id, a.status])),
      progress: lessonTotal ? Math.round(db.prepare('SELECT COUNT(*) n FROM progress WHERE user_id = ? AND course_id = ?').get(l.user_id, section.course_id).n / lessonTotal * 100) : 0
    }));
    return { section, sessions, learners };
  }));
  router.put('/api/admin/attendance', A((req, res, { body, user }) => {
    const status = ['present', 'late', 'absent', 'excused'].includes(body.status) ? body.status : fail(400, 'invalid_status');
    const sessionId = int(body.sessionId, { min: 1 }), userId = int(body.userId, { min: 1 });
    const enrolled = db.prepare(`SELECT 1 FROM enrollments e JOIN class_sessions cs ON cs.section_id = e.section_id
                                 WHERE cs.id = ? AND e.user_id = ?`).get(sessionId, userId);
    if (!enrolled) fail(400, 'not_enrolled');
    db.prepare('INSERT INTO attendance(session_id, user_id, status) VALUES (?,?,?) ON CONFLICT(session_id, user_id) DO UPDATE SET status = excluded.status')
      .run(sessionId, userId, status);
    return { ok: true };
  }));

  // ── 문의·공지·FAQ ─────────────────────────
  router.get('/api/admin/inquiries', A(() => ({ inquiries: db.prepare('SELECT * FROM inquiries ORDER BY id DESC').all() })));
  router.put('/api/admin/inquiries/:id', A(async (req, res, { params, body, user }) => {
    const q = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(int(params.id));
    if (!q) fail(404, 'not_found');
    const reply = str(body.admin_reply, 4000);
    const status = ['open', 'answered', 'closed'].includes(body.status) ? body.status : q.status;
    db.prepare('UPDATE inquiries SET admin_reply = ?, status = ? WHERE id = ?').run(reply, status, q.id);
    let emailStatus = null;
    if (body.sendEmail && reply && EMAIL_RE.test(q.email)) emailStatus = await mailer.send(db, q.email, 'inquiry_reply', { site: site(), reply });
    audit(db, user, 'inquiry.update', q.id, { status, emailStatus });
    return { ok: true, emailStatus };
  }));

  for (const [table, fields] of [
    ['notices', ['title_ko', 'title_en', 'body_ko', 'body_en', 'published']],
    ['faqs', ['sort', 'q_ko', 'q_en', 'a_ko', 'a_en']]
  ]) {
    const vals = (b) => fields.map((f) => (f === 'published' ? (b[f] ? 1 : 0) : f === 'sort' ? int(b[f] ?? 0, { min: 0, max: 999 }) : str(b[f], 5000)));
    router.get(`/api/admin/${table}`, A(() => ({ items: db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all() })));
    router.post(`/api/admin/${table}`, A((req, res, { body, user }) => {
      const r = db.prepare(`INSERT INTO ${table}(${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...vals(body));
      audit(db, user, `${table}.create`, r.lastInsertRowid);
      return { id: r.lastInsertRowid };
    }));
    router.put(`/api/admin/${table}/:id`, A((req, res, { params, body, user }) => {
      db.prepare(`UPDATE ${table} SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(...vals(body), int(params.id));
      audit(db, user, `${table}.update`, params.id);
      return { ok: true };
    }));
    router.delete(`/api/admin/${table}/:id`, A((req, res, { params, user }) => {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(int(params.id));
      audit(db, user, `${table}.delete`, params.id);
      return { ok: true };
    }));
  }

  router.get('/api/admin/emails', A(() => ({ emails: db.prepare('SELECT * FROM email_outbox ORDER BY id DESC LIMIT 300').all() })));
  router.get('/api/admin/audit', A(() => ({ entries: db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 500').all() })));
  router.get('/api/admin/payment-events', A(() => ({ events: db.prepare('SELECT id, provider, event_key, order_no, kind, result, created_at FROM payment_events ORDER BY id DESC LIMIT 300').all() })));

}
