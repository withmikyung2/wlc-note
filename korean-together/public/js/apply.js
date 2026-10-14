import { S, render, go, refreshUser, paymentBanner } from './app.js';
import { t, L, getLang } from './i18n.js';
import { esc, api, session, fmtMoney, refConversions, timeZones, localTz, toast, errText, uid, safeHref } from './util.js';
import { formatLabel, reasonText, sessionTimes, priceHtml } from './views-public.js';
import { authPanel } from './account.js';

const LEVELS = ['none', 'beginner', 'elementary', 'intermediate', 'advanced'];
const PURPOSES = ['study', 'daily', 'work', 'friends', 'travel', 'family', 'culture', 'hobby'];
const STEP_KEYS = ['s_course', 's_schedule', 's_info', 's_review', 's_pay'];

// 신청 초안: 언어 전환·새로고침·결제 실패 후에도 유지 (탭 단위 sessionStorage)
const draft = () => session.get('kt-draft', { step: 0, courseSlug: '', sectionId: null, applicant: {}, consents: {}, idemKey: '', orderNo: '' });
const saveDraft = (d) => session.set('kt-draft', d);
const patch = (p) => { const d = { ...draft(), ...p }; saveDraft(d); return d; };

let currentOrder = null;
let lastCheckout = null;

function findCourse(slug) { return S.boot.courses.find((c) => c.slug === slug); }
function findSection(id) { for (const c of S.boot.courses) { const s = c.sections.find((x) => x.id === Number(id)); if (s) return { c, s }; } return {}; }

function stepsNav(step) {
  return `<ol class="steps" aria-label="${esc(t('apply_title'))}">${[...STEP_KEYS, 's_done'].map((k, i) =>
    `<li ${i === step ? 'aria-current="step"' : ''} class="${i < step ? 'done' : ''}">${esc(t(k))}</li>`).join('')}</ol>`;
}

const nav = (back, nextLabel = t('next'), nextAct = 'applyNext', disabled = false) => `<div class="row between" style="margin-top:20px">
  ${back ? `<button class="btn outline" type="button" data-act="applyBack">← ${esc(t('prev'))}</button>` : '<span></span>'}
  <button class="btn" type="button" data-act="${nextAct}" ${disabled ? 'disabled' : ''}>${esc(nextLabel)} →</button></div>`;

function stepCourse(d) {
  return `<fieldset style="border:0;padding:0;margin:0"><legend class="legend">${esc(t('choose_course'))}</legend>
    <div class="stack">${S.boot.courses.map((c) => {
      const open = c.sections.some((s) => s.purchasable);
      return `<label class="option"><input type="radio" name="course" value="${esc(c.slug)}" data-draft="courseSlug" ${d.courseSlug === c.slug ? 'checked' : ''}>
        <span><strong>${esc(L(c.title))}</strong><br><span class="small muted">${esc(L(c.level))} · ${c.price ? esc(fmtMoney(c.price.amount, c.price.currency)) : esc(t('tbd'))}
        ${open ? '' : ` · ${esc(t('r_schedule_tbd'))}`}</span></span></label>`;
    }).join('')}</div></fieldset>${nav(false)}`;
}

function stepSchedule(d) {
  const c = findCourse(d.courseSlug);
  if (!c) return stepCourse(d);
  const any = c.sections.some((s) => s.purchasable);
  return `<h3>${esc(L(c.title))}</h3>
    ${any ? '' : `<div class="banner warn">${esc(t('blocked_pay'))}</div>`}
    <fieldset style="border:0;padding:0;margin:0"><legend class="legend">${esc(t('choose_section'))}</legend>
    <div class="stack">${c.sections.length ? c.sections.map((s) => `<label class="option">
      <input type="radio" name="section" value="${s.id}" data-draft="sectionId" ${Number(d.sectionId) === s.id ? 'checked' : ''} ${s.purchasable ? '' : 'disabled'}>
      <span><strong>${esc(L(s.label) || formatLabel(s.format))}</strong> · ${esc(formatLabel(s.format))}
        <span class="small">${s.sessions[0] ? sessionTimes(s.sessions[0].startsAt, s.timezone) : esc(t('r_schedule_tbd'))}</span>
        <span class="small muted">${s.sessions.length ? `${s.sessions.length}${getLang() === 'ko' ? '회' : ' classes'} · ` : ''}${esc(t('seats_left'))} ${s.remaining}/${s.capacity}</span>
        ${s.purchasable ? '' : `<br>${s.blockedReasons.map((r) => `<span class="badge warn">${esc(reasonText(r))}</span>`).join(' ')}`}
      </span></label>`).join('') : `<p class="muted">${esc(t('no_sections'))}</p>`}</div></fieldset>
    ${any ? '' : `<p style="margin-top:12px"><a class="btn outline" href="#/help?kind=consult&course=${encodeURIComponent(c.slug)}">${esc(t('consult'))}</a></p>`}
    ${nav(true, t('next'), 'applyNext', !any)}`;
}

function selectField(id, name, label, options, value) {
  return `<div class="field"><label for="${id}">${esc(label)} <span class="req" aria-hidden="true">*</span><span class="sr-only">(${esc(t('required'))})</span></label>
    <select id="${id}" name="${name}" required data-draft="applicant.${name}"><option value="">—</option>
    ${options.map(([v, l]) => `<option value="${esc(v)}" ${value === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
}

function stepInfo(d) {
  if (!S.user) return `<div class="banner info">${esc(t('login_to_continue'))}</div>${authPanel('apply')}<div class="row" style="margin-top:16px"><button class="btn outline" type="button" data-act="applyBack">← ${esc(t('prev'))}</button></div>`;
  const a = { timezone: S.user.timezone || localTz(), ...d.applicant };
  const { s } = findSection(d.sectionId);
  return `<form data-form="applyInfo" novalidate>
    <div class="grid g2">
      <div class="field"><label for="ap-name">${esc(t('f_name'))} <span class="req" aria-hidden="true">*</span><span class="sr-only">(${esc(t('required'))})</span></label>
        <input id="ap-name" name="name" type="text" autocomplete="name" required value="${esc(a.name || S.user.displayName || '')}" data-draft="applicant.name"></div>
      <div class="field"><label for="ap-email">${esc(t('email'))}</label><input id="ap-email" type="email" value="${esc(S.user.email)}" readonly></div>
      <div class="field"><label for="ap-country">${esc(t('f_country'))} <span class="req" aria-hidden="true">*</span><span class="sr-only">(${esc(t('required'))})</span></label>
        <input id="ap-country" name="country" type="text" autocomplete="country-name" required value="${esc(a.country || '')}" data-draft="applicant.country"></div>
      ${selectField('ap-tz', 'timezone', t('f_tz'), timeZones().map((z) => [z, z]), a.timezone)}
      ${selectField('ap-level', 'level', t('f_level'), LEVELS.map((v, i) => [v, t('lv' + i)]), a.level)}
      ${selectField('ap-purpose', 'purpose', t('f_purpose'), PURPOSES.map((p) => [p, t('p_' + p)]), a.purpose)}
      ${selectField('ap-format', 'format', t('f_format'), ['group', 'private', 'recorded'].map((f) => [f, formatLabel(f)]), a.format || s?.format)}
    </div>
    <p class="error-text form-error" role="alert" tabindex="-1"></p>
    <div class="row between"><button class="btn outline" type="button" data-act="applyBack">← ${esc(t('prev'))}</button><button class="btn" type="submit">${esc(t('next'))} →</button></div>
  </form>`;
}

function orderSummary({ c, s, amount, currency, orderNo, refundPolicy }) {
  const sessions = s?.sessions || [];
  const refs = refConversions(amount, currency, S.boot.settings.reference_rates);
  return `<dl class="facts">
    ${orderNo ? `<dt>${esc(t('order_no'))}</dt><dd><strong>${esc(orderNo)}</strong></dd>` : ''}
    <dt>${esc(t('nav_courses'))}</dt><dd>${esc(L(c.title))}</dd>
    <dt>${esc(t('d_teacher'))}</dt><dd>${c.instructor ? esc(L(c.instructor.name)) : esc(t('tbd'))}</dd>
    <dt>${esc(t('schedule'))}</dt><dd>${esc(L(s?.label) || formatLabel(s?.format))}${sessions[0] ? sessionTimes(sessions[0].startsAt, s.timezone) : ''}</dd>
    <dt>${esc(t('d_count'))}</dt><dd>${sessions.length ? `${sessions.length}${getLang() === 'ko' ? '회' : ' classes'}` : esc(formatLabel(s?.format))}${c.minutesPerSession ? ` · ${esc(t('per'))} ${c.minutesPerSession}${esc(t('minutes'))}` : ''}</dd>
    <dt>${esc(t('charge_amount'))}</dt><dd><strong style="font-size:1.25rem">${esc(fmtMoney(amount, currency))}</strong>
      ${refs.length ? `<div class="small muted">${esc(t('ref_conv'))}: ≈ ${esc(refs.join(' / '))} — ${esc(t('ref_conv_note'))}</div>` : ''}</dd>
    <dt>${esc(t('currency'))}</dt><dd>${esc(currency)}</dd>
    <dt>${esc(t('d_refund'))}</dt><dd style="white-space:pre-line">${esc(L(refundPolicy || c.refundPolicy))}</dd>
  </dl>`;
}

function stepReview(d) {
  const { c, s } = findSection(d.sectionId);
  if (!c || !c.price) return stepSchedule(d);
  const cs = d.consents || {};
  const check = (k, label, req, link) => `<label class="check"><input type="checkbox" name="${k}" ${cs[k] ? 'checked' : ''} data-draft="consents.${k}" ${req ? 'required' : ''}>
    <span>${req ? `<span class="req">[${esc(t('required'))}]</span>` : `<span class="opt-tag">[${esc(t('optional'))}]</span>`} ${esc(label)} ${link ? `<a href="${link}" target="_blank" rel="noopener">${esc(t('view'))}</a>` : ''}</span></label>`;
  return `<p>${esc(t('review_note'))}</p>
    <div class="card">${orderSummary({ c, s, amount: c.price.amount, currency: c.price.currency })}</div>
    <form data-form="applyConfirm" class="card" style="margin-top:16px" novalidate>
      ${check('terms', t('consent_terms'), true, '#/legal/terms')}
      ${check('privacy', t('consent_privacy'), true, '#/legal/privacy')}
      ${check('refund', t('consent_refund'), true, '#/legal/refund')}
      ${check('marketing', t('consent_marketing'), false)}
      <p class="small muted">${esc(t('hold_info', { m: 15 }))}</p>
      <p class="error-text form-error" role="alert" tabindex="-1"></p>
      <div class="row between"><button class="btn outline" type="button" data-act="applyBack">← ${esc(t('prev'))}</button>
        <button class="btn" type="submit">${esc(t('confirm_order'))}</button></div>
    </form>`;
}

function stepPay(d) {
  const o = currentOrder;
  if (!o) return `<p>${esc(t('paying'))}</p>`;
  const c = S.boot.courses.find((x) => x.id === o.course.id) || { title: o.course.title, refundPolicy: o.refundPolicy };
  const { s } = findSection(o.section.id);
  const statusBadge = `<span class="badge ${o.status === 'paid' ? 'green' : ['failed', 'expired', 'cancelled'].includes(o.status) ? 'danger' : 'warn'}">${esc(t('os_' + o.status))}</span>`;
  let body = '';
  if (['paid', 'partially_refunded'].includes(o.status)) {
    body = `<div class="banner ok"><strong>${esc(t('pay_ok_title'))}</strong><br>${esc(t('pay_ok_desc'))}</div><a class="btn" href="#/my">${esc(t('go_my'))}</a>`;
  } else if (o.status === 'awaiting_confirmation') {
    body = `<div class="banner info">${esc(t('link_waiting'))}</div><a class="btn outline" href="#/my">${esc(t('go_my'))}</a>`;
  } else if (lastCheckout?.type === 'link' && o.status === 'pending') {
    body = `<div class="banner info">${esc(t('link_memo'))} <strong>${esc(o.orderNo)}</strong></div>
      <div class="row"><a class="btn" href="${safeHref(lastCheckout.url)}" target="_blank" rel="noopener">${esc(t('link_go'))} ↗</a>
      <button class="btn outline" type="button" data-act="applyReportPaid">${esc(t('link_paid'))}</button></div>`;
  } else if (['pending', 'failed', 'expired'].includes(o.status)) {
    body = `${o.status !== 'pending' ? `<div class="banner danger">${esc(t('pay_fail_desc'))}</div>` : ''}
      <div class="row"><button class="btn" type="button" data-act="applyPay">${esc(o.status === 'pending' ? t('go_pay') : t('pay_retry'))}</button>
      <button class="btn ghost" type="button" data-act="applyCancel">${esc(t('cancel_order'))}</button></div>
      <p class="small muted">${esc(t('hold_info', { m: 15 }))}</p>`;
  } else {
    body = `<a class="btn outline" href="#/my">${esc(t('go_my'))}</a>`;
  }
  return `${paymentBanner()}<div class="card"><div class="row between"><h3>${esc(t('s_pay'))}</h3>${statusBadge}</div>
    ${orderSummary({ c, s, amount: o.amount, currency: o.currency, orderNo: o.orderNo, refundPolicy: o.refundPolicy })}</div>
    <div class="stack" style="margin-top:16px">${body}</div>`;
}

export async function view(params, q) {
  if (!S.boot.serverConnected) return `<div class="wrap"><h1>${esc(t('apply_title'))}</h1></div>`;
  let d = draft();
  // 과정 상세에서 들어온 경우 선택 반영
  if (q.get('course') && q.get('course') !== d.courseSlug) d = patch({ courseSlug: q.get('course'), sectionId: null, step: 1, orderNo: '', idemKey: '' });
  if (q.get('section') && Number(q.get('section')) !== Number(d.sectionId)) d = patch({ sectionId: Number(q.get('section')), step: 2, orderNo: '', idemKey: '' });
  if (q.get('order')) d = patch({ orderNo: q.get('order'), step: 4 });
  currentOrder = null;
  if (d.orderNo && S.user) {
    try { currentOrder = (await api('GET', `/api/checkout/orders/${encodeURIComponent(d.orderNo)}`)).order; } catch { d = patch({ orderNo: '', step: Math.min(d.step, 3) }); }
  }
  if (d.orderNo && !S.user) d = patch({ step: 2 });
  const step = d.orderNo && currentOrder ? 4 : Math.min(d.step || 0, 3);
  const body = [stepCourse, stepSchedule, stepInfo, stepReview, stepPay][step](d);
  return `<div class="wrap" style="max-width:860px"><h1>${esc(t('apply_title'))}</h1>${stepsNav(step === 4 && currentOrder && ['paid', 'partially_refunded'].includes(currentOrder.status) ? 5 : step)}
    <h2 id="apply-step" style="font-size:1.2rem">${esc(t([...STEP_KEYS][step]))}</h2>${body}</div>`;
}

function focusStep() {
  const h = document.getElementById('apply-step');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
}
const rerender = () => render({ keepFocus: true }).then(focusStep);

export const actions = {
  applyNext() {
    const d = draft();
    if (d.step === 0 && !d.courseSlug) return toast(t('choose_course'));
    if (d.step === 1 && !d.sectionId) return toast(t('choose_section'));
    patch({ step: Math.min(3, (d.step || 0) + 1) });
    if (location.hash.includes('?')) location.hash = '#/apply'; else rerender();
  },
  applyBack() {
    const d = draft();
    patch({ step: Math.max(0, (d.step || 0) - 1) });
    if (location.hash.includes('?')) location.hash = '#/apply'; else rerender();
  },
  async applyPay() {
    const d = draft();
    const r = await api('POST', `/api/checkout/orders/${encodeURIComponent(d.orderNo)}/pay`);
    lastCheckout = r.checkout;
    currentOrder = r.order;
    if (r.checkout.type === 'test') { go(r.checkout.checkoutUrl); return; }
    if (r.checkout.type === 'toss') { await openToss(r.checkout); return; }
    rerender();
  },
  async applyReportPaid() {
    const d = draft();
    currentOrder = (await api('POST', `/api/checkout/orders/${encodeURIComponent(d.orderNo)}/reported-paid`)).order;
    lastCheckout = null;
    rerender();
  },
  async applyCancel() {
    const d = draft();
    await api('POST', `/api/checkout/orders/${encodeURIComponent(d.orderNo)}/cancel`);
    session.del('kt-draft');
    go('#/my');
  },
  async testPay(el) {
    const r = await api('POST', '/api/test-gateway/authorize', { orderId: el.dataset.order, outcome: el.dataset.outcome });
    if (r.ok) go(`#/pay/success?paymentKey=${encodeURIComponent(r.paymentKey)}&orderId=${encodeURIComponent(r.orderId)}&amount=${r.amount}`);
    else go(`#/pay/fail?code=${encodeURIComponent(r.code)}&orderId=${encodeURIComponent(r.orderId)}`);
  }
};

// 토스페이먼츠 v2 결제창: 공개 클라이언트 키만 사용, 비밀 키는 서버에만 있음
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = src; el.onload = resolve; el.onerror = reject;
    document.head.appendChild(el);
  });
}
async function openToss(co) {
  await loadScript('https://js.tosspayments.com/v2/standard');
  const toss = window.TossPayments(co.clientKey);
  const payment = toss.payment({ customerKey: co.customerKey });
  await payment.requestPayment({
    method: 'CARD', amount: { currency: co.currency, value: co.amount }, orderId: co.orderId, orderName: co.orderName,
    successUrl: co.successUrl, failUrl: co.failUrl, customerEmail: co.customerEmail
  });
}

export const forms = {
  async applyInfo(form, fd) {
    const applicant = Object.fromEntries(['name', 'country', 'timezone', 'level', 'purpose', 'format'].map((k) => [k, String(fd.get(k) || '').trim()]));
    if (Object.values(applicant).some((v) => !v)) {
      const first = [...form.querySelectorAll('[required]')].find((el) => !el.value.trim());
      first?.setAttribute('aria-invalid', 'true');
      throw Object.assign(new Error(), { code: 'missing_fields' });
    }
    patch({ applicant, step: 3 });
    if (location.hash.includes('?')) location.hash = '#/apply'; else rerender();
  },
  async applyConfirm(form, fd) {
    const consents = { terms: !!fd.get('terms'), privacy: !!fd.get('privacy'), refund: !!fd.get('refund'), marketing: !!fd.get('marketing') };
    if (!consents.terms || !consents.privacy || !consents.refund) throw Object.assign(new Error(), { code: 'consent_required' });
    let d = draft();
    // 같은 신청에서 버튼을 여러 번 눌러도 주문이 하나만 생기도록 멱등키 고정
    if (!d.idemKey) d = patch({ idemKey: uid() });
    const r = await api('POST', '/api/checkout/orders', { sectionId: d.sectionId, applicant: d.applicant, consents, idempotencyKey: d.idemKey });
    patch({ consents, orderNo: r.order.orderNo, step: 4 });
    currentOrder = r.order;
    if (location.hash.includes('?')) location.hash = '#/apply'; else rerender();
  }
};

export function onChange(ev) {
  const key = ev.target.dataset?.draft;
  if (!key || !location.hash.startsWith('#/apply')) return;
  const d = draft();
  const val = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
  if (key === 'courseSlug') saveDraft({ ...d, courseSlug: val, sectionId: null, orderNo: '', idemKey: '' });
  else if (key === 'sectionId') saveDraft({ ...d, sectionId: Number(val), orderNo: '', idemKey: '' });
  else if (key.startsWith('applicant.')) saveDraft({ ...d, applicant: { ...d.applicant, [key.slice(10)]: val } });
  else if (key.startsWith('consents.')) saveDraft({ ...d, consents: { ...d.consents, [key.slice(9)]: val } });
}
export const onInput = (ev) => { if (ev.target.dataset?.draft?.startsWith('applicant.')) onChange(ev); };

// ── 결제창 (테스트) / 성공 / 실패 화면 ──
export function testGateway(params, q) {
  const o = currentOrder;
  return `<div class="wrap" style="max-width:640px"><h1>${esc(t('test_gateway'))}</h1>
    <div class="banner warn"><strong>TEST</strong> · ${esc(t('test_gateway_desc'))}</div>
    <div class="card"><p>${esc(t('order_no'))}: <strong>${esc(q.get('orderId'))}</strong></p>
      ${o ? `<p>${esc(t('charge_amount'))}: <strong>${esc(fmtMoney(o.amount, o.currency))}</strong></p>` : ''}
      <div class="stack">
        <button class="btn block" type="button" data-act="testPay" data-outcome="success" data-order="${esc(q.get('orderId'))}">${esc(t('test_success'))}</button>
        <button class="btn outline block" type="button" data-act="testPay" data-outcome="fail" data-order="${esc(q.get('orderId'))}">${esc(t('test_fail'))}</button>
        <button class="btn ghost block" type="button" data-act="testPay" data-outcome="cancel" data-order="${esc(q.get('orderId'))}">${esc(t('test_cancel'))}</button>
      </div></div></div>`;
}

const confirmed = new Map();
export async function paySuccess(params, q) {
  const key = `${q.get('orderId')}|${q.get('paymentKey')}`;
  // 같은 화면이 다시 그려져도 승인 요청은 한 번만 (서버도 중복 승인을 막음)
  if (!confirmed.has(key)) {
    confirmed.set(key, api('POST', '/api/checkout/confirm', { paymentKey: q.get('paymentKey'), orderId: q.get('orderId'), amount: Number(q.get('amount')) }));
  }
  try {
    const r = await confirmed.get(key);
    session.del('kt-draft');
    currentOrder = r.order;
    return `<div class="wrap" style="max-width:760px"><h1>${esc(t('pay_ok_title'))}</h1>${stepsNav(5)}
      <div class="banner ok">${esc(t('pay_ok_desc'))}</div>
      <div class="card">${orderSummary({ c: S.boot.courses.find((c) => c.id === r.order.course.id) || { title: r.order.course.title }, s: findSection(r.order.section.id).s, amount: r.order.amount, currency: r.order.currency, orderNo: r.order.orderNo, refundPolicy: r.order.refundPolicy })}</div>
      <p style="margin-top:16px"><a class="btn" href="#/my">${esc(t('go_my'))}</a></p></div>`;
  } catch (e) {
    return `<div class="wrap" style="max-width:760px"><h1>${esc(t('pay_fail_title'))}</h1>
      <div class="banner danger">${esc(errText(e))}</div><p>${esc(t('pay_fail_desc'))}</p>
      <div class="row"><a class="btn" href="#/apply">${esc(t('pay_retry'))}</a><a class="btn outline" href="#/help?kind=consult">${esc(t('consult'))}</a></div></div>`;
  }
}

export async function payFail(params, q) {
  if (q.get('orderId') && S.user) await api('POST', '/api/checkout/fail', { orderId: q.get('orderId'), code: q.get('code') || 'user_failed' }).catch(() => {});
  return `<div class="wrap" style="max-width:760px"><h1>${esc(t('pay_fail_title'))}</h1>
    <div class="banner danger">${esc(t('pay_fail_desc'))}${q.get('code') ? ` <span class="small">(${esc(q.get('code'))})</span>` : ''}</div>
    <div class="row"><a class="btn" href="#/apply">${esc(t('pay_retry'))}</a><a class="btn outline" href="#/help?kind=consult">${esc(t('consult'))}</a></div></div>`;
}

export function afterRender() {}
export async function afterLogin() { await refreshUser(); }
export { priceHtml };
