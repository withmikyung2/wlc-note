import { getSettings, audit, tx, nowIso } from '../db.js';
import { fail, str, int, EMAIL_RE } from '../http.js';
import {
  hashPassword, verifyPassword, validatePassword, createSession, destroySession, publicUser,
  checkRateLimit, clearRateLimit, randomToken, sha256, verifyTotp
} from '../auth.js';
import {
  createOrder, startPayment, confirmPayment, markFailed, ownOrder, handleWebhook, expireHolds
} from '../orders.js';
import { serializeCourse, serializeOrder } from '../serialize.js';
import { formatMoney, toMajor } from '../payments.js';

const PUBLIC_SETTING_KEYS = [
  'site_name_ko', 'site_name_en', 'tagline_ko', 'tagline_en', 'intro_ko', 'intro_en', 'org_name', 'representative',
  'business_reg_no', 'mail_order_reg_no', 'address', 'contact_email', 'phone', 'privacy_officer',
  'terms_ko', 'terms_en', 'privacy_ko', 'privacy_en', 'refund_general_ko', 'refund_general_en', 'reference_rates'
];

const LEVELS = ['none', 'beginner', 'elementary', 'intermediate', 'advanced'];
const PURPOSES = ['study', 'daily', 'work', 'friends', 'travel', 'family', 'culture', 'hobby'];
const FORMATS = ['group', 'private', 'recorded'];

export function publicBootstrap(ctx) {
  const { db, payments, mailer } = ctx;
  const s = getSettings(db);
  const settings = Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, s[k] ?? '']));
  const courses = db.prepare("SELECT * FROM courses WHERE status = 'published' ORDER BY sort, id").all()
    .map((c) => serializeCourse(db, c));
  const instructors = db.prepare('SELECT * FROM instructors WHERE published = 1 ORDER BY id').all().map((i) => ({
    id: i.id, name: { ko: i.name_ko, en: i.name_en }, bio: { ko: i.bio_ko, en: i.bio_en },
    qualifications: i.qualifications, career: i.career, photoUrl: i.photo_url
  }));
  const faqs = db.prepare('SELECT * FROM faqs ORDER BY sort, id').all()
    .map((f) => ({ id: f.id, q: { ko: f.q_ko, en: f.q_en }, a: { ko: f.a_ko, en: f.a_en } }));
  const notices = db.prepare('SELECT * FROM notices WHERE published = 1 ORDER BY id DESC LIMIT 5').all()
    .map((n) => ({ id: n.id, title: { ko: n.title_ko, en: n.title_en }, body: { ko: n.body_ko, en: n.body_en }, createdAt: n.created_at }));
  const p = payments.active();
  return {
    settings, courses, instructors, faqs, notices,
    payment: { mode: p.name, live: p.live, configured: p.configured },
    email: { configured: mailer.configured },
    serverConnected: true
  };
}

export function registerSite(router, ctx) {
  const { db, config, payments, mailer } = ctx;
  const site = () => getSettings(db).site_name_ko || 'Korean Together';

  router.get('/api/public/bootstrap', () => publicBootstrap(ctx));

  router.post('/api/public/inquiries', async (req, res, { body, user }) => {
    const email = user ? user.email : str(body.email, 200);
    if (!EMAIL_RE.test(email)) fail(400, 'invalid_email');
    const subject = str(body.subject, 200), text = str(body.body, 4000);
    if (!subject || !text) fail(400, 'missing_fields');
    checkRateLimit('inq:' + (req.socket.remoteAddress || ''), { max: 10, windowMs: 3600e3 });
    const kind = ['general', 'consult', 'trial', 'refund', 'tech'].includes(body.kind) ? body.kind : 'general';
    db.prepare('INSERT INTO inquiries(user_id, email, kind, subject, body) VALUES (?,?,?,?,?)').run(user?.id ?? null, email, kind, subject, text);
    return { ok: true };
  });

  // ── 회원 ───────────────────────────────────
  router.post('/api/auth/signup', async (req, res, { body }) => {
    const email = str(body.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) fail(400, 'invalid_email');
    validatePassword(body.password);
    if (!body.agreeTerms || !body.agreePrivacy) fail(400, 'consent_required');
    checkRateLimit('signup:' + (req.socket.remoteAddress || ''), { max: 20, windowMs: 3600e3 });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'email_taken');
    const r = db.prepare('INSERT INTO users(email, password_hash, display_name, timezone) VALUES (?,?,?,?)')
      .run(email, hashPassword(body.password), str(body.displayName, 80), str(body.timezone, 60));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    createSession(db, res, user, { secure: config.secureCookies });
    const emailStatus = await mailer.send(db, email, 'signup', { site: site() });
    return { user: publicUser(user), emailStatus };
  });

  router.post('/api/auth/login', async (req, res, { body }) => {
    const email = str(body.email, 200).toLowerCase();
    const key = 'login:' + email;
    checkRateLimit(key);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(String(body.password || ''), user.password_hash)) fail(401, 'invalid_credentials');
    let mfaPassed = false;
    if (user.role === 'admin' && user.totp_enabled) {
      if (!body.otp) return { mfaRequired: true };
      if (!verifyTotp(user.totp_secret, body.otp)) fail(401, 'invalid_otp');
      mfaPassed = true;
    }
    clearRateLimit(key);
    createSession(db, res, user, { mfaPassed, secure: config.secureCookies });
    if (user.role === 'admin') audit(db, user, 'admin.login', user.email, { mfa: mfaPassed });
    return { user: publicUser(user) };
  });

  router.post('/api/auth/logout', (req, res) => { destroySession(db, req, res, config.secureCookies); return { ok: true }; });
  router.get('/api/auth/me', (req, res, { user }) => ({ user: publicUser(user) }));

  router.post('/api/auth/forgot', async (req, res, { body }) => {
    const email = str(body.email, 200).toLowerCase();
    checkRateLimit('forgot:' + email, { max: 5, windowMs: 3600e3 });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    let emailStatus = mailer.configured ? 'sent' : 'not_configured';
    if (user) {
      const token = randomToken();
      db.prepare('INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES (?,?,?)')
        .run(sha256(token), user.id, new Date(Date.now() + 3600e3).toISOString());
      const link = `${config.publicBaseUrl}/#/reset?token=${token}`;
      emailStatus = await mailer.send(db, email, 'password_reset', { site: site(), link });
      if (!config.production && emailStatus !== 'sent') console.log(`[dev] 비밀번호 재설정 링크 (${email}): ${link}`);
    }
    // 가입 여부를 노출하지 않음
    return { ok: true, emailStatus };
  });

  router.post('/api/auth/reset', (req, res, { body }) => {
    validatePassword(body.password);
    const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(sha256(String(body.token || '')));
    if (!row || row.used_at || row.expires_at < nowIso()) fail(400, 'invalid_token');
    tx(db, () => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), row.user_id);
      db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').run(nowIso(), row.token_hash);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    });
    return { ok: true };
  });

  router.put('/api/me/profile', (req, res, { body, user }) => {
    ctx.requireUser(user);
    db.prepare('UPDATE users SET display_name = ?, timezone = ? WHERE id = ?').run(str(body.displayName, 80), str(body.timezone, 60), user.id);
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) };
  });

  // ── 수강 신청·결제 ─────────────────────────
  router.post('/api/checkout/orders', async (req, res, { body, user }) => {
    ctx.requireUser(user);
    const a = body.applicant || {};
    const applicant = {
      name: str(a.name, 80), email: user.email, country: str(a.country, 80), timezone: str(a.timezone, 60),
      level: LEVELS.includes(a.level) ? a.level : '', purpose: PURPOSES.includes(a.purpose) ? a.purpose : '',
      format: FORMATS.includes(a.format) ? a.format : ''
    };
    if (!applicant.name || !applicant.country || !applicant.timezone || !applicant.level || !applicant.purpose || !applicant.format) fail(400, 'missing_fields');
    const c = body.consents || {};
    if (!c.terms || !c.privacy || !c.refund) fail(400, 'consent_required');
    const consents = { terms: true, privacy: true, refund: true, marketing: !!c.marketing, at: nowIso() };
    const idempotencyKey = str(body.idempotencyKey, 80);
    if (idempotencyKey.length < 8) fail(400, 'missing_idempotency_key');
    const { order, reused } = createOrder(db, payments, config, user, {
      sectionId: int(body.sectionId, { min: 1 }), applicant, consents, idempotencyKey
    });
    if (!reused) {
      const course = db.prepare('SELECT title_ko FROM courses WHERE id = ?').get(order.course_id);
      await mailer.send(db, user.email, 'order_created', {
        site: site(), course: course.title_ko, orderNo: order.order_no, amount: formatMoney(order.amount, order.currency)
      });
    }
    return { order: serializeOrder(db, order), reused };
  });

  router.get('/api/checkout/orders/:orderNo', (req, res, { params, user }) => {
    ctx.requireUser(user);
    expireHolds(db);
    return { order: serializeOrder(db, ownOrder(db, user, params.orderNo)) };
  });

  router.post('/api/checkout/orders/:orderNo/pay', (req, res, { params, user }) => {
    ctx.requireUser(user);
    const r = startPayment(db, payments, config, user, params.orderNo);
    audit(db, user, 'payment.start', r.order.order_no, { provider: r.order.provider, attempt: r.order.attempt });
    return { order: serializeOrder(db, r.order), checkout: r.checkout, live: r.live, holdExpiresAt: r.holdExpiresAt };
  });

  router.post('/api/checkout/confirm', async (req, res, { body, user }) => {
    ctx.requireUser(user);
    const r = await confirmPayment(db, payments, user, { paymentKey: body.paymentKey, orderId: body.orderId, amount: body.amount });
    if (r.newlyPaid) await notifyPaid(r.order);
    return { order: serializeOrder(db, r.order), duplicate: !!r.duplicate };
  });

  router.post('/api/checkout/fail', (req, res, { body, user }) => {
    ctx.requireUser(user);
    const order = db.prepare('SELECT * FROM orders WHERE provider_order_id = ?').get(str(body.orderId, 80));
    if (!order || order.user_id !== user.id) fail(404, 'not_found');
    markFailed(db, user, order, str(body.code, 80) || 'user_failed');
    return { order: serializeOrder(db, db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) };
  });

  // 결제 링크 방식: 학습자가 '결제 완료'를 알리면 관리자 확인 대기 (이 자체로 수강 등록하지 않음)
  router.post('/api/checkout/orders/:orderNo/reported-paid', (req, res, { params, user }) => {
    ctx.requireUser(user);
    const order = ownOrder(db, user, params.orderNo);
    if (order.provider !== 'link' || order.status !== 'pending') fail(409, 'order_not_payable');
    db.prepare("UPDATE orders SET status = 'awaiting_confirmation', hold_expires_at = ?, updated_at = ? WHERE id = ?")
      .run(new Date(Date.now() + 72 * 3600e3).toISOString(), nowIso(), order.id);
    audit(db, user, 'payment.reported_by_learner', order.order_no, {});
    return { order: serializeOrder(db, db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) };
  });

  router.post('/api/checkout/orders/:orderNo/cancel', (req, res, { params, user }) => {
    ctx.requireUser(user);
    const order = ownOrder(db, user, params.orderNo);
    if (!['pending', 'failed', 'expired'].includes(order.status)) fail(409, 'order_not_cancellable');
    db.prepare("UPDATE orders SET status = 'cancelled', hold_expires_at = NULL, updated_at = ? WHERE id = ?").run(nowIso(), order.id);
    audit(db, user, 'order.cancel', order.order_no, {});
    return { ok: true };
  });

  // 테스트 결제창 (PAYMENT_MODE=test 일 때만). 카드 정보를 받지 않고 결과만 선택함.
  router.post('/api/test-gateway/authorize', (req, res, { body }) => {
    if (payments.active().name !== 'test') fail(404, 'not_found');
    const r = payments.get('test').authorize(str(body.orderId, 80), body.outcome);
    if (!r) fail(404, 'not_found');
    return r;
  });

  router.post('/api/payments/webhook/:provider', async (req, res, { params, body }) => {
    const r = await handleWebhook(db, payments, params.provider, body);
    if (r.newlyPaid) await notifyPaid(r.order);
    return { ok: true, duplicate: !!r.duplicate };
  });

  async function notifyPaid(order) {
    const u = db.prepare('SELECT email FROM users WHERE id = ?').get(order.user_id);
    const course = db.prepare('SELECT title_ko FROM courses WHERE id = ?').get(order.course_id);
    await mailer.send(db, u.email, 'payment_paid', { site: site(), course: course.title_ko, orderNo: order.order_no, amount: formatMoney(order.amount, order.currency) });
  }

  // ── 나의 학습 ──────────────────────────────
  router.get('/api/me/dashboard', (req, res, { user }) => {
    ctx.requireUser(user);
    expireHolds(db);
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(user.id).map((o) => serializeOrder(db, o));
    const enrollments = db.prepare(`SELECT e.id, e.status, e.section_id, s.course_id, s.format, s.timezone, s.label_ko, s.label_en,
        c.title_ko, c.title_en, c.slug, o.order_no
      FROM enrollments e JOIN sections s ON s.id = e.section_id JOIN courses c ON c.id = s.course_id JOIN orders o ON o.id = e.order_id
      WHERE e.user_id = ? ORDER BY e.id DESC`).all(user.id);
    const now = Date.now();
    const learning = enrollments.map((e) => {
      const active = e.status === 'active';
      const sessions = db.prepare('SELECT id, no, starts_at, meeting_url FROM class_sessions WHERE section_id = ? ORDER BY no').all(e.section_id)
        .map((s) => {
          const att = db.prepare('SELECT status FROM attendance WHERE session_id = ? AND user_id = ?').get(s.id, user.id);
          return {
            id: s.id, no: s.no, startsAt: s.starts_at, attendance: att?.status || null,
            // 수강 권한이 유효한 본인에게만 링크 제공
            meetingUrl: active && s.meeting_url ? s.meeting_url : null
          };
        });
      const lessons = db.prepare('SELECT no, title_ko, title_en FROM lessons WHERE course_id = ? ORDER BY no').all(e.course_id);
      const done = db.prepare('SELECT lesson_no FROM progress WHERE user_id = ? AND course_id = ?').all(user.id, e.course_id).map((r) => r.lesson_no);
      const materials = active
        ? db.prepare(`SELECT id, lesson_no, kind, title, url FROM materials WHERE course_id = ? AND rights_confirmed = 1
                      AND (section_id IS NULL OR section_id = ?) ORDER BY lesson_no, id`).all(e.course_id, e.section_id)
        : [];
      const review = active
        ? db.prepare('SELECT id, lesson_no, prompt, choices, answer FROM review_items WHERE course_id = ? ORDER BY lesson_no, id').all(e.course_id)
          .map((r) => ({ ...r, choices: JSON.parse(r.choices) }))
        : [];
      const next = sessions.find((s) => Date.parse(s.startsAt) > now - 90 * 60e3) || null;
      return {
        enrollmentId: e.id, status: e.status, orderNo: e.order_no, courseId: e.course_id, slug: e.slug,
        course: { ko: e.title_ko, en: e.title_en }, section: { ko: e.label_ko, en: e.label_en }, format: e.format, timezone: e.timezone,
        sessions, nextSession: next,
        lessons: lessons.map((l) => ({ no: l.no, title: { ko: l.title_ko, en: l.title_en }, done: done.includes(l.no) })),
        progress: lessons.length ? Math.round((done.length / lessons.length) * 100) : 0,
        materials, review
      };
    });
    const favorites = db.prepare('SELECT id, phrase, meaning FROM favorites WHERE user_id = ? ORDER BY id DESC').all(user.id);
    const refunds = db.prepare(`SELECT r.id, r.status, r.reason, r.approved_amount, r.admin_note, r.created_at, o.order_no, o.currency
      FROM refund_requests r JOIN orders o ON o.id = r.order_id WHERE r.user_id = ? ORDER BY r.id DESC`).all(user.id)
      .map((r) => ({ ...r, approvedMajor: r.approved_amount != null ? toMajor(r.approved_amount, r.currency) : null }));
    const inquiries = db.prepare('SELECT id, kind, subject, status, admin_reply, created_at FROM inquiries WHERE user_id = ? ORDER BY id DESC').all(user.id);
    return { user: publicUser(user), orders, learning, favorites, refunds, inquiries };
  });

  function requireEnrolled(user, courseId) {
    const ok = db.prepare(`SELECT 1 FROM enrollments e JOIN sections s ON s.id = e.section_id
                           WHERE e.user_id = ? AND s.course_id = ? AND e.status = 'active'`).get(user.id, courseId);
    if (!ok) fail(403, 'not_enrolled');
  }

  router.post('/api/me/progress', (req, res, { body, user }) => {
    ctx.requireUser(user);
    const courseId = int(body.courseId, { min: 1 }), lessonNo = int(body.lessonNo, { min: 1 });
    requireEnrolled(user, courseId);
    if (body.done) db.prepare('INSERT OR IGNORE INTO progress(user_id, course_id, lesson_no) VALUES (?,?,?)').run(user.id, courseId, lessonNo);
    else db.prepare('DELETE FROM progress WHERE user_id = ? AND course_id = ? AND lesson_no = ?').run(user.id, courseId, lessonNo);
    return { ok: true };
  });

  router.post('/api/me/favorites', (req, res, { body, user }) => {
    ctx.requireUser(user);
    const phrase = str(body.phrase, 200);
    if (!phrase) fail(400, 'missing_fields');
    db.prepare('INSERT OR IGNORE INTO favorites(user_id, phrase, meaning) VALUES (?,?,?)').run(user.id, phrase, str(body.meaning, 300));
    return { ok: true };
  });

  router.delete('/api/me/favorites/:id', (req, res, { params, user }) => {
    ctx.requireUser(user);
    db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?').run(int(params.id), user.id);
    return { ok: true };
  });

  router.get('/api/me/orders/:orderNo/receipt', (req, res, { params, user }) => {
    ctx.requireUser(user);
    const order = ownOrder(db, user, params.orderNo);
    if (!['paid', 'partially_refunded', 'refunded'].includes(order.status)) fail(409, 'not_paid');
    const s = getSettings(db);
    return {
      receipt: serializeOrder(db, order),
      issuer: { org: s.org_name, representative: s.representative, businessRegNo: s.business_reg_no, address: s.address, email: s.contact_email },
      note: '본 확인서는 수강료 결제 확인용입니다. 카드 매출전표는 결제서비스에서 발급됩니다.'
    };
  });

  router.post('/api/me/refund-requests', (req, res, { body, user }) => {
    ctx.requireUser(user);
    const order = ownOrder(db, user, str(body.orderNo, 40));
    if (!['paid', 'partially_refunded'].includes(order.status)) fail(409, 'not_refundable');
    const reason = str(body.reason, 2000);
    if (!reason) fail(400, 'missing_fields');
    const open = db.prepare("SELECT 1 FROM refund_requests WHERE order_id = ? AND status IN ('requested','approved')").get(order.id);
    if (open) fail(409, 'refund_already_requested');
    db.prepare('INSERT INTO refund_requests(order_id, user_id, reason) VALUES (?,?,?)').run(order.id, user.id, reason);
    audit(db, user, 'refund.request', order.order_no, {});
    return { ok: true };
  });
}
