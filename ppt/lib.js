// WLC 2급 강의 PPT 공통 엔진 — 회차별 데이터(lectureNN.js)를 받아 .pptx를 만든다.
const pptxgen = require('pptxgenjs');
const React = require('react');
const RDS = require('react-dom/server');
const sharp = require('sharp');
const fa = require('react-icons/fa');

const THEME = {
  name: 'WLC Teal',
  headFontFace: 'Noto Serif KR Black',
  bodyFontFace: 'Noto Serif KR Black',
  colors: { dk1: '222222', lt1: 'FFFFFF', dk2: '1F4E4A', lt2: 'EAF3F0',
    accent1: '2E7D6B', accent2: 'D98E04', accent3: '3A6EA5', accent4: 'B5452F',
    accent5: '8FB9A8', accent6: '6B6B6B', hlink: '3A6EA5', folHlink: '1F4E4A' },
};
const HEX = { dk2: '1F4E4A', acc: '2E7D6B', warn: 'D98E04', ask: '3A6EA5', no: 'B5452F', mint: '8FB9A8', light: 'EAF3F0', ink: '222222', mute: '6B6B6B' };
const TINT = { key: 'EAF3F0', warn: 'FDF1DC', ask: 'E8EFF8', no: 'F8E6E1', base: 'F3F4F3', white: 'FFFFFF' };
const KIND = { key: 'acc', warn: 'warn', ask: 'ask', no: 'no', base: 'mute' };
const W = 13.333, H = 7.5, MX = 0.6, CW = W - 2 * MX;

const ICONS = { q: 'FaQuestion', warn: 'FaExclamationTriangle', ok: 'FaCheck', no: 'FaTimes', clock: 'FaClock',
  users: 'FaUsers', pen: 'FaPenFancy', heart: 'FaHeart', leaf: 'FaLeaf', law: 'FaBalanceScale', brain: 'FaBrain',
  hands: 'FaHandsHelping', book: 'FaBookOpen', bulb: 'FaLightbulb', hour: 'FaHourglassHalf', talk: 'FaComments',
  med: 'FaHeartbeat', soul: 'FaDove', life: 'FaRoute', world: 'FaGlobeAsia', home: 'FaHome', star: 'FaStar',
  link: 'FaLink', coffee: 'FaCoffee', flag: 'FaFlag', seed: 'FaSeedling', user: 'FaUser', eye: 'FaEye', map: 'FaMapSigns' };
const iconCache = {};
async function icon(name, color = 'FFFFFF') {
  const key = name + color;
  if (iconCache[key]) return iconCache[key];
  const C = fa[ICONS[name] || name] || fa.FaCircle;
  const svg = RDS.renderToStaticMarkup(React.createElement(C, { color: '#' + color, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return (iconCache[key] = 'image/png;base64,' + buf.toString('base64'));
}

// 대략적 줄 수 추정 (한글 1자 ≈ 글자크기, 영문 ≈ 0.55)
function lines(text, wIn, pt) {
  const cap = (wIn * 72) / pt;
  return String(text).split('\n').reduce((n, seg) => {
    let w = 0; for (const ch of seg) w += /[ㄱ-힝　-〿＀-￯“”‘’「」『』·]/.test(ch) ? 1 : 0.55;
    return n + Math.max(1, Math.ceil(w / (cap * 0.94)));
  }, 0);
}
function fitSize(text, wIn, hIn, max = 16, min = 14, ls = 1.25) {
  for (let pt = max; pt >= min; pt--) if (lines(text, wIn, pt) * pt * ls / 72 <= hIn) return pt;
  return null;
}
const WARN = [];
function sized(text, wIn, hIn, max, min, where) {
  const pt = fitSize(text, wIn, hIn, max, min);
  if (!pt) { WARN.push(`[overflow?] ${where}: "${String(text).slice(0, 30)}…"`); return min; }
  return pt;
}

async function build(L, outFile) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = `WLC 2급 제${L.no}강 ${L.title}`;
  pres.author = '삶잇다협동조합';
  const C = pres.SchemeColor;
  const col = { dk2: C.text2, acc: C.accent1, warn: C.accent2, ask: C.accent3, no: C.accent4, mint: C.accent5, mute: C.accent6, ink: C.text1, white: C.background1, light: C.background2 };
  const footer = `WLC 2급 자격과정  ·  제${L.no}강 ${L.title}`;
  const num = { x: W - MX - 0.8, y: H - 0.42, w: 0.8, h: 0.3, fontSize: 10, color: HEX.mute, align: 'right' };

  pres.defineSlideMaster({ title: 'COVER', background: { color: HEX.dk2 }, objects: [] });
  pres.defineSlideMaster({ title: 'SECTION', background: { color: HEX.dk2 }, slideNumber: { ...num, color: 'A8C5BC' },
    objects: [{ placeholder: { options: { name: 'title', type: 'title', x: MX, y: 2.9, w: CW, h: 1.1, fontSize: 40, bold: true, color: 'FFFFFF', margin: 0, valign: 'top', align: 'left' }, text: '' } }] });
  pres.defineSlideMaster({ title: 'DARK', background: { color: HEX.dk2 }, slideNumber: { ...num, color: 'A8C5BC' }, objects: [] });
  const contentObjs = (bg) => [
    { text: { text: footer, options: { x: MX, y: H - 0.42, w: 8, h: 0.3, fontSize: 10, color: HEX.mute, margin: 0 } } },
    { placeholder: { options: { name: 'tag', type: 'body', x: MX, y: 0.32, w: CW, h: 0.32, fontSize: 13, bold: true, color: HEX.acc, margin: 0, valign: 'middle' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: MX, y: 0.66, w: CW, h: 0.72, fontSize: 28, bold: true, color: HEX.dk2, margin: 0, valign: 'middle', align: 'left' }, text: '' } },
  ];
  pres.defineSlideMaster({ title: 'CONTENT', background: { color: 'FFFFFF' }, slideNumber: num, objects: contentObjs() });
  pres.defineSlideMaster({ title: 'ACTIVITY', background: { color: HEX.light }, slideNumber: num, objects: contentObjs() });

  // 시간 계산
  let clock = 0; const fmt = m => `${String(Math.floor(m / 60)).padStart(1, '0')}:${String(m % 60).padStart(2, '0')}`;
  const blocks = {};
  for (const s of L.slides) { s._start = clock; clock += s.min || 0; s._end = clock; blocks[s.block || '-'] = (blocks[s.block || '-'] || 0) + (s.min || 0); }

  let section = null;
  for (const [i, s] of L.slides.entries()) {
    if (s.section && s.section !== section) { section = s.section; pres.addSection({ title: section }); }
    const master = { cover: 'COVER', section: 'SECTION', question: 'DARK', brk: 'DARK', quote: 'DARK', closing: 'DARK',
      activity: 'ACTIVITY', worksheet: 'ACTIVITY' }[s.type] || 'CONTENT';
    const sl = pres.addSlide({ masterName: master, sectionTitle: section });
    if (master === 'CONTENT' || master === 'ACTIVITY') {
      if (s.tag) sl.addText(s.tag, { placeholder: 'tag' });
      if (s.title) sl.addText(s.title, { placeholder: 'title' });
    }
    await R[s.type](pres, sl, s, { col, L, i });
    const time = s.min ? `⏱ ${fmt(s._start)}–${fmt(s._end)} (${s.min}분)` : '⏱ 전환';
    sl.addNotes([time, s.ref ? `📖 교재: ${s.ref}` : '', '', s.notes || ''].filter((x, k) => x || k === 2).join('\n'));
  }
  await pres.writeFile({ fileName: outFile });
  const { applyTheme } = require(process.env.PPTX_SKILL + '/scripts/apply_theme.js');
  await applyTheme(outFile, THEME);
  return { total: clock, blocks, warn: WARN };
}

// ---------- 공통 그리기 ----------
const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.12, blur: 6, offset: 2, angle: 90 });
function card(pres, sl, x, y, w, h, fill, opt = {}) {
  sl.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill, width: 0 }, shadow: opt.shadow ? shadow() : undefined, objectName: opt.name });
}
async function iconDot(pres, sl, name, x, y, d, colorHex) {
  sl.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: colorHex }, line: { color: colorHex, width: 0 } });
  const p = d * 0.26; sl.addImage({ data: await icon(name), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
}
function numDot(pres, sl, n, x, y, d, colorHex, fs) {
  sl.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: colorHex }, line: { color: colorHex, width: 0 } });
  sl.addText(String(n), { x, y, w: d, h: d, fontSize: fs || Math.round(d * 30), bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}
function txt(sl, text, o) { sl.addText(text, { isTextBox: true, margin: 0, valign: 'top', color: HEX.ink, ...o }); }
async function calloutBar(pres, sl, c, y, h = 0.95) {
  const k = c.kind || 'key';
  card(pres, sl, MX, y, CW, h, TINT[k]);
  await iconDot(pres, sl, c.icon || { key: 'bulb', warn: 'warn', ask: 'q', no: 'no', base: 'book' }[k], MX + 0.25, y + (h - 0.5) / 2, 0.5, HEX[KIND[k]]);
  const tw = CW - 1.3;
  const fs = sized((c.label ? c.label + '  ' : '') + c.text, tw, h - 0.2, 18, 14, 'callout');
  txt(sl, [
    ...(c.label ? [{ text: c.label + '   ', options: { bold: true, color: HEX[KIND[k]] } }] : []),
    { text: c.text, options: {} }], { x: MX + 1.0, y: y + 0.1, w: tw, h: h - 0.2, fontSize: fs, valign: 'middle' });
}

// ---------- 슬라이드 유형 ----------
const R = {
  async cover(pres, sl, s, { L }) {
    sl.addShape(pres.shapes.OVAL, { x: 8.6, y: -1.6, w: 6.4, h: 6.4, fill: { color: '2E7D6B', transparency: 55 }, line: { color: '2E7D6B', width: 0 } });
    sl.addShape(pres.shapes.OVAL, { x: 10.4, y: 3.9, w: 4.2, h: 4.2, fill: { color: '8FB9A8', transparency: 70 }, line: { color: '8FB9A8', width: 0 } });
    txt(sl, `WLC 2급 자격과정  ·  ${L.part}`, { x: MX, y: 1.3, w: 9, h: 0.4, fontSize: 16, color: 'A8C5BC', bold: true });
    txt(sl, `제${L.no}강`, { x: MX, y: 2.0, w: 9, h: 0.8, fontSize: 32, color: 'FFFFFF', bold: true });
    txt(sl, L.title, { x: MX, y: 2.8, w: 10, h: 1.2, fontSize: 48, color: 'FFFFFF', bold: true, fontFace: THEME.headFontFace });
    txt(sl, L.eng, { x: MX, y: 4.05, w: 9, h: 0.45, fontSize: 18, color: 'CFE3DC', italic: true });
    txt(sl, s.sub || '3시간 과정  ·  1교시 50분 · 2교시 50분 · 3교시 60분', { x: MX, y: 5.6, w: 9, h: 0.4, fontSize: 15, color: 'CFE3DC' });
    txt(sl, '삶잇다협동조합', { x: MX, y: 6.2, w: 6, h: 0.45, fontSize: 18, color: 'FFFFFF', bold: true });
  },
  async roadmap(pres, sl, s, { L }) {
    const n = s.parts.length, gap = 0.2, w = (CW - gap * (n - 1)) / n, y0 = 1.65;
    s.parts.forEach((p, j) => {
      const x = MX + j * (w + gap);
      card(pres, sl, x, y0, w, 0.85, HEX.dk2);
      txt(sl, [{ text: p.name + '\n', options: { fontSize: 13, color: 'A8C5BC', bold: true } }, { text: p.title, options: { fontSize: 15, color: 'FFFFFF', bold: true } }], { x: x + 0.15, y: y0 + 0.08, w: w - 0.3, h: 0.72, valign: 'middle' });
      p.items.forEach((it, k) => {
        const y = y0 + 1.0 + k * 0.92, cur = it.no === L.no;
        card(pres, sl, x, y, w, 0.8, cur ? HEX.acc : TINT.key);
        txt(sl, [{ text: `${it.no}강  `, options: { bold: true, color: cur ? 'FFFFFF' : HEX.acc } }, { text: it.t, options: { color: cur ? 'FFFFFF' : HEX.ink, bold: cur } }],
          { x: x + 0.15, y: y + 0.05, w: w - 0.3, h: 0.7, fontSize: 13, valign: 'middle' });
      });
    });
  },
  async timeline(pres, sl, s) {
    const total = s.blocks.reduce((a, b) => a + b.min, 0), y = 1.9, h = 1.15;
    let x = MX;
    s.blocks.forEach(b => {
      const w = CW * b.min / total - 0.06, br = b.brk;
      card(pres, sl, x, y, w, h, br ? 'D9DEDC' : HEX.dk2);
      txt(sl, [{ text: b.label, options: { fontSize: br ? 13 : 20, bold: true, color: br ? HEX.mute : 'FFFFFF', align: 'center', breakLine: true } }, { text: `${b.min}분`, options: { fontSize: br ? 12 : 15, color: br ? HEX.mute : 'CFE3DC', align: 'center' } }],
        { x: x + 0.1, y: y + 0.1, w: w - 0.2, h: h - 0.2, align: 'center', valign: 'middle' });
      if (!br) {
        const fs = sized(b.desc, w - 0.1, 2.6, 20, 14, 'timeline');
        txt(sl, [{ text: b.title + '\n', options: { bold: true, color: HEX.acc, fontSize: 22, paraSpaceAfter: 8 } }, { text: b.desc, options: { fontSize: fs } }], { x: x + 0.05, y: y + h + 0.3, w: w - 0.1, h: 3.0 });
      }
      x += w + 0.06;
    });
  },
  async cards(pres, sl, s) {
    const n = s.cards.length, cols = s.cols || Math.min(n, 3), rows = Math.ceil(n / cols), gap = 0.3;
    const top = 1.7, bottom = s.callout ? 5.55 : 6.75;
    const w = (CW - gap * (cols - 1)) / cols, h = (bottom - top - gap * (rows - 1)) / rows;
    for (const [j, c] of s.cards.entries()) {
      const x = MX + (j % cols) * (w + gap), y = top + Math.floor(j / cols) * (h + gap), k = c.kind || s.kind || 'key';
      card(pres, sl, x, y, w, h, TINT[k]);
      let tx = x + 0.25, tw = w - 0.5, ty = y + 0.22;
      if (c.icon || s.numbered) {
        if (c.icon) await iconDot(pres, sl, c.icon, x + 0.25, y + 0.25, 0.6, HEX[KIND[k]]); else numDot(pres, sl, j + 1, x + 0.25, y + 0.25, 0.6, HEX[KIND[k]], 18);
        if (s.iconLeft) { tx = x + 1.05; tw = w - 1.3; } else ty = y + 1.0;
      }
      const bh = y + h - ty - 0.2 - (c.title ? ((s.titleSize || 22) / 72) * 1.5 + 0.1 : 0);
      const fs = c.body ? sized(c.body, tw, bh, s.bodyMax || 22, 14, 'card ' + (c.title || '')) : 16;
      txt(sl, [
        ...(c.title ? [{ text: c.title, options: { bold: true, fontSize: s.titleSize || 22, color: HEX[KIND[k]] === HEX.mute ? HEX.dk2 : HEX[KIND[k]], breakLine: !!c.body, paraSpaceAfter: 6 } }] : []),
        ...(c.body ? [{ text: c.body, options: { fontSize: fs } }] : [])], { x: tx, y: ty, w: tw, h: y + h - ty - 0.15 });
    }
    if (s.callout) await calloutBar(pres, sl, s.callout, 5.8, 0.95);
  },
  async question(pres, sl, s) {
    await iconDot(pres, sl, s.icon || 'q', MX, 1.2, 0.9, HEX.acc);
    txt(sl, s.label || '오프닝 질문', { x: MX + 1.15, y: 1.35, w: 8, h: 0.6, fontSize: 18, color: 'A8C5BC', bold: true, valign: 'middle' });
    txt(sl, s.q, { x: MX, y: 2.45, w: CW, h: 2.0, fontSize: s.qSize || 38, color: 'FFFFFF', bold: true, valign: 'middle' });
    if (s.sub) txt(sl, s.sub, { x: MX, y: 4.6, w: CW, h: 0.6, fontSize: 18, color: 'CFE3DC' });
    if (s.activity) {
      card(pres, sl, MX, 5.45, CW, 1.15, '2A5F5A');
      await iconDot(pres, sl, 'clock', MX + 0.25, 5.72, 0.6, HEX.warn);
      txt(sl, s.activity, { x: MX + 1.1, y: 5.55, w: CW - 1.3, h: 0.95, fontSize: 19, color: 'FFFFFF', valign: 'middle' });
    }
  },
  async quote(pres, sl, s) {
    txt(sl, '“', { x: MX, y: 0.9, w: 1.5, h: 1.4, fontSize: 110, color: '8FB9A8', bold: true });
    txt(sl, s.quote, { x: MX + 0.4, y: 2.0, w: CW - 0.8, h: 1.5, fontSize: 32, color: 'FFFFFF', bold: true, valign: 'middle' });
    txt(sl, s.by, { x: MX + 0.4, y: 3.55, w: CW - 0.8, h: 0.45, fontSize: 15, color: 'A8C5BC' });
    if (s.message) {
      card(pres, sl, MX, 4.6, CW, 1.75, '2A5F5A');
      txt(sl, [{ text: (s.messageLabel || '이 강의의 핵심 메시지') + '\n', options: { bold: true, color: '8FB9A8', fontSize: 15, paraSpaceAfter: 6 } }, { text: s.message, options: { fontSize: 18, color: 'FFFFFF' } }],
        { x: MX + 0.35, y: 4.75, w: CW - 0.7, h: 1.5, valign: 'middle' });
    }
  },
  async numlist(pres, sl, s) {
    const cols = s.cols || 2, n = s.items.length, rows = Math.ceil(n / cols), gap = 0.3;
    const top = 1.7, bottom = s.callout ? 5.55 : 6.75;
    const w = (CW - gap * (cols - 1)) / cols, rh = (bottom - top) / rows;
    s.items.forEach((t, j) => {
      const x = MX + Math.floor(j / rows) * (w + gap), y = top + (j % rows) * rh;
      numDot(pres, sl, j + 1, x, y + 0.05, 0.48, HEX[s.color || 'acc'], 15);
      const [head, ...rest] = Array.isArray(t) ? t : [null, t];
      const body = rest.join('');
      const fs = sized((head || '') + body, w - 0.75, rh - 0.12, s.max || 22, 14, 'numlist');
      txt(sl, [...(head ? [{ text: head + ' ', options: { bold: true, color: HEX.dk2 } }] : []), { text: body, options: {} }], { x: x + 0.68, y: y + 0.02, w: w - 0.75, h: rh - 0.08, fontSize: fs });
    });
    if (s.callout) await calloutBar(pres, sl, s.callout, 5.8, 0.95);
  },
  async chips(pres, sl, s) {
    let x = MX, y = 1.85; const h = 0.62;
    s.items.forEach((t, j) => {
      const w = 0.5 + [...t].reduce((a, c) => a + (/[가-힣]/.test(c) ? 0.235 : 0.13), 0);
      if (x + w > W - MX) { x = MX; y += h + 0.25; }
      const hi = (s.highlight || []).includes(t);
      card(pres, sl, x, y, w, h, hi ? HEX.acc : TINT.key);
      txt(sl, t, { x, y, w, h, fontSize: 18, bold: hi, color: hi ? 'FFFFFF' : HEX.dk2, align: 'center', valign: 'middle' });
      x += w + 0.22;
    });
    if (s.callout) await calloutBar(pres, sl, s.callout, 5.8, 0.95);
  },
  async section(pres, sl, s) {
    txt(sl, s.no, { x: MX, y: 1.9, w: 6, h: 0.6, fontSize: 22, color: '8FB9A8', bold: true });
    sl.addText(s.title, { placeholder: 'title' });
    if (s.sub) txt(sl, s.sub, { x: MX, y: 4.1, w: CW, h: 0.6, fontSize: 20, color: 'CFE3DC' });
    if (s.items) txt(sl, s.items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < s.items.length - 1 } })), { x: MX, y: 4.9, w: CW, h: 1.8, fontSize: 19, color: 'FFFFFF', paraSpaceAfter: 6 });
  },
  async compare(pres, sl, s) {
    const gap = 0.4, w = (CW - gap) / 2, top = 1.7, bottom = s.callout ? 5.55 : 6.75, h = bottom - top;
    for (const [j, side] of [s.left, s.right].entries()) {
      const x = MX + j * (w + gap), k = side.kind || (j ? 'key' : 'no');
      card(pres, sl, x, top, w, h, TINT[k]);
      await iconDot(pres, sl, side.icon || (k === 'no' ? 'no' : 'ok'), x + 0.3, top + 0.28, 0.6, HEX[KIND[k]]);
      txt(sl, side.label, { x: x + 1.1, y: top + 0.28, w: w - 1.4, h: 0.6, fontSize: 22, bold: true, color: HEX[KIND[k]], valign: 'middle' });
      const body = side.items.join('\n');
      const fs = sized(body, w - 0.9, h - 1.35 - side.items.length * 0.12, 22, 14, 'compare');
      txt(sl, side.items.map((t, q) => ({ text: t, options: { bullet: side.bullet === false ? false : true, breakLine: q < side.items.length - 1 } })),
        { x: x + 0.3, y: top + 1.1, w: w - 0.6, h: h - 1.25, fontSize: fs, paraSpaceAfter: 10 });
    }
    if (s.callout) await calloutBar(pres, sl, s.callout, 5.8, 0.95);
  },
  async flow(pres, sl, s) {
    const n = s.steps.length, gap = 0.35, top = s.top || 2.0, h = s.h || 2.1;
    const w = (CW - gap * (n - 1)) / n;
    s.steps.forEach((st, j) => {
      const x = MX + j * (w + gap), [head, body] = Array.isArray(st) ? st : [st, ''];
      card(pres, sl, x, top, w, h, j === n - 1 && s.lastHi !== false ? HEX.acc : TINT.key);
      const last = j === n - 1 && s.lastHi !== false;
      numDot(pres, sl, j + 1, x + w / 2 - 0.25, top + 0.2, 0.5, last ? HEX.dk2 : HEX.acc, 15);
      const hs = n > 5 ? 17 : 20; const fs = body ? sized(body, w - 0.3, h - 1.0 - (lines(head, w - 0.3, hs) * hs * 1.3) / 72, 18, 13, 'flow') : 15;
      txt(sl, [{ text: head, options: { bold: true, fontSize: hs, color: last ? 'FFFFFF' : HEX.dk2, breakLine: !!body, paraSpaceAfter: 4 } }, ...(body ? [{ text: body, options: { fontSize: fs, color: last ? 'FFFFFF' : HEX.ink } }] : [])],
        { x: x + 0.15, y: top + 0.85, w: w - 0.3, h: h - 0.95, align: 'center' });
      if (j < n - 1) sl.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: x + w + 0.08, y: top + h / 2 - 0.13, w: 0.2, h: 0.26, fill: { color: HEX.mint }, line: { color: HEX.mint, width: 0 }, rotate: 90 });
    });
    if (s.below) {
      const y = top + h + 0.4, bh = (s.callout ? 5.55 : 6.75) - y;
      const fs = sized(s.below.join('\n'), CW - 0.6, bh - 0.3 - s.below.length * 0.1, 20, 14, 'flow below');
      card(pres, sl, MX, y, CW, bh, TINT.base);
      txt(sl, s.below.map((t, q) => ({ text: t, options: { bullet: true, breakLine: q < s.below.length - 1 } })), { x: MX + 0.3, y: y + 0.18, w: CW - 0.6, h: bh - 0.3, fontSize: fs, paraSpaceAfter: 6 });
    }
    if (s.callout) await calloutBar(pres, sl, s.callout, 5.8, 0.95);
  },
  async table(pres, sl, s) {
    const top = 1.7, colW = s.colW, fs = s.fs || 16;
    const head = s.head.map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: HEX.dk2 }, align: 'center', valign: 'middle' } }));
    const rows = s.rows.map((r, ri) => r.map((t, ci) => ({ text: t, options: { valign: 'middle', bold: ci === 0, color: ci === 0 ? HEX.dk2 : HEX.ink, fill: { color: ci === 0 ? TINT.key : (ri % 2 ? 'F7F9F8' : 'FFFFFF') } } })));
    sl.addTable([head, ...rows], { x: MX, y: top, w: CW, colW, fontSize: fs, fontFace: THEME.bodyFontFace, border: { type: 'solid', pt: 0.75, color: 'C8D3CF' }, margin: [0.06, 0.12, 0.06, 0.12], rowH: s.rowH || 0.5 });
    if (s.callout) await calloutBar(pres, sl, s.callout, 5.8, 0.95);
  },
  async callout(pres, sl, s) {
    const k = s.kind || 'warn';
    card(pres, sl, MX, 1.75, CW, 2.2, TINT[k]);
    await iconDot(pres, sl, s.icon || (k === 'warn' ? 'warn' : 'bulb'), MX + 0.35, 2.15, 0.9, HEX[KIND[k]]);
    const fs = sized(s.text, CW - 1.9, 1.8, 28, 16, 'callout big');
    txt(sl, s.text, { x: MX + 1.55, y: 1.95, w: CW - 1.9, h: 1.8, fontSize: fs, bold: true, color: HEX.dk2, valign: 'middle' });
    if (s.points) {
      const gap = 0.3, n = s.points.length, w = (CW - gap * (n - 1)) / n;
      s.points.forEach((p, j) => {
        const x = MX + j * (w + gap), [h, b] = p;
        card(pres, sl, x, 4.25, w, 2.45, TINT.base);
        const f2 = sized(b, w - 0.5, 1.5, 20, 14, 'callout pt');
        txt(sl, [{ text: h, options: { bold: true, fontSize: 21, color: HEX[KIND[k]], breakLine: true, paraSpaceAfter: 8 } }, { text: b, options: { fontSize: f2 } }], { x: x + 0.25, y: 4.45, w: w - 0.5, h: 2.1 });
      });
    }
  },
  async dialogue(pres, sl, s) {
    if (s.situation) txt(sl, [{ text: '상황  ', options: { bold: true, color: HEX.acc } }, { text: s.situation }], { x: MX, y: 1.5, w: CW, h: 0.45, fontSize: 18 });
    let y = 2.1; const lh = (s.callout ? 5.45 : 6.7) - y, each = lh / s.lines.length;
    s.lines.forEach(l => {
      const me = l.who === 'WLC', w = 9.2, x = me ? W - MX - w : MX;
      card(pres, sl, x, y, w, each - 0.12, me ? TINT.key : 'F1F1EF');
      txt(sl, l.who, { x: x + 0.2, y, w: 1.2, h: each - 0.12, fontSize: 14, bold: true, color: me ? HEX.acc : HEX.mute, valign: 'middle' });
      const fs = sized(l.text, w - 1.6, each - 0.2, 19, 14, 'dialogue');
      txt(sl, l.text, { x: x + 1.35, y, w: w - 1.55, h: each - 0.12, fontSize: fs, valign: 'middle' });
      y += each;
    });
    if (s.callout) await calloutBar(pres, sl, s.callout, 5.75, 1.0);
  },
  async activity(pres, sl, s) {
    // 좌: 진행 단계 / 우: 시간·방식·결과물
    const lw = 8.1;
    card(pres, sl, MX, 1.7, lw, 5.0, 'FFFFFF', { shadow: true });
    if (s.prompt) {
      const fs = sized(s.prompt, lw - 0.6, 1.0, 24, 16, 'activity prompt');
      txt(sl, s.prompt, { x: MX + 0.3, y: 1.9, w: lw - 0.6, h: 1.05, fontSize: fs, bold: true, color: HEX.dk2, valign: 'middle' });
    }
    const sy = s.prompt ? 3.1 : 1.95, sh = (6.5 - sy) / s.steps.length;
    s.steps.forEach((t, j) => {
      numDot(pres, sl, j + 1, MX + 0.3, sy + j * sh + 0.02, 0.42, HEX.acc, 14);
      const fs = sized(t, lw - 1.2, sh - 0.05, 21, 14, 'activity step');
      txt(sl, t, { x: MX + 0.9, y: sy + j * sh, w: lw - 1.2, h: sh - 0.05, fontSize: fs });
    });
    const rx = MX + lw + 0.3, rw = CW - lw - 0.3;
    const info = [['clock', '시간', s.time], ['users', '방식', s.mode], ['pen', '결과물', s.output]];
    for (const [j, [ic, lab, val]] of info.entries()) {
      const y = 1.7 + j * 1.72;
      card(pres, sl, rx, y, rw, 1.55, j === 0 ? HEX.dk2 : 'FFFFFF', { shadow: j !== 0 });
      await iconDot(pres, sl, ic, rx + 0.22, y + 0.22, 0.5, j === 0 ? HEX.warn : HEX.acc);
      txt(sl, lab, { x: rx + 0.85, y: y + 0.22, w: rw - 1, h: 0.5, fontSize: 14, bold: true, color: j === 0 ? 'A8C5BC' : HEX.acc, valign: 'middle' });
      const fs = sized(val, rw - 0.45, 0.7, j === 0 ? 28 : 18, 14, 'activity info');
      txt(sl, val, { x: rx + 0.22, y: y + 0.78, w: rw - 0.45, h: 0.7, fontSize: fs, bold: j === 0, color: j === 0 ? 'FFFFFF' : HEX.ink });
    }
  },
  async worksheet(pres, sl, s) { await R.table(pres, sl, s); },
  async quiz(pres, sl, s) {
    txt(sl, s.q, { x: MX, y: 1.6, w: CW, h: 0.9, fontSize: sized(s.q, CW, 0.9, 28, 18, 'quiz q'), bold: true, color: HEX.dk2, valign: 'middle' });
    const gap = 0.3, w = (CW - gap) / 2, h = 1.6;
    s.options.forEach((o, j) => {
      const x = MX + (j % 2) * (w + gap), y = 2.8 + Math.floor(j / 2) * (h + gap);
      card(pres, sl, x, y, w, h, TINT.key);
      numDot(pres, sl, '①②③④'[j], x + 0.3, y + h / 2 - 0.32, 0.64, HEX.acc, 20);
      txt(sl, o, { x: x + 1.2, y: y + 0.1, w: w - 1.45, h: h - 0.2, fontSize: sized(o, w - 1.45, h - 0.2, 22, 14, 'quiz opt'), valign: 'middle' });
    });
  },
  async ox(pres, sl, s) {
    const top = 1.7, rh = (6.75 - top) / s.items.length;
    s.items.forEach((it, j) => {
      const y = top + j * rh;
      card(pres, sl, MX, y, CW, rh - 0.2, j % 2 ? 'FFFFFF' : TINT.key);
      numDot(pres, sl, j + 1, MX + 0.25, y + (rh - 0.2) / 2 - 0.25, 0.5, HEX.acc, 15);
      txt(sl, it.q, { x: MX + 1.0, y, w: CW - 3.4, h: rh - 0.2, fontSize: sized(it.q, CW - 3.4, rh - 0.3, 22, 14, 'ox'), valign: 'middle' });
      ['O', 'X'].forEach((t, k) => {
        const x = W - MX - 2.1 + k * 1.0;
        sl.addShape(pres.shapes.OVAL, { x, y: y + (rh - 0.2) / 2 - 0.35, w: 0.7, h: 0.7, fill: { color: 'FFFFFF' }, line: { color: k ? HEX.no : HEX.ask, width: 2 } });
        txt(sl, t, { x, y: y + (rh - 0.2) / 2 - 0.35, w: 0.7, h: 0.7, fontSize: 22, bold: true, color: k ? HEX.no : HEX.ask, align: 'center', valign: 'middle' });
      });
    });
  },
  async answers(pres, sl, s) {
    const n = s.items.length, cols = 2, rows = Math.ceil(n / cols), gap = 0.3, top = 1.65;
    const w = (CW - gap) / cols, rh = (6.8 - top) / rows;
    s.items.forEach((it, j) => {
      const x = MX + Math.floor(j / rows) * (w + gap), y = top + (j % rows) * rh;
      card(pres, sl, x, y, w, rh - 0.15, TINT.key);
      txt(sl, it.no, { x: x + 0.2, y, w: 1.0, h: rh - 0.15, fontSize: 14, bold: true, color: HEX.mute, valign: 'middle' });
      txt(sl, it.a, { x: x + 1.05, y, w: 0.8, h: rh - 0.15, fontSize: 22, bold: true, color: HEX.acc, valign: 'middle', align: 'center' });
      txt(sl, it.why, { x: x + 1.95, y: y + 0.05, w: w - 2.15, h: rh - 0.25, fontSize: sized(it.why, w - 2.15, rh - 0.3, 18, 14, 'answer'), valign: 'middle' });
    });
  },
  async brk(pres, sl, s) {
    await iconDot(pres, sl, 'coffee', W / 2 - 0.6, 1.1, 1.2, HEX.acc);
    txt(sl, s.title || '휴식 10분', { x: MX, y: 2.5, w: CW, h: 0.9, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center' });
    if (s.recap) {
      txt(sl, s.recapLabel || '지금까지 기억할 세 가지', { x: MX, y: 3.6, w: CW, h: 0.45, fontSize: 16, color: '8FB9A8', bold: true, align: 'center' });
      const gap = 0.3, w = (CW - gap * 2) / 3;
      s.recap.forEach((t, j) => { const x = MX + j * (w + gap); card(pres, sl, x, 4.2, w, 1.5, '2A5F5A'); txt(sl, t, { x: x + 0.25, y: 4.3, w: w - 0.5, h: 1.3, fontSize: sized(t, w - 0.5, 1.3, 20, 14, 'brk'), color: 'FFFFFF', align: 'center', valign: 'middle' }); });
    }
    if (s.next) txt(sl, '다음  ▸  ' + s.next, { x: MX, y: 6.15, w: CW, h: 0.45, fontSize: 15, color: 'CFE3DC', align: 'center' });
  },
  async closing(pres, sl, s) {
    txt(sl, s.label || '오늘의 마지막 질문', { x: MX, y: 1.6, w: CW, h: 0.5, fontSize: 18, color: '8FB9A8', bold: true, align: 'center' });
    txt(sl, s.q, { x: MX + 0.5, y: 2.3, w: CW - 1, h: 2.2, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
    if (s.sub) txt(sl, s.sub, { x: MX, y: 4.9, w: CW, h: 0.6, fontSize: 18, color: 'CFE3DC', align: 'center' });
  },
  async next(pres, sl, s) {
    // 다음 회차 예고 — 좌: 제목·질문 / 우: 다룰 내용, 하단: 준비
    card(pres, sl, MX, 1.7, 5.4, 5.0, HEX.dk2);
    txt(sl, `다음 시간  ·  제${s.no}강`, { x: MX + 0.35, y: 1.95, w: 4.8, h: 0.4, fontSize: 15, bold: true, color: '8FB9A8' });
    txt(sl, s.title2, { x: MX + 0.35, y: 2.4, w: 4.8, h: 1.3, fontSize: 26, bold: true, color: 'FFFFFF', valign: 'top' });
    txt(sl, [{ text: '다음 질문\n', options: { bold: true, color: '8FB9A8', fontSize: 14, paraSpaceAfter: 4 } }, { text: s.q, options: { fontSize: sized(s.q, 4.8, 2.0, 21, 15, 'next q'), color: 'FFFFFF' } }],
      { x: MX + 0.35, y: 4.1, w: 4.8, h: 2.4 });
    const rx = MX + 5.7, rw = CW - 5.7;
    txt(sl, '이런 내용을 다룹니다', { x: rx, y: 1.7, w: rw, h: 0.4, fontSize: 16, bold: true, color: HEX.acc });
    const ih = 3.15 / s.topics.length;
    s.topics.forEach((t, j) => {
      numDot(pres, sl, j + 1, rx, 2.2 + j * ih + 0.02, 0.38, HEX.acc, 13);
      txt(sl, t, { x: rx + 0.55, y: 2.2 + j * ih, w: rw - 0.55, h: ih, fontSize: sized(t, rw - 0.55, ih - 0.05, 19, 14, 'next topic') });
    });
    card(pres, sl, rx, 5.5, rw, 1.2, TINT.warn);
    await iconDot(pres, sl, 'book', rx + 0.2, 5.75, 0.6, HEX.warn);
    txt(sl, s.prep, { x: rx + 1.0, y: 5.55, w: rw - 1.2, h: 1.1, fontSize: sized(s.prep, rw - 1.2, 1.05, 18, 14, 'next prep'), valign: 'middle' });
  },
};

module.exports = { build };
