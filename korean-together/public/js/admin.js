// 운영자 관리 화면 — 모든 권한 검증은 서버에서 수행하며, 이 화면은 입력·표시만 담당함
import { esc, api, toast, safeHref, fmtMoney, digits } from './util.js';

const $main = document.getElementById('main');
let me = null;
let tab = 'overview';
let cache = {};

const STATUS_KO = {
  pending: '결제 대기', awaiting_confirmation: '결제 확인 대기', paid: '결제 완료', failed: '결제 실패', cancelled: '취소', expired: '시간 만료',
  partially_refunded: '부분 환불', refunded: '전체 환불', requested: '요청 접수', approved: '승인', rejected: '반려', processed: '처리 완료',
  open: '접수', answered: '답변 완료', closed: '종료', active: '수강 중', revoked: '권한 종료', not_configured: '미발송(서비스 미연결)', sent: '발송', draft: '비공개'
};
const ERR_KO = {
  forbidden: '권한이 없습니다.', login_required: '로그인이 필요합니다.', mfa_required: '2단계 인증이 필요합니다. 다시 로그인하세요.', invalid_otp: '인증 코드가 맞지 않습니다.',
  invalid_credentials: '이메일 또는 비밀번호가 맞지 않습니다.', amount_mismatch: '입금 금액이 주문 금액과 다릅니다.', reference_required: '결제 확인 근거(거래번호 등)를 입력하세요.',
  invalid_refund_amount: '환불 가능 금액을 넘었거나 올바르지 않습니다.', manual_reference_required: 'API 환불이 불가한 결제입니다. 외부에서 환불한 뒤 근거를 입력하세요.',
  refund_failed: '결제서비스 환불 요청이 실패했습니다.', capacity_below_enrolled: '정원을 현재 수강 인원보다 작게 줄일 수 없습니다.', has_orders: '주문이 있어 삭제할 수 없습니다. 비공개로 전환하세요.',
  rights_confirmation_required: '자료 사용 권한 확인에 체크해야 등록할 수 있습니다.', invalid_url: 'URL 형식을 확인하세요 (https://...)', invalid_timezone: '시간대 이름을 확인하세요 (예: Asia/Seoul).',
  invalid_price: '수강료는 0보다 커야 합니다. 미정이면 비워 두세요.', order_not_payable: '이 주문 상태에서는 처리할 수 없습니다.', missing_fields: '필수 항목을 입력하세요.'
};
const err = (e) => ERR_KO[e.code] || `오류: ${e.code || e.message}`;
const ko = (s) => STATUS_KO[s] || s;
const badge = (s) => `<span class="badge ${['paid', 'processed', 'answered', 'active', 'sent'].includes(s) ? 'green' : ['failed', 'cancelled', 'expired', 'refunded', 'rejected', 'revoked'].includes(s) ? 'danger' : 'warn'}">${esc(ko(s))}</span>`;

const TABS = [
  ['overview', '현황·연결 상태'], ['settings', '사이트·운영기관'], ['instructors', '강사'], ['courses', '과정·수강료'], ['sections', '개설반·시간표'],
  ['orders', '주문·결제'], ['refunds', '취소·환불'], ['learners', '학습자'], ['roster', '출석·진도'], ['materials', '자료·복습 문제'],
  ['inquiries', '문의'], ['content', '공지·FAQ'], ['emails', '이메일 발송함'], ['audit', '변경 기록'], ['security', '보안(2단계 인증)']
];

// ── 시간대 변환 (반의 기준 시간대 ↔ UTC) ──
function tzOffset(ts, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ts;
}
function zonedToUtc(local, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(local.trim());
  if (!m) throw Object.assign(new Error(), { code: 'invalid_datetime_format' });
  const base = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let guess = base;
  for (let i = 0; i < 3; i++) guess = base - tzOffset(guess, tz);
  return new Date(guess).toISOString();
}
function utcToZoned(iso, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// ── 공통 UI ──
const field = (name, label, value = '', { type = 'text', hint = '', rows = 0, required = false, options = null } = {}) => {
  const id = 'f-' + name;
  let input;
  if (options) input = `<select id="${id}" name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (rows) input = `<textarea id="${id}" name="${name}" rows="${rows}">${esc(value ?? '')}</textarea>`;
  else if (type === 'checkbox') return `<label class="check"><input type="checkbox" id="${id}" name="${name}" ${value ? 'checked' : ''}><span>${esc(label)}${hint ? `<br><span class="small muted">${esc(hint)}</span>` : ''}</span></label>`;
  else input = `<input id="${id}" name="${name}" type="${type}" value="${esc(value ?? '')}" ${required ? 'required' : ''} ${type === 'number' ? 'step="any"' : ''}>`;
  return `<div class="field"><label for="${id}">${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>${input}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
};
const table = (cols, rows) => `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="muted">없음</td></tr>`}</tbody></table></div>`;
const fd2obj = (form) => {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') { if (el.dataset.multi) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
    else o[el.name] = el.value;
  }
  return o;
};

// ── 화면 ──
async function viewLogin(step = 'pw', saved = {}) {
  $main.innerHTML = `<div class="wrap" style="max-width:520px"><h1>관리자 로그인</h1>
    <form id="login" class="card" novalidate>
      ${step === 'pw' ? `${field('email', '이메일', saved.email, { type: 'email', required: true })}${field('password', '비밀번호', '', { type: 'password', required: true })}`
        : `<input type="hidden" name="email" value="${esc(saved.email)}"><input type="hidden" name="password" value="${esc(saved.password)}">
           ${field('otp', '인증 앱의 6자리 코드', '', { required: true })}`}
      <p class="error-text" role="alert" id="login-err"></p>
      <button class="btn" type="submit">${step === 'pw' ? '로그인' : '확인'}</button>
    </form>
    <p class="small muted">관리자 계정은 서버에서 <code>npm run create-admin</code>으로 만듭니다. 학습자 계정으로는 접근할 수 없습니다.</p></div>`;
  document.getElementById('login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const b = fd2obj(ev.target);
    try {
      const r = await api('POST', '/api/auth/login', b);
      if (r.mfaRequired) return viewLogin('otp', b);
      if (r.user.role !== 'admin') { await api('POST', '/api/auth/logout'); throw Object.assign(new Error(), { code: 'forbidden' }); }
      start();
    } catch (e) { document.getElementById('login-err').textContent = err(e); }
  });
  document.querySelector('#login input')?.focus();
}

function shell(inner) {
  return `<div class="wrap admin-layout">
    <nav class="admin-nav" aria-label="관리 메뉴">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}>${esc(l)}</button>`).join('')}</nav>
    <div id="panel">${inner}</div></div>`;
}

const CHECK_LABEL = {
  org_info: ['운영기관명·대표자·사업자등록번호·주소·문의 이메일·연락처 입력', '사이트·운영기관 탭'],
  mail_order_reg: ['통신판매업 신고번호 입력 (해당 여부 확인)', '사이트·운영기관 탭'],
  terms: ['이용약관 (한국어·영어) 게시', '전문가 검토 후 입력'],
  privacy: ['개인정보 처리방침 (한국어·영어) + 보호책임자 게시', '전문가 검토 후 입력'],
  refund_general: ['취소·환불 일반 안내 게시', '적용 규정 확인 후 입력'],
  instructor: ['강사 소개 공개', '자격증 사본 등 개인정보 가림 확인'],
  course_prices: ['모든 공개 과정의 수강료 확정', '미정이면 결제 차단됨'],
  course_refund: ['모든 공개 과정의 환불 기준 입력', '미입력 과정은 결제 차단됨'],
  schedules: ['신청 가능한 개설반·시간표 등록', ''],
  payment_contract: ['결제서비스 계약 + 운영(라이브) 키 연결', '.env 설정 후 서버 재시작'],
  settlement_account: ['정산 계좌 등록 (결제서비스 관리자 화면)', '직접 확인 후 체크'],
  payment_webhook: ['결제서비스에 웹훅 주소 등록', '/api/payments/webhook/{toss}'],
  email_service: ['이메일 발송 서비스 연결 + 발신 도메인 인증', '.env EMAIL_PROVIDER'],
  domain_https: ['운영 도메인 + HTTPS (PUBLIC_BASE_URL)', ''],
  admin_mfa: ['모든 관리자 계정 2단계 인증 설정', '보안 탭'],
  backup: ['데이터베이스 정기 백업 설정', '직접 확인 후 체크']
};
const MANUAL_KEYS = { settlement_account: 'checklist_settlement_account', payment_webhook: 'checklist_webhook_registered', backup: 'checklist_backup' };

const views = {
  async overview() {
    const o = await api('GET', '/api/admin/overview');
    const i = o.integrations;
    const pm = i.payment;
    return `<h1>현황</h1>
      <div class="kv">
        <div class="stat"><b>${o.learners}</b><span>학습자</span></div><div class="stat"><b>${o.activeEnrollments}</b><span>수강 중</span></div>
        <div class="stat"><b>${o.pendingOrders}</b><span>결제 대기</span></div><div class="stat"><b>${o.awaitingConfirmation}</b><span>결제 확인 대기(링크)</span></div>
        <div class="stat"><b>${o.openRefunds}</b><span>처리할 환불 요청</span></div><div class="stat"><b>${o.openInquiries}</b><span>새 문의</span></div>
        <div class="stat"><b>${o.needsReview}</b><span>검토 필요 주문</span></div>
      </div>
      <h2 style="margin-top:28px">매출 (결제 완료 − 환불)</h2>
      ${table(['통화', '결제 건수', '결제 합계', '순매출'], o.sales.map((s) => [esc(s.currency), s.n, esc(s.grossText), `<strong>${esc(s.netText)}</strong>`]))}
      <h2 style="margin-top:28px">반별 수강 현황</h2>
      ${table(['과정', '반', '수강/정원'], o.bySection.map((s) => [esc(s.course), esc(s.label || '#' + s.sectionId), `${s.enrolled} / ${s.capacity}`]))}
      <h2 style="margin-top:28px">외부 서비스 연결 상태</h2>
      ${table(['서비스', '상태', '설명'], [
        ['결제 방식', `<strong>${esc(pm.mode)}</strong> ${pm.configured ? badge('active') : badge('failed')}`, pm.mode === 'test' ? '테스트 모드 — 실제 결제 없음' : pm.mode === 'link' ? '결제 링크 + 관리자 확인' : pm.live ? '실결제' : '테스트 키'],
        ['토스페이먼츠', pm.toss.configured ? (pm.toss.live ? '라이브 키 설정됨' : '테스트 키 설정됨') : '미설정', '계약 후 TOSS_CLIENT_KEY / TOSS_SECRET_KEY'],
        ['엑심베이', pm.eximbay.hasKeys ? '키 있음 · 연동 구현 대기' : '미설정', '계약 시 받은 연동 문서로 구현 필요'],
        ['이메일 발송', i.email.configured ? `연결됨 (${esc(i.email.provider)})` : '<span class="badge warn">미연결 — 메일이 발송되지 않음</span>', 'EMAIL_PROVIDER, EMAIL_FROM, RESEND_API_KEY'],
        ['관리자 2단계 인증 강제', i.mfaRequired ? '켜짐' : '꺼짐', 'ADMIN_REQUIRE_MFA=true 권장'],
        ['사이트 주소', esc(i.baseUrl), 'PUBLIC_BASE_URL']
      ])}
      <h2 style="margin-top:28px">실제 운영 전 확인 항목</h2>
      ${table(['', '항목', '비고'], o.checklist.map((c) => [
        c.manual ? `<input type="checkbox" data-check="${MANUAL_KEYS[c.key]}" ${c.ok ? 'checked' : ''} aria-label="${esc(CHECK_LABEL[c.key][0])}">` : (c.ok ? '✅' : '⬜'),
        esc(CHECK_LABEL[c.key]?.[0] || c.key), esc(CHECK_LABEL[c.key]?.[1] || '')]))}`;
  },

  async settings() {
    const { settings: s } = await api('GET', '/api/admin/settings');
    const rates = Object.entries(s.reference_rates || {}).map(([k, v]) => `${k}=${v}`).join('\n');
    return `<h1>사이트·운영기관 정보</h1>
      <div class="banner info">비어 있는 항목은 공개 화면에 ‘등록 예정’으로 표시됩니다. 확인되지 않은 정보를 입력하지 마세요.</div>
      <form data-save="settings" class="card">
        <h2>사이트</h2><div class="grid g2">${field('site_name_ko', '사이트명(한국어)', s.site_name_ko)}${field('site_name_en', '사이트명(영어)', s.site_name_en)}
        ${field('tagline_ko', '핵심 문구(한국어)', s.tagline_ko)}${field('tagline_en', '핵심 문구(영어)', s.tagline_en)}
        ${field('intro_ko', '소개 문구(한국어)', s.intro_ko, { rows: 2 })}${field('intro_en', '소개 문구(영어)', s.intro_en, { rows: 2 })}</div>
        <h2>운영기관 (사이트 하단 표시)</h2><div class="grid g2">${field('org_name', '운영기관명', s.org_name)}${field('representative', '대표자', s.representative)}
        ${field('business_reg_no', '사업자등록번호', s.business_reg_no)}${field('mail_order_reg_no', '통신판매업 신고번호', s.mail_order_reg_no)}
        ${field('address', '주소', s.address)}${field('contact_email', '문의 이메일', s.contact_email, { type: 'email' })}
        ${field('phone', '연락처', s.phone)}${field('privacy_officer', '개인정보 보호책임자 (이름·연락처)', s.privacy_officer)}</div>
        <h2>약관·방침</h2><p class="small muted">법률 문구는 적용 규정과 운영 방식을 확인한 뒤 확정하여 입력하세요. 이용약관·개인정보 처리방침이 비어 있으면 결제가 열리지 않습니다.</p>
        ${field('terms_ko', '이용약관(한국어)', s.terms_ko, { rows: 6 })}${field('terms_en', '이용약관(영어)', s.terms_en, { rows: 6 })}
        ${field('privacy_ko', '개인정보 처리방침(한국어)', s.privacy_ko, { rows: 6 })}${field('privacy_en', '개인정보 처리방침(영어)', s.privacy_en, { rows: 6 })}
        ${field('refund_general_ko', '취소·환불 일반 안내(한국어)', s.refund_general_ko, { rows: 4 })}${field('refund_general_en', '취소·환불 일반 안내(영어)', s.refund_general_en, { rows: 4 })}
        <h2>참고용 환산 환율 (선택)</h2>
        ${field('rates', '한 줄에 하나: 결제통화_표시통화=환율', rates, { rows: 3, hint: '예) KRW_USD=0.00072 → 원화 가격 옆에 “참고용 환산(실제 청구 금액 아님)”으로 표시' })}
        <button class="btn" type="submit">저장</button></form>`;
  },

  async instructors() {
    const { instructors } = await api('GET', '/api/admin/instructors');
    cache.instructors = instructors;
    const edit = cache.editInstructor ? instructors.find((i) => i.id === cache.editInstructor) || {} : {};
    return `<h1>강사</h1>
      ${table(['이름', '공개', ''], instructors.map((i) => [esc(i.name_ko) + ' / ' + esc(i.name_en), i.published ? '공개' : '비공개',
        `<button class="btn small outline" data-act="editInstructor" data-id="${i.id}">수정</button> <button class="btn small ghost" data-act="del" data-path="/api/admin/instructors/${i.id}">삭제</button>`]))}
      <form data-save="instructor" data-id="${edit.id || ''}" class="card" style="margin-top:16px">
        <h2>${edit.id ? '강사 수정' : '강사 등록'}</h2>
        <div class="banner warn">자격증 사본·번호를 공개할 때는 주민등록번호, 생년월일, 자격번호 일부, 주소 등 불필요한 개인정보를 가린 이미지·문구만 사용하세요.</div>
        <div class="grid g2">${field('name_ko', '이름(한국어)', edit.name_ko, { required: true })}${field('name_en', '이름(영어)', edit.name_en)}</div>
        ${field('bio_ko', '소개(한국어)', edit.bio_ko, { rows: 4 })}${field('bio_en', '소개(영어)', edit.bio_en, { rows: 4 })}
        ${field('qualifications', '자격 (예: 한국어교원 자격 — 등급·발급기관은 확인 후 입력)', edit.qualifications, { rows: 3 })}
        ${field('career', '경력 (확인된 내용만)', edit.career, { rows: 4 })}
        ${field('photo_url', '사진 URL (https)', edit.photo_url)}
        ${field('published', '공개 화면에 표시', edit.published)}
        <div class="row"><button class="btn" type="submit">저장</button>${edit.id ? '<button class="btn ghost" type="button" data-act="newInstructor">새로 등록</button>' : ''}</div></form>`;
  },

  async courses() {
    const [{ courses }, { instructors }] = await Promise.all([api('GET', '/api/admin/courses'), api('GET', '/api/admin/instructors')]);
    cache.courses = courses;
    const blank = { id: 0, title: {}, summary: {}, level: {}, prerequisites: {}, goals: { ko: [], en: [] }, formats: ['group'], purposes: [], lessons: [], materials: {}, refundPolicy: {}, sections: [], status: 'draft', currency: 'KRW', levelMin: 0, levelMax: 4, sort: 10 };
    const c = cache.editCourse === 0 ? blank : courses.find((x) => x.id === cache.editCourse);
    const list = table(['과정', '수강료', '환불 기준', '상태', ''], courses.map((x) => [esc(x.title.ko),
      x.price ? esc(fmtMoney(x.price.amount, x.price.currency)) : '<span class="badge warn">추후 안내</span>',
      x.refundPolicy.ko ? '입력됨' : '<span class="badge warn">미입력</span>', badge(x.status === 'draft' ? 'draft' : 'active'),
      `<button class="btn small outline" data-act="editCourse" data-id="${x.id}">수정</button>`]));
    if (!c) return `<h1>과정·수강료</h1>${list}<p style="margin-top:12px"><button class="btn" data-act="newCourse">새 과정</button></p>`;
    const isNew = c.id === 0;
    const chk = (name, values, all) => `<div class="options">${all.map(([v, l]) => `<label class="option"><input type="checkbox" name="${name}" data-multi="1" value="${v}" ${values.includes(v) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
    return `<h1>과정·수강료</h1>${list}
      <form data-save="course" data-id="${isNew ? '' : c.id}" class="card" style="margin-top:16px">
        <h2>${isNew ? '새 과정' : '과정 수정: ' + esc(c.title.ko)}</h2>
        <div class="grid g2">${field('title_ko', '과정명(한국어)', c.title.ko, { required: true })}${field('title_en', '과정명(영어)', c.title.en)}
        ${field('slug', '주소용 이름 (영문)', c.slug)}${field('sort', '표시 순서', c.sort, { type: 'number' })}</div>
        ${field('summary_ko', '요약(한국어)', c.summary.ko, { rows: 2 })}${field('summary_en', '요약(영어)', c.summary.en, { rows: 2 })}
        <div class="grid g2">${field('level_ko', '대상 수준(한국어)', c.level.ko)}${field('level_en', '대상 수준(영어)', c.level.en)}
        ${field('prerequisites_ko', '사전 지식(한국어)', c.prerequisites.ko)}${field('prerequisites_en', '사전 지식(영어)', c.prerequisites.en)}
        ${field('level_min', '추천 최소 수준 (0=한글 모름 ~ 4)', c.levelMin, { type: 'number' })}${field('level_max', '추천 최대 수준', c.levelMax, { type: 'number' })}</div>
        <div class="grid g2">${field('goals_ko', '학습 목표(한국어, 한 줄에 하나)', (c.goals.ko || []).join('\n'), { rows: 4 })}${field('goals_en', '학습 목표(영어)', (c.goals.en || []).join('\n'), { rows: 4 })}</div>
        ${field('lessons', '회차별 학습 내용 (한 줄에 하나: 한국어 | English)', c.lessons.map((l) => `${l.title.ko} | ${l.title.en}`).join('\n'), { rows: 8 })}
        <p class="legend">수업 방식</p>${chk('formats', c.formats, [['group', '실시간 소그룹'], ['private', '1:1'], ['recorded', '녹화 학습']])}
        <p class="legend" style="margin-top:12px">학습 목적 (추천에 사용)</p>${chk('purposes', c.purposes, [['study', '유학·학교'], ['daily', '일상생활'], ['work', '직장'], ['friends', '친구'], ['travel', '여행'], ['family', '가족'], ['culture', '문화'], ['hobby', '취미']])}
        <div class="grid g2" style="margin-top:12px">${field('session_count', '수업 횟수 (미정이면 비움)', c.sessionCount ?? '', { type: 'number' })}${field('minutes_per_session', '회당 시간(분)', c.minutesPerSession ?? '', { type: 'number' })}
        ${field('instructor_id', '강사', c.instructorId ?? '', { options: [['', '— 추후 안내 —'], ...instructors.map((i) => [i.id, i.name_ko])] })}
        ${field('status', '공개 상태', c.status, { options: [['published', '공개'], ['draft', '비공개']] })}</div>
        ${field('materials_ko', '교재 및 준비사항(한국어)', c.materials.ko, { rows: 2 })}${field('materials_en', '교재 및 준비사항(영어)', c.materials.en, { rows: 2 })}
        <h3>수강료</h3>
        <div class="grid g2">${field('price', '총 수강료 (미정이면 비움 → ‘추후 안내’, 결제 차단)', c.price ? c.price.major : '', { type: 'number' })}
        ${field('currency', '결제 통화', c.currency || 'KRW', { options: [['KRW', 'KRW 원'], ['USD', 'USD 달러'], ['EUR', 'EUR'], ['JPY', 'JPY']] })}</div>
        <p class="small muted">결제서비스와 계약된 통화만 선택하세요. 가격 변경은 기록에 남으며, 이미 생성된 주문 금액은 결제 시작 시점에 서버가 다시 확정합니다.</p>
        ${field('payment_link_url', '결제 링크 (A안: 결제 링크 방식일 때)', c.paymentLinkUrl, { hint: '결제서비스에서 만든 이 과정의 결제 링크. 학습자는 주문번호를 메모에 적어 결제합니다.' })}
        <h3>취소·환불 기준</h3>
        <p class="small muted">운영 방식과 적용 규정을 확인한 뒤 확정한 내용만 입력하세요. 비어 있으면 결제가 열리지 않습니다.</p>
        ${field('refund_policy_ko', '취소·환불 기준(한국어)', c.refundPolicy.ko, { rows: 4 })}${field('refund_policy_en', '취소·환불 기준(영어)', c.refundPolicy.en, { rows: 4 })}
        <div class="row"><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" data-act="closeCourse">닫기</button></div>
      </form>`;
  },

  async sections() {
    const { courses } = await api('GET', '/api/admin/courses');
    cache.courses = courses;
    const cid = cache.sectionCourse || courses[0]?.id;
    const c = courses.find((x) => x.id === Number(cid));
    if (!c) return '<h1>개설반·시간표</h1><p>과정을 먼저 등록하세요.</p>';
    return `<h1>개설반·시간표</h1>
      <div class="field" style="max-width:420px"><label for="sec-course">과정</label><select id="sec-course" data-change="sectionCourse">${courses.map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.title.ko)}</option>`).join('')}</select></div>
      ${c.sections.map((s) => `<form data-save="section" data-id="${s.id}" class="card" style="margin-top:16px">
        <div class="row between"><h2>반 #${s.id} ${esc(s.label.ko)}</h2><span>${badge(s.status === 'open' ? 'active' : s.status)} 수강 ${s.enrolled} · 결제 진행 중 ${s.held} · 잔여 ${s.remaining}/${s.capacity}</span></div>
        ${s.blockedReasons.length ? `<div class="banner warn">결제 차단 사유: ${s.blockedReasons.map(esc).join(', ')}</div>` : '<div class="banner ok">신청·결제 가능</div>'}
        ${sectionFields(s)}
        ${field('sessions', `회차 일정 (한 줄에 하나: YYYY-MM-DD HH:mm | 화상수업 링크) — ${s.timezone} 기준`, s.sessions.map((x) => `${utcToZoned(x.startsAt, s.timezone)}${x.meetingUrl ? ' | ' + x.meetingUrl : ''}`).join('\n'), { rows: 6, hint: '화상수업 링크는 이 반에 등록된 학습자에게만 보입니다.' })}
        <div class="row"><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" data-act="del" data-path="/api/admin/sections/${s.id}">삭제</button></div>
        <details style="margin-top:12px"><summary>수강생에게 일정 안내 메일 보내기</summary>
          <textarea id="notify-${s.id}" rows="3" aria-label="안내 내용"></textarea><button class="btn small" type="button" data-act="notify" data-id="${s.id}">보내기</button></details>
      </form>`).join('')}
      <form data-save="section" data-id="" class="card" style="margin-top:16px"><h2>새 반 만들기</h2>${sectionFields({ format: 'group', timezone: 'Asia/Seoul', capacity: 6, status: 'draft', label: {} })}
        <button class="btn" type="submit">만들기</button></form>`;
  },

  async orders() {
    const status = cache.orderStatus || '';
    const { orders } = await api('GET', '/api/admin/orders' + (status ? `?status=${status}` : ''));
    cache.orders = orders;
    return `<h1>주문·결제</h1>
      <div class="field" style="max-width:320px"><label for="ord-st">상태</label><select id="ord-st" data-change="orderStatus">
        ${['', 'pending', 'awaiting_confirmation', 'paid', 'failed', 'expired', 'cancelled', 'partially_refunded', 'refunded'].map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${s ? ko(s) : '전체'}</option>`).join('')}</select></div>
      ${table(['주문번호', '학습자', '과정·반', '금액', '상태', '결제', '작업'], orders.map((o) => [
        `<span class="small">${esc(o.orderNo)}</span><div class="small muted">${esc(o.createdAt)}</div>`,
        `${esc(o.applicant.name || '')}<div class="small muted">${esc(o.email)}</div><div class="small muted">${esc(o.applicant.country || '')} · ${esc(o.applicant.timezone || '')}</div>`,
        `${esc(o.course.title.ko)}<div class="small muted">${esc(o.section.label.ko || '#' + o.section.id)}</div>`,
        `${esc(fmtMoney(o.amount, o.currency))}${o.refundedAmount ? `<div class="small">환불 ${esc(fmtMoney(o.refundedAmount, o.currency))}</div>` : ''}`,
        `${badge(o.status)}${o.needsReview ? ` <span class="badge danger">검토: ${esc(o.needsReview)}</span>` : ''}${o.failureReason ? `<div class="small muted">${esc(o.failureReason)}</div>` : ''}${o.enrollment ? `<div class="small">수강 ${badge(o.enrollment.status)}</div>` : ''}`,
        `${esc(o.provider)}${o.providerReference ? `<div class="small muted">근거: ${esc(o.providerReference)}</div>` : ''}`,
        orderActions(o)]))}`;
  },

  async refunds() {
    const { refunds } = await api('GET', '/api/admin/refunds');
    return `<h1>취소·환불</h1>
      <div class="banner info">결제서비스 API로 환불되는 결제(테스트·토스)는 승인 시 바로 환불 요청됩니다. 결제 링크 등 API 환불이 불가한 결제는 외부에서 먼저 환불한 뒤 근거를 입력하세요. 전체 환불 시 수강 권한은 자동 종료되고, 부분 환불 시에는 선택에 따릅니다.</div>
      ${refunds.map((r) => `<div class="card" style="margin-top:12px">
        <div class="row between"><h3>${esc(r.order_no)} · ${esc(r.email)}</h3>${badge(r.status)}</div>
        <p>결제 ${esc(fmtMoney(r.amount, r.currency))} · 기환불 ${esc(fmtMoney(r.refunded_amount, r.currency))} · 주문 ${badge(r.order_status)} · ${esc(r.provider)}</p>
        <p><strong>요청 사유:</strong> ${esc(r.reason)}</p>
        <details><summary>신청 당시 환불 기준</summary><p style="white-space:pre-line">${esc(r.refundPolicy.ko || '')}</p></details>
        ${['requested', 'failed', 'approved'].includes(r.status) ? `<form data-save="refund" data-id="${r.id}" style="margin-top:10px">
          <div class="grid g2">${field('amount', `환불 금액 (${r.currency}, 최대 ${(r.amount - r.refunded_amount) / 10 ** digits(r.currency)})`, (r.amount - r.refunded_amount) / 10 ** digits(r.currency), { type: 'number' })}
          ${field('manualReference', '외부 환불 근거 (API 환불 불가 시)', '')}</div>
          ${field('revokeAccess', '부분 환불이어도 수강 권한 종료', false)}
          ${field('note', '학습자에게 보낼 메모', '', { rows: 2 })}
          <div class="row"><button class="btn" type="submit" name="decision" value="approve">승인·환불 처리</button><button class="btn outline" type="button" data-act="rejectRefund" data-id="${r.id}">반려</button></div>
        </form>` : `<p class="small muted">${esc(r.admin_note)}</p>`}
      </div>`).join('') || '<p class="muted">요청이 없습니다.</p>'}`;
  },

  async learners() {
    const { learners } = await api('GET', '/api/admin/learners');
    return `<h1>학습자</h1><p class="small muted">개인정보는 관리자에게만 표시됩니다. 필요한 범위에서만 확인하세요.</p>
      ${table(['이메일', '이름', '시간대', '주문', '수강 중', '가입일'], learners.map((l) => [esc(l.email), esc(l.display_name), esc(l.timezone), l.orders, l.active, esc(l.created_at)]))}`;
  },

  async roster() {
    const { courses } = await api('GET', '/api/admin/courses');
    const sections = courses.flatMap((c) => c.sections.map((s) => ({ ...s, course: c.title.ko })));
    const sid = cache.rosterSection || sections[0]?.id;
    if (!sid) return '<h1>출석·진도</h1><p>개설반이 없습니다.</p>';
    const r = await api('GET', `/api/admin/sections/${sid}/roster`);
    const opts = [['present', '출석'], ['late', '지각'], ['absent', '결석'], ['excused', '공결']];
    return `<h1>출석·진도</h1>
      <div class="field" style="max-width:480px"><label for="ro-sec">반</label><select id="ro-sec" data-change="rosterSection">${sections.map((s) => `<option value="${s.id}" ${s.id === Number(sid) ? 'selected' : ''}>${esc(s.course)} · ${esc(s.label.ko || '#' + s.id)}</option>`).join('')}</select></div>
      ${table(['학습자', '진도', ...r.sessions.map((s) => `${s.no}회 ${utcToZoned(s.starts_at, r.section.timezone).slice(5)}`)], r.learners.map((l) => [
        `${esc(l.display_name || l.email)}<div class="small muted">${esc(l.email)}</div>${l.status !== 'active' ? badge(l.status) : ''}`, `${l.progress}%`,
        ...r.sessions.map((s) => `<select aria-label="${esc(l.email)} ${s.no}회 출석" data-att="${s.id}" data-user="${l.user_id}"><option value="">—</option>${opts.map(([v, lb]) => `<option value="${v}" ${l.attendance[s.id] === v ? 'selected' : ''}>${lb}</option>`).join('')}</select>`)]))}`;
  },

  async materials() {
    const [{ materials }, { items }, { courses }] = await Promise.all([api('GET', '/api/admin/materials'), api('GET', '/api/admin/review-items'), api('GET', '/api/admin/courses')]);
    const cname = (id) => esc(courses.find((c) => c.id === id)?.title.ko || id);
    const copts = courses.map((c) => [c.id, c.title.ko]);
    return `<h1>학습 자료·복습 문제</h1>
      <div class="banner warn">저작권·초상권 등 사용 권한이 확보된 자료만 등록하세요. 녹화 자료는 여기에서 등록한 것만 수강생에게 보입니다.</div>
      ${table(['과정', '회차', '종류', '제목', ''], materials.map((m) => [cname(m.course_id), m.lesson_no || '', esc(m.kind), `<a href="${safeHref(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>`,
        `<button class="btn small ghost" data-act="del" data-path="/api/admin/materials/${m.id}">삭제</button>`]))}
      <form data-save="material" class="card" style="margin-top:16px"><h2>자료 등록</h2>
        <div class="grid g2">${field('course_id', '과정', '', { options: copts })}${field('section_id', '반 번호 (비우면 과정 전체)', '', { type: 'number' })}
        ${field('lesson_no', '회차 번호', '', { type: 'number' })}${field('kind', '종류', 'file', { options: [['file', '파일'], ['recording', '녹화'], ['link', '링크']] })}</div>
        ${field('title', '제목', '', { required: true })}${field('url', '주소 (https)', '', { required: true, hint: '접근 제한이 가능한 저장소(예: 비공개 링크) 사용을 권장합니다.' })}
        ${field('rights_confirmed', '이 자료의 사용 권한(저작권·초상권 등)을 확보했음을 확인합니다', false)}
        <button class="btn" type="submit">등록</button></form>
      <h2 style="margin-top:28px">복습 문제</h2>
      ${table(['과정', '회차', '문제', '정답', ''], items.map((q) => [cname(q.course_id), q.lesson_no || '', esc(q.prompt), esc(JSON.parse(q.choices)[q.answer]),
        `<button class="btn small ghost" data-act="del" data-path="/api/admin/review-items/${q.id}">삭제</button>`]))}
      <form data-save="review" class="card" style="margin-top:16px"><h2>복습 문제 추가</h2>
        <div class="grid g2">${field('course_id', '과정', '', { options: copts })}${field('lesson_no', '회차 번호', '', { type: 'number' })}</div>
        ${field('prompt', '문제', '', { required: true })}${field('choices', '보기 (한 줄에 하나)', '', { rows: 3 })}${field('answer', '정답 번호 (첫 보기 = 0)', 0, { type: 'number' })}
        <button class="btn" type="submit">추가</button></form>`;
  },

  async inquiries() {
    const { inquiries } = await api('GET', '/api/admin/inquiries');
    return `<h1>문의</h1>${inquiries.map((q) => `<form data-save="inquiry" data-id="${q.id}" class="card" style="margin-top:12px">
      <div class="row between"><h3>${esc(q.subject)}</h3>${badge(q.status)}</div>
      <p class="small muted">${esc(q.email)} · ${esc(q.kind)} · ${esc(q.created_at)}</p><p style="white-space:pre-line">${esc(q.body)}</p>
      ${field('admin_reply', '답변', q.admin_reply, { rows: 3 })}
      <div class="grid g2">${field('status', '상태', q.status, { options: [['open', '접수'], ['answered', '답변 완료'], ['closed', '종료']] })}${field('sendEmail', '답변을 이메일로 보내기 (발송 서비스 연결 시)', false)}</div>
      <button class="btn" type="submit">저장</button></form>`).join('') || '<p class="muted">문의가 없습니다.</p>'}`;
  },

  async content() {
    const [{ items: notices }, { items: faqs }] = await Promise.all([api('GET', '/api/admin/notices'), api('GET', '/api/admin/faqs')]);
    const nForm = (n = {}) => `<form data-save="notice" data-id="${n.id || ''}" class="card" style="margin-top:12px">
      <div class="grid g2">${field('title_ko', '제목(한국어)', n.title_ko)}${field('title_en', '제목(영어)', n.title_en)}</div>
      <div class="grid g2">${field('body_ko', '내용(한국어)', n.body_ko, { rows: 3 })}${field('body_en', '내용(영어)', n.body_en, { rows: 3 })}</div>
      ${field('published', '공개', n.id ? n.published : true)}
      <div class="row"><button class="btn small" type="submit">${n.id ? '저장' : '공지 추가'}</button>${n.id ? `<button class="btn small ghost" type="button" data-act="del" data-path="/api/admin/notices/${n.id}">삭제</button>` : ''}</div></form>`;
    const fForm = (f = {}) => `<form data-save="faq" data-id="${f.id || ''}" class="card" style="margin-top:12px">
      <div class="grid g2">${field('q_ko', '질문(한국어)', f.q_ko)}${field('q_en', '질문(영어)', f.q_en)}${field('a_ko', '답변(한국어)', f.a_ko, { rows: 3 })}${field('a_en', '답변(영어)', f.a_en, { rows: 3 })}</div>
      ${field('sort', '순서', f.sort ?? 0, { type: 'number' })}
      <div class="row"><button class="btn small" type="submit">${f.id ? '저장' : 'FAQ 추가'}</button>${f.id ? `<button class="btn small ghost" type="button" data-act="del" data-path="/api/admin/faqs/${f.id}">삭제</button>` : ''}</div></form>`;
    return `<h1>공지·자주 묻는 질문</h1><h2>공지사항</h2>${notices.map(nForm).join('')}${nForm()}
      <h2 style="margin-top:28px">자주 묻는 질문</h2>${faqs.map(fForm).join('')}${fForm()}`;
  },

  async emails() {
    const { emails } = await api('GET', '/api/admin/emails');
    return `<h1>이메일 발송함</h1><div class="banner info">‘미발송(서비스 미연결)’은 발송 서비스가 연결되지 않아 실제로 보내지지 않은 메일입니다. 비밀번호 재설정 링크는 보안을 위해 여기에 남기지 않습니다.</div>
      ${table(['시각', '받는 사람', '종류', '제목', '상태'], emails.map((e) => [esc(e.created_at), esc(e.to_email), esc(e.template), `<details><summary>${esc(e.subject)}</summary><pre style="white-space:pre-wrap">${esc(e.body)}</pre></details>`, badge(e.status)]))}`;
  },

  async audit() {
    const [{ entries }, { events }] = await Promise.all([api('GET', '/api/admin/audit'), api('GET', '/api/admin/payment-events')]);
    return `<h1>변경 기록</h1><p class="small muted">결제·환불·수강 권한·가격·설정 변경이 자동으로 기록됩니다. 기록은 화면에서 수정·삭제할 수 없습니다.</p>
      ${table(['시각', '처리자', '작업', '대상', '내용'], entries.map((e) => [esc(e.created_at), esc(e.actor), esc(e.action), esc(e.target), `<code class="small">${esc(e.detail)}</code>`]))}
      <h2 style="margin-top:28px">결제 통지(웹훅) 수신 기록</h2>
      ${table(['시각', '결제사', '이벤트', '주문', '결과'], events.map((e) => [esc(e.created_at), esc(e.provider), `<code class="small">${esc(e.event_key)}</code>`, esc(e.order_no), `<code class="small">${esc(e.result)}</code>`]))}`;
  },

  async security() {
    return `<h1>보안 · 2단계 인증</h1>
      <div class="card"><p>현재 계정: <strong>${esc(me.email)}</strong> · 2단계 인증 ${me.totpEnabled ? badge('active') : '<span class="badge warn">미설정</span>'}</p>
      ${me.totpEnabled ? '<p>설정되어 있습니다. 로그인 시 인증 앱의 코드가 필요합니다.</p>' : `
        <ol><li>Google Authenticator, Microsoft Authenticator 등 인증 앱을 준비합니다.</li><li>아래 버튼으로 비밀 키를 만들고 앱에 직접 입력합니다.</li><li>앱에 표시된 6자리 코드를 입력해 활성화합니다.</li></ol>
        <button class="btn" type="button" data-act="mfaSetup">비밀 키 만들기</button><div id="mfa-box" style="margin-top:12px"></div>`}
      </div>`;
  }
};

function sectionFields(s) {
  return `<div class="grid g2">${field('label_ko', '반 이름(한국어)', s.label?.ko)}${field('label_en', '반 이름(영어)', s.label?.en)}
    ${field('format', '수업 방식', s.format, { options: [['group', '실시간 소그룹'], ['private', '1:1'], ['recorded', '녹화 학습']] })}
    ${field('timezone', '기준 시간대 (IANA)', s.timezone, { hint: '예: Asia/Seoul, America/New_York' })}
    ${field('capacity', '정원', s.capacity, { type: 'number' })}
    ${field('enroll_deadline', '신청 마감 (선택)', s.enrollDeadline ? s.enrollDeadline.slice(0, 16) : '', { type: 'datetime-local' })}
    ${field('status', '상태', s.status, { options: [['draft', '비공개'], ['open', '모집 중'], ['closed', '모집 마감']] })}</div>`;
}

function orderActions(o) {
  const out = [];
  if (['pending', 'awaiting_confirmation', 'expired', 'failed'].includes(o.status) && o.provider === 'link') {
    out.push(`<details><summary>결제 확인 후 등록</summary><form data-save="confirmManual" data-id="${esc(o.orderNo)}">
      ${field('reference', '거래번호·확인 근거', '', { required: true })}${field('paidAmount', `확인한 결제 금액 (${o.currency})`, '', { type: 'number', required: true })}
      <button class="btn small" type="submit">결제 확인 · 수강 등록</button></form></details>`);
  }
  if (['paid', 'partially_refunded'].includes(o.status)) {
    out.push(`<details><summary>환불</summary><form data-save="directRefund" data-id="${esc(o.orderNo)}">
      ${field('amount', `금액 (${o.currency})`, (o.amount - o.refundedAmount) / 10 ** digits(o.currency), { type: 'number' })}
      ${field('manualReference', '외부 환불 근거 (API 환불 불가 시)', '')}${field('revokeAccess', '수강 권한 종료', false)}${field('note', '메모', '')}
      <button class="btn small danger" type="submit">환불 처리</button></form></details>`);
  }
  if (o.needsReview) out.push(`<button class="btn small outline" data-act="resolveReview" data-id="${esc(o.orderNo)}">검토 완료</button>`);
  if (o.enrollment) out.push(`<button class="btn small ghost" data-act="enroll" data-id="${o.enrollment.id}" data-do="${o.enrollment.status === 'active' ? 'revoke' : 'restore'}">${o.enrollment.status === 'active' ? '수강 권한 종료' : '수강 권한 복구'}</button>`);
  return out.join('');
}

const savers = {
  async settings(f, b) {
    const rates = {};
    for (const line of String(b.rates || '').split('\n')) { const [k, v] = line.split('='); if (k && v) rates[k.trim().toUpperCase()] = Number(v); }
    delete b.rates;
    await api('PUT', '/api/admin/settings', { ...b, reference_rates: rates });
  },
  async instructor(f, b) { const id = f.dataset.id; await api(id ? 'PUT' : 'POST', `/api/admin/instructors${id ? '/' + id : ''}`, b); cache.editInstructor = null; },
  async course(f, b) {
    b.lessons = String(b.lessons || '').split('\n').map((l) => l.split('|')).filter((x) => x[0].trim()).map(([k, e]) => ({ title_ko: k.trim(), title_en: (e || '').trim() }));
    b.goals_ko = String(b.goals_ko || '').split('\n'); b.goals_en = String(b.goals_en || '').split('\n');
    b.formats ||= []; b.purposes ||= [];
    const id = f.dataset.id;
    const r = await api(id ? 'PUT' : 'POST', `/api/admin/courses${id ? '/' + id : ''}`, b);
    cache.editCourse = id ? Number(id) : r.id;
  },
  async section(f, b) {
    const id = f.dataset.id;
    const sessionsText = b.sessions;
    delete b.sessions;
    if (b.enroll_deadline) b.enroll_deadline = zonedToUtc(b.enroll_deadline.replace('T', ' '), b.timezone);
    if (id) {
      await api('PUT', `/api/admin/sections/${id}`, b);
      const sessions = String(sessionsText || '').split('\n').filter((l) => l.trim()).map((l) => {
        const [when, url] = l.split('|').map((x) => x.trim());
        return { startsAt: zonedToUtc(when, b.timezone), meetingUrl: url || '' };
      });
      await api('PUT', `/api/admin/sections/${id}/sessions`, { sessions });
    } else {
      await api('POST', '/api/admin/sections', { ...b, course_id: cache.sectionCourse || cache.courses[0].id });
    }
  },
  async refund(f, b) { await api('POST', `/api/admin/refunds/${f.dataset.id}`, { approve: true, amount: Number(b.amount), revokeAccess: b.revokeAccess, note: b.note, manualReference: b.manualReference }); },
  async directRefund(f, b) { await api('POST', `/api/admin/orders/${encodeURIComponent(f.dataset.id)}/refund`, { amount: Number(b.amount), revokeAccess: b.revokeAccess, note: b.note, manualReference: b.manualReference }); },
  async confirmManual(f, b) { await api('POST', `/api/admin/orders/${encodeURIComponent(f.dataset.id)}/confirm-manual`, { reference: b.reference, paidAmount: Number(b.paidAmount) }); },
  async material(f, b) { await api('POST', '/api/admin/materials', b); },
  async review(f, b) { await api('POST', '/api/admin/review-items', { ...b, choices: String(b.choices).split('\n') }); },
  async inquiry(f, b) { const r = await api('PUT', `/api/admin/inquiries/${f.dataset.id}`, b); if (r.emailStatus === 'not_configured') toast('이메일 서비스 미연결 — 메일은 발송되지 않았습니다.'); },
  async notice(f, b) { const id = f.dataset.id; await api(id ? 'PUT' : 'POST', `/api/admin/notices${id ? '/' + id : ''}`, b); },
  async faq(f, b) { const id = f.dataset.id; await api(id ? 'PUT' : 'POST', `/api/admin/faqs${id ? '/' + id : ''}`, b); }
};

const acts = {
  editInstructor(el) { cache.editInstructor = Number(el.dataset.id); show(); },
  newInstructor() { cache.editInstructor = null; show(); },
  editCourse(el) { cache.editCourse = Number(el.dataset.id); show(); },
  newCourse() { cache.editCourse = 0; show(); },
  closeCourse() { cache.editCourse = null; show(); },
  async del(el) { if (!confirm('삭제할까요? 되돌릴 수 없습니다.')) return; await api('DELETE', el.dataset.path); toast('삭제했습니다'); show(); },
  async rejectRefund(el) {
    const note = prompt('반려 사유 (학습자에게 전달)');
    if (note === null) return;
    await api('POST', `/api/admin/refunds/${el.dataset.id}`, { approve: false, note });
    show();
  },
  async resolveReview(el) { await api('POST', `/api/admin/orders/${encodeURIComponent(el.dataset.id)}/resolve-review`, { note: prompt('검토 메모') || '' }); show(); },
  async enroll(el) {
    if (!confirm(el.dataset.do === 'revoke' ? '수강 권한을 종료할까요? 화상 링크와 자료가 보이지 않게 됩니다.' : '수강 권한을 복구할까요?')) return;
    await api('POST', `/api/admin/enrollments/${el.dataset.id}/${el.dataset.do}`, { reason: prompt('사유') || '' });
    show();
  },
  async notify(el) {
    const text = document.getElementById('notify-' + el.dataset.id).value;
    const r = await api('POST', `/api/admin/sections/${el.dataset.id}/notify`, { text });
    toast(r.statuses.every((s) => s === 'sent') ? `${r.recipients}명에게 발송했습니다.` : `${r.recipients}명 대상 — 이메일 서비스 미연결로 발송되지 않았습니다.`);
  },
  async mfaSetup() {
    const r = await api('POST', '/api/auth/mfa/setup');
    document.getElementById('mfa-box').innerHTML = `<p>인증 앱에 아래 비밀 키를 입력하세요 (시간 기반, 6자리).</p>
      <p><code style="font-size:1.1rem;letter-spacing:2px">${esc(r.secret.replace(/(.{4})/g, '$1 ').trim())}</code></p>
      <form id="mfa-enable">${field('code', '앱에 표시된 6자리 코드', '', { required: true })}<button class="btn" type="submit">활성화</button></form>`;
    document.getElementById('mfa-enable').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try { await api('POST', '/api/auth/mfa/enable', { code: ev.target.code.value }); toast('2단계 인증을 켰습니다.'); me.totpEnabled = true; show(); } catch (e) { toast(err(e)); }
    });
  },
  async logout() { await api('POST', '/api/auth/logout'); location.reload(); }
};

async function show() {
  const panel = document.getElementById('panel');
  if (!panel) return;
  panel.innerHTML = '<p>불러오는 중…</p>';
  try {
    panel.innerHTML = await views[tab]();
    document.querySelectorAll('.admin-nav button').forEach((b) => {
      if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  } catch (e) {
    if (e.status === 401 || e.code === 'mfa_required') return viewLogin();
    panel.innerHTML = `<div class="banner danger">${esc(err(e))}</div>`;
  }
}

document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; cache.editCourse = null; cache.editInstructor = null; show(); document.getElementById('panel').focus?.(); return; }
  const a = ev.target.closest('[data-act]');
  if (a && acts[a.dataset.act]) { ev.preventDefault(); try { await acts[a.dataset.act](a); } catch (e) { toast(err(e)); } }
});

document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-save]');
  if (!f) return;
  ev.preventDefault();
  const btn = f.querySelector('[type=submit]');
  if (btn) btn.disabled = true;
  try {
    await savers[f.dataset.save](f, fd2obj(f));
    toast('저장했습니다');
    show();
  } catch (e) {
    toast(e.code === 'invalid_datetime_format' ? '날짜 형식은 YYYY-MM-DD HH:mm 입니다.' : err(e));
    if (btn) btn.disabled = false;
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.change) { cache[el.dataset.change] = el.value; show(); }
  if (el.dataset.check) { await api('PUT', '/api/admin/settings', { [el.dataset.check]: el.checked }); toast('저장했습니다'); }
  if (el.dataset.att && el.value) {
    try { await api('PUT', '/api/admin/attendance', { sessionId: Number(el.dataset.att), userId: Number(el.dataset.user), status: el.value }); toast('출석 저장'); } catch (e) { toast(err(e)); }
  }
});

async function start() {
  try {
    me = (await api('GET', '/api/auth/me')).user;
  } catch { me = null; }
  if (!me || me.role !== 'admin') return viewLogin();
  document.getElementById('logout').hidden = false;
  document.getElementById('logout').dataset.act = 'logout';
  $main.innerHTML = shell('');
  show();
}
start();
