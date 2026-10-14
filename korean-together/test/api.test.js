import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, loadConfig } from '../server/app.js';
import { hashPassword, totpCode } from '../server/auth.js';

let app, base;

before(async () => {
  app = createApp({ ...loadConfig({}), databasePath: ':memory:', seatHoldMinutes: 15 });
  await new Promise((r) => app.server.listen(0, r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  app.db.prepare("INSERT INTO users(email, password_hash, role) VALUES ('admin@test.local', ?, 'admin')").run(hashPassword('admin-password-1'));
});
after(() => app.server.close());

function client() {
  let cookie = '';
  return async function call(method, path, body, { raw = false, headers = {} } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-KT-Request': '1', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await res.json().catch(() => ({}));
    if (raw) return { status: res.status, data };
    if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status} ${data.error}`), { status: res.status, data });
    return data;
  };
}

const admin = client();
let courseId, sectionId, smallSectionId;

async function signup(email) {
  const c = client();
  await c('POST', '/api/auth/signup', { email, password: 'learner-pass-1', agreeTerms: true, agreePrivacy: true, timezone: 'America/New_York' });
  return c;
}

const applicant = { name: 'Maria', country: 'USA', timezone: 'America/New_York', level: 'none', purpose: 'travel', format: 'group' };
const consents = { terms: true, privacy: true, refund: true };
let idem = 0;
const order = (c, secId) => c('POST', '/api/checkout/orders', { sectionId: secId, applicant, consents, idempotencyKey: `idem-key-${++idem}` });

async function payTest(c, orderNo, { outcome = 'success', tamper = 0 } = {}) {
  const start = await c('POST', `/api/checkout/orders/${orderNo}/pay`);
  const auth = await c('POST', '/api/test-gateway/authorize', { orderId: start.checkout.orderId, outcome });
  if (!auth.ok) return { start, auth };
  const confirm = await c('POST', '/api/checkout/confirm', { paymentKey: auth.paymentKey, orderId: auth.orderId, amount: auth.amount + tamper }, { raw: true });
  return { start, auth, confirm };
}

test('관리자 로그인 + 과정 가격·환불정책·반·일정 설정', async () => {
  await admin('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admin-password-1' });
  await admin('PUT', '/api/admin/settings', { terms_ko: '테스트 약관', privacy_ko: '테스트 처리방침' });
  const { courses } = await admin('GET', '/api/admin/courses');
  const c = courses.find((x) => x.slug === 'hangul-first-steps');
  courseId = c.id;
  assert.equal(c.price, null, '기본 가격은 비어 있어야 함 (임의 가격 금지)');
  await admin('PUT', `/api/admin/courses/${courseId}`, {
    slug: c.slug, title_ko: c.title.ko, title_en: c.title.en, formats: c.formats, purposes: c.purposes,
    price: 120000, currency: 'KRW', refund_policy_ko: '테스트 환불 기준', refund_policy_en: 'Test policy',
    lessons: c.lessons.map((l) => ({ title_ko: l.title.ko, title_en: l.title.en }))
  });
  sectionId = (await admin('POST', '/api/admin/sections', { course_id: courseId, label_ko: 'A반', format: 'group', capacity: 5, status: 'open', timezone: 'Asia/Seoul' })).id;
  const t = Date.now() + 7 * 864e5;
  await admin('PUT', `/api/admin/sections/${sectionId}/sessions`, {
    sessions: [{ startsAt: new Date(t).toISOString(), meetingUrl: 'https://meet.example.com/secret-room' }, { startsAt: new Date(t + 864e5).toISOString() }]
  });
  smallSectionId = (await admin('POST', '/api/admin/sections', { course_id: courseId, label_ko: '1석반', format: 'group', capacity: 1, status: 'open' })).id;
  await admin('PUT', `/api/admin/sections/${smallSectionId}/sessions`, { sessions: [{ startsAt: new Date(t).toISOString() }] });
});

test('공개 정보: 미정 가격·일정은 결제 불가, 화상 링크 비노출, 가짜 사업자정보 없음', async () => {
  const pub = client();
  const b = await pub('GET', '/api/public/bootstrap');
  const daily = b.courses.find((c) => c.slug === 'everyday-korean');
  assert.equal(daily.price, null);
  assert.equal(b.settings.org_name, '');
  assert.equal(b.payment.live, false);
  const hangul = b.courses.find((c) => c.id === courseId);
  const sec = hangul.sections.find((s) => s.id === sectionId);
  assert.equal(sec.purchasable, true);
  assert.ok(!JSON.stringify(b).includes('secret-room'), '공개 응답에 화상 링크 포함 금지');
});

test('가격 미정 과정은 주문 생성 차단', async () => {
  const { courses } = await admin('GET', '/api/admin/courses');
  const daily = courses.find((c) => c.slug === 'everyday-korean');
  const sec = (await admin('POST', '/api/admin/sections', { course_id: daily.id, label_ko: 'B', status: 'open', capacity: 3 })).id;
  await admin('PUT', `/api/admin/sections/${sec}/sessions`, { sessions: [{ startsAt: new Date(Date.now() + 864e5).toISOString() }] });
  const u = await signup('tbd@test.local');
  const r = await u('POST', '/api/checkout/orders', { sectionId: sec, applicant, consents, idempotencyKey: 'tbd-key-1' }, { raw: true });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'price_tbd');
});

test('필수 동의 없으면 신청 불가, 로그인 없으면 신청 불가', async () => {
  const anon = client();
  const r1 = await anon('POST', '/api/checkout/orders', { sectionId, applicant, consents, idempotencyKey: 'anon-key-1' }, { raw: true });
  assert.equal(r1.status, 401);
  const u = await signup('consent@test.local');
  const r2 = await u('POST', '/api/checkout/orders', { sectionId, applicant, consents: { terms: true }, idempotencyKey: 'c-key-1' }, { raw: true });
  assert.equal(r2.data.error, 'consent_required');
});

let learnerA, paidOrderNo;

test('결제 성공 → 서버 검증 후 수강 등록, 화상 링크는 본인에게만', async () => {
  learnerA = await signup('a@test.local');
  const { order: o } = await order(learnerA, sectionId);
  assert.equal(o.status, 'pending');
  assert.equal(o.amount, 120000);
  const { confirm } = await payTest(learnerA, o.orderNo);
  assert.equal(confirm.status, 200);
  assert.equal(confirm.data.order.status, 'paid');
  paidOrderNo = o.orderNo;
  const dash = await learnerA('GET', '/api/me/dashboard');
  assert.equal(dash.learning.length, 1);
  assert.equal(dash.learning[0].sessions[0].meetingUrl, 'https://meet.example.com/secret-room');
  const emails = await admin('GET', '/api/admin/emails');
  assert.ok(emails.emails.some((e) => e.template === 'payment_paid' && e.status === 'not_configured'), '미연결 시 발송 안 됨으로 기록');
});

test('결제창 복귀만으로는 완료 처리 안 됨 (승인 전 결제키 위조)', async () => {
  const u = await signup('forge@test.local');
  const { order: o } = await order(u, sectionId);
  const start = await u('POST', `/api/checkout/orders/${o.orderNo}/pay`);
  const r = await u('POST', '/api/checkout/confirm', { paymentKey: 'tpk_fake', orderId: start.checkout.orderId, amount: o.amount }, { raw: true });
  assert.equal(r.status, 402);
  const again = await u('GET', `/api/checkout/orders/${o.orderNo}`);
  assert.equal(again.order.status, 'failed');
  assert.equal((await u('GET', '/api/me/dashboard')).learning.length, 0);
});

test('결제금액 변조 차단', async () => {
  const u = await signup('tamper@test.local');
  const { order: o } = await order(u, sectionId);
  const { confirm } = await payTest(u, o.orderNo, { tamper: -119000 });
  assert.equal(confirm.status, 400);
  assert.equal(confirm.data.error, 'amount_mismatch');
  assert.equal((await u('GET', `/api/checkout/orders/${o.orderNo}`)).order.status, 'failed');
  const audit = await admin('GET', '/api/admin/audit');
  assert.ok(audit.entries.some((e) => e.action === 'payment.amount_mismatch'));
});

test('결제 실패 → 신청 정보 유지, 같은 주문으로 재시도 성공', async () => {
  const u = await signup('retry@test.local');
  const { order: o } = await order(u, sectionId);
  const first = await payTest(u, o.orderNo, { outcome: 'fail' });
  assert.equal(first.auth.ok, false);
  await u('POST', '/api/checkout/fail', { orderId: first.start.checkout.orderId, code: first.auth.code });
  const failed = await u('GET', `/api/checkout/orders/${o.orderNo}`);
  assert.equal(failed.order.status, 'failed');
  assert.equal(failed.order.applicant.name, 'Maria');
  const second = await payTest(u, o.orderNo);
  assert.equal(second.confirm.data.order.status, 'paid');
  assert.notEqual(first.start.checkout.orderId, second.start.checkout.orderId, '재시도마다 결제사 주문번호 새로 발급');
});

test('중복 클릭(같은 멱등키) → 주문 1건, 중복 승인·중복 웹훅 → 수강 등록 1건', async () => {
  const u = await signup('dup@test.local');
  const body = { sectionId, applicant, consents, idempotencyKey: 'same-key-123' };
  const [r1, r2] = await Promise.all([u('POST', '/api/checkout/orders', body), u('POST', '/api/checkout/orders', body)]);
  assert.equal(r1.order.orderNo, r2.order.orderNo);
  const { auth, confirm } = await payTest(u, r1.order.orderNo);
  assert.equal(confirm.data.order.status, 'paid');
  const again = await u('POST', '/api/checkout/confirm', { paymentKey: auth.paymentKey, orderId: auth.orderId, amount: auth.amount });
  assert.equal(again.duplicate, true);
  const hook = client();
  const w1 = await hook('POST', '/api/payments/webhook/test', { eventType: 'PAYMENT_STATUS_CHANGED', data: { paymentKey: auth.paymentKey, orderId: auth.orderId, status: 'DONE' } }, { headers: { 'X-KT-Request': '' } });
  const w2 = await hook('POST', '/api/payments/webhook/test', { eventType: 'PAYMENT_STATUS_CHANGED', data: { paymentKey: auth.paymentKey, orderId: auth.orderId, status: 'DONE' } }, { headers: { 'X-KT-Request': '' } });
  assert.equal(w2.duplicate, true);
  assert.ok(w1.ok);
  const n = app.db.prepare("SELECT COUNT(*) n FROM enrollments e JOIN orders o ON o.id = e.order_id WHERE o.order_no = ?").get(r1.order.orderNo).n;
  assert.equal(n, 1);
  const orders = app.db.prepare("SELECT COUNT(*) n FROM orders o JOIN users u ON u.id = o.user_id WHERE u.email = 'dup@test.local'").get().n;
  assert.equal(orders, 1);
});

test('웹훅 본문 위조(DONE 주장)는 결제사 조회 결과로 무시됨', async () => {
  const u = await signup('hook@test.local');
  const { order: o } = await order(u, sectionId);
  const start = await u('POST', `/api/checkout/orders/${o.orderNo}/pay`);
  const hook = client();
  const r = await hook('POST', '/api/payments/webhook/test', { data: { paymentKey: 'tpk_forged', orderId: start.checkout.orderId, status: 'DONE' } }, { raw: true });
  assert.equal(r.status, 404);
  assert.equal((await u('GET', `/api/checkout/orders/${o.orderNo}`)).order.status, 'pending');
  await u('POST', `/api/checkout/orders/${o.orderNo}/cancel`);
});

test('다른 학습자의 주문·영수증·환불·진도 접근 차단', async () => {
  const b = await signup('b@test.local');
  for (const [m, p, body] of [
    ['GET', `/api/checkout/orders/${paidOrderNo}`],
    ['GET', `/api/me/orders/${paidOrderNo}/receipt`],
    ['POST', '/api/me/refund-requests', { orderNo: paidOrderNo, reason: 'x' }],
    ['POST', `/api/checkout/orders/${paidOrderNo}/pay`]
  ]) {
    const r = await b(m, p, body, { raw: true });
    assert.equal(r.status, 404, `${m} ${p}`);
  }
  const prog = await b('POST', '/api/me/progress', { courseId, lessonNo: 1, done: true }, { raw: true });
  assert.equal(prog.status, 403);
  const dash = await b('GET', '/api/me/dashboard');
  assert.equal(dash.orders.length, 0);
  assert.ok(!JSON.stringify(dash).includes('secret-room'));
  const adm = await b('GET', '/api/admin/orders', null, { raw: true });
  assert.equal(adm.status, 403);
});

test('정원 마감 + 결제 진행 중 좌석 임시 확보', async () => {
  const u1 = await signup('seat1@test.local');
  const u2 = await signup('seat2@test.local');
  const { order: o1 } = await order(u1, smallSectionId);
  const r = await u2('POST', '/api/checkout/orders', { sectionId: smallSectionId, applicant, consents, idempotencyKey: 'seat-key-2' }, { raw: true });
  assert.equal(r.data.error, 'sold_out', '결제 진행 중 좌석은 다른 사람이 가져갈 수 없음');
  // 임시 확보 시간 만료 → 좌석 반환
  app.db.prepare("UPDATE orders SET hold_expires_at = '2000-01-01T00:00:00.000Z' WHERE order_no = ?").run(o1.orderNo);
  const { order: o2 } = await order(u2, smallSectionId);
  await payTest(u2, o2.orderNo);
  // 만료된 u1은 결제 재개 시 마감 안내
  const late = await u1('POST', `/api/checkout/orders/${o1.orderNo}/pay`, null, { raw: true });
  assert.equal(late.data.error, 'sold_out');
  const pub = await client()('GET', '/api/public/bootstrap');
  const sec = pub.courses.find((c) => c.id === courseId).sections.find((s) => s.id === smallSectionId);
  assert.equal(sec.remaining, 0);
  assert.ok(sec.blockedReasons.includes('sold_out'));
});

test('환불: 학습자 요청 → 관리자 부분 환불 → 전체 환불 시 수강 권한 회수', async () => {
  await learnerA('POST', '/api/me/refund-requests', { orderNo: paidOrderNo, reason: '일정 변경' });
  const dup = await learnerA('POST', '/api/me/refund-requests', { orderNo: paidOrderNo, reason: '다시' }, { raw: true });
  assert.equal(dup.data.error, 'refund_already_requested');
  let { refunds } = await admin('GET', '/api/admin/refunds');
  const req1 = refunds.find((r) => r.order_no === paidOrderNo);
  const over = await admin('POST', `/api/admin/refunds/${req1.id}`, { approve: true, amount: 999999 }, { raw: true });
  assert.equal(over.data.error, 'invalid_refund_amount');
  const p = await admin('POST', `/api/admin/refunds/${req1.id}`, { approve: true, amount: 20000, revokeAccess: false, note: '부분 환불' });
  assert.equal(p.order.status, 'partially_refunded');
  let dash = await learnerA('GET', '/api/me/dashboard');
  assert.equal(dash.learning[0].status, 'active');
  await learnerA('POST', '/api/me/refund-requests', { orderNo: paidOrderNo, reason: '전체 취소' });
  ({ refunds } = await admin('GET', '/api/admin/refunds'));
  const req2 = refunds.find((r) => r.order_no === paidOrderNo && r.status === 'requested');
  const f = await admin('POST', `/api/admin/refunds/${req2.id}`, { approve: true, amount: 100000, note: '잔액 환불' });
  assert.equal(f.order.status, 'refunded');
  dash = await learnerA('GET', '/api/me/dashboard');
  assert.equal(dash.learning[0].status, 'revoked');
  assert.equal(dash.learning[0].sessions[0].meetingUrl, null, '환불 후 화상 링크 비노출');
  const audit = await admin('GET', '/api/admin/audit');
  for (const a of ['refund.partial', 'refund.full', 'enrollment.revoke']) assert.ok(audit.entries.some((e) => e.action === a), a);
});

test('결제 링크 방식(A안): 학습자 신고만으로 등록 안 됨 → 관리자 확인 후 등록', async () => {
  const linkApp = createApp({ ...loadConfig({}), databasePath: ':memory:', paymentMode: 'link' });
  await new Promise((r) => linkApp.server.listen(0, r));
  const saved = base;
  base = `http://127.0.0.1:${linkApp.server.address().port}`;
  try {
    linkApp.db.prepare("INSERT INTO users(email, password_hash, role) VALUES ('admin@test.local', ?, 'admin')").run(hashPassword('admin-password-1'));
    const adm = client();
    await adm('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admin-password-1' });
    await adm('PUT', '/api/admin/settings', { terms_ko: '약관', privacy_ko: '처리방침' });
    const c = (await adm('GET', '/api/admin/courses')).courses[0];
    await adm('PUT', `/api/admin/courses/${c.id}`, { slug: c.slug, title_ko: c.title.ko, title_en: c.title.en, price: 50, currency: 'USD',
      refund_policy_ko: '기준', payment_link_url: 'https://pay.example.com/link/abc' });
    const sec = (await adm('POST', '/api/admin/sections', { course_id: c.id, capacity: 3, status: 'open', format: 'recorded' })).id;
    const u = await signup('link@test.local');
    const { order: o } = await order(u, sec);
    assert.equal(o.amount, 5000);
    assert.equal(o.currency, 'USD');
    const start = await u('POST', `/api/checkout/orders/${o.orderNo}/pay`);
    assert.equal(start.checkout.type, 'link');
    assert.ok(start.checkout.url.includes(o.orderNo));
    await u('POST', `/api/checkout/orders/${o.orderNo}/reported-paid`);
    assert.equal((await u('GET', '/api/me/dashboard')).learning.length, 0);
    const wrong = await adm('POST', `/api/admin/orders/${o.orderNo}/confirm-manual`, { reference: 'TX-1', paidAmount: 40 }, { raw: true });
    assert.equal(wrong.data.error, 'amount_mismatch');
    await adm('POST', `/api/admin/orders/${o.orderNo}/confirm-manual`, { reference: 'TX-1', paidAmount: 50 });
    assert.equal((await u('GET', '/api/me/dashboard')).learning.length, 1);
    const dup = await adm('POST', `/api/admin/orders/${o.orderNo}/confirm-manual`, { reference: 'TX-1', paidAmount: 50 }, { raw: true });
    assert.equal(dup.status, 409);
  } finally {
    base = saved;
    linkApp.server.close();
  }
});

test('관리자 2단계 인증: 활성화 후 OTP 없이는 관리자 API 불가', async () => {
  const a2 = client();
  app.db.prepare("INSERT INTO users(email, password_hash, role) VALUES ('admin2@test.local', ?, 'admin')").run(hashPassword('admin-password-2'));
  await a2('POST', '/api/auth/login', { email: 'admin2@test.local', password: 'admin-password-2' });
  const { secret } = await a2('POST', '/api/auth/mfa/setup');
  await a2('POST', '/api/auth/mfa/enable', { code: totpCode(secret) });
  const fresh = client();
  const step1 = await fresh('POST', '/api/auth/login', { email: 'admin2@test.local', password: 'admin-password-2' });
  assert.equal(step1.mfaRequired, true);
  assert.equal((await fresh('GET', '/api/admin/overview', null, { raw: true })).status, 401);
  const bad = await fresh('POST', '/api/auth/login', { email: 'admin2@test.local', password: 'admin-password-2', otp: '000000' }, { raw: true });
  assert.equal(bad.status, 401);
  await fresh('POST', '/api/auth/login', { email: 'admin2@test.local', password: 'admin-password-2', otp: totpCode(secret) });
  assert.ok((await fresh('GET', '/api/admin/overview')).checklist.length > 5);
});

test('CSRF: 사이트 헤더 없는 쓰기 요청 거부', async () => {
  const r = await fetch(base + '/api/auth/logout', { method: 'POST' });
  assert.equal(r.status, 403);
});

test('비밀번호 재설정: 이메일 미연결 상태를 그대로 알림, 토큰 1회용', async () => {
  const u = await signup('reset@test.local');
  const r = await u('POST', '/api/auth/forgot', { email: 'reset@test.local' });
  assert.equal(r.emailStatus, 'not_configured');
  const out = app.db.prepare("SELECT body FROM email_outbox WHERE template = 'password_reset' ORDER BY id DESC").get();
  assert.ok(!out.body.includes('token='), '발송함에 재설정 토큰 저장 금지');
  const { sha256 } = await import('../server/auth.js');
  const uid = app.db.prepare("SELECT id FROM users WHERE email = 'reset@test.local'").get().id;
  app.db.prepare('INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES (?,?,?)').run(sha256('known-token'), uid, new Date(Date.now() + 6e5).toISOString());
  await client()('POST', '/api/auth/reset', { token: 'known-token', password: 'new-password-123' });
  const reuse = await client()('POST', '/api/auth/reset', { token: 'known-token', password: 'other-password-123' }, { raw: true });
  assert.equal(reuse.data.error, 'invalid_token');
  const old = await client()('POST', '/api/auth/login', { email: 'reset@test.local', password: 'learner-pass-1' }, { raw: true });
  assert.equal(old.status, 401);
  await client()('POST', '/api/auth/login', { email: 'reset@test.local', password: 'new-password-123' });
});

test('약관·개인정보 처리방침 미게시 시 결제 차단', async () => {
  await admin('PUT', '/api/admin/settings', { privacy_ko: '' });
  const pub = await client()('GET', '/api/public/bootstrap');
  const sec = pub.courses.find((c) => c.id === courseId).sections.find((s) => s.id === sectionId);
  assert.ok(sec.blockedReasons.includes('legal_tbd'));
  await admin('PUT', '/api/admin/settings', { privacy_ko: '테스트 처리방침' });
});
