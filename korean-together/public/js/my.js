import { S, render, go, refreshUser } from './app.js';
import { t, L, getLang } from './i18n.js';
import { esc, api, local, fmtMoney, timeZones, toast, safeHref, session } from './util.js';
import { sessionTimes, formatLabel } from './views-public.js';
import { authPanel } from './account.js';

let dash = null;
const quizState = {};

const statusBadge = (prefix, s) => {
  const cls = ['paid', 'processed', 'answered', 'present', 'active'].includes(s) ? 'green'
    : ['failed', 'cancelled', 'expired', 'refunded', 'rejected', 'absent', 'revoked'].includes(s) ? 'danger' : 'warn';
  return `<span class="badge ${cls}">${esc(t(prefix + s))}</span>`;
};

function nextClassCard() {
  const items = dash.learning.filter((l) => l.status === 'active' && l.nextSession)
    .sort((a, b) => Date.parse(a.nextSession.startsAt) - Date.parse(b.nextSession.startsAt));
  const n = items[0];
  if (!n) return `<div class="card"><h2>${esc(t('next_class'))}</h2><p class="muted">${esc(t('none_yet'))}</p></div>`;
  const s = n.nextSession;
  return `<div class="card" style="border-color:var(--green)">
    <h2>${esc(t('next_class'))}</h2>
    <p><strong>${esc(L(n.course))}</strong> · ${esc(L(n.section) || formatLabel(n.format))} · ${s.no}${getLang() === 'ko' ? '회차' : ''}</p>
    ${sessionTimes(s.startsAt, n.timezone)}
    <div style="margin-top:14px">${s.meetingUrl
      ? `<a class="btn" href="${safeHref(s.meetingUrl)}" target="_blank" rel="noopener">${esc(t('join'))} ↗</a>`
      : `<button class="btn" type="button" disabled>${esc(t('join'))}</button><p class="small muted">${esc(t('link_pending'))}</p>`}</div>
  </div>`;
}

function continueCard() {
  const l = dash.learning.find((x) => x.status === 'active' && x.lessons.some((y) => !y.done));
  if (!l) return '';
  const next = l.lessons.find((y) => !y.done);
  return `<div class="card"><h2>${esc(t('continue_learning'))}</h2>
    <p><strong>${esc(L(l.course))}</strong> — ${next.no}. ${esc(L(next.title))}</p>
    <div class="progress" role="progressbar" aria-valuenow="${l.progress}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(t('progress'))}"><span style="width:${l.progress}%"></span></div>
    <p class="small muted">${esc(t('progress'))} ${l.progress}%</p>
    <a class="btn outline" href="#course-${l.enrollmentId}">${esc(t('my_courses'))} ↓</a></div>`;
}

function courseBlock(l) {
  const active = l.status === 'active';
  return `<article class="card" id="course-${l.enrollmentId}">
    <div class="row between"><h3>${esc(L(l.course))} <span class="small muted">· ${esc(L(l.section) || formatLabel(l.format))}</span></h3>
      ${active ? `<span class="badge green">${esc(t('os_paid'))}</span>` : `<span class="badge danger">${esc(t('enroll_revoked'))}</span>`}</div>
    <div class="progress" aria-hidden="true"><span style="width:${l.progress}%"></span></div>
    <p class="small muted">${esc(t('progress'))} ${l.progress}%</p>
    <details open><summary><strong>${esc(t('d_lessons'))}</strong></summary>
      <ul class="plain" style="list-style:none;padding:0">${l.lessons.map((x) => `<li><label class="check" style="margin:6px 0">
        <input type="checkbox" data-progress="${l.courseId}" data-lesson="${x.no}" ${x.done ? 'checked' : ''} ${active ? '' : 'disabled'}>
        <span>${x.no}. ${esc(L(x.title))}</span></label></li>`).join('')}</ul></details>
    <details><summary><strong>${esc(t('materials'))}</strong></summary>
      ${l.materials.length ? `<ul class="plain">${l.materials.map((m) => `<li>${m.lesson_no ? `${m.lesson_no}. ` : ''}<a href="${safeHref(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a> <span class="badge">${esc(m.kind)}</span></li>`).join('')}</ul>`
        : `<p class="muted">${esc(t('no_materials'))}</p>`}</details>
    <details><summary><strong>${esc(t('attendance'))}</strong></summary>
      ${l.sessions.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">#</th><th scope="col">${esc(t('schedule'))}</th><th scope="col">${esc(t('attendance'))}</th></tr></thead>
        <tbody>${l.sessions.map((s) => `<tr><td>${s.no}</td><td>${sessionTimes(s.startsAt, l.timezone)}</td><td>${s.attendance ? statusBadge('att_', s.attendance) : '—'}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="muted">${esc(t('none_yet'))}</p>`}</details>
    ${active && l.review.length ? `<details><summary><strong>${esc(t('review_quiz'))}</strong></summary>${l.review.map((r) => {
      const a = quizState[r.id];
      return `<fieldset class="card" style="margin:10px 0"><legend class="legend">${esc(r.prompt)}</legend>
        <div class="options">${r.choices.map((c, i) => `<label class="option"><input type="radio" name="rv${r.id}" value="${i}" data-review="${r.id}" data-answer="${r.answer}" ${a === i ? 'checked' : ''}><span>${esc(c)}</span></label>`).join('')}</div>
        <p role="status" style="font-weight:700">${a === undefined ? '' : a === r.answer ? '✓ ' + esc(t('quiz_correct')) : esc(t('quiz_wrong'))}</p></fieldset>`;
    }).join('')}</details>` : ''}
  </article>`;
}

function favoritesBlock() {
  const localFavs = local.get('kt-favorites', []);
  const all = [...dash.favorites, ...localFavs.filter((f) => !dash.favorites.some((x) => x.phrase === f.phrase)).map((f) => ({ ...f, local: true }))];
  return `<div class="card"><h2>${esc(t('favorites'))}</h2>
    ${all.length ? `<ul class="plain" style="list-style:none;padding:0">${all.map((f) => `<li class="row between" style="border-bottom:1px solid var(--line);padding:8px 0">
      <span><strong lang="ko">${esc(f.phrase)}</strong> <span class="muted">${esc(f.meaning)}</span></span>
      ${f.local ? `<button class="btn small outline" type="button" data-act="favSync" data-phrase="${esc(f.phrase)}" data-meaning="${esc(f.meaning)}">${esc(t('save'))}</button>`
        : `<button class="btn small ghost" type="button" data-act="favDelete" data-id="${f.id}" aria-label="Delete ${esc(f.phrase)}">✕</button>`}</li>`).join('')}</ul>`
      : `<p class="muted">${esc(t('none_yet'))} <a href="#/trial">${esc(t('nav_trial'))}</a></p>`}</div>`;
}

function ordersBlock() {
  if (!dash.orders.length) return `<div class="card"><h2>${esc(t('orders'))}</h2><p class="muted">${esc(t('none_yet'))}</p></div>`;
  return `<div class="card"><h2>${esc(t('orders'))}</h2><div class="table-wrap"><table>
    <thead><tr><th scope="col">${esc(t('order_no'))}</th><th scope="col">${esc(t('nav_courses'))}</th><th scope="col">${esc(t('total'))}</th><th scope="col"></th><th scope="col"></th></tr></thead>
    <tbody>${dash.orders.map((o) => `<tr>
      <td><span class="small">${esc(o.orderNo)}</span><div class="small muted">${esc(o.createdAt)}</div></td>
      <td>${esc(L(o.course.title))}</td>
      <td>${esc(fmtMoney(o.amount, o.currency))}${o.refundedAmount ? `<div class="small">−${esc(fmtMoney(o.refundedAmount, o.currency))}</div>` : ''}</td>
      <td>${statusBadge('os_', o.status)}</td>
      <td><div class="row">
        ${['pending', 'failed', 'expired'].includes(o.status) ? `<a class="btn small" href="#/apply?order=${encodeURIComponent(o.orderNo)}">${esc(t('go_pay'))}</a>` : ''}
        ${['paid', 'partially_refunded', 'refunded'].includes(o.status) ? `<button class="btn small outline" type="button" data-act="receipt" data-order="${esc(o.orderNo)}">${esc(t('receipt'))}</button>` : ''}
        ${['paid', 'partially_refunded'].includes(o.status) ? `<button class="btn small ghost" type="button" data-act="refundOpen" data-order="${esc(o.orderNo)}">${esc(t('refund_req'))}</button>` : ''}
      </div></td></tr>`).join('')}</tbody></table></div>
    <div id="receipt-box" aria-live="polite"></div>
    <form data-form="refund" id="refund-form" class="card" style="margin-top:16px" hidden novalidate>
      <h3>${esc(t('refund_req'))} <span id="refund-order"></span></h3>
      <input type="hidden" name="orderNo">
      <div class="field"><label for="rf-reason">${esc(t('refund_reason'))} <span class="req">*</span></label><textarea id="rf-reason" name="reason" required></textarea></div>
      <p class="small muted">${esc(t('d_refund'))}: <a href="#/legal/refund">${esc(t('legal_refund'))}</a></p>
      <p class="error-text form-error" role="alert" tabindex="-1"></p>
      <button class="btn" type="submit">${esc(t('send'))}</button>
    </form>
    ${dash.refunds.length ? `<h3 style="margin-top:16px">${esc(t('refund_req'))}</h3><ul class="plain">${dash.refunds.map((r) =>
      `<li>${esc(r.order_no)} · ${statusBadge('rs_', r.status)} ${r.approvedMajor != null ? esc(r.approvedMajor) : ''} ${r.admin_note ? `<span class="muted">— ${esc(r.admin_note)}</span>` : ''}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function inquiryBlock() {
  return `<div class="card"><h2>${esc(t('inquiry'))}</h2>
    <form data-form="myInquiry" novalidate>
      <div class="field"><label for="mi-kind">${esc(t('kind'))}</label><select id="mi-kind" name="kind">${['general', 'consult', 'refund', 'tech'].map((k) => `<option value="${k}">${esc(t('k_' + k))}</option>`).join('')}</select></div>
      <div class="field"><label for="mi-subject">${esc(t('subject'))} <span class="req">*</span></label><input id="mi-subject" name="subject" type="text" required></div>
      <div class="field"><label for="mi-body">${esc(t('message'))} <span class="req">*</span></label><textarea id="mi-body" name="body" required></textarea></div>
      <p class="error-text form-error" role="alert" tabindex="-1"></p>
      <button class="btn" type="submit">${esc(t('send'))}</button>
    </form>
    ${dash.inquiries.length ? `<h3 style="margin-top:16px">${esc(t('inquiries'))}</h3>${dash.inquiries.map((q) => `<details class="faq"><summary>${esc(q.subject)} ${statusBadge('qs_', q.status)}</summary>
      ${q.admin_reply ? `<p><strong>${esc(t('reply'))}:</strong> <span style="white-space:pre-line">${esc(q.admin_reply)}</span></p>` : `<p class="muted">${esc(t('none_yet'))}</p>`}</details>`).join('')}` : ''}
  </div>`;
}

function profileBlock() {
  return `<div class="card"><h2>${esc(t('profile'))}</h2>
    <form data-form="profile" novalidate>
      <div class="field"><label for="pf-name">${esc(t('display_name'))}</label><input id="pf-name" name="displayName" type="text" value="${esc(S.user.displayName)}"></div>
      <div class="field"><label for="pf-tz">${esc(t('f_tz'))}</label><select id="pf-tz" name="timezone">${timeZones().map((z) => `<option ${z === S.user.timezone ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></div>
      <p class="small muted">${esc(t('email'))}: ${esc(S.user.email)}</p>
      <p class="error-text form-error" role="alert" tabindex="-1"></p>
      <button class="btn outline" type="submit">${esc(t('save'))}</button>
    </form></div>`;
}

export async function view() {
  if (!S.boot.serverConnected) return `<div class="wrap"><h1>${esc(t('my_title'))}</h1></div>`;
  if (!S.user) {
    try { sessionStorage.setItem('kt-after-login', '#/my'); } catch { /* noop */ }
    return `<div class="wrap" style="max-width:640px"><h1>${esc(t('my_title'))}</h1><div class="banner info">${esc(t('err_login_required'))}</div>${authPanel('page')}</div>`;
  }
  dash = await api('GET', '/api/me/dashboard');
  return `<div class="wrap"><h1>${esc(t('my_title'))}</h1>
    <div class="grid g2">${nextClassCard()}${continueCard() || favoritesBlock()}</div>
    <section class="block"><h2>${esc(t('my_courses'))}</h2>
      ${dash.learning.length ? `<div class="stack">${dash.learning.map(courseBlock).join('')}</div>` : `<div class="card"><p class="muted">${esc(t('none_yet'))}</p><a class="btn" href="#/courses">${esc(t('cta_find'))}</a></div>`}</section>
    <div class="stack">${continueCard() ? favoritesBlock() : ''}${ordersBlock()}${inquiryBlock()}${profileBlock()}</div>
  </div>`;
}

export const actions = {
  async receipt(el) {
    const r = await api('GET', `/api/me/orders/${encodeURIComponent(el.dataset.order)}/receipt`);
    const o = r.receipt;
    const iss = r.issuer;
    document.getElementById('receipt-box').innerHTML = `<div class="card" style="margin-top:16px"><h3>${esc(t('receipt'))}</h3>
      <dl class="facts"><dt>${esc(t('order_no'))}</dt><dd>${esc(o.orderNo)}</dd><dt>${esc(t('nav_courses'))}</dt><dd>${esc(L(o.course.title))}</dd>
      <dt>${esc(t('charge_amount'))}</dt><dd>${esc(fmtMoney(o.amount, o.currency))}</dd>
      ${o.refundedAmount ? `<dt>${esc(t('os_refunded'))}</dt><dd>${esc(fmtMoney(o.refundedAmount, o.currency))}</dd>` : ''}
      <dt>${esc(t('os_paid'))}</dt><dd>${esc(o.paidAt || '')}</dd>
      <dt>${esc(t('org'))}</dt><dd>${esc(iss.org || t('org_pending'))}${iss.businessRegNo ? ` · ${esc(iss.businessRegNo)}` : ''}</dd></dl>
      <p class="small muted">${esc(r.note)}</p><button class="btn small outline" type="button" data-act="print">Print</button></div>`;
  },
  print() { window.print(); },
  refundOpen(el) {
    const f = document.getElementById('refund-form');
    f.hidden = false;
    f.orderNo.value = el.dataset.order;
    document.getElementById('refund-order').textContent = el.dataset.order;
    f.querySelector('textarea').focus();
  },
  async favDelete(el) { await api('DELETE', `/api/me/favorites/${el.dataset.id}`); render({ keepFocus: true }); },
  async favSync(el) {
    await api('POST', '/api/me/favorites', { phrase: el.dataset.phrase, meaning: el.dataset.meaning });
    local.set('kt-favorites', local.get('kt-favorites', []).filter((f) => f.phrase !== el.dataset.phrase));
    render({ keepFocus: true });
  }
};

export const forms = {
  async refund(form, fd) {
    await api('POST', '/api/me/refund-requests', { orderNo: fd.get('orderNo'), reason: fd.get('reason') });
    toast(t('rs_requested'));
    render({ keepFocus: true });
  },
  async myInquiry(form, fd) {
    await api('POST', '/api/public/inquiries', { subject: fd.get('subject'), body: fd.get('body'), kind: fd.get('kind') });
    toast(t('help_sent'));
    render({ keepFocus: true });
  },
  async profile(form, fd) {
    await api('PUT', '/api/me/profile', { displayName: fd.get('displayName'), timezone: fd.get('timezone') });
    await refreshUser();
    toast(t('save') + ' ✓');
    render({ keepFocus: true });
  }
};

export async function onChange(ev) {
  const el = ev.target;
  if (el.dataset?.progress) {
    await api('POST', '/api/me/progress', { courseId: Number(el.dataset.progress), lessonNo: Number(el.dataset.lesson), done: el.checked }).catch(() => { el.checked = !el.checked; });
  }
  if (el.dataset?.review) {
    const a = Number(el.value);
    quizState[el.dataset.review] = a;
    const st = el.closest('fieldset').querySelector('[role=status]');
    st.textContent = a === Number(el.dataset.answer) ? '✓ ' + t('quiz_correct') : t('quiz_wrong');
  }
}

export function afterRender() {}
export { go, session };
