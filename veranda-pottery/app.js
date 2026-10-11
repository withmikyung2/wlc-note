/* Homepage behaviour: language, workshops, piece tracker, Facebook feed. */

const I18N = {
  en: {
    'nav.workshops': 'Workshops', 'nav.track': 'My piece', 'nav.invite': 'Invite us', 'nav.news': 'News', 'nav.visit': 'Visit', 'nav.menu': 'Menu',
    'hero.kicker': 'Khmer pottery · Workshops · Phnom Penh',
    'hero.title': 'Make something<br><em>with your hands.</em>',
    'hero.lead': 'Veranda brings traditional Khmer pottery into hands-on workshops — at our studio, and at schools, cafés and community spaces across Phnom Penh. After class, follow your own piece as it dries, fires and waits for you.',
    'hero.cta1': 'Find a workshop', 'hero.cta2': 'Track my piece',
    'hero.fact1': 'makers joined in our first 7 months', 'hero.fact2t': 'Traditional firing', 'hero.fact2': 'Cambodian methods, hands-on craft',
    'journey.title': 'The journey of your piece',
    'ws.kicker': 'Workshops', 'ws.title': 'Find your next session.', 'ws.upcoming': 'At the studio', 'ws.previous': 'Past pop-ups',
    'ws.note': "Photos and posters come from Veranda's own workshop posts. New dates are announced first on Facebook.",
    'ws.time': 'Time', 'ws.price': 'Price', 'ws.pickup': 'Pickup', 'ws.place': 'Place', 'ws.book': 'Ask for a slot', 'ws.open': 'Open now', 'ws.past': 'Past',
    'tr.kicker': 'My piece', 'tr.title': 'Where is my pottery now?',
    'tr.lead': 'Every piece made at Veranda gets a piece code on your pickup card (for example VP-2610-A7K3). Enter it to see which stage your work is in, the photos we took along the way, and when it will be ready.',
    'tr.label': 'Piece code', 'tr.button': 'Check',
    'tr.demo': 'Try the sample codes: <button type="button" class="chip" data-demo="VP-DEMO-0001">VP-DEMO-0001</button> <button type="button" class="chip" data-demo="VP-DEMO-0002">VP-DEMO-0002</button>',
    'tr.empty': "Your piece's timeline will appear here.",
    'tr.loading': 'Looking for your piece…',
    'tr.notfound': 'We could not find that code.', 'tr.notfoundHint': 'Check the code on your pickup card, or message us and we will look it up for you.',
    'tr.error': 'The tracker could not load right now. Please try again in a moment.',
    'tr.by': 'Made by', 'tr.pickupBy': 'Expected ready', 'tr.step': 'Step', 'tr.of': 'of', 'tr.sample': 'SAMPLE',
    'tr.share': 'Share on Facebook', 'tr.copy': 'Copy link', 'tr.copied': 'Link copied', 'tr.ask': 'Ask about my piece',
    'inv.kicker': 'Invite us', 'inv.title': 'Bring the workshop to your space.',
    'inv.lead': 'Planning a school day, café event, cultural program or team gathering? We bring the clay, the tools and the know-how — every participant still gets a piece code to follow their work afterwards.',
    'inv.a': 'Schools', 'inv.ad': 'Creative learning days and camps for young makers.',
    'inv.b': 'Cafés & spaces', 'inv.bd': 'Limited pop-up sessions that bring your community together.',
    'inv.c': 'Groups & NGOs', 'inv.cd': 'Team days, cultural visits, volunteer and study-tour groups.',
    'inv.cta': 'Message us on Facebook', 'inv.call': 'Call +855 16 783 083',
    'news.kicker': 'From our Facebook', 'news.title': 'Latest from the studio.',
    'news.lead': 'New workshop dates, kiln days and photos are posted on Facebook first. This feed updates on its own whenever we post.',
    'news.follow': 'Follow on Facebook', 'news.fallback': 'Open Veranda Pottery on Facebook ↗',
    'visit.kicker': 'Visit', 'visit.title': 'Come by and get your hands in clay.', 'visit.addr': 'Address', 'visit.phone': 'Phone', 'visit.map': 'Open in Google Maps ↗',
    'foot.line': 'Khmer pottery · workshops · Phnom Penh', 'foot.staff': 'Studio tools'
  },
  ko: {
    'nav.workshops': '워크숍', 'nav.track': '내 작품', 'nav.invite': '출장 수업', 'nav.news': '소식', 'nav.visit': '오시는 길', 'nav.menu': '메뉴',
    'hero.kicker': '크메르 전통 도예 · 워크숍 · 프놈펜',
    'hero.title': '내 손으로<br><em>무언가를 빚는 시간.</em>',
    'hero.lead': '베란다는 캄보디아 크메르 전통 도예를 직접 체험하는 워크숍으로 전합니다. 공방에서, 그리고 프놈펜의 학교·카페·지역 공간에서 만납니다. 수업이 끝난 뒤에도 내 작품이 마르고, 구워지고, 나를 기다리는 과정을 이곳에서 확인할 수 있습니다.',
    'hero.cta1': '워크숍 찾기', 'hero.cta2': '내 작품 진행 보기',
    'hero.fact1': '첫 7개월 동안 함께한 참가자', 'hero.fact2t': '전통 방식 소성', 'hero.fact2': '캄보디아 전통 기법, 손으로 하는 공예',
    'journey.title': '작품이 완성되기까지',
    'ws.kicker': '워크숍', 'ws.title': '다음 수업을 찾아보세요.', 'ws.upcoming': '공방 상시 수업', 'ws.previous': '지난 팝업 워크숍',
    'ws.note': '사진과 포스터는 베란다가 직접 올린 워크숍 게시물에서 가져왔습니다. 새 일정은 Facebook에 가장 먼저 올라옵니다.',
    'ws.time': '시간', 'ws.price': '참가비', 'ws.pickup': '수령', 'ws.place': '장소', 'ws.book': '자리 문의하기', 'ws.open': '수강 가능', 'ws.past': '지난 수업',
    'tr.kicker': '내 작품', 'tr.title': '내 도자기는 지금 어디쯤?',
    'tr.lead': '베란다에서 만든 모든 작품에는 수령 카드에 작품 번호가 적혀 있습니다(예: VP-2610-A7K3). 번호를 입력하면 지금 어느 단계인지, 과정마다 찍은 사진, 그리고 언제 찾아갈 수 있는지 보여드립니다.',
    'tr.label': '작품 번호', 'tr.button': '조회',
    'tr.demo': '예시 번호로 체험해 보세요: <button type="button" class="chip" data-demo="VP-DEMO-0001">VP-DEMO-0001</button> <button type="button" class="chip" data-demo="VP-DEMO-0002">VP-DEMO-0002</button>',
    'tr.empty': '여기에 내 작품의 진행 과정이 나타납니다.',
    'tr.loading': '작품을 찾고 있습니다…',
    'tr.notfound': '해당 번호를 찾지 못했습니다.', 'tr.notfoundHint': '수령 카드의 번호를 다시 확인하시거나, 메시지를 보내주시면 공방에서 확인해 드립니다.',
    'tr.error': '지금은 조회 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    'tr.by': '만든 사람', 'tr.pickupBy': '완성 예정일', 'tr.step': '단계', 'tr.of': '/', 'tr.sample': '예시',
    'tr.share': 'Facebook에 공유', 'tr.copy': '링크 복사', 'tr.copied': '링크를 복사했습니다', 'tr.ask': '내 작품 문의하기',
    'inv.kicker': '출장 수업', 'inv.title': '여러분의 공간으로 찾아갑니다.',
    'inv.lead': '학교 체험일, 카페 행사, 문화 프로그램, 단체 모임을 준비하시나요? 흙과 도구, 노하우를 모두 가지고 갑니다. 출장 수업 참가자도 작품 번호로 이후 과정을 확인할 수 있습니다.',
    'inv.a': '학교', 'inv.ad': '어린 메이커를 위한 창의 체험일과 캠프.',
    'inv.b': '카페 · 공간', 'inv.bd': '공동체가 함께 모이는 소규모 팝업 수업.',
    'inv.c': '단체 · NGO', 'inv.cd': '팀 활동, 문화 탐방, 봉사단·연수단 프로그램.',
    'inv.cta': 'Facebook으로 문의하기', 'inv.call': '전화 +855 16 783 083',
    'news.kicker': 'Facebook 소식', 'news.title': '공방의 최신 소식.',
    'news.lead': '새 워크숍 일정, 가마 굽는 날, 사진은 Facebook에 가장 먼저 올라옵니다. 공방이 글을 올리면 이 화면도 자동으로 바뀝니다.',
    'news.follow': 'Facebook 팔로우', 'news.fallback': 'Facebook에서 베란다 포터리 보기 ↗',
    'visit.kicker': '오시는 길', 'visit.title': '들러서 흙을 만져 보세요.', 'visit.addr': '주소', 'visit.phone': '전화', 'visit.map': 'Google 지도에서 열기 ↗',
    'foot.line': '크메르 전통 도예 · 워크숍 · 프놈펜', 'foot.staff': '공방 관리 도구'
  }
};

const WORKSHOPS = {
  upcoming: [
    {
      image: 'assets/studio-shelf.webp', alt: 'Pottery on the shelves at Veranda',
      title: { en: 'Traditional Cambodian Pottery', ko: '캄보디아 전통 도예' },
      text: { en: 'A one-hour hands-on class. Shape your own piece from clay and collect it after firing.', ko: '1시간 체험 수업. 흙으로 나만의 작품을 빚고, 소성이 끝나면 찾아갑니다.' },
      time: { en: '1 hour', ko: '1시간' }, price: '$10',
      pickup: { en: 'About 1 month', ko: '약 1개월 후' }, place: { en: 'Veranda studio', ko: '베란다 공방' }
    },
    {
      image: 'assets/hero-farm-to-table.webp', alt: 'Guests shaping clay',
      title: { en: 'Water-safe Ceramic', ko: '물을 담을 수 있는 도자기' },
      text: { en: 'Your piece is double-fired with glaze so it can safely hold water.', ko: '유약을 입혀 두 번 구워, 물을 안전하게 담을 수 있는 그릇을 만듭니다.' },
      time: { en: '1 hour', ko: '1시간' }, price: '$15',
      pickup: { en: 'About 1 month', ko: '약 1개월 후' }, place: { en: 'Veranda studio', ko: '베란다 공방' }
    }
  ],
  previous: [
    {
      image: 'assets/farm-to-table-poster.webp', poster: true, alt: 'Farm to Table × Veranda workshop poster',
      title: { en: 'Pottery Workshop at Farm to Table', ko: 'Farm to Table 도예 워크숍' },
      text: { en: 'A weekend collaboration in BKK: make two pieces, or paint pottery and plant a small plant.', ko: 'BKK에서 열린 주말 협업. 작품 두 점 만들기, 또는 도자기 페인팅과 식물 심기.' },
      time: { en: 'Sep 19–20 · 2–5 PM', ko: '9월 19–20일 · 오후 2–5시' }, price: '$20 / $30',
      pickup: { en: 'After firing / same day', ko: '소성 후 / 당일' }, place: { en: '#16 St 360, BKK', ko: '#16 St 360, BKK' }
    },
    {
      image: 'assets/sign-cafe-poster.webp', poster: true, alt: 'Sign Cafe workshop poster',
      title: { en: 'Pottery Workshop at Sign Cafe', ko: 'Sign Cafe 도예 워크숍' },
      text: { en: 'An extra session for the Phnom Penh Houseplant Festival community program.', ko: '프놈펜 하우스플랜트 페스티벌 커뮤니티 프로그램의 추가 회차.' },
      time: { en: 'Aug 8 · 4–5 PM', ko: '8월 8일 · 오후 4–5시' }, price: '$10',
      pickup: { en: 'Workshop session', ko: '워크숍 회차' }, place: { en: 'Sign Cafe, Bassac Lane', ko: 'Sign Cafe, Bassac Lane' }
    },
    {
      image: 'assets/pteah-chas-poster.webp', poster: true, alt: 'Pteah Chas workshop poster',
      title: { en: 'Traditional Pottery at Pteah Chas', ko: 'Pteah Chas 전통 도예' },
      text: { en: 'A beginner-friendly introduction to Khmer pottery and hand-shaping techniques.', ko: '크메르 도예와 손 성형 기법을 처음 배우는 입문 수업.' },
      time: { en: 'Jul 4 · 2–4 PM', ko: '7월 4일 · 오후 2–4시' }, price: '$10',
      pickup: { en: 'Workshop session', ko: '워크숍 회차' }, place: { en: '#91, St 110, Phnom Penh', ko: '#91, St 110, 프놈펜' }
    },
    {
      image: 'assets/factory-poster.webp', poster: true, alt: 'Factory Phnom Penh workshop poster',
      title: { en: 'Khmer Traditional Pottery at Factory', ko: 'Factory 크메르 전통 도예' },
      text: { en: 'A one-hour cultural workshop on Cambodian pottery heritage, shaping real clay.', ko: '캄보디아 도예 유산을 배우며 흙을 직접 빚는 1시간 문화 워크숍.' },
      time: { en: 'May 23 · 10–11 AM', ko: '5월 23일 · 오전 10–11시' }, price: '$10',
      pickup: { en: 'Workshop session', ko: '워크숍 회차' }, place: { en: 'Factory Phnom Penh', ko: 'Factory 프놈펜' }
    }
  ]
};

let lang = 'en';
let activeTab = 'upcoming';
let piecesCache = null;
let lastCode = '';

const $ = sel => document.querySelector(sel);
const t = key => (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
const pick = obj => (obj && typeof obj === 'object') ? (obj[lang] || obj.en) : obj;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
  });
  children.flat().forEach(c => { if (c != null) node.append(c.nodeType ? c : String(c)); });
  return node;
}

/* ---------- Language ---------- */
function initialLang() {
  try {
    const saved = localStorage.getItem('veranda-lang');
    if (saved && I18N[saved]) return saved;
  } catch (e) { /* storage unavailable */ }
  return (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  try { localStorage.setItem('veranda-lang', lang); } catch (e) { /* ignore */ }
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(n => { n.innerHTML = t(n.dataset.i18nHtml); });
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  renderJourney();
  renderWorkshops();
  if (lastCode) showPiece(lastCode, false);
}

/* ---------- Journey strip ---------- */
function renderJourney() {
  const list = $('#journeySteps');
  list.replaceChildren(...JOURNEY.map(s => el('li', {}, STAGES[s][lang][0], el('span', {}, STAGES[s][lang][1]))));
}

/* ---------- Workshops ---------- */
function renderWorkshops() {
  const past = activeTab === 'previous';
  const cards = WORKSHOPS[activeTab].map(w => el('article', { class: 'ws-card' + (w.poster ? ' poster' : '') },
    el('figure', {}, el('img', { src: w.image, alt: w.alt, loading: 'lazy' })),
    el('div', { class: 'ws-body' },
      el('span', { class: 'pill' + (past ? ' past' : '') }, past ? t('ws.past') : t('ws.open')),
      el('h3', {}, pick(w.title)),
      el('p', {}, pick(w.text)),
      el('div', { class: 'ws-meta' },
        el('div', {}, el('span', {}, t('ws.time')), pick(w.time)),
        el('div', {}, el('span', {}, t('ws.price')), w.price),
        el('div', {}, el('span', {}, t('ws.pickup')), pick(w.pickup)),
        el('div', {}, el('span', {}, t('ws.place')), pick(w.place))
      ),
      past ? null : el('a', { class: 'btn btn-dark', href: messengerUrl(), target: '_blank', rel: 'noopener' }, t('ws.book'))
    )
  ));
  $('#wsGrid').replaceChildren(...cards);
}

document.querySelectorAll('.tabs [data-tab]').forEach(btn => btn.addEventListener('click', () => {
  activeTab = btn.dataset.tab;
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b === btn)));
  renderWorkshops();
}));

/* ---------- Facebook ---------- */
function messengerUrl() { return 'https://m.me/' + VERANDA.facebookId; }

function initFacebook() {
  document.querySelectorAll('[data-fb="page"]').forEach(a => { a.href = VERANDA.facebookPage; });
  document.querySelectorAll('[data-fb="messenger"]').forEach(a => { a.href = messengerUrl(); });

  const frame = $('#fbFrame');
  const width = Math.min(500, Math.max(280, Math.round(frame.clientWidth)));
  const src = 'https://www.facebook.com/plugins/page.php?' + new URLSearchParams({
    href: VERANDA.facebookPage, tabs: 'timeline,events', width: String(width), height: '620',
    small_header: 'false', adapt_container_width: 'true', hide_cover: 'false', show_facepile: 'true'
  });
  const iframe = el('iframe', {
    title: 'Veranda Pottery on Facebook', src, width: String(width), height: '620',
    loading: 'lazy', allow: 'encrypted-media', scrolling: 'no'
  });
  frame.replaceChildren(iframe);
}

/* ---------- Piece tracker ---------- */
async function getPieces() {
  if (!piecesCache) piecesCache = await loadPieces();
  return piecesCache;
}

function pieceLink(code) {
  const url = new URL(location.href);
  url.hash = 'track';
  url.search = '?piece=' + encodeURIComponent(code);
  return url.toString();
}

async function showPiece(raw, scroll = true) {
  const code = normalizeCode(raw);
  if (!code) return;
  lastCode = code;
  $('#codeInput').value = code;
  const box = $('#trackResult');
  if (!piecesCache) box.replaceChildren(el('p', { class: 'notfound' }, t('tr.loading')));

  let pieces;
  try { pieces = await getPieces(); }
  catch (e) {
    box.replaceChildren(el('div', { class: 'notfound' }, el('strong', {}, t('tr.error'))));
    return;
  }
  const piece = pieces.find(p => normalizeCode(p.code) === code);
  if (!piece) {
    box.replaceChildren(el('div', { class: 'notfound' },
      el('strong', {}, t('tr.notfound')), t('tr.notfoundHint'),
      el('div', { class: 'actions', style: 'justify-content:center' },
        el('a', { class: 'btn btn-line', href: messengerUrl(), target: '_blank', rel: 'noopener' }, t('tr.ask')))));
    return;
  }
  box.replaceChildren(renderPiece(piece));
  if (scroll) $('#track').scrollIntoView({ behavior: 'smooth' });
}

function renderPiece(p) {
  const route = routeFor(p);
  const currentIdx = Math.max(0, route.indexOf(p.stage));
  const finished = p.stage === 'collected';
  const byStage = {};
  (p.history || []).forEach(h => { byStage[h.stage] = h; });

  const steps = route.map((s, i) => {
    const state = (i < currentIdx || finished) ? 'done' : i === currentIdx ? 'current' : 'todo';
    const h = byStage[s] || {};
    const [title, desc] = STAGES[s][lang];
    return el('li', { class: state },
      el('span', { class: 'dot', 'aria-hidden': 'true' }),
      el('div', { class: 'tl-title' }, title, h.date ? el('span', { class: 'tl-date' }, formatDate(h.date)) : null),
      el('p', { class: 'tl-desc' }, desc),
      h.note ? el('p', { class: 'tl-note' }, h.note) : null,
      h.photo ? el('img', { class: 'tl-photo', src: h.photo, alt: title, loading: 'lazy' }) : null
    );
  });

  const pct = route.length > 1 ? Math.round((currentIdx / (route.length - 1)) * 100) : 100;
  const isReady = p.stage === 'ready' || finished;
  const typeLabel = pick((CLASS_TYPES[p.class] || CLASS_TYPES.traditional).label);
  const link = pieceLink(p.code);

  const copyBtn = el('button', { class: 'btn btn-line', type: 'button' }, t('tr.copy'));
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); copyBtn.textContent = t('tr.copied'); }
    catch (e) { window.prompt(t('tr.copy'), link); }
  });

  return el('div', { class: 'piece' },
    el('div', { class: 'piece-head' },
      el('div', {},
        el('span', { class: 'piece-code' }, p.code), p.demo ? el('span', { class: 'demo-flag' }, t('tr.sample')) : null,
        el('h3', {}, p.title || typeLabel),
        el('p', { class: 'piece-sub' }, typeLabel + (p.maker ? ' · ' + t('tr.by') + ' ' + p.maker : ''))
      ),
      el('span', { class: 'status-badge' + (isReady ? ' ready' : '') }, STAGES[p.stage] ? STAGES[p.stage][lang][0] : p.stage)
    ),
    el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) },
      el('span', { style: 'width:' + pct + '%' })),
    el('div', { class: 'progress-label' },
      el('span', {}, `${t('tr.step')} ${currentIdx + 1} ${t('tr.of')} ${route.length}`),
      p.pickupEstimate && !finished ? el('span', {}, `${t('tr.pickupBy')}: ${formatDate(p.pickupEstimate)}`) : null),
    el('ol', { class: 'timeline' }, steps),
    el('div', { class: 'piece-foot' },
      el('a', { class: 'btn btn-dark', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link), target: '_blank', rel: 'noopener' }, t('tr.share')),
      copyBtn,
      el('a', { class: 'btn btn-line', href: messengerUrl(), target: '_blank', rel: 'noopener' }, t('tr.ask'))
    )
  );
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

$('#trackForm').addEventListener('submit', e => {
  e.preventDefault();
  const code = $('#codeInput').value;
  showPiece(code, false);
  try { history.replaceState(null, '', pieceLink(normalizeCode(code))); } catch (err) { /* ignore */ }
});
$('#trackForm').addEventListener('click', e => {
  const demo = e.target.closest('[data-demo]');
  if (demo) showPiece(demo.dataset.demo, false);
});

/* ---------- Menu ---------- */
const menuBtn = $('.menu-toggle');
menuBtn.addEventListener('click', () => {
  const open = $('#nav').classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('#nav a').forEach(a => a.addEventListener('click', () => {
  $('#nav').classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
}));
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang)));

/* ---------- Start ---------- */
applyLang(initialLang());
initFacebook();
const linked = new URLSearchParams(location.search).get('piece');
if (linked) showPiece(linked, true);
