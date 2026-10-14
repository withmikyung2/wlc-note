import { S, render } from './app.js';
import { t, getLang } from './i18n.js';
import { esc, api, local, toast } from './util.js';
import { recoForm } from './views-public.js';

const PHRASES = [
  {
    ko: '안녕하세요.', roman: 'an-nyeong-ha-se-yo', pron: '[안녕하세요]', en: 'Hello.',
    when: { ko: '하루 중 언제나 쓰는 기본 인사입니다. 처음 만난 사람, 윗사람에게도 공손하게 쓸 수 있어요.', en: 'The basic greeting for any time of day. Polite enough for people you meet for the first time and for elders.' }
  },
  {
    ko: '저는 ○○입니다.', roman: 'jeo-neun ○○-im-ni-da', pron: '[저는 ○○임니다]', en: 'I am ○○.',
    when: { ko: '자기소개를 할 때 이름을 공손하게 말하는 표현입니다. ‘입니다’는 [임니다]로 소리 납니다.', en: 'A polite way to say your name when introducing yourself. "입니다" is pronounced [im-ni-da].' }
  },
  {
    ko: '만나서 반갑습니다.', roman: 'man-na-seo ban-gap-seum-ni-da', pron: '[만나서 반갑씀니다]', en: 'Nice to meet you.',
    when: { ko: '처음 만난 사람에게 반가움을 전하는 표현입니다. 인사와 자기소개 뒤에 이어서 말해요.', en: 'Said to someone you meet for the first time, usually after greeting and introducing yourself.' }
  }
];

const QUIZ = [
  { q: { ko: '처음 만난 사람에게 하는 인사는?', en: 'What do you say to greet someone you just met?' }, choices: ['안녕하세요.', '잘 자요.', '잘 먹겠습니다.'], answer: 0 },
  { q: { ko: '"Nice to meet you."는 한국어로?', en: 'How do you say "Nice to meet you"?' }, choices: ['감사합니다.', '만나서 반갑습니다.', '미안합니다.'], answer: 1 },
  { q: { ko: '내 이름을 소개하는 문장은?', en: 'Which sentence introduces your name?' }, choices: ['저는 ○○입니다.', '○○는 어디예요?', '○○ 주세요.'], answer: 0 }
];

const STEPS = ['st_see', 'st_meaning', 'st_listen', 'st_say', 'st_quiz', 'st_next'];
const state = { step: 0, name: '', repeat: 1, said: [false, false, false], answers: {}, tts: 'checking' };
let koVoice = null;

const L2 = (o) => o[getLang()] || o.ko;
const withName = (s) => (state.name ? s.replace(/○○/g, state.name) : s);

function detectVoice() {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { state.tts = 'none'; return Promise.resolve(); }
  const pick = () => speechSynthesis.getVoices().find((v) => /^ko(-|_|$)/i.test(v.lang));
  return new Promise((resolve) => {
    const done = () => { koVoice = pick() || null; state.tts = koVoice ? 'ok' : 'none'; resolve(); };
    if (speechSynthesis.getVoices().length) return done();
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 2000);
  });
}

function speak(text, { rate = 0.9, times = 1 } = {}) {
  if (state.tts !== 'ok') return;
  speechSynthesis.cancel();
  for (let i = 0; i < times; i++) {
    const u = new SpeechSynthesisUtterance(text.replace(/○○/g, '하나'));
    u.lang = 'ko-KR';
    u.voice = koVoice;
    u.rate = document.documentElement.classList.contains('large') ? rate * 0.85 : rate;
    speechSynthesis.speak(u);
  }
}

function ttsBanner() {
  if (state.tts === 'checking') return `<div class="banner info" role="status">${esc(t('tts_checking'))}</div>`;
  if (state.tts === 'none') return `<div class="banner warn" role="status">${esc(t('tts_none'))}</div>`;
  return `<div class="banner ok" role="status">${esc(t('tts_ok'))}</div>`;
}

function phraseCard(p, i, body) {
  return `<article class="card"><div class="phrase" lang="ko">${esc(withName(p.ko))}</div>
    <div class="roman">${esc(withName(p.roman))} · <span lang="en">${esc(p.en.replace('○○', state.name || '○○'))}</span></div>${body || ''}</article>`;
}

function stepBody() {
  switch (STEPS[state.step]) {
    case 'st_see':
      return `<div class="field"><label for="trial-name">${esc(t('your_name'))}</label>
          <input id="trial-name" type="text" maxlength="20" autocomplete="off" value="${esc(state.name)}" data-trial="name">
          <span class="hint">${esc(t('your_name_hint'))}</span></div>
        <div class="stack">${PHRASES.map((p, i) => phraseCard(p, i)).join('')}</div>`;
    case 'st_meaning':
      return `<div class="stack">${PHRASES.map((p, i) => phraseCard(p, i, `<p style="margin-top:10px">${esc(L2(p.when))}</p>`)).join('')}</div>`;
    case 'st_listen':
      return `${ttsBanner()}
        <div class="field" style="max-width:280px"><label for="trial-repeat">${esc(t('repeat_label'))}</label>
          <select id="trial-repeat" data-trial="repeat">${[1, 2, 3, 5].map((n) => `<option value="${n}" ${state.repeat === n ? 'selected' : ''}>${esc(t('repeat_n', { n }))}</option>`).join('')}</select></div>
        <div class="stack">${PHRASES.map((p, i) => phraseCard(p, i, `
          <p class="small muted" style="margin-top:6px">${esc(getLang() === 'ko' ? '발음' : 'Pronunciation')}: <span lang="ko">${esc(withName(p.pron))}</span></p>
          <div class="row">
            <button class="btn" type="button" data-act="trialSpeak" data-i="${i}" ${state.tts !== 'ok' ? 'disabled' : ''}>▶ ${esc(t('listen'))}</button>
            <button class="btn outline" type="button" data-act="trialSpeak" data-i="${i}" data-slow="1" ${state.tts !== 'ok' ? 'disabled' : ''}>${esc(t('listen_slow'))}</button>
            <button class="btn ghost" type="button" data-act="trialStop" ${state.tts !== 'ok' ? 'disabled' : ''}>■ ${esc(t('stop'))}</button>
          </div>`)).join('')}</div>`;
    case 'st_say':
      return `${ttsBanner()}<p>${esc(t('say_guide'))}</p>
        <div class="stack">${PHRASES.map((p, i) => phraseCard(p, i, `
          <p class="small muted" style="margin-top:6px"><span lang="ko">${esc(withName(p.pron))}</span></p>
          <div class="row">
            <button class="btn outline" type="button" data-act="trialSpeak" data-i="${i}" ${state.tts !== 'ok' ? 'disabled' : ''}>▶ ${esc(t('listen'))}</button>
            <button class="btn ${state.said[i] ? '' : 'outline'}" type="button" data-act="trialSaid" data-i="${i}" aria-pressed="${state.said[i]}">${state.said[i] ? '✓ ' : ''}${esc(t('said_it'))}</button>
            <button class="btn ghost" type="button" data-act="trialFav" data-i="${i}">☆ ${esc(t('save_fav'))}</button>
          </div>`)).join('')}</div>`;
    case 'st_quiz':
      return `<div class="stack">${QUIZ.map((q, qi) => {
        const a = state.answers[qi];
        return `<fieldset class="card" style="margin:0"><legend class="legend" style="padding:0 6px">${qi + 1}. ${esc(L2(q.q))}</legend>
          <div class="options">${q.choices.map((c, ci) => `<label class="option"><input type="radio" name="tq${qi}" value="${ci}" data-quiz="${qi}" ${a === ci ? 'checked' : ''}><span lang="ko">${esc(c)}</span></label>`).join('')}</div>
          <p role="status" aria-live="polite" style="margin-top:8px;font-weight:700;color:${a === undefined ? 'inherit' : a === q.answer ? 'var(--green)' : 'var(--danger)'}">
            ${a === undefined ? '' : a === q.answer ? '✓ ' + esc(t('quiz_correct')) : esc(t('quiz_wrong'))}</p></fieldset>`;
      }).join('')}</div>`;
    case 'st_next':
      return `<div class="banner ok">${esc(t('trial_finish'))}</div><p class="small muted">※ ${esc(t('reco_note'))}</p><div class="card">${recoForm('trial')}</div>`;
    default:
      return '';
  }
}

export function view() {
  return `<div class="wrap" id="trial">
    <h1>${esc(t('trial_title'))}</h1><p class="muted">${esc(t('trial_desc'))}</p>
    <ol class="steps" aria-label="Steps">${STEPS.map((s, i) => `<li ${i === state.step ? 'aria-current="step"' : ''} class="${i < state.step ? 'done' : ''}">${esc(t(s))}</li>`).join('')}</ol>
    <div class="progress" aria-hidden="true"><span style="width:${Math.round(((state.step + 1) / STEPS.length) * 100)}%"></span></div>
    <h2 style="margin-top:20px" id="trial-step">${esc(t(STEPS[state.step]))}</h2>
    ${stepBody()}
    <div class="row between" style="margin-top:24px">
      <button class="btn outline" type="button" data-act="trialPrev" ${state.step === 0 ? 'disabled' : ''}>← ${esc(t('prev'))}</button>
      ${state.step < STEPS.length - 1 ? `<button class="btn" type="button" data-act="trialNext">${esc(t('next'))} →</button>` : `<a class="btn" href="#/courses">${esc(t('cta_find'))}</a>`}
    </div>
  </div>`;
}

function rerenderStep() {
  render({ keepFocus: true }).then(() => {
    const h = document.getElementById('trial-step');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  });
}

export const actions = {
  trialNext() { if ('speechSynthesis' in window) speechSynthesis.cancel(); state.step = Math.min(STEPS.length - 1, state.step + 1); rerenderStep(); },
  trialPrev() { if ('speechSynthesis' in window) speechSynthesis.cancel(); state.step = Math.max(0, state.step - 1); rerenderStep(); },
  trialSpeak(el) { const p = PHRASES[Number(el.dataset.i)]; speak(withName(p.ko), { rate: el.dataset.slow ? 0.6 : 0.9, times: state.repeat }); },
  trialStop() { if ('speechSynthesis' in window) speechSynthesis.cancel(); },
  trialSaid(el) { const i = Number(el.dataset.i); state.said[i] = !state.said[i]; el.setAttribute('aria-pressed', state.said[i]); el.classList.toggle('outline', !state.said[i]); el.textContent = (state.said[i] ? '✓ ' : '') + t('said_it'); },
  async trialFav(el) {
    const p = PHRASES[Number(el.dataset.i)];
    if (S.user) await api('POST', '/api/me/favorites', { phrase: p.ko, meaning: p.en });
    else {
      const favs = local.get('kt-favorites', []);
      if (!favs.some((f) => f.phrase === p.ko)) favs.push({ phrase: p.ko, meaning: p.en });
      local.set('kt-favorites', favs);
    }
    el.textContent = '★ ' + t('saved');
    toast(t('saved'));
  }
};

export function onInput(ev) {
  if (ev.target.dataset?.trial === 'name') state.name = ev.target.value.trim().slice(0, 20);
}
export function onChange(ev) {
  if (ev.target.dataset?.trial === 'repeat') state.repeat = Number(ev.target.value) || 1;
  if (ev.target.dataset?.quiz !== undefined) {
    state.answers[Number(ev.target.dataset.quiz)] = Number(ev.target.value);
    const fs = ev.target.closest('fieldset');
    const q = QUIZ[Number(ev.target.dataset.quiz)];
    const status = fs.querySelector('[role=status]');
    const ok = Number(ev.target.value) === q.answer;
    status.textContent = ok ? '✓ ' + t('quiz_correct') : t('quiz_wrong');
    status.style.color = ok ? 'var(--green)' : 'var(--danger)';
  }
}

export function afterRender(route) {
  if (route.path !== '/trial') return;
  if (state.tts === 'checking') detectVoice().then(() => { if (location.hash.startsWith('#/trial') && ['st_listen', 'st_say'].includes(STEPS[state.step])) rerenderStep(); });
}
