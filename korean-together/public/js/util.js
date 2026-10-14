import { t, getLang } from './i18n.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeHref = (u) => (/^https?:\/\//i.test(String(u || '')) ? esc(u) : '#');

export async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-KT-Request': '1' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'error'), { code: data.error, status: res.status, detail: data.message });
  return data;
}

export function errText(e) {
  const key = 'err_' + (e?.code || 'generic');
  const s = t(key);
  return s === key ? t('err_generic') : s;
}

const store = (kind) => ({
  get(k, d = null) { try { const v = window[kind].getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { window[kind].setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경에서도 화면은 동작 */ } },
  del(k) { try { window[kind].removeItem(k); } catch { /* noop */ } }
});
export const local = store('localStorage');
export const session = store('sessionStorage');

const locale = () => (getLang() === 'ko' ? 'ko-KR' : 'en-GB');

export function localTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}
export function fmtDT(iso, tz) {
  try {
    return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: tz || undefined, weekday: 'short' }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}
export function fmtDate(iso, tz) {
  try { return new Intl.DateTimeFormat(locale(), { dateStyle: 'long', timeZone: tz || undefined }).format(new Date(iso)); } catch { return iso; }
}
export function digits(cur) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits; } catch { return 2; }
}
export function fmtMoney(minor, cur) {
  const major = minor / 10 ** digits(cur);
  try { return new Intl.NumberFormat(locale(), { style: 'currency', currency: cur }).format(major) + ` (${cur})`; } catch { return `${major} ${cur}`; }
}
// 관리자가 입력한 참고 환율로만 환산 표시 (실제 청구 금액과 구분)
export function refConversions(minor, cur, rates = {}) {
  const out = [];
  for (const [pair, rate] of Object.entries(rates || {})) {
    const [from, to] = pair.split('_');
    if (from !== cur || !(rate > 0)) continue;
    const major = (minor / 10 ** digits(cur)) * rate;
    try { out.push(new Intl.NumberFormat(locale(), { style: 'currency', currency: to }).format(major)); } catch { /* skip */ }
  }
  return out;
}

export function timeZones() {
  try { return Intl.supportedValuesOf('timeZone'); } catch {
    return ['Asia/Seoul', 'Asia/Tokyo', 'Asia/Phnom_Penh', 'Asia/Ho_Chi_Minh', 'Asia/Shanghai', 'Asia/Singapore', 'Europe/London', 'Europe/Paris',
      'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo', 'Australia/Sydney', 'UTC'];
  }
}

export function toast(msg) {
  const live = document.getElementById('live');
  if (live) live.textContent = msg;
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
