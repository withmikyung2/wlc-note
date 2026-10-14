import { t, L, setLang, getLang } from './i18n.js';
import { esc, api, local, toast, errText } from './util.js';
import * as pub from './views-public.js';
import * as trial from './trial.js';
import * as apply from './apply.js';
import * as my from './my.js';
import * as account from './account.js';

export const S = { boot: null, user: null, route: { path: '/', parts: [], query: new URLSearchParams() } };

const modules = [pub, trial, apply, my, account];
const actions = Object.assign({}, ...modules.map((m) => m.actions || {}));
const forms = Object.assign({}, ...modules.map((m) => m.forms || {}));

const ROUTES = [
  ['/', pub.home, 'nav_home'],
  ['/courses', pub.courses, 'nav_courses'],
  ['/courses/:slug', pub.courseDetail, 'nav_courses'],
  ['/trial', trial.view, 'nav_trial'],
  ['/teacher', pub.teacher, 'nav_teacher'],
  ['/apply', apply.view, 'nav_apply'],
  ['/my', my.view, 'nav_my'],
  ['/help', pub.help, 'nav_help'],
  ['/legal/:kind', pub.legal, 'nav_help'],
  ['/login', account.login, null],
  ['/signup', account.signup, null],
  ['/forgot', account.forgot, null],
  ['/reset', account.reset, null],
  ['/pay/test', apply.testGateway, 'nav_apply'],
  ['/pay/success', apply.paySuccess, 'nav_apply'],
  ['/pay/fail', apply.payFail, 'nav_apply']
];

function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts, query: new URLSearchParams(qs || '') };
}

function matchRoute(route) {
  for (const [pattern, view, nav] of ROUTES) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== route.parts.length) continue;
    const params = {};
    if (pp.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(route.parts[i])), true) : p === route.parts[i]))) {
      return { view, nav, params };
    }
  }
  return { view: pub.notFound, nav: null, params: {} };
}

const NAV = [['/', 'nav_home'], ['/courses', 'nav_courses'], ['/trial', 'nav_trial'], ['/teacher', 'nav_teacher'], ['/apply', 'nav_apply'], ['/my', 'nav_my'], ['/help', 'nav_help']];

function header(activeNav) {
  const name = getLang() === 'en' ? S.boot.settings.site_name_en : S.boot.settings.site_name_ko;
  const sub = getLang() === 'en' ? S.boot.settings.site_name_ko : S.boot.settings.site_name_en;
  const large = document.documentElement.classList.contains('large');
  const easy = document.documentElement.classList.contains('easy');
  return `
    <div class="wrap">
      <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true">잇</span><span>${esc(name)}<small>${esc(sub)}</small></span></a>
      <div class="toggles" role="group" aria-label="${esc(t('t_large'))} / ${esc(t('t_easy'))}">
        <button class="chip-btn" type="button" data-act="lang" lang="${getLang() === 'ko' ? 'en' : 'ko'}" aria-label="${esc(t('t_lang_label'))}">${esc(t('t_lang'))}</button>
        <button class="chip-btn" type="button" data-act="large" aria-pressed="${large}">${esc(t('t_large'))}</button>
        <button class="chip-btn" type="button" data-act="easy" aria-pressed="${easy}">${esc(t('t_easy'))}</button>
        ${S.user
          ? `<button class="chip-btn" type="button" data-act="logout">${esc(t('logout'))}</button>`
          : `<a class="chip-btn" href="#/login" style="display:inline-flex;align-items:center;text-decoration:none">${esc(t('login'))}</a>`}
      </div>
      <nav class="nav" aria-label="Main">
        ${NAV.map(([href, key]) => `<a href="#${href}" ${activeNav === key ? 'aria-current="page"' : ''}>${esc(t(key))}</a>`).join('')}
      </nav>
      <nav class="easy-nav" aria-label="Simple">
        <a href="#/courses">${esc(t('easy_find'))}</a><a href="#/my">${esc(t('easy_my'))}</a><a href="#/help">${esc(t('easy_help'))}</a>
      </nav>
    </div>`;
}

function footer() {
  const s = S.boot.settings;
  const rows = [['org', s.org_name], ['rep', s.representative], ['bizno', s.business_reg_no], ['mailorder', s.mail_order_reg_no],
    ['addr', s.address], ['contact_email', s.contact_email], ['phone', s.phone], ['privacy_officer', s.privacy_officer]];
  return `<div class="wrap">
    <div class="row between" style="align-items:flex-start">
      <div>
        <strong>${esc(getLang() === 'en' ? s.site_name_en : s.site_name_ko)}</strong>
        <dl>${rows.map(([k, v]) => `<dt>${esc(t(k))}</dt><dd>${v ? esc(v) : `<span class="muted">${esc(t('org_pending'))}</span>`}</dd>`).join('')}</dl>
      </div>
      <nav aria-label="Legal" class="stack" style="min-width:200px">
        <div><a href="#/legal/terms">${esc(t('legal_terms'))}</a></div>
        <div><a href="#/legal/privacy"><strong>${esc(t('legal_privacy'))}</strong></a></div>
        <div><a href="#/legal/refund">${esc(t('legal_refund'))}</a></div>
        <div><a href="#/help">${esc(t('help_contact'))}</a></div>
      </nav>
    </div>
  </div>`;
}

export function banners() {
  const out = [];
  if (!S.boot.serverConnected) out.push(`<div class="banner warn" role="note">${esc(t('offline'))}</div>`);
  return out.join('');
}

export function paymentBanner() {
  const p = S.boot.payment;
  if (!S.boot.serverConnected) return '';
  if (!p.configured) return `<div class="banner warn" role="note">${esc(t('pay_unavailable'))}</div>`;
  if (p.mode === 'test' || !p.live) return `<div class="banner warn" role="note"><strong>TEST</strong> · ${esc(t('pay_test_banner'))}</div>`;
  if (p.mode === 'link') return `<div class="banner info" role="note">${esc(t('pay_link_banner'))}</div>`;
  return '';
}

let renderSeq = 0;
export async function render({ keepFocus = false } = {}) {
  const seq = ++renderSeq;
  S.route = parseRoute();
  const { view, nav, params } = matchRoute(S.route);
  document.getElementById('header').innerHTML = header(nav);
  document.getElementById('footer').innerHTML = footer();
  const main = document.getElementById('main');
  const html = await view(params, S.route.query);
  if (seq !== renderSeq) return;
  main.innerHTML = banners() + html;
  const site = getLang() === 'en' ? S.boot.settings.site_name_en : S.boot.settings.site_name_ko;
  const h1 = main.querySelector('h1');
  document.title = h1 ? `${h1.textContent.trim()} · ${site}` : site;
  modules.forEach((m) => m.afterRender && m.afterRender(S.route, params));
  if (!keepFocus && h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

export function go(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

export async function refreshUser() {
  if (!S.boot.serverConnected) { S.user = null; return; }
  try { S.user = (await api('GET', '/api/auth/me')).user; } catch { S.user = null; }
}

Object.assign(actions, {
  skip() { const m = document.getElementById('main'); m.focus(); m.scrollIntoView(); },
  lang() { const l = getLang() === 'ko' ? 'en' : 'ko'; setLang(l); local.set('kt-lang', l); render({ keepFocus: true }).then(() => document.querySelector('[data-act="lang"]')?.focus()); },
  large(el) { const on = !document.documentElement.classList.contains('large'); document.documentElement.classList.toggle('large', on); local.set('kt-large', on); el.setAttribute('aria-pressed', on); },
  easy() { const on = !document.documentElement.classList.contains('easy'); document.documentElement.classList.toggle('easy', on); local.set('kt-easy', on); render({ keepFocus: true }).then(() => document.querySelector('[data-act="easy"]')?.focus()); },
  async logout() { await api('POST', '/api/auth/logout').catch(() => {}); S.user = null; go('#/'); }
});

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  ev.preventDefault();
  try { await actions[el.dataset.act](el, ev); } catch (e) { toast(errText(e)); }
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('form[data-form]');
  if (!form || !forms[form.dataset.form]) return;
  ev.preventDefault();
  const btn = form.querySelector('[type=submit]');
  const err = form.querySelector('.form-error');
  if (err) err.textContent = '';
  if (btn) btn.disabled = true;
  try {
    await forms[form.dataset.form](form, new FormData(form));
  } catch (e) {
    if (err) { err.textContent = errText(e); err.focus?.(); } else toast(errText(e));
  } finally {
    if (btn && btn.isConnected) btn.disabled = false;
  }
});

// 입력하는 동안 신청서 초안을 저장해 언어 전환·새로고침에도 유지
document.addEventListener('input', (ev) => { modules.forEach((m) => m.onInput && m.onInput(ev)); });
document.addEventListener('change', (ev) => { modules.forEach((m) => m.onChange && m.onChange(ev)); });

async function loadBoot() {
  try {
    return await api('GET', '/api/public/bootstrap');
  } catch {
    const r = await fetch('./data/public-snapshot.json');
    if (!r.ok) throw new Error('boot_failed');
    return { ...(await r.json()), serverConnected: false };
  }
}

async function start() {
  // 결제사 복귀 주소(?kt=success|fail&...)를 화면 경로로 변환
  const sp = new URLSearchParams(location.search);
  if (sp.get('kt') === 'success' || sp.get('kt') === 'fail') {
    const kind = sp.get('kt');
    sp.delete('kt');
    history.replaceState(null, '', location.pathname + `#/pay/${kind}?${sp.toString()}`);
  }
  const prefLang = local.get('kt-lang') || ((navigator.language || 'ko').toLowerCase().startsWith('ko') ? 'ko' : 'en');
  setLang(prefLang);
  document.documentElement.classList.toggle('large', !!local.get('kt-large'));
  document.documentElement.classList.toggle('easy', !!local.get('kt-easy'));
  try {
    S.boot = await loadBoot();
  } catch {
    document.getElementById('main').innerHTML = '<div class="wrap"><div class="banner danger">Cannot load the site. 잠시 후 다시 시도해 주세요.</div></div>';
    return;
  }
  await refreshUser();
  window.addEventListener('hashchange', () => render());
  render({ keepFocus: true });
}

export { L, t };
start();
