import { S, render, go, refreshUser } from './app.js';
import { t } from './i18n.js';
import { esc, api, localTz, toast } from './util.js';

let mode = 'signup';

function loginForm(ctx) {
  return `<form data-form="login" data-ctx="${ctx}" novalidate>
    <div class="field"><label for="${ctx}-li-email">${esc(t('email'))}</label><input id="${ctx}-li-email" name="email" type="email" autocomplete="email" required></div>
    <div class="field"><label for="${ctx}-li-pw">${esc(t('password'))}</label><input id="${ctx}-li-pw" name="password" type="password" autocomplete="current-password" required></div>
    <p class="error-text form-error" role="alert" tabindex="-1"></p>
    <div class="row between"><button class="btn" type="submit">${esc(t('login'))}</button><a href="#/forgot">${esc(t('forgot'))}</a></div>
  </form>`;
}

function signupForm(ctx) {
  return `<form data-form="signup" data-ctx="${ctx}" novalidate>
    <div class="field"><label for="${ctx}-su-email">${esc(t('email'))} <span class="req">*</span></label><input id="${ctx}-su-email" name="email" type="email" autocomplete="email" required></div>
    <div class="field"><label for="${ctx}-su-pw">${esc(t('password'))} <span class="req">*</span></label>
      <input id="${ctx}-su-pw" name="password" type="password" autocomplete="new-password" minlength="10" required aria-describedby="${ctx}-su-pw-hint">
      <span class="hint" id="${ctx}-su-pw-hint">${esc(t('password_hint'))}</span></div>
    <div class="field"><label for="${ctx}-su-name">${esc(t('display_name'))}</label><input id="${ctx}-su-name" name="displayName" type="text" autocomplete="nickname"></div>
    <label class="check"><input type="checkbox" name="agreeTerms" required><span><span class="req">[${esc(t('required'))}]</span> ${esc(t('agree_terms'))} <a href="#/legal/terms" target="_blank" rel="noopener">${esc(t('view'))}</a></span></label>
    <label class="check"><input type="checkbox" name="agreePrivacy" required><span><span class="req">[${esc(t('required'))}]</span> ${esc(t('agree_privacy'))} <a href="#/legal/privacy" target="_blank" rel="noopener">${esc(t('view'))}</a></span></label>
    <p class="error-text form-error" role="alert" tabindex="-1"></p>
    <button class="btn" type="submit">${esc(t('signup'))}</button>
  </form>`;
}

// 신청 화면 안에서 쓰는 로그인/가입 패널 (입력한 신청 정보는 그대로 유지)
export function authPanel(ctx) {
  return `<div class="card">
    <div class="row" role="group" aria-label="${esc(t('login'))} / ${esc(t('signup'))}" style="margin-bottom:16px">
      <button class="chip-btn" type="button" data-act="authMode" data-mode="signup" aria-pressed="${mode === 'signup'}">${esc(t('no_account'))} ${esc(t('signup'))}</button>
      <button class="chip-btn" type="button" data-act="authMode" data-mode="login" aria-pressed="${mode === 'login'}">${esc(t('have_account'))} ${esc(t('login'))}</button>
    </div>
    ${mode === 'login' ? loginForm(ctx) : signupForm(ctx)}</div>`;
}

const page = (title, body) => `<div class="wrap" style="max-width:560px"><h1>${esc(title)}</h1>${body}</div>`;

export function login() {
  if (!S.boot.serverConnected) return page(t('login'), `<div class="card">${esc(t('offline'))}</div>`);
  return page(t('login'), `<div class="card">${loginForm('page')}</div><p style="margin-top:16px">${esc(t('no_account'))} <a href="#/signup">${esc(t('signup'))}</a></p>`);
}
export function signup() {
  if (!S.boot.serverConnected) return page(t('signup'), `<div class="card">${esc(t('offline'))}</div>`);
  return page(t('signup'), `<div class="card">${signupForm('page')}</div><p style="margin-top:16px">${esc(t('have_account'))} <a href="#/login">${esc(t('login'))}</a></p>`);
}
export function forgot() {
  return page(t('reset_title'), `<form data-form="forgot" class="card" novalidate>
    <div class="field"><label for="fg-email">${esc(t('email'))}</label><input id="fg-email" name="email" type="email" autocomplete="email" required></div>
    <p class="error-text form-error" role="alert" tabindex="-1"></p><div class="form-ok" role="status"></div>
    <button class="btn" type="submit">${esc(t('reset_send'))}</button></form>`);
}
export function reset(params, q) {
  return page(t('reset_title'), `<form data-form="reset" class="card" novalidate>
    <input type="hidden" name="token" value="${esc(q.get('token') || '')}">
    <div class="field"><label for="rs-pw">${esc(t('reset_new'))}</label><input id="rs-pw" name="password" type="password" autocomplete="new-password" minlength="10" required>
      <span class="hint">${esc(t('password_hint'))}</span></div>
    <p class="error-text form-error" role="alert" tabindex="-1"></p>
    <button class="btn" type="submit">${esc(t('reset_save'))}</button></form>`);
}

async function afterAuth(form) {
  await refreshUser();
  const ctx = form.dataset.ctx;
  if (ctx === 'page') {
    const back = sessionStorage.getItem('kt-after-login');
    sessionStorage.removeItem('kt-after-login');
    go(back || '#/my');
  } else {
    render({ keepFocus: true }).then(() => document.getElementById('apply-step')?.focus());
  }
}

export const actions = {
  authMode(el) { mode = el.dataset.mode; render({ keepFocus: true }).then(() => document.querySelector(`[data-act="authMode"][data-mode="${mode}"]`)?.focus()); }
};

export const forms = {
  async login(form, fd) {
    const body = { email: fd.get('email'), password: fd.get('password') };
    const r = await api('POST', '/api/auth/login', body);
    if (r.mfaRequired) throw Object.assign(new Error(), { code: 'generic' });
    await afterAuth(form);
  },
  async signup(form, fd) {
    if (!fd.get('agreeTerms') || !fd.get('agreePrivacy')) throw Object.assign(new Error(), { code: 'consent_required' });
    const r = await api('POST', '/api/auth/signup', {
      email: fd.get('email'), password: fd.get('password'), displayName: fd.get('displayName'),
      agreeTerms: true, agreePrivacy: true, timezone: localTz()
    });
    if (r.emailStatus === 'not_configured') toast(t('email_not_configured'));
    await afterAuth(form);
  },
  async forgot(form, fd) {
    const r = await api('POST', '/api/auth/forgot', { email: fd.get('email') });
    form.querySelector('.form-ok').innerHTML = r.emailStatus === 'sent'
      ? `<div class="banner ok">${esc(t('reset_sent'))}</div>`
      : `<div class="banner warn">${esc(t('email_not_configured'))}</div>`;
  },
  async reset(form, fd) {
    await api('POST', '/api/auth/reset', { token: fd.get('token'), password: fd.get('password') });
    toast('OK');
    go('#/login');
  }
};
