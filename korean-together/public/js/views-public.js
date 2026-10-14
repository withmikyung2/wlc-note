import { S, render } from './app.js';
import { t, L, getLang } from './i18n.js';
import { esc, api, fmtDT, fmtDate, fmtMoney, refConversions, localTz, toast, safeHref } from './util.js';

const PURPOSES = ['study', 'daily', 'work', 'friends', 'travel', 'family', 'culture', 'hobby'];
const FORMATS = ['group', 'private', 'recorded'];

export const userTz = () => S.user?.timezone || localTz();

export function priceHtml(course, { withRef = true } = {}) {
  if (!course.price) return `<span class="badge warn">${esc(t('tbd'))}</span>`;
  const refs = withRef ? refConversions(course.price.amount, course.price.currency, S.boot.settings.reference_rates) : [];
  return `<strong>${esc(fmtMoney(course.price.amount, course.price.currency))}</strong>
    ${refs.length ? `<div class="small muted">${esc(t('ref_conv'))}: ≈ ${esc(refs.join(' / '))} — ${esc(t('ref_conv_note'))}</div>` : ''}`;
}

export const formatLabel = (f) => t('fmt_' + f);
export const reasonText = (r) => t('r_' + r);

export function sessionTimes(iso, baseTz) {
  const mine = userTz();
  return `<div>${esc(fmtDT(iso, baseTz))} <span class="small muted">(${esc(t('base_time'))} ${esc(baseTz)})</span></div>
    ${mine !== baseTz ? `<div class="small">${esc(t('local_time'))}: ${esc(fmtDT(iso, mine))} <span class="muted">(${esc(mine)})</span></div>` : ''}`;
}

function courseCard(c) {
  const open = c.sections.filter((s) => s.purchasable).length;
  return `<article class="card course-card">
    <div class="row">${c.formats.map((f) => `<span class="badge">${esc(formatLabel(f))}</span>`).join('')}</div>
    <h3>${esc(L(c.title))}</h3>
    <p class="muted">${esc(L(c.summary))}</p>
    <div class="meta">${esc(t('d_level'))}: ${esc(L(c.level))}</div>
    <div class="meta">${esc(t('d_price'))}: ${priceHtml(c, { withRef: false })}</div>
    <div class="meta">${open ? `<span class="badge green">${esc(t('apply'))} · ${open}</span>` : `<span class="badge">${esc(t('r_schedule_tbd'))}</span>`}</div>
    <div class="actions"><a class="btn outline block" href="#/courses/${encodeURIComponent(c.slug)}">${esc(t('view_detail'))}<span class="sr-only">: ${esc(L(c.title))}</span></a></div>
  </article>`;
}

// ── 과정 추천: 수준·목적·속도(·방식) 기준. 나이는 사용하지 않음 ──
export function recommend({ level, purpose, pace, format }) {
  const lv = Number(level);
  const scored = S.boot.courses.map((c) => {
    let score = 0;
    const why = [];
    if (lv >= c.levelMin && lv <= c.levelMax) { score += 3; why.push('reco_reason_level'); } else if (lv < c.levelMin) score -= 6; else score -= 2;
    if (purpose && c.purposes.includes(purpose)) { score += 3; why.push('reco_reason_purpose'); }
    if (format && c.formats.includes(format)) score += 2;
    if (pace === 'slow' && (c.formats.includes('recorded') || c.formats.includes('private') || c.category === 'senior')) { score += 1; why.push('reco_reason_pace'); }
    if (pace === 'fast' && c.formats.includes('private')) { score += 1; why.push('reco_reason_pace'); }
    if (lv === 0 && c.slug === 'hangul-first-steps') { score += 5; why.unshift('reco_reason_hangul'); }
    if (c.category === 'private' && !(format === 'private' || pace === 'fast')) score -= 2;
    return { c, score, why };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

export function recoForm(prefix = 'reco') {
  const opt = (name, value, label, checked) => `<label class="option"><input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''} required><span>${esc(label)}</span></label>`;
  return `<form data-form="reco" class="stack" id="${prefix}-form">
    <fieldset style="border:0;padding:0;margin:0"><legend class="legend">${esc(t('level_q'))}</legend>
      <div class="options">${[0, 1, 2, 3, 4].map((n) => opt('level', n, t('lv' + n))).join('')}</div></fieldset>
    <fieldset style="border:0;padding:0;margin:0"><legend class="legend">${esc(t('purpose_q'))}</legend>
      <div class="options">${PURPOSES.map((p) => opt('purpose', p, t('p_' + p))).join('')}</div></fieldset>
    <fieldset style="border:0;padding:0;margin:0"><legend class="legend">${esc(t('pace_q'))}</legend>
      <div class="options">${['slow', 'standard', 'fast'].map((p) => opt('pace', p, t('pace_' + p))).join('')}</div></fieldset>
    <fieldset style="border:0;padding:0;margin:0"><legend class="legend">${esc(t('format_q'))} <span class="opt-tag">(${esc(t('optional'))})</span></legend>
      <div class="options">${FORMATS.map((f) => `<label class="option"><input type="radio" name="format" value="${f}"><span>${esc(formatLabel(f))}</span></label>`).join('')}</div></fieldset>
    <div><button class="btn" type="submit">${esc(t('reco_btn'))}</button></div>
    <div id="${prefix}-result" aria-live="polite"></div>
  </form>`;
}

export function recoResult(list) {
  return `<div class="card" style="background:var(--green-soft)">
    <h3>${esc(t('reco_result'))}</h3>
    <div class="grid g3">${list.map(({ c, why }) => `<div class="card course-card">
      <h3>${esc(L(c.title))}</h3>
      <ul class="plain small">${[...new Set(why)].map((w) => `<li>${esc(t(w))}</li>`).join('')}</ul>
      <div class="actions row"><a class="btn small" href="#/courses/${encodeURIComponent(c.slug)}">${esc(t('view_detail'))}</a></div>
    </div>`).join('')}</div>
    <p class="small muted" style="margin-top:12px">※ ${esc(t('reco_note'))}</p>
  </div>`;
}

export const forms = {
  async reco(form, fd) {
    const list = recommend({ level: fd.get('level'), purpose: fd.get('purpose'), pace: fd.get('pace'), format: fd.get('format') });
    const box = form.querySelector('[id$="-result"]');
    box.innerHTML = recoResult(list);
    box.querySelector('h3')?.setAttribute('tabindex', '-1');
    box.querySelector('h3')?.focus();
  },
  async inquiry(form, fd) {
    await api('POST', '/api/public/inquiries', { email: fd.get('email'), subject: fd.get('subject'), body: fd.get('body'), kind: fd.get('kind') });
    form.reset();
    toast(t('help_sent'));
    form.querySelector('.form-ok').textContent = t('help_sent');
  }
};

function sectionRows() {
  const rows = [];
  for (const c of S.boot.courses) for (const s of c.sections) rows.push({ c, s });
  if (!rows.length) return `<div class="card"><p class="muted">${esc(t('no_sections'))} ${esc(t('tbd'))}</p></div>`;
  return `<div class="table-wrap"><table>
    <thead><tr><th scope="col">${esc(t('nav_courses'))}</th><th scope="col">${esc(t('d_format'))}</th><th scope="col">${esc(t('d_start'))}</th><th scope="col">${esc(t('d_cap'))}</th><th scope="col"></th></tr></thead>
    <tbody>${rows.map(({ c, s }) => `<tr>
      <td><strong>${esc(L(c.title))}</strong><div class="small muted">${esc(L(s.label))}</div></td>
      <td>${esc(formatLabel(s.format))}</td>
      <td>${s.sessions[0] ? sessionTimes(s.sessions[0].startsAt, s.timezone) : esc(t('tbd'))}</td>
      <td>${s.purchasable ? `${esc(t('seats_left'))} ${s.remaining}${esc(t('seats'))}` : s.blockedReasons.map((r) => `<span class="badge warn">${esc(reasonText(r))}</span>`).join(' ')}</td>
      <td><a class="btn small outline" href="#/courses/${encodeURIComponent(c.slug)}">${esc(t('view_detail'))}</a></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function inquiryForm(kind = 'general', subject = '') {
  return `<form data-form="inquiry" class="card" novalidate>
    <div class="field"><label for="iq-email">${esc(t('email'))} <span class="req">*</span></label>
      <input id="iq-email" name="email" type="email" autocomplete="email" required value="${esc(S.user?.email || '')}" ${S.user ? 'readonly' : ''}></div>
    <div class="field"><label for="iq-kind">${esc(t('kind'))}</label>
      <select id="iq-kind" name="kind">${['general', 'consult', 'trial', 'refund', 'tech'].map((k) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(t('k_' + k))}</option>`).join('')}</select></div>
    <div class="field"><label for="iq-subject">${esc(t('subject'))} <span class="req">*</span></label><input id="iq-subject" name="subject" type="text" required value="${esc(subject)}"></div>
    <div class="field"><label for="iq-body">${esc(t('message'))} <span class="req">*</span></label><textarea id="iq-body" name="body" required></textarea></div>
    <p class="error-text form-error" role="alert" tabindex="-1"></p><p class="form-ok" role="status" style="color:var(--green)"></p>
    <button class="btn" type="submit" ${S.boot.serverConnected ? '' : 'disabled'}>${esc(t('send'))}</button>
  </form>`;
}

function faqList(limit) {
  const list = limit ? S.boot.faqs.slice(0, limit) : S.boot.faqs;
  return list.map((f) => `<details class="faq"><summary>${esc(L(f.q))}</summary><p>${esc(L(f.a))}</p></details>`).join('');
}

function teacherCards() {
  if (!S.boot.instructors.length) return `<div class="card"><p class="muted">${esc(t('teacher_pending'))}</p></div>`;
  return S.boot.instructors.map((i) => `<article class="card">
    <div class="row" style="align-items:flex-start;gap:20px">
      ${i.photoUrl ? `<img src="${safeHref(i.photoUrl)}" alt="" width="120" height="120" style="border-radius:16px;object-fit:cover">` : ''}
      <div style="flex:1;min-width:240px">
        <h3>${esc(L(i.name))}</h3>
        <p style="white-space:pre-line">${esc(L(i.bio))}</p>
        ${i.qualifications ? `<p><strong>${esc(t('qualifications'))}</strong><br><span style="white-space:pre-line">${esc(i.qualifications)}</span></p>` : ''}
        ${i.career ? `<p><strong>${esc(t('career'))}</strong><br><span style="white-space:pre-line">${esc(i.career)}</span></p>` : ''}
      </div>
    </div></article>`).join('');
}

export function home() {
  const s = S.boot.settings;
  const easy = document.documentElement.classList.contains('easy');
  const notices = S.boot.notices.length ? `<div class="banner info" role="note"><strong>${esc(L(S.boot.notices[0].title))}</strong> — ${esc(L(S.boot.notices[0].body))}</div>` : '';
  const hero = `<section class="hero" aria-labelledby="hero-title">
      <div>
        <p class="eyebrow">${esc(getLang() === 'en' ? s.site_name_en : s.site_name_ko)}</p>
        <h1 id="hero-title">${esc(L({ ko: s.tagline_ko, en: s.tagline_en }))}</h1>
        <p class="lead">${esc(L({ ko: s.intro_ko, en: s.intro_en }))}</p>
        <div class="row" style="margin-top:20px"><a class="btn" href="#/trial">${esc(t('cta_trial'))}</a><a class="btn outline" href="#/courses">${esc(t('cta_find'))}</a></div>
      </div>
      <div class="hero-card" aria-hidden="true">
        <div class="big">안녕하세요.</div>
        <p class="muted">an-nyeong-ha-se-yo · Hello</p>
        <div class="big" style="font-size:1.6rem">만나서 반갑습니다.</div>
        <p class="muted">man-na-seo ban-gap-seum-ni-da · Nice to meet you</p>
      </div>
    </section>`;
  const audience = `<div class="grid g2">
      <article class="card"><h3>${esc(t('youth_title'))}</h3><p class="muted">${esc(t('youth_desc'))}</p></article>
      <article class="card"><h3>${esc(t('senior_title'))}</h3><p class="muted">${esc(t('senior_desc'))}</p></article>
    </div>`;
  const purposeCards = `<section class="block" aria-labelledby="h-purpose"><div class="section-head"><h2 id="h-purpose">${esc(t('home_purpose_title'))}</h2><p>${esc(t('home_purpose_desc'))}</p></div>
      ${audience}<div class="grid g3" style="margin-top:16px">${S.boot.courses.map(courseCard).join('')}</div></section>`;
  if (easy) {
    return `<div class="wrap">${notices}${hero}${purposeCards}
      <section class="block"><h2>${esc(t('home_faq_title'))}</h2>${faqList(3)}<a class="btn outline" href="#/help">${esc(t('easy_help'))}</a></section></div>`;
  }
  return `<div class="wrap">${notices}${hero}${purposeCards}
    <section class="block" aria-labelledby="h-reco"><div class="section-head"><h2 id="h-reco">${esc(t('home_reco_title'))}</h2><p>${esc(t('home_reco_desc'))}</p></div>
      <div class="card">${recoForm('home')}</div></section>
    <section class="block" aria-labelledby="h-how"><div class="section-head"><h2 id="h-how">${esc(t('home_how_title'))}</h2></div>
      <ol class="flow">${[1, 2, 3, 4].map((n) => `<li><strong>${esc(t('how_' + n))}</strong><p class="muted small">${esc(t('how_' + n + 'd'))}</p></li>`).join('')}</ol>
      <div class="grid g3" style="margin-top:16px">${FORMATS.map((f) => `<div class="card"><h3>${esc(formatLabel(f))}</h3><p class="muted small">${esc(t('fmt_' + f + '_d'))}</p></div>`).join('')}</div></section>
    <section class="block" aria-labelledby="h-teacher"><div class="section-head"><h2 id="h-teacher">${esc(t('home_teacher_title'))}</h2></div>${teacherCards()}</section>
    <section class="block" aria-labelledby="h-sched"><div class="section-head"><h2 id="h-sched">${esc(t('home_sched_title'))}</h2></div>${sectionRows()}</section>
    <section class="block" aria-labelledby="h-faq"><div class="section-head"><h2 id="h-faq">${esc(t('home_faq_title'))}</h2></div>${faqList(5)}</section>
    <section class="block" aria-labelledby="h-contact"><div class="section-head"><h2 id="h-contact">${esc(t('home_contact_title'))}</h2></div>
      <div class="grid g2">${inquiryForm()}<div class="card"><h3>${esc(t('org'))}</h3>${orgInfo()}</div></div></section>
  </div>`;
}

function orgInfo() {
  const s = S.boot.settings;
  const rows = [['org', s.org_name], ['rep', s.representative], ['addr', s.address], ['contact_email', s.contact_email], ['phone', s.phone]];
  return `<dl class="facts">${rows.map(([k, v]) => `<dt>${esc(t(k))}</dt><dd>${v ? esc(v) : `<span class="muted">${esc(t('org_pending'))}</span>`}</dd>`).join('')}</dl>`;
}

export function courses() {
  return `<div class="wrap"><h1>${esc(t('nav_courses'))}</h1><p class="muted">${esc(t('home_purpose_desc'))}</p>
    <div class="grid g3">${S.boot.courses.map(courseCard).join('')}</div>
    <section class="block"><h2>${esc(t('home_reco_title'))}</h2><div class="card">${recoForm('courses')}</div></section></div>`;
}

export function courseDetail({ slug }) {
  const c = S.boot.courses.find((x) => x.slug === slug);
  if (!c) return notFound();
  const goals = L(c.goals) || [];
  const purchasable = c.sections.filter((s) => s.purchasable);
  const count = c.sessionCount ? `${c.sessionCount}${getLang() === 'ko' ? t('times') : ' ' + t('times')}` : t('tbd');
  const mins = c.minutesPerSession ? `${t('per')} ${c.minutesPerSession}${t('minutes')}` : t('tbd');
  const sectionsHtml = c.sections.length ? c.sections.map((s) => `<div class="card">
      <div class="row between"><h3>${esc(L(s.label) || formatLabel(s.format))}</h3><span class="badge">${esc(formatLabel(s.format))}</span></div>
      <p>${esc(t('capacity'))} ${s.capacity} · ${esc(t('seats_left'))} ${s.remaining}${esc(t('seats'))}
        ${s.enrollDeadline ? ` · ~${esc(fmtDate(s.enrollDeadline, s.timezone))}` : ''}</p>
      ${s.sessions.length ? `<details><summary>${esc(t('schedule'))} (${s.sessions.length})</summary><ol class="lessons">${s.sessions.map((x) => `<li>${sessionTimes(x.startsAt, s.timezone)}</li>`).join('')}</ol></details>`
        : `<p class="muted">${esc(t('r_schedule_tbd'))}</p>`}
      <div class="row" style="margin-top:10px">${s.purchasable
        ? `<a class="btn small" href="#/apply?course=${encodeURIComponent(c.slug)}&section=${s.id}">${esc(t('apply'))}</a>`
        : s.blockedReasons.map((r) => `<span class="badge warn">${esc(reasonText(r))}</span>`).join(' ')}</div>
    </div>`).join('') : `<p class="muted">${esc(t('no_sections'))} ${esc(t('tbd'))}</p>`;
  const firstSection = c.sections.find((s) => s.sessions.length);
  return `<div class="wrap">
    <p><a href="#/courses">← ${esc(t('nav_courses'))}</a></p>
    <h1>${esc(L(c.title))}</h1>
    <p class="lead muted">${esc(L(c.summary))}</p>
    <div class="row" style="margin:16px 0 24px">
      <a class="btn outline" href="#/trial">${esc(t('cta_trial'))}</a>
      <a class="btn outline" href="#/help?kind=consult&course=${encodeURIComponent(c.slug)}">${esc(t('consult'))}</a>
      ${purchasable.length ? `<a class="btn" href="#/apply?course=${encodeURIComponent(c.slug)}">${esc(t('apply'))}</a>`
        : `<button class="btn" type="button" disabled aria-describedby="why-blocked">${esc(t('apply'))}</button>`}
    </div>
    ${purchasable.length ? '' : `<div class="banner warn" id="why-blocked">${esc(t('blocked_pay'))}</div>`}
    <div class="card"><dl class="facts">
      <dt>${esc(t('d_level'))}</dt><dd>${esc(L(c.level))}</dd>
      <dt>${esc(t('d_pre'))}</dt><dd>${esc(L(c.prerequisites))}</dd>
      <dt>${esc(t('d_goals'))}</dt><dd><ul class="plain">${goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></dd>
      <dt>${esc(t('d_lessons'))}</dt><dd><ol class="lessons">${c.lessons.map((l) => `<li>${esc(L(l.title))}</li>`).join('')}</ol></dd>
      <dt>${esc(t('d_teacher'))}</dt><dd>${c.instructor ? `<a href="#/teacher">${esc(L(c.instructor.name))}</a>` : esc(t('tbd'))}</dd>
      <dt>${esc(t('d_format'))}</dt><dd>${c.formats.map((f) => esc(formatLabel(f))).join(' · ')}</dd>
      <dt>${esc(t('d_count'))}</dt><dd>${esc(count)} · ${esc(mins)}</dd>
      <dt>${esc(t('d_start'))}</dt><dd>${firstSection ? sessionTimes(firstSection.sessions[0].startsAt, firstSection.timezone) : esc(t('tbd'))}</dd>
      <dt>${esc(t('d_tz'))}</dt><dd>${firstSection ? esc(firstSection.timezone) : esc(t('tbd'))} · ${esc(t('local_time'))}: ${esc(userTz())}</dd>
      <dt>${esc(t('d_cap'))}</dt><dd>${c.sections.length ? c.sections.map((s) => `${esc(L(s.label) || formatLabel(s.format))}: ${s.purchasable ? `${esc(t('seats_left'))} ${s.remaining}/${s.capacity}` : s.blockedReasons.map(reasonText).map(esc).join(', ')}`).join('<br>') : esc(t('tbd'))}</dd>
      <dt>${esc(t('d_price'))}</dt><dd>${priceHtml(c)}</dd>
      <dt>${esc(t('d_materials'))}</dt><dd>${esc(L(c.materials)) || esc(t('tbd'))}</dd>
      <dt>${esc(t('d_refund'))}</dt><dd style="white-space:pre-line">${esc(L(c.refundPolicy)) || `<span class="badge warn">${esc(t('r_refund_policy_tbd'))}</span>`}</dd>
    </dl></div>
    <section class="block"><h2>${esc(t('home_sched_title'))}</h2><div class="stack">${sectionsHtml}</div></section>
  </div>`;
}

export function teacher() {
  return `<div class="wrap"><h1>${esc(t('nav_teacher'))}</h1><div class="stack">${teacherCards()}</div></div>`;
}

export function help(params, q) {
  const course = S.boot.courses.find((c) => c.slug === q.get('course'));
  return `<div class="wrap"><h1>${esc(t('help_title'))}</h1>
    <section class="block"><h2>${esc(t('help_how'))}</h2>
      <ol class="flow">${[1, 2, 3, 4].map((n) => `<li><strong>${esc(t('how_' + n))}</strong><p class="muted small">${esc(t('how_' + n + 'd'))}</p></li>`).join('')}</ol></section>
    <section class="block"><h2>${esc(t('home_faq_title'))}</h2>${faqList()}</section>
    <section class="block" id="contact"><h2>${esc(t('help_contact'))}</h2>
      <div class="grid g2">${inquiryForm(q.get('kind') || 'general', course ? `[${L(course.title)}] ${t('consult')}` : '')}
      <div class="card"><h3>${esc(t('org'))}</h3>${orgInfo()}
        <p style="margin-top:16px"><a href="#/legal/terms">${esc(t('legal_terms'))}</a> · <a href="#/legal/privacy">${esc(t('legal_privacy'))}</a> · <a href="#/legal/refund">${esc(t('legal_refund'))}</a></p></div></div>
    </section></div>`;
}

export function legal({ kind }) {
  const s = S.boot.settings;
  const map = { terms: ['legal_terms', s.terms_ko, s.terms_en], privacy: ['legal_privacy', s.privacy_ko, s.privacy_en], refund: ['legal_refund', s.refund_general_ko, s.refund_general_en] };
  const [title, ko, en] = map[kind] || map.terms;
  const body = L({ ko, en });
  const perCourse = kind === 'refund' ? S.boot.courses.map((c) => `<h3>${esc(L(c.title))}</h3><p style="white-space:pre-line">${esc(L(c.refundPolicy)) || esc(t('r_refund_policy_tbd'))}</p>`).join('') : '';
  return `<div class="wrap"><h1>${esc(t(title))}</h1><div class="card">
    ${body ? `<div style="white-space:pre-line">${esc(body)}</div>` : `<div class="banner warn">${esc(t('legal_pending'))}</div>`}
    ${perCourse}</div></div>`;
}

export function notFound() {
  return `<div class="wrap"><h1>404</h1><p><a href="#/">${esc(t('nav_home'))}</a></p></div>`;
}

export function afterRender() {}
export { render };
