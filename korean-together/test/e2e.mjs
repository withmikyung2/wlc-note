// 브라우저 종단 테스트: node test/e2e.mjs  (Playwright + Chromium 필요)
// PLAYWRIGHT_MODULE 로 playwright 모듈 경로를 지정할 수 있음
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp, loadConfig } from '../server/app.js';
import { hashPassword } from '../server/auth.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const shotDir = process.env.E2E_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'kt-e2e-'));
const app = createApp({ ...loadConfig({}), databasePath: ':memory:' });
await new Promise((r) => app.server.listen(0, r));
const base = `http://127.0.0.1:${app.server.address().port}`;
app.db.prepare("INSERT INTO users(email, password_hash, role) VALUES ('admin@e2e.local', ?, 'admin')").run(hashPassword('admin-password-1'));

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
const errors = [];
async function step(name, fn) {
  try { await fn(); results.push(['PASS', name]); } catch (e) {
    results.push(['FAIL', name, e.message.split('\n')[0]]);
    const slug = name.replace(/[^\w가-힣]+/g, '_').slice(0, 40);
    for (const [label, pg] of [['learner', globalThis.__page], ['admin', globalThis.__admin]]) {
      if (pg && !pg.isClosed()) await pg.screenshot({ path: path.join(shotDir, `FAIL-${slug}-${label}.png`), fullPage: true }).catch(() => {});
    }
  }
}
function watch(page, label) {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|401|404|409|400|402/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}

// ── 관리자: UI 로그인 후 각 탭 표시 + 과정·반 설정 ──
const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
watch(admin, 'admin');
globalThis.__admin = admin;
await step('관리자 화면: 학습자 계정 없이 로그인 화면 표시', async () => {
  await admin.goto(base + '/admin');
  await admin.waitForSelector('#login');
});
await step('관리자 로그인 + 15개 메뉴 전부 오류 없이 표시', async () => {
  await admin.fill('#f-email', 'admin@e2e.local');
  await admin.fill('#f-password', 'admin-password-1');
  await admin.click('#login button[type=submit]');
  await admin.waitForSelector('.admin-nav');
  for (const tab of await admin.$$eval('.admin-nav button', (b) => b.map((x) => x.dataset.tab))) {
    await admin.click(`[data-tab="${tab}"]`);
    await admin.waitForFunction(() => !document.getElementById('panel').textContent.includes('불러오는 중'));
    const bad = await admin.$('#panel .banner.danger');
    assert.equal(bad, null, `탭 ${tab} 오류: ${bad && (await bad.textContent())}`);
  }
  await admin.click('[data-tab="overview"]');
  await admin.waitForSelector('text=실제 운영 전 확인 항목');
  await admin.screenshot({ path: path.join(shotDir, 'admin-overview.png'), fullPage: false });
});
await step('관리자: 약관 입력, 과정 수강료·환불 기준 저장', async () => {
  await admin.click('[data-tab="settings"]');
  await admin.waitForSelector('#f-terms_ko');
  await admin.fill('#f-terms_ko', '(테스트용 약관)');
  await admin.fill('#f-privacy_ko', '(테스트용 처리방침)');
  await admin.click('form[data-save="settings"] button[type=submit]');
  await admin.waitForSelector('text=저장했습니다');
  await admin.click('[data-tab="courses"]');
  await admin.click('[data-act="editCourse"] >> nth=0');
  await admin.waitForSelector('#f-price');
  await admin.fill('#f-price', '150000');
  await admin.fill('#f-refund_policy_ko', '(테스트용 환불 기준)');
  await admin.fill('#f-session_count', '8');
  await admin.fill('#f-minutes_per_session', '50');
  await admin.click('form[data-save="course"] button[type=submit]');
  await admin.waitForSelector('text=저장했습니다');
});
await step('관리자: 새 반 + 회차 일정(기준 시간대) + 화상 링크 등록', async () => {
  await admin.click('[data-tab="sections"]');
  await admin.waitForSelector('form[data-save="section"][data-id=""]');
  const f = 'form[data-save="section"][data-id=""]';
  await admin.fill(`${f} #f-label_ko`, '평일 저녁반');
  await admin.fill(`${f} #f-capacity`, '4');
  await admin.selectOption(`${f} #f-status`, 'open');
  await admin.click(`${f} button[type=submit]`);
  await admin.waitForSelector('form[data-save="section"]:not([data-id=""])');
  const d = new Date(Date.now() + 5 * 864e5);
  const ymd = d.toISOString().slice(0, 10);
  const g = 'form[data-save="section"]:not([data-id=""])';
  await admin.fill(`${g} #f-sessions`, `${ymd} 19:30 | https://meet.example.com/e2e-room\n${ymd} 20:30`);
  await admin.click(`${g} button[type=submit]`);
  await admin.waitForSelector('text=신청·결제 가능');
  const row = app.db.prepare('SELECT starts_at FROM class_sessions ORDER BY id LIMIT 1').get();
  assert.equal(row.starts_at, new Date(`${ymd}T10:30:00Z`).toISOString(), '19:30 Asia/Seoul = 10:30 UTC');
});

// ── 학습자 (데스크톱) ──
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR', timezoneId: 'America/New_York' });
const page = await ctx.newPage();
watch(page, 'learner');
globalThis.__page = page;
await step('홈: 8개 영역 표시 + 가짜 사업자정보 없음(등록 예정)', async () => {
  await page.goto(base + '/');
  await page.waitForSelector('#hero-title');
  for (const id of ['h-purpose', 'h-reco', 'h-how', 'h-teacher', 'h-sched', 'h-faq', 'h-contact']) assert.ok(await page.$('#' + id), id);
  assert.ok((await page.textContent('footer')).includes('등록 예정'));
  await page.screenshot({ path: path.join(shotDir, 'home-ko.png') });
});
await step('과정 추천: 수준·목적·속도 선택 → 결과 + 학습 안내용 표시', async () => {
  await page.check('#home-form input[name=level][value="0"]', { force: true });
  await page.check('#home-form input[name=purpose][value="travel"]', { force: true });
  await page.check('#home-form input[name=pace][value="slow"]', { force: true });
  await page.click('#home-form button[type=submit]');
  const txt = await page.textContent('#home-result');
  assert.ok(txt.includes('한글 첫걸음'));
  assert.ok(txt.includes('공식 한국어 능력 인증이나 시험 성적이 아닙니다'));
});
await step('과정 상세: 필수 항목 13개 + 미정 가격은 ‘추후 안내’', async () => {
  await page.goto(base + '/#/courses/everyday-korean');
  await page.waitForSelector('dl.facts');
  assert.equal(await page.$$eval('dl.facts dt', (d) => d.length), 13);
  assert.ok((await page.textContent('dl.facts')).includes('추후 안내'));
  assert.ok(await page.$('button[disabled][aria-describedby="why-blocked"]'), '미정 과정은 신청 버튼 비활성');
});
await step('무료 체험: 6단계 진행, 반복 재생 선택, 음성 지원 여부 안내, 확인 문제', async () => {
  await page.goto(base + '/#/trial');
  await page.fill('#trial-name', '마리아');
  await page.click('[data-act=trialNext]');
  await page.click('[data-act=trialNext]');
  await page.waitForSelector('#trial-repeat');
  await page.selectOption('#trial-repeat', '3');
  await page.waitForFunction(() => /한국어 음성/.test(document.querySelector('#trial [role=status]')?.textContent || ''));
  assert.ok((await page.textContent('#trial')).includes('저는 마리아입니다.'));
  await page.click('[data-act=trialNext]');
  await page.click('[data-act=trialSaid] >> nth=0');
  await page.click('[data-act=trialNext]');
  await page.check('input[data-quiz="0"][value="0"]', { force: true });
  assert.ok((await page.textContent('#trial fieldset')).includes('정답'));
  await page.click('[data-act=trialNext]');
  assert.ok((await page.textContent('#trial')).includes('학습 안내용'));
});
await step('큰 글씨·쉬운 화면: 기본 20px → 24px, 메뉴 3개로 축소', async () => {
  const before = await page.evaluate(() => getComputedStyle(document.body).fontSize);
  assert.equal(before, '20px');
  await page.click('[data-act=large]');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontSize), '24px');
  await page.click('[data-act=easy]');
  assert.equal(await page.isVisible('.nav'), false);
  assert.equal(await page.$$eval('.easy-nav a', (a) => a.filter((x) => x.offsetParent).length), 3);
  await page.screenshot({ path: path.join(shotDir, 'easy-large.png') });
  await page.click('[data-act=easy]');
  await page.click('[data-act=large]');
});
await step('수업 신청: 과정 → 일정(현지 시간 표시) → 가입 → 신청 정보', async () => {
  await page.goto(base + '/#/courses/hangul-first-steps');
  await page.waitForSelector('dl.facts');
  assert.ok((await page.textContent('main')).includes('America/New_York'), '학습자 현지 시간 표시');
  await page.click('a.btn[href^="#/apply?course=hangul-first-steps&section="]');
  await page.waitForSelector('#apply-su-email');
  await page.fill('#apply-su-email', 'learner@e2e.local');
  await page.fill('#apply-su-pw', 'learner-pass-1');
  await page.check('form[data-form=signup] input[name=agreeTerms]');
  await page.check('form[data-form=signup] input[name=agreePrivacy]');
  await page.click('form[data-form=signup] button[type=submit]');
  await page.waitForSelector('#ap-name');
  await page.fill('#ap-name', 'Maria');
  await page.fill('#ap-country', 'USA');
  await page.selectOption('#ap-level', 'none');
  await page.selectOption('#ap-purpose', 'travel');
});
await step('언어 전환: 입력 중인 신청 정보 유지', async () => {
  await page.click('[data-act=lang]');
  await page.waitForSelector('label[for=ap-name]:has-text("Name")');
  assert.equal(await page.inputValue('#ap-name'), 'Maria');
  assert.equal(await page.inputValue('#ap-purpose'), 'travel');
  await page.click('[data-act=lang]');
  await page.waitForSelector('label[for=ap-name]:has-text("이름")');
});
await step('주문 확인: 필수/선택 동의 구분, 금액·통화·환불 기준 표시', async () => {
  await page.click('form[data-form=applyInfo] button[type=submit]');
  await page.waitForSelector('form[data-form=applyConfirm]');
  const txt = await page.textContent('main');
  for (const s of ['₩150,000', 'KRW', '(테스트용 환불 기준)', '[필수]', '[선택]']) assert.ok(txt.includes(s), s);
  await page.click('form[data-form=applyConfirm] button[type=submit]');
  assert.ok((await page.textContent('.form-error')).includes('필수 항목에 동의'));
  for (const n of ['terms', 'privacy', 'refund']) await page.check(`form[data-form=applyConfirm] input[name=${n}]`);
  await page.click('form[data-form=applyConfirm] button[type=submit]');
  await page.waitForSelector('[data-act=applyPay]');
  assert.ok((await page.textContent('main')).includes('실제 결제가 일어나지 않습니다'), '테스트 모드 표시');
});
await step('결제 실패 → 신청 정보 유지 → 재시도 성공 → 수강 등록', async () => {
  await page.click('[data-act=applyPay]');
  await page.waitForSelector('[data-outcome=fail]');
  await page.click('[data-outcome=fail]');
  await page.waitForSelector('text=결제가 완료되지 않았습니다');
  await page.click('a[href="#/apply"]');
  await page.waitForSelector('[data-act=applyPay]');
  assert.ok((await page.textContent('main')).includes('결제 실패'));
  await page.click('[data-act=applyPay]');
  await page.click('[data-outcome=success]');
  await page.waitForSelector('text=결제가 완료되어 수강이 등록되었습니다');
  await page.screenshot({ path: path.join(shotDir, 'pay-success.png') });
});
await step('결제 성공 화면 새로고침(중복 복귀)에도 수강 등록 1건', async () => {
  await page.reload();
  await page.waitForSelector('h1');
  const n = app.db.prepare("SELECT COUNT(*) n FROM enrollments e JOIN users u ON u.id = e.user_id WHERE u.email = 'learner@e2e.local'").get().n;
  assert.equal(n, 1);
});
await step('나의 학습: 다음 수업(현지 시간) + 수업 참여하기 링크 + 결제 내역', async () => {
  await page.goto(base + '/#/my');
  await page.waitForSelector('text=다음 수업');
  const join = await page.getAttribute('a:has-text("수업 참여하기")', 'href');
  assert.equal(join, 'https://meet.example.com/e2e-room');
  assert.ok((await page.textContent('main')).includes('결제 완료'));
  await page.click('[data-act=receipt]');
  await page.waitForSelector('#receipt-box dl');
  await page.screenshot({ path: path.join(shotDir, 'my.png'), fullPage: true });
});
await step('학습자: 환불 요청 → 관리자 화면에서 전체 환불 → 수강 권한 종료', async () => {
  await page.click('[data-act=refundOpen]');
  await page.fill('#rf-reason', '일정이 맞지 않음');
  await page.click('form[data-form=refund] button[type=submit]');
  await page.waitForSelector('text=요청 접수');
  await admin.click('[data-tab="refunds"]');
  await admin.waitForSelector('form[data-save="refund"]');
  await admin.click('form[data-save="refund"] button[type=submit]');
  await admin.waitForSelector('text=저장했습니다');
  await page.reload();
  await page.waitForSelector('text=수강 권한 종료');
  assert.equal(await page.$('a:has-text("수업 참여하기")'), null);
});

// ── 다른 학습자: 남의 기록 접근 불가 ──
await step('다른 학습자 브라우저에서 첫 학습자 주문 조회 차단', async () => {
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(base + '/');
  const orderNo = app.db.prepare('SELECT order_no FROM orders LIMIT 1').get().order_no;
  const status = await p2.evaluate(async (no) => {
    await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-KT-Request': '1' }, body: JSON.stringify({ email: 'other@e2e.local', password: 'other-pass-123', agreeTerms: true, agreePrivacy: true }) });
    return (await fetch('/api/me/orders/' + no + '/receipt')).status;
  }, orderNo);
  assert.equal(status, 404);
  await other.close();
});

// ── 모바일 ──
await step('모바일(390px): 가로 스크롤 없음, 큰 버튼, 메뉴·신청 화면 표시', async () => {
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  watch(m, 'mobile');
  for (const r of ['/', '/#/courses/hangul-first-steps', '/#/trial', '/#/apply', '/#/help']) {
    await m.goto(base + r);
    await m.waitForSelector('h1');
    const sw = await m.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(sw <= 390, `${r} scrollWidth ${sw}`);
  }
  const h = await m.$eval('.btn', (b) => b.getBoundingClientRect().height);
  assert.ok(h >= 44, 'button height ' + h);
  await m.goto(base + '/');
  await m.screenshot({ path: path.join(shotDir, 'mobile-home-en.png'), fullPage: false });
  await m.close();
});

await step('키보드: 건너뛰기 링크 → 본문 포커스', async () => {
  await page.goto(base + '/');
  await page.waitForSelector('#hero-title');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
});

await step('브라우저 오류 없음', async () => { assert.deepEqual(errors, []); });

await browser.close();
app.server.close();
for (const r of results) console.log(r.join(' | '));
console.log(`\n${results.filter((r) => r[0] === 'PASS').length}/${results.length} passed · screenshots: ${shotDir}`);
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
