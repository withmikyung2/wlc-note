// 2시간 웰다잉 특강 「웰다잉을 위한 웰빙의 삶」 — 인천금곡교회 시니어 대상
// 원본 특강 PDF의 서체(HY견고딕·HY견명조·맑은 고딕)와 사진을 살려 편집 가능한 PPT로 재구성
// 사용: node build_special.js  →  out/웰다잉특강_2시간_웰다잉을위한웰빙의삶.pptx
const path = require('path');
const pptxgen = require('pptxgenjs');
const dims = require('./img/dims.json');

const T = 'HY견고딕', M = 'HY견명조', G = '맑은 고딕';
const C = { green: '1E4D3A', navy: '1F3A68', red: 'B03A2E', pink: 'F7DDF0', cream: 'FBF7EF', sage: 'E8F0EA', gray: '6B6B6B', line: 'C9C9C9', ink: '222222', gold: 'B8860B' };
const W = 13.333, H = 7.5, MX = 0.6;
const FOOT = '2026 인천금곡교회 웰다잉 특강';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = '웰다잉을 위한 웰빙의 삶';
pres.author = '삶잇다협동조합 이미경';

let pageNo = 0;
const slides = [];

function img(s, key, x, y, w, h, o = {}) {
  const d = dims[key];
  const r = Math.min(w / d.w, h / d.h);
  const iw = d.w * r, ih = d.h * r;
  const ix = o.align === 'left' ? x : x + (w - iw) / 2;
  const iy = o.valign === 'top' ? y : y + (h - ih) / 2;
  s.addImage({ path: path.join(__dirname, 'img', d.f), x: ix, y: iy, w: iw, h: ih, ...(o.shadow ? { shadow: { type: 'outer', blur: 4, offset: 2, angle: 45, opacity: 0.25, color: '000000' } } : {}) });
  return { x: ix, y: iy, w: iw, h: ih };
}

function frame(s, tag) {
  s.background = { color: 'FFFFFF' };
  s.addText('웰다잉을 위한 웰빙의 삶', { x: MX, y: 0.15, w: 5, h: 0.35, fontFace: G, fontSize: 12, color: C.gray });
  if (tag) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: W - 2.3, y: 0.15, w: 1.7, h: 0.36, rectRadius: 0.08, fill: { color: 'EDEDED' }, line: { color: 'EDEDED' } });
    s.addText(tag, { x: W - 2.3, y: 0.15, w: 1.7, h: 0.36, fontFace: G, fontSize: 12, color: '444444', align: 'center', valign: 'middle' });
  }
  s.addShape(pres.shapes.LINE, { x: MX, y: H - 0.55, w: W - 2 * MX, h: 0, line: { color: C.line, width: 0.75 } });
  s.addText(FOOT, { x: MX, y: H - 0.5, w: 5, h: 0.35, fontFace: G, fontSize: 11, color: C.gray });
}

function title(s, t, o = {}) {
  s.addText(t, { x: MX, y: 0.55, w: W - 2 * MX, h: 0.85, fontFace: T, fontSize: o.size || 32, color: o.color || C.green, valign: 'middle', fit: 'shrink' });
}

function box(s, x, y, w, h, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: o.r ?? 0.12, fill: { color: o.fill || 'FFFFFF' }, line: { color: o.line || C.line, width: o.lw || 1, dashType: o.dash || 'solid' } });
}

function text(s, t, x, y, w, h, o = {}) {
  s.addText(t, { x, y, w, h, fontFace: o.font || M, fontSize: o.size || 24, color: o.color || C.ink, bold: o.bold, align: o.align || 'left', valign: o.valign || 'top', lineSpacingMultiple: o.ls || 1.15, paraSpaceAfter: o.psa ?? 6, fit: 'shrink', margin: o.margin ?? 0.08 });
}

function highlight(s, t, y, o = {}) {
  const w = o.w || W - 2 * MX - 0.6, x = (W - w) / 2;
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: o.h || 0.75, fill: { color: o.fill || C.pink }, line: { color: o.fill || C.pink } });
  text(s, t, x, y, w, o.h || 0.75, { size: o.size || 26, align: 'center', valign: 'middle', color: o.color || C.ink, font: o.font || M });
}

// [필수]/[선택] 표시와 시간 메모를 노트 머리에 붙인다
function add(tag, build, notes, meta = {}) {
  const s = pres.addSlide();
  pageNo += 1;
  if (!meta.bare) frame(s, tag);
  build(s);
  if (!meta.bare) s.addText(`${pageNo}`, { x: W - 1.6, y: H - 0.5, w: 1, h: 0.35, fontFace: G, fontSize: 11, color: C.gray, align: 'right' });
  const head = `[${meta.opt ? '선택 · 시간이 부족하면 넘김' : '필수'}] ${meta.min ? meta.min + '분' : ''}${meta.wb ? ' · 워크북 ' + meta.wb + '쪽' : ''}`;
  s.addNotes(`${head}\n${notes}`);
  slides.push({ no: pageNo, min: meta.min || 0, opt: !!meta.opt });
  return s;
}

function section(no, t, sub, notes, min) {
  add('', s => {
    s.background = { color: C.cream };
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.35, h: H, fill: { color: C.green }, line: { color: C.green } });
    text(s, no, 1.2, 2.0, 6, 0.6, { font: G, size: 22, color: C.gold, bold: true });
    text(s, t, 1.2, 2.6, 11.6, 1.4, { font: T, size: t.length > 18 ? 38 : 44, color: C.green });
    text(s, sub, 1.2, 4.1, 11, 1.4, { size: 24, color: '444444' });
    s.addText(FOOT, { x: 1.2, y: H - 0.6, w: 6, h: 0.35, fontFace: G, fontSize: 11, color: C.gray });
  }, notes, { bare: true, min });
}

function activity(tag, t, wb, prompt, steps, minutes, notes, extra) {
  return add(tag, s => {
    title(s, t);
    box(s, MX, 1.6, 8.3, 4.9, { fill: C.cream, line: 'E6DCC6' });
    text(s, prompt, MX + 0.3, 1.75, 7.7, 1.3, { size: prompt.length > 40 ? 21 : 26, color: C.navy, font: M, valign: 'middle' });
    s.addText(steps.map((st, i) => ({ text: st, options: { bullet: { type: 'number' }, breakLine: i < steps.length - 1 } })),
      { x: MX + 0.3, y: 3.1, w: 7.7, h: 3.2, fontFace: M, fontSize: 22, color: C.ink, valign: 'top', paraSpaceAfter: 10, fit: 'shrink' });
    box(s, 9.2, 1.6, 3.53, 2.2, { fill: C.green, line: C.green });
    text(s, '워크북', 9.2, 1.75, 3.53, 0.5, { font: G, size: 18, color: 'CFE3DC', align: 'center' });
    text(s, `${wb}쪽`, 9.2, 2.25, 3.53, 1.2, { font: T, size: 54, color: 'FFFFFF', align: 'center', valign: 'middle' });
    box(s, 9.2, 4.0, 3.53, 2.5, { fill: 'FFFFFF', line: C.line });
    text(s, '쓰는 시간', 9.2, 4.15, 3.53, 0.5, { font: G, size: 18, color: C.gray, align: 'center' });
    text(s, `${minutes}분`, 9.2, 4.65, 3.53, 1.0, { font: T, size: 44, color: C.green, align: 'center', valign: 'middle' });
    text(s, '쓰지 않고 생각만 해도 괜찮습니다', 9.3, 5.65, 3.33, 0.7, { font: G, size: 14, color: C.gray, align: 'center' });
    if (extra) extra(s);
  }, notes, { min: minutes + 1, wb });
}

// ═════════ 열기 — 왜 이 강의를 하게 되었나 (약 15분) ═════════
add('', s => {
  s.background = { color: 'FFFFFF' };
  img(s, 'logo', 0.6, 0.45, 2.6, 0.6, { align: 'left' });
  text(s, '웰다잉을 위한 웰빙의 삶', 0.8, 1.9, 11.7, 1.3, { font: T, size: 54, align: 'center', valign: 'middle', color: C.ink });
  text(s, '- 하나님 안에서 내 삶을 완성하는 7가지 질문 -', 0.8, 3.2, 11.7, 0.7, { size: 26, align: 'center', color: '333333' });
  s.addShape(pres.shapes.LINE, { x: 1.2, y: 4.15, w: 10.9, h: 0, line: { color: '999999', width: 1 } });
  text(s, '“나의 달려갈 길과 주 예수께 받은 사명 … 을 마치려 함에는\n나의 생명조차 조금도 귀한 것으로 여기지 아니하노라”  — 사도행전 20:24', 1.2, 4.3, 10.9, 1.0, { size: 17, align: 'center', color: C.gray });
  text(s, '삶잇다협동조합_이 미 경', 7.5, 5.6, 4.6, 0.6, { size: 24, align: 'right', color: C.ink });
  s.addShape(pres.shapes.LINE, { x: 1.2, y: 6.3, w: 10.9, h: 0, line: { color: '999999', width: 1 } });
  text(s, FOOT, 1.2, 6.45, 10.9, 0.4, { font: G, size: 14, align: 'center', color: C.gray });
}, '인사. 오늘은 2시간 동안 "어떻게 죽을까"가 아니라 "어떻게 살아갈까"를 이야기합니다.\n워크북과 필기구를 확인한다. 화장실 위치, 중간 휴식(약 60분 지점) 안내.', { bare: true, min: 1 });

add('인사', s => {
  text(s, '안녕하세요?\n어떻게 지내세요?\n별 일 없으시지요?', MX + 0.4, 1.4, 6.4, 4.6, { font: T, size: 42, color: C.navy, ls: 1.5, valign: 'middle' });
  img(s, 'bugo', 7.3, 1.0, 5.4, 5.7, { shadow: true });
}, '천천히, 객석을 둘러보며 세 번 묻는다. 대답을 기다린다.\n오른쪽 부고장을 가리키며: "우리가 일상에서 가장 자주 받는 소식 중 하나가 이 부고입니다. 그런데 정작 우리는 이 이야기를 잘 하지 않지요."', { min: 2 });

add('영화', s => {
  img(s, 'movie_still', MX, 1.1, 7.6, 5.0, { shadow: true });
  text(s, '여러분은 이미\n충분히 아름다운\n삶을 사셨습니다.', 8.6, 1.4, 4.2, 3.0, { font: T, size: 34, color: C.green, ls: 1.4, valign: 'middle' });
  box(s, 8.5, 4.6, 4.3, 1.6, { fill: C.cream, line: 'E6DCC6' });
  text(s, '“호상? 잘 죽어? 세상에 잘 죽은 게 어디 있어? 늙어서 죽으면 好喪이야?”\n— 영화 속 김만석 어르신', 8.6, 4.65, 4.1, 1.5, { size: 16, color: '444444', valign: 'middle' });
}, '영화 「그대를 사랑합니다」(2011) 한 장면. 김만석 어르신의 대사를 실감 나게 읽어 준다.\n"오늘 여기 오신 여러분은 이미 충분히 아름다운 삶을 사셨습니다." — 인정과 존중으로 시작.\n[영상 삽입 후보] 영화 예고편 1~2분.', { min: 2 });

add('영화', s => {
  title(s, '그대를 사랑합니다  [2011년 작, 강풀 원작 / 추창민 감독]', { size: 26 });
  img(s, 'movie_poster', MX, 1.6, 3.6, 5.0, { shadow: true });
  text(s, '장군봉 부부 ➔ 치매 아내를 돌보다 ‘동반’\n김만석 & 송이쁜 ➔ 노년의 사랑과 이별', 4.6, 1.7, 8.1, 1.4, { size: 24, color: C.navy });
  box(s, 4.6, 3.3, 8.1, 2.6, { fill: C.cream, line: 'E6DCC6' });
  text(s, '네 분 모두 이미 별세\n윤소정  2017년, 향년 74세\n송재호  2020년, 향년 83세\n김수미  2024년, 향년 75세\n이순재  2025년, 향년 91세', 4.8, 3.4, 7.7, 2.4, { size: 21, ls: 1.2, valign: 'middle' });
  text(s, '화면 속에서 우리를 웃기고 울리던 분들도, 모두 삶을 마치셨습니다.', 4.6, 6.0, 8.1, 0.6, { size: 20, color: C.red });
}, '주인공 네 분이 모두 세상을 떠났다는 사실을 전하며 잠시 멈춘다.\n"죽음은 영화 속 이야기가 아니라, 우리 모두의 이야기입니다."', { opt: true, min: 2 });

add('소개', s => {
  text(s, '반갑습니다~!', 8.5, 0.5, 4.2, 0.8, { font: T, size: 32, color: C.navy, align: 'right' });
  img(s, 'profile', MX, 1.3, 3.6, 4.3, { shadow: true });
  text(s, [{ text: '이 미 경 ', options: { bold: true, fontSize: 26 } }, { text: 'Ph.D.', options: { fontSize: 18 } }], MX, 5.7, 4.6, 0.55, { size: 22 });
  text(s, '삶잇다협동조합 · 웰다잉라이프코치(WLC) 과정 운영\nE-mail. girin0822@gmail.com', MX, 6.15, 3.8, 0.75, { font: G, size: 12, color: '444444' });
  img(s, 'endingnote', 4.6, 1.3, 3.9, 5.1, { shadow: true });
  img(s, 'textbook', 8.8, 1.3, 3.9, 5.1, { shadow: true });
  text(s, '엔딩노트 「아하소풍」', 4.6, 6.4, 3.9, 0.45, { font: G, size: 15, align: 'center', color: C.gray });
  text(s, 'WLC 자격과정 공식교재', 8.8, 6.4, 3.9, 0.45, { font: G, size: 15, align: 'center', color: C.gray });
}, '간단한 자기소개. 엔딩노트와 WLC 교재를 직접 들어 보여 주면 좋다.\n"저는 16주 동안 웰다잉라이프코치를 양성하는 과정을 가르치고 있습니다. 오늘은 그 16주의 가장 중요한 이야기를 두 시간에 담아 왔습니다."', { min: 2 });

add('왜 이 강의를', s => {
  title(s, '제가 이 이야기를 하게 된 이유');
  img(s, 'body_donation', MX + 0.2, 1.55, 3.3, 5.3, { shadow: true });
  text(s, '1999년 4월 26일', 4.6, 1.7, 8, 0.7, { font: T, size: 30, color: C.navy });
  text(s, '저는 사후에 제 몸을 의과대학에\n기증하기로 등록했습니다.', 4.6, 2.5, 8, 1.4, { size: 28, ls: 1.3 });
  box(s, 4.6, 4.2, 8.1, 2.1, { fill: C.cream, line: 'E6DCC6' });
  text(s, '그날 이후, 죽음은 두려운 끝이 아니라\n“그렇다면 오늘을 어떻게 살 것인가”를\n묻게 하는 질문이 되었습니다.', 4.8, 4.3, 7.7, 1.9, { size: 24, color: C.green, ls: 1.35, valign: 'middle' });
}, '[강사 이야기] 시신기증을 결심하게 된 계기를 직접, 짧게 들려준다(2~3분).\n강의의 출발점: "죽음을 미리 생각해 본 경험이 제 삶을 바꾸었습니다."\n※ 등록증의 개인정보(주소 등)가 화면에 크게 보이지 않도록 이미지 크기를 유지.', { min: 3 });

add('왜 이 강의를', s => {
  title(s, '네 번 고쳐 쓴 “마지막 글”');
  img(s, 'letter4', MX, 1.6, 7.6, 3.0, { shadow: true });
  const yrs = [['1999년 5월', '처음 정리'], ['2000년 10월', '두 번째'], ['2005년 2월', '해외 출장 앞두고'], ['2026년 5월', '부모님 기일에']];
  yrs.forEach(([y, d], i) => {
    const x = MX + i * 1.95;
    box(s, x, 4.9, 1.8, 1.5, { fill: i === 3 ? C.green : C.sage, line: i === 3 ? C.green : C.sage });
    text(s, y, x, 5.0, 1.8, 0.6, { font: T, size: 17, align: 'center', color: i === 3 ? 'FFFFFF' : C.green });
    text(s, d, x, 5.6, 1.8, 0.7, { font: G, size: 14, align: 'center', color: i === 3 ? 'FFFFFF' : '444444' });
  });
  text(s, '마지막 글은\n한 번 쓰고 끝나는 것이 아니라,\n삶이 바뀔 때마다\n다시 쓰는 것입니다.', 8.6, 1.7, 4.2, 4.6, { font: T, size: 28, color: C.navy, ls: 1.45, valign: 'middle' });
}, '"처음 이런 글을 정리한 때는 1999년 5월이었고, 2000년, 2005년, 그리고 올해 부모님 기일에 네 번째로 정리했습니다."\n핵심 메시지: 유언·엔딩노트는 "완성"이 아니라 "업데이트". 오늘 워크북도 그 첫 장입니다.', { min: 2 });

add('왜 이 강의를', s => {
  title(s, '기억 속의 얼굴들, 먼저 떠난 사람들');
  img(s, 'family1', MX, 1.55, 5.6, 2.55, { shadow: true });
  img(s, 'family2', MX, 4.2, 5.6, 2.55, { shadow: true });
  img(s, 'rock', 6.5, 1.55, 6.2, 5.2, { shadow: true });
}, '[강사 이야기] 사진 속 사람들과 장소에 얽힌 이야기를 직접 들려준다.\n"함께 웃던 얼굴들 가운데 벌써 떠난 이들이 있습니다. 그때 미처 하지 못한 말이 오늘 강의를 하게 된 또 하나의 이유입니다."', { min: 2 });

add('질문', s => {
  title(s, '우리에게 ‘삶’과 ‘좋은 마무리’란?');
  const qs = ['스스로 생각하는 가장 평안하고 존엄한 죽음의 모습은 무엇인가요?', '그 순간을 위해 지금까지 어떤 준비를 해 오셨나요?', '그리고 이제, 우리는 어떤 준비가 필요할까요?'];
  qs.forEach((q, i) => {
    box(s, MX + 0.4, 1.8 + i * 1.5, W - 2 * MX - 0.8, 1.25, { fill: i === 2 ? C.pink : C.cream, line: i === 2 ? C.pink : 'E6DCC6' });
    text(s, `✓  ${q}`, MX + 0.7, 1.8 + i * 1.5, W - 2 * MX - 1.4, 1.25, { size: 26, valign: 'middle' });
  });
}, '세 질문을 천천히 읽고 1분 침묵. 옆 사람과 짧게 나누어도 좋다.\n"오늘 두 시간이 끝날 때, 세 번째 질문에 대한 나만의 답 하나를 가져가시면 됩니다."', { min: 2 });

add('오늘의 흐름', s => {
  title(s, '16주의 웰다잉 과정을, 오늘 네 걸음으로');
  const parts = [
    ['1', '죽음을 이해하면\n삶이 보입니다', '1~3강 · 죽음의 이해\n초고령사회'],
    ['2', '미리 준비하는\n사랑', '6~9강 · 연명의료\n유언 · 장례'],
    ['3', '관계를 정리하고\n마음을 전합니다', '10·11·13강 · 관계\n애도 · 임종'],
    ['4', '나를 완성하는\n7가지 질문', '워크북 실습\n오늘 한 걸음'],
  ];
  parts.forEach(([n, t, d], i) => {
    const x = MX + i * 3.08, w = 2.9;
    box(s, x, 1.7, w, 4.3, { fill: i === 3 ? C.green : C.sage, line: i === 3 ? C.green : C.sage });
    s.addShape(pres.shapes.OVAL, { x: x + w / 2 - 0.42, y: 1.95, w: 0.84, h: 0.84, fill: { color: i === 3 ? 'FFFFFF' : C.green }, line: { color: 'FFFFFF' } });
    text(s, n, x + w / 2 - 0.42, 1.95, 0.84, 0.84, { font: T, size: 28, align: 'center', valign: 'middle', color: i === 3 ? C.green : 'FFFFFF' });
    text(s, t, x + 0.1, 3.0, w - 0.2, 1.5, { font: T, size: 24, align: 'center', valign: 'middle', color: i === 3 ? 'FFFFFF' : C.green, ls: 1.3 });
    text(s, d, x + 0.1, 4.6, w - 0.2, 1.2, { font: G, size: 16, align: 'center', color: i === 3 ? 'E6F0EA' : '444444' });
  });
  highlight(s, '죽음을 배우는 시간은, 결국 오늘을 더 잘 사는 법을 배우는 시간입니다.', 6.15, { size: 22, h: 0.6 });
}, '오늘의 지도. "16주 과정 전체를 두 시간에 담을 수는 없습니다. 그래서 가장 중요한 네 걸음만 함께 걷겠습니다."\n시간 배분(참고): 열기 15분 · 1부 20분 · 2부 25분 · 휴식 5분 · 3부 15분 · 4부 30분 · 닫기 10분.', { min: 1 });

// ═════════ 1부 죽음을 이해하면 삶이 보입니다 (약 20분) ═════════
section('1부', '죽음을 이해하면 삶이 보입니다', '삶과 죽음은 나뉘지 않는다 · 초고령사회의 현실 · 죽음교육의 필요성', '1부 시작. 약 20분.', 0);

add('정의', s => {
  title(s, '삶과 죽음은 나뉘지 않는다');
  box(s, MX + 0.2, 1.7, W - 2 * MX - 0.4, 2.2, { dash: 'dash', line: '666666' });
  text(s, [
    { text: '정의  ', options: { bold: true, color: C.red } }, { text: '사람은 죽음을 피할 수 없다.', options: { breakLine: true } },
    { text: '생물학적 ➔ 세포와 장기의 기능이 한계에 도달', options: { breakLine: true, fontSize: 22 } },
    { text: '철학적·윤리적 ➔ 죽음이 삶의 의미를 성찰하게 하는 필연적 과정', options: { fontSize: 22 } },
  ], MX + 0.5, 1.8, W - 2 * MX - 1, 2.0, { size: 26, valign: 'middle', ls: 1.3 });
  box(s, MX + 0.2, 4.15, (W - 2 * MX - 0.6) / 2, 2.4, { fill: C.sage, line: C.sage });
  box(s, MX + 0.4 + (W - 2 * MX - 0.6) / 2, 4.15, (W - 2 * MX - 0.6) / 2, 2.4, { fill: 'F6E3E0', line: 'F6E3E0' });
  text(s, '‘좋은 죽음’\n환자의 존엄과 자기결정권이 존중되고 고통이 최소화되는 죽음', MX + 0.4, 4.25, 5.6, 2.2, { size: 22, valign: 'middle', color: C.green, ls: 1.3 });
  text(s, '‘나쁜 죽음’\n불필요한 연명치료와 고통 속에서 맞이하는 죽음', MX + 0.6 + (W - 2 * MX - 0.6) / 2, 4.25, 5.6, 2.2, { size: 22, valign: 'middle', color: C.red, ls: 1.3 });
}, '"여러분이 생각하는 좋은 죽음은 어느 쪽에 가깝습니까?"\n좋은 죽음의 핵심 두 단어: 존엄, 자기결정.', { min: 2 });

add('생명', s => {
  title(s, '사람은 도대체 얼마나 살 수 있을까?');
  img(s, 'lifespan', MX, 1.5, 8.3, 5.2);
  img(s, 'jellyfish', 9.1, 1.5, 3.6, 3.5, { shadow: true });
  text(s, '불로장생 해파리\n(투리톱시스 뉴트리큘라)\n늙으면 다시 아기로 돌아가는 유일한 동물', 9.0, 5.1, 3.8, 1.6, { font: G, size: 15, color: '444444', align: 'center' });
}, '생물마다 정해진 수명이 있다. 사람의 최대 수명은 약 120년 안팎으로 본다(Dong 외, Nature 2016).\n가벼운 호기심으로 분위기를 푸는 슬라이드.', { opt: true, min: 2 });

add('죽음의 의미', s => {
  title(s, '죽음은 생명의 최고 발명품이다……?');
  img(s, 'why_die', MX, 1.5, 3.6, 5.1, { shadow: true });
  img(s, 'jobs', 4.5, 1.5, 8.2, 4.4);
  text(s, '스티브 잡스, 2005년 6월 스탠퍼드 대학 졸업식 축사 중\n“죽음은 낡은 것을 치우고 새로운 것에 길을 내어 준다.”', 4.5, 5.95, 8.2, 0.85, { size: 18, color: '444444' });
}, '죽음이 있기에 오늘이 소중하다. 잡스의 축사 한 구절.', { opt: true, min: 1 });

add('초고령사회', s => {
  title(s, '초고령사회 대한민국, 1960 → 2026 → 2072');
  img(s, 'pyramid', MX, 1.45, W - 2 * MX, 5.4);
}, '인구 피라미드가 "항아리"에서 "역삼각형"으로 바뀐다. 2026년 우리나라 인구는 약 5,160만 명, 65세 이상이 빠르게 늘고 있다.\n수치는 통계청 장래인구추계 기준 — 수업 직전 재확인.', { min: 2 });

add('현실', s => {
  title(s, '한국인의 임종 현실 — 숫자가 말하는 준비의 필요성');
  const stats = [['약 18년', '건강수명과 기대수명 사이,\n아프며 사는 기간'], ['39.7%', '노인 빈곤율\n(OECD 평균의 약 2.7배)'], ['7~10년', '치매 간병 평균 기간\n간병비 월 250~350만 원']];
  stats.forEach(([v, l], i) => {
    const x = MX + i * 4.1;
    box(s, x, 1.65, 3.9, 2.4, { fill: i === 0 ? C.green : C.sage, line: i === 0 ? C.green : C.sage });
    text(s, v, x, 1.75, 3.9, 1.0, { font: T, size: 42, align: 'center', valign: 'middle', color: i === 0 ? 'FFFFFF' : C.green });
    text(s, l, x + 0.1, 2.8, 3.7, 1.15, { font: G, size: 17, align: 'center', color: i === 0 ? 'E6F0EA' : '333333' });
  });
  img(s, 'gap18', MX, 4.25, 6.6, 2.4);
  box(s, 7.4, 4.25, 5.33, 2.4, { fill: C.cream, line: 'E6DCC6' });
  text(s, '간병 파산\n가족이 간병하느라 일을 그만두거나, 간병비를 감당하다 가족 전체가 빈곤해지는 현상', 7.55, 4.3, 5.05, 2.3, { size: 19, valign: 'middle', ls: 1.25 });
}, '"준비되지 않은 장수는 축복이 아닌 가족 전체의 위기가 될 수 있습니다."\n원본 슬라이드 수치(노인 빈곤율 39.7%, 유병기간 약 18년)는 발표 전 최신 통계로 재확인.', { min: 3 });

add('참여', s => {
  title(s, '죽음이 어느 날 내게 온다면……,');
  const r = ['무슨 소리야? 상상도 하기 싫어~!!!', '나, 이제 겨우 살 만한데? 벌써? 아니 아니…', '잠깐만, 뭐든 준비를 해야 할 거 아냐?', '그래, 언젠가는 올 줄 알았지?', '그래도 잠깐만, 아주 잠깐만 시간을 줘~!!!', '그래, 알았다. 준비됐으니 같이 가자~!!!', '이제껏 잘 살았으니, 모두에게, 세상에게 감사해야지……'];
  r.forEach((t, i) => {
    box(s, MX + 0.3, 1.55 + i * 0.7, W - 2 * MX - 0.6, 0.6, { r: 0.05, fill: i === 6 ? C.pink : 'FFFFFF', line: '888888' });
    text(s, `${i + 1}.  ${t}`, MX + 0.5, 1.55 + i * 0.7, W - 2 * MX - 1, 0.6, { font: T, size: 22, valign: 'middle', color: C.ink });
  });
}, '참여 질문: "나는 지금 몇 번에 가까운가요? 손가락으로 표시해 보세요."\n1~5는 퀴블러-로스가 말한 부정·분노·타협·우울·수용과도 닮아 있다. 정답은 없다 — 어느 번호든 자연스러운 마음.\n웃음이 나오는 대목. 충분히 웃게 둔다.', { min: 3 });

add('메멘토 모리', s => {
  title(s, '죽음을 기억하라, 고로 오늘을 살아라');
  img(s, 'gladiator', 8.3, 1.5, 4.4, 3.4, { shadow: true });
  text(s, '“메멘토 모리 (Memento Mori)”\n“죽음을 기억하라” — 라틴어', MX, 1.55, 7.5, 1.2, { font: T, size: 26, color: C.navy });
  box(s, MX, 2.85, 7.5, 2.6, { fill: C.cream, line: 'E6DCC6' });
  text(s, '✓ 오늘 내가 가장 소중히 여기는 것은 무엇인가?\n✓ 혹시, 무엇을 미루고 있는가?\n✓ 꼭 했어야 할 ‘고맙다는 말’을 전하지 못했는가?', MX + 0.2, 2.95, 7.1, 2.4, { size: 22, ls: 1.45, valign: 'middle' });
  img(s, 'infinity', MX, 5.6, 4.5, 1.2);
  text(s, '➩  웰다잉 = 웰빙의 완성', 5.3, 5.7, 7.4, 1.0, { font: T, size: 26, color: C.green, valign: 'middle' });
}, '로마 개선장군 뒤에서 노예가 외쳤다는 "메멘토 모리".\n웰다잉(준비된 끝)과 웰빙(충만한 현재)은 하나로 이어진 고리.', { min: 2 });

add('필요성', s => {
  title(s, '초고령사회, 왜 지금 죽음교육이 필요할까요?');
  const c = [['길어진 마지막', '아프며 사는 시간이 길어졌습니다.\n돌봄·의료·비용을 미리 생각하지 않으면 가족이 떠안게 됩니다.'], ['대신 내려야 하는 결정', '말할 수 없게 되면 연명의료·장례를 가족이 대신 정합니다.\n내 뜻을 미리 알려 두는 것이 사랑입니다.'], ['전하지 못한 말', '마지막 순간에 가장 많이 남는 것은\n“고맙다, 미안하다, 사랑한다”를 못 한 후회입니다.']];
  c.forEach(([h, b], i) => {
    const x = MX + i * 4.1;
    box(s, x, 1.7, 3.9, 4.0, { fill: C.sage, line: C.sage });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.9, w: 0.7, h: 0.7, fill: { color: C.green }, line: { color: C.green } });
    text(s, `${i + 1}`, x + 0.25, 1.9, 0.7, 0.7, { font: T, size: 24, align: 'center', valign: 'middle', color: 'FFFFFF' });
    text(s, h, x + 1.05, 1.9, 2.75, 0.7, { font: T, size: 22, valign: 'middle', color: C.green });
    text(s, b, x + 0.25, 2.8, 3.45, 2.8, { size: 19, ls: 1.35 });
  });
  highlight(s, '죽음교육은 죽음을 앞당기는 공부가 아니라, 남은 삶을 지키는 공부입니다.', 5.95, { size: 22, h: 0.65 });
}, 'WLC 교재 1·2장의 핵심을 세 가지로 압축. 시니어 청중이 "내 이야기"로 느끼도록 각 항목마다 짧은 질문을 던진다.\n예) "자녀에게 내 치료에 대해 말해 둔 적 있으세요?"', { min: 3 });

add('필요성', s => {
  title(s, '죽음도 삶처럼 준비와 교육이 필요하다!');
  box(s, 3.2, 1.6, 9.5, 2.5, { line: '444444' });
  text(s, '“죽음을 이해할 때, 현재 나의 삶을 어떻게 살아야 할지 성찰할 수 있다.\n죽음의 관점에서 현재를 바라본다면, 욕구 충족의 삶이 아니라\n의미 있는 삶을 위한 선택을 하게 된다.”', 3.4, 1.7, 9.1, 2.3, { size: 21, ls: 1.4, valign: 'middle' });
  text(s, '죽음 준비', MX, 2.2, 2.4, 0.7, { font: T, size: 28, color: C.navy, align: 'center' });
  text(s, '⬍', MX, 3.15, 2.4, 0.9, { font: G, size: 40, color: C.navy, align: 'center' });
  text(s, '삶의 준비', MX, 4.3, 2.4, 0.7, { font: T, size: 28, color: C.navy, align: 'center' });
  box(s, 3.2, 4.35, 9.5, 2.0, { line: '444444' });
  text(s, '✓ 죽음을 논의하는 것은 결국 삶을 논의하는 것이고,\n✓ 좋은 죽음은 좋은 삶에 대한 논의가 될 수밖에 없다.\n✓ 삶과 죽음은 생명 과정의 양면이기 때문이다.', 3.4, 4.4, 9.1, 1.9, { size: 21, ls: 1.35, valign: 'middle' });
  text(s, '— 한림대 생사학연구소 양정연 교수', 7.7, 6.4, 5.0, 0.4, { font: G, size: 13, color: C.gray, align: 'right' });
}, '1부 마무리. "그래서 오늘 우리는 죽음을 이야기하면서 사실은 삶을 이야기합니다."', { min: 1 });

// ═════════ 2부 미리 준비하는 사랑 (약 25분) ═════════
section('2부', '미리 준비하는 사랑', '연명의료 · 돌봄 · 유언 · 장례 — 내 뜻을 미리 알려 두는 일', '2부 시작. 약 25분. 정보가 많은 구간이므로 "다 외우실 필요 없습니다, 어디에 물어보면 되는지만 기억하세요"라고 안심시킨다.', 0);

add('연명의료', s => {
  title(s, '존엄성을 잃어버린 연명의료의 역설');
  img(s, 'lst_gap', MX, 1.5, W - 2 * MX, 3.9);
  highlight(s, '막연한 ‘의지’가 아니라, 효력을 갖춘 ‘서류’가 가족의 짐을 덜어 줍니다.', 5.7, { size: 22, h: 0.75 });
}, '대다수가 무의미한 연명의료를 원하지 않는다고 답하지만, 실제로 미리 서류로 남긴 사람은 많지 않다 — "의지와 실행의 간극".\n원본 수치(사전연명의료의향서 등록 300만 명 돌파, 84.1% 거부 희망 등)는 국립연명의료관리기관 최신 통계로 재확인.', { min: 2 });

add('연명의료', s => {
  title(s, '사전연명의료의향서와 연명의료계획서, 무엇이 다를까요?');
  const cols = [
    ['사전연명의료의향서', C.green, ['누가 · 19세 이상 누구나', '언제 · 건강할 때 미리', '어디서 · 지정된 등록기관에서 상담 후 작성', '마음이 바뀌면 · 언제든 변경·철회 가능']],
    ['연명의료계획서', C.navy, ['누가 · 말기·임종과정의 환자', '언제 · 병이 깊어졌을 때', '어디서 · 담당 의사와 함께 작성', '의료기관의 절차에 따라 기록']],
  ];
  cols.forEach(([h, col, items], i) => {
    const x = MX + i * 6.15, w = 5.95;
    box(s, x, 1.65, w, 0.85, { fill: col, line: col });
    text(s, h, x, 1.65, w, 0.85, { font: T, size: 26, align: 'center', valign: 'middle', color: 'FFFFFF' });
    box(s, x, 2.6, w, 3.3, { fill: i ? 'EEF2F8' : C.sage, line: i ? 'EEF2F8' : C.sage });
    s.addText(items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < items.length - 1 } })), { x: x + 0.25, y: 2.75, w: w - 0.5, h: 3.0, fontFace: M, fontSize: 21, color: C.ink, paraSpaceAfter: 12, valign: 'top', fit: 'shrink' });
  });
  highlight(s, '“의사표현이 어렵게 되면, 가족이 무엇을 알았으면 하나요?”', 6.05, { size: 22, h: 0.6 });
}, 'WLC 9강 내용 요약. 등록기관(보건소, 국민건강보험공단 지사, 일부 의료기관·복지관 등)은 국립연명의료관리기관 누리집에서 확인 — 수업 직전 재확인.\n"이 서류는 죽음을 서두르는 서류가 아니라, 내 뜻을 지키고 가족의 짐을 덜어 주는 서류입니다."\n워크북 6쪽(의료·장례 희망)과 연결.', { min: 3 });

add('돌봄', s => {
  title(s, '2026년 3월, 살던 곳에서 누리는 ‘통합돌봄’ 시작');
  img(s, 'care2026', MX, 1.5, 8.0, 3.9);
  box(s, 8.8, 1.5, 3.93, 3.9, { fill: C.cream, line: 'E6DCC6' });
  text(s, '돌봄통합지원법\n2026. 3. 27. 시행\n\n살던 곳에서 의료·요양·돌봄을 통합적으로\n읍·면·동 주민센터에서 신청', 8.9, 1.6, 3.73, 3.7, { size: 18, ls: 1.3, valign: 'middle' });
  highlight(s, '존엄성을 지키는 돌봄은 단순한 서비스가 아니라, 사람의 삶을 지탱하는 사회적 약속입니다.', 5.7, { size: 20, h: 0.8 });
}, '"병원이 아닌 우리 집에서" 살다가 마무리할 수 있도록 돕는 제도. 대상·신청 절차는 지자체마다 다르므로 주민센터 문의 안내.', { opt: true, min: 2 });

add('유언', s => {
  title(s, '유언은 삶의 뜻을 남기는 기록');
  img(s, 'will5', MX, 1.5, 8.2, 4.6);
  box(s, 9.0, 1.5, 3.73, 4.6, { fill: C.cream, line: 'E6DCC6' });
  text(s, '민법이 정한\n유언의 5가지 방식\n\n자필증서 · 녹음\n공정증서 · 비밀증서\n구수증서', 9.1, 1.6, 3.53, 4.4, { font: T, size: 20, ls: 1.35, color: C.green, align: 'center', valign: 'middle' });
  highlight(s, '정해진 방식을 지키지 않은 유언은 효력이 없을 수 있습니다.', 6.25, { size: 21, h: 0.6 });
}, '세부 요건은 법률 전문가(변호사·법무사·공증인)에게 확인하도록 안내 — WLC는 법률 자문을 하지 않는다.', { min: 2 });

add('유언', s => {
  title(s, '가장 쉽고 확실한 실천 : 자필 유언과 디지털 정리');
  img(s, 'holo_will', MX, 1.5, 6.0, 4.6, { shadow: true });
  img(s, 'digital', 6.9, 1.5, 5.83, 3.4);
  box(s, 6.9, 5.0, 5.83, 1.1, { fill: C.sage, line: C.sage });
  text(s, '휴대전화·통장 앱·사진첩의 존재와 접근 방법을\n믿을 수 있는 가족에게 미리 알려 두세요.', 7.0, 5.0, 5.63, 1.1, { size: 18, valign: 'middle' });
  highlight(s, '자필 유언 5요건 : 전문 직접 자필 · 연월일 · 주소 · 성명 · 날인', 6.25, { size: 22, h: 0.6 });
}, '자필증서 유언은 내용 전부·날짜·주소·성명을 직접 쓰고 도장을 찍어야 한다. 하나라도 빠지면 무효가 될 수 있다.\n디지털 유산(사진·계정·구독 서비스)은 7강 내용. 비밀번호를 종이에 적어 두는 것보다 "어디에 무엇이 있는지" 알려 두는 것이 우선.', { min: 3 });

add('장례', s => {
  title(s, '장례 문화의 변화 — 화장·자연장, 그리고 작은 장례');
  img(s, 'f1', MX, 1.5, 3.0, 2.0); img(s, 'f2', MX + 3.1, 1.5, 3.0, 2.0); img(s, 'f3', MX + 6.2, 1.5, 3.0, 2.0); img(s, 'f4', MX + 9.3, 1.5, 2.8, 2.0);
  text(s, [
    { text: '2000년대 초 ', options: { bold: true, color: C.navy } }, { text: '매장 중심 → 화장 장려 정책 시작', options: { breakLine: true } },
    { text: '2010년대 ', options: { bold: true, color: C.navy } }, { text: '화장률 급증, 봉안당·수목장 제도화', options: { breakLine: true } },
    { text: '최근 ', options: { bold: true, color: C.navy } }, { text: '자연장 범위 확대 — 바다에 골분을 뿌리는 산분장 가능', options: { breakLine: true } },
    { text: '함께 늘어나는 것 ', options: { bold: true, color: C.navy } }, { text: '빈소 없는 가족장 · 작은 장례 · 가족 중심의 애도' },
  ], MX + 0.2, 3.7, W - 2 * MX - 0.4, 2.9, { size: 22, ls: 1.4 });
}, '화장률은 1990년대 초 20% 안팎에서 최근 90% 이상으로 높아졌다. 산분장 관련 규정은 2025년 시행 — 세부 기준은 e하늘 장사정보시스템에서 확인.\n"장례의 크기보다, 어떤 마음으로 보내고 싶은지가 중요해졌습니다."', { min: 2 });

add('장묘', s => {
  title(s, '흙으로 돌아갈 것이니라.  창세기 3:19');
  img(s, 'dust1', MX, 1.5, 5.95, 4.3, { shadow: true });
  img(s, 'dust2', 6.78, 1.5, 5.95, 4.3, { shadow: true });
  highlight(s, '마지막 공간을 선택하는 일은, 내가 어떤 방식으로 기억되고 싶은지와 연결됩니다.', 6.0, { size: 21, h: 0.65 });
}, '"너는 흙이니 흙으로 돌아갈 것이니라." 신앙 안에서 장례·장묘를 바라보는 시선.\n워크북 6쪽 "원하는 장례 방식"으로 이어진다.', { min: 1 });

add('변화', s => {
  title(s, '세상의 인식은 변하고 있습니다');
  ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].forEach((k, i) => img(s, k, MX + (i % 3) * 4.1, 1.5 + Math.floor(i / 3) * 2.45, 3.95, 2.35, { shadow: true }));
  text(s, '죽음은 숨기는 주제가 아니라, 함께 배워야 할 삶의 주제가 되었습니다.', MX, 6.35, W - 2 * MX, 0.5, { size: 20, align: 'center', color: C.green });
}, '영화·방송·현장 사진. 웰다잉이 사회적 관심사가 되었음을 보여 준다.\n[영상 삽입 후보] 관련 다큐 또는 드라마 장면 1~2분.\n이 슬라이드 뒤에 5분 휴식을 권장.', { opt: true, min: 1 });

add('휴식', s => {
  s.background = { color: C.cream };
  text(s, '잠시 쉬어 갑니다', 1, 2.2, W - 2, 1.2, { font: T, size: 48, align: 'center', color: C.green });
  text(s, '기지개를 켜고, 물 한 잔 드세요.\n옆 분께 “오늘 오시길 잘하셨어요” 한마디 건네 볼까요?', 1, 3.6, W - 2, 1.4, { size: 26, align: 'center', color: '444444', ls: 1.4 });
}, '5분 휴식. 무거운 정보 뒤에 몸과 마음을 푼다.', { min: 5 });

// ═════════ 3부 관계를 정리하고 마음을 전합니다 (약 15분) ═════════
section('3부', '관계를 정리하고 마음을 전합니다', '후회를 줄이는 다섯 문장 · 마지막 대화 · 곁에 있어 주기 · 슬픔을 지나는 길', '3부 시작. 약 15분.', 0);

add('후회', s => {
  title(s, '죽음을 앞둔 이들이 가장 많이 남긴 다섯 가지 후회');
  img(s, 'regrets', MX, 1.5, 3.1, 5.0, { shadow: true });
  const r = ['남들의 기대가 아닌, 나 자신에게 충실한 삶을 살 용기가 있었더라면', '그렇게 열심히 일만 하지 않았더라면', '내 감정을 표현할 용기가 있었더라면', '친구들과 계속 연락하고 지냈더라면', '좀 더 행복했더라면'];
  r.forEach((t, i) => {
    box(s, 4.0, 1.5 + i * 0.95, 8.73, 0.82, { fill: i % 2 ? 'FFFFFF' : C.cream, line: 'E6DCC6' });
    text(s, `${i + 1}. ${t}`, 4.2, 1.5 + i * 0.95, 8.4, 0.82, { size: 21, valign: 'middle' });
  });
  text(s, '출처 : Bronnie Ware, The Top Five Regrets of the Dying (2011)', 4.0, 6.3, 8.7, 0.4, { font: G, size: 12, color: C.gray });
}, '호스피스 간병인 브로니 웨어가 들은 이야기. 다섯 가지 중 "나에게 가장 와닿는 번호"를 마음속으로 골라 보게 한다.', { min: 2 });

add('성찰', s => {
  title(s, '후회를 줄이는 다섯 문장');
  const r = ['나는 나답게 살고 있는가?', '사랑한다고 말했는가?', '고맙다고 표현했는가?', '미안함을 미루지 않았는가?', '행복을 선택하고 있는가?'];
  r.forEach((t, i) => text(s, `${i + 1}. ${t}`, 2.2, 1.6 + i * 0.95, 9, 0.85, { font: T, size: 30, color: i === 2 ? C.red : C.green, valign: 'middle' }));
}, '다섯 문장을 다 같이 소리 내어 읽는다. 3번(고맙다)은 워크북 2·5쪽으로 이어진다.\n"인생은 선택입니다. 행복을 선택하십시오." — 브로니 웨어', { min: 2 });

add('마지막 대화', s => {
  title(s, '마지막 대화에는 정답이 없습니다');
  const rows = [['감사', '“함께 살아줘서 고마워요.”'], ['사과', '“내가 미안했던 일이 있어요. 말하고 싶었어요.”'], ['사랑', '“사랑해요. 당신이 우리에게 큰 의미였어요.”'], ['안심', '“걱정되는 일은 우리가 하나씩 해볼게요.”'], ['침묵', '손을 잡고 조용히 곁에 있는 것도 충분한 대화입니다.']];
  rows.forEach(([h, b], i) => {
    const y = 1.55 + i * 0.92;
    box(s, MX + 0.2, y, 1.8, 0.8, { fill: C.green, line: C.green });
    text(s, h, MX + 0.2, y, 1.8, 0.8, { font: T, size: 24, align: 'center', valign: 'middle', color: 'FFFFFF' });
    box(s, MX + 2.1, y, W - 2 * MX - 2.3, 0.8, { fill: i === 4 ? C.pink : C.cream, line: i === 4 ? C.pink : 'E6DCC6' });
    text(s, b, MX + 2.3, y, W - 2 * MX - 2.7, 0.8, { size: 22, valign: 'middle' });
  });
  text(s, '화해나 용서를 억지로 하지 않아도 됩니다. 어떤 관계는 마지막까지 복잡할 수 있습니다.', MX, 6.25, W - 2 * MX, 0.5, { font: G, size: 16, color: C.gray, align: 'center' });
}, 'WLC 13강(임종 돌봄) "마지막 대화"의 핵심.\n"이 말들은 마지막에만 하는 말이 아닙니다. 오늘 집에 가서 해도 되는 말입니다."', { min: 2 });

add('돌봄', s => {
  title(s, '죽음을 앞둔 사람을 대하는 법');
  text(s, '「죽음을 배우다」 랍 몰 (Rob Moll) / 미국 작가 · 죽음연구가', MX, 1.4, W - 2 * MX, 0.5, { font: G, size: 16, color: C.gray });
  box(s, MX + 0.6, 2.0, W - 2 * MX - 1.2, 3.9, { line: '333333', lw: 1.5, r: 0.02 });
  text(s, [
    { text: '첫번째, 남은 목표를 실현할 수 있게 돕고,', options: { breakLine: true } },
    { text: '두번째, 자신의 인생이야기를 정리하게 돕고,', options: { breakLine: true } },
    { text: '세번째, 가족과 친구들에게 진정으로 이별하고 작별 인사를 할 수 있게 돕고,', options: { breakLine: true } },
    { text: '그리고, ', options: {} }, { text: '곁에 있어 줘라', options: { color: '1F5FD1', bold: true, underline: true } },
  ], MX + 0.9, 2.1, W - 2 * MX - 1.8, 3.7, { font: T, size: 26, ls: 1.5, valign: 'middle' });
}, '"많은 말보다, 곁에 있어 주는 것." 간병 경험이 있는 분들께 깊이 와닿는 대목.', { min: 2 });

add('애도', s => {
  title(s, '슬픔은 사랑의 다른 이름입니다');
  const L = ['애도에는 정해진 기간도, 순서도 없습니다.', '울지 않는 사람도, 오래 우는 사람도 모두 자연스럽습니다.', '떠난 사람과의 사랑은 끝나지 않고 다른 방식으로 이어집니다.'];
  L.forEach((t, i) => text(s, `◆  ${t}`, MX + 0.2, 1.6 + i * 0.8, W - 2 * MX - 0.4, 0.75, { size: 23, valign: 'middle' }));
  const x2 = MX + 6.25, w = 5.95;
  box(s, MX, 4.15, w, 2.45, { fill: 'F6E3E0', line: 'F6E3E0' });
  box(s, x2, 4.15, w, 2.45, { fill: C.sage, line: C.sage });
  text(s, '아픔이 되는 말\n“이제 그만 울어.”\n“좋은 곳 가셨으니 됐어.”\n“시간이 약이야.”', MX + 0.2, 4.2, w - 0.4, 2.35, { size: 20, color: C.red, ls: 1.3, valign: 'middle' });
  text(s, '힘이 되는 말\n“많이 보고 싶으시지요.”\n“그분 이야기 더 들려주세요.”\n“제가 곁에 있을게요.”', x2 + 0.2, 4.2, w - 0.4, 2.35, { size: 20, color: C.green, ls: 1.3, valign: 'middle' });
}, 'WLC 11강(상실·애도) 요약. 배우자를 먼저 보낸 분이 계실 수 있으니 따뜻하게, 천천히.\n두 시간 이상 일상이 무너지거나 "따라가고 싶다"는 말이 반복되면 전문 상담(정신건강복지센터, 자살예방상담전화 109)으로 연결.', { min: 3 });

// ═════════ 4부 나를 완성하는 7가지 질문 — 워크북 (약 30분) ═════════
section('4부', '하나님 안에서 내 삶을 완성하는 7가지 질문', '워크북을 펴 주세요. 쓰고 싶은 만큼만, 쓰기 어려우면 생각만 해도 괜찮습니다.', '4부 워크북 실습. 약 30분. 각 질문당 3~4분. 시간이 부족하면 1·4·7번을 우선하고 나머지는 집에서 쓰도록 안내.', 0);

add('워크북', s => {
  title(s, '오늘 함께 쓸 일곱 가지 질문');
  const q = [['1', '나를 여기까지 인도하신 은혜', '감사의 순간 세 가지', '돌아보기'], ['2', '내가 소중히 여기며 살아온 것', '나의 가치 세 가지', '돌아보기'], ['3', '지금 나는 얼마나 준비되어 있는가', '준비 점검표', '준비하기'], ['4', '고마운 사람에게 전하는 한마디', '짧은 감사 편지', '전하기'], ['5', '나의 의료·장례 희망 사항', '장소·방식·바람', '준비하기'], ['6', '내가 남기고 싶은 믿음의 기억', '기억되고 싶은 모습', '전하기'], ['7', '오늘, 한 걸음', '바로 실천할 한 가지', '시작하기']];
  q.forEach(([n, t, d, g], i) => {
    const col = i < 4 ? 0 : 1, row = i < 4 ? i : i - 4;
    const x = MX + col * 6.15, y = 1.55 + row * 1.25, w = 5.95;
    box(s, x, y, w, 1.1, { fill: C.cream, line: 'E6DCC6' });
    s.addShape(pres.shapes.OVAL, { x: x + 0.15, y: y + 0.18, w: 0.74, h: 0.74, fill: { color: C.green }, line: { color: C.green } });
    text(s, n, x + 0.15, y + 0.18, 0.74, 0.74, { font: T, size: 22, align: 'center', valign: 'middle', color: 'FFFFFF' });
    text(s, t, x + 1.0, y + 0.08, w - 2.3, 0.55, { font: T, size: 19, color: C.green, valign: 'middle' });
    text(s, `워크북 ${+n + 1}쪽 · ${d}`, x + 1.0, y + 0.6, w - 2.3, 0.45, { font: G, size: 14, color: '555555' });
    box(s, x + w - 1.25, y + 0.3, 1.1, 0.5, { fill: 'FFFFFF', line: C.green, r: 0.25 });
    text(s, g, x + w - 1.25, y + 0.3, 1.1, 0.5, { font: G, size: 13, align: 'center', valign: 'middle', color: C.green });
  });
  box(s, MX + 6.15, 1.55 + 3 * 1.25, 5.95, 1.1, { fill: C.green, line: C.green });
  text(s, '돌아보기 → 준비하기 → 전하기 → 시작하기', MX + 6.25, 1.55 + 3 * 1.25, 5.75, 1.1, { font: T, size: 18, color: 'FFFFFF', align: 'center', valign: 'middle' });
}, '워크북 전체 흐름 소개. 표지에 이름·날짜·구역을 먼저 쓰게 한다.\n"이 워크북은 오늘 다 채우지 않아도 됩니다. 제가 네 번 고쳐 썼듯이, 오늘은 첫 장입니다."', { min: 2 });

activity('질문 1', '1. 나를 여기까지 인도하신 하나님의 은혜', 2, '“범사에 감사하라 이것이 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라”  — 데살로니가전서 5:18',
  ['살아오며 가장 감사했던 순간 세 가지를 적습니다.', '가장 힘들었지만, 지나고 보니 감사한 일 하나를 적습니다.', '원하시면 옆 분과 한 가지만 나눕니다.'], 4,
  '좋은 마무리는 좋았던 삶을 기억하는 데서 시작한다. 성찰 질문: "지금의 나를 있게 한 하나님의 손길은 어느 순간에 가장 선명했습니까?"\n나눔은 자원자 1~2명만. 강요하지 않는다.');

activity('질문 2', '2. 내가 소중히 여기며 살아온 것들', 3, '무엇을 지키며 살아왔는지가 곧 나의 삶입니다.',
  ['내 삶에서 가장 소중했던 가치 세 가지를 적습니다.', '“나는 하나님 앞에서 …” 로 시작하는 신앙 고백 한 줄을 씁니다.', '이 가치를 지키기 위해 이번 주 실천할 작은 순종 하나를 적습니다.'], 3,
  '가치 예시를 몇 개 보여 주면 쉽게 쓴다: 가족, 정직, 신앙, 나눔, 건강, 배움, 성실.\n성찰 질문: "내가 지켜온 가치 중 가족에게 가장 물려주고 싶은 것은?"', s => {
    text(s, '예) 가족 · 정직 · 신앙 · 나눔 · 성실 · 배움', MX + 0.3, 5.85, 7.7, 0.5, { font: G, size: 16, color: C.gray });
  });

add('질문 3', s => {
  title(s, '3. 지금 나는 얼마나 준비되어 있는가?');
  const items = ['지금 감사한 사람이 바로 떠오른다', '화해하고 싶은 사람이 있다', '가족에게 내 마음을 충분히 표현했다', '나의 소중한 물건·기록을 정리하고 있다', '신앙의 유산을 다음 세대에 남기고 싶다', '남은 삶에 이루고 싶은 목표가 있다', '사전연명의료의향서를 알고 있다'];
  box(s, MX, 1.55, 8.4, 0.55, { fill: C.green, line: C.green, r: 0.03 });
  text(s, '점검 항목', MX + 0.2, 1.55, 6, 0.55, { font: T, size: 18, color: 'FFFFFF', valign: 'middle' });
  text(s, '예      아직', MX + 6.2, 1.55, 2.1, 0.55, { font: T, size: 18, color: 'FFFFFF', valign: 'middle' });
  items.forEach((t, i) => {
    const y = 2.15 + i * 0.62;
    box(s, MX, y, 8.4, 0.58, { fill: i % 2 ? 'FFFFFF' : C.cream, line: 'E6DCC6', r: 0.03 });
    text(s, t, MX + 0.2, y, 6, 0.58, { size: 19, valign: 'middle' });
    text(s, '□       □', MX + 6.3, y, 2.0, 0.58, { font: G, size: 20, valign: 'middle' });
  });
  box(s, 9.2, 1.55, 3.53, 2.2, { fill: C.green, line: C.green });
  text(s, '워크북', 9.2, 1.7, 3.53, 0.5, { font: G, size: 18, color: 'CFE3DC', align: 'center' });
  text(s, '4쪽', 9.2, 2.2, 3.53, 1.2, { font: T, size: 54, color: 'FFFFFF', align: 'center', valign: 'middle' });
  box(s, 9.2, 4.0, 3.53, 2.4, { fill: C.cream, line: 'E6DCC6' });
  text(s, '“아직”에 체크한 것 중\n오늘 가장 먼저\n시작하고 싶은 것\n하나에 ○ 표시', 9.3, 4.1, 3.33, 2.2, { size: 19, align: 'center', valign: 'middle', color: C.navy, ls: 1.3 });
}, '웰다잉은 죽음을 준비하는 것이 아니라 삶을 정리하고 완성하는 과정. 정답·점수는 없다.\n7번(사전연명의료의향서)에 "아직"이 많으면 2부 슬라이드로 잠깐 돌아가 등록기관 안내.', { min: 4, wb: 4 });

activity('질문 4', '4. 고마운 사람에게 전하는 한마디', 5, '“말하지 못한 감사는 상처가 되고, 전한 감사는 유산이 됩니다.”',
  ['지금 가장 감사한 사람 한 명을 떠올립니다.', '“사랑하는 ______ 에게,” 로 시작하는 짧은 편지를 씁니다.', '오늘 저녁, 이 편지를 사진으로 보내거나 전화로 읽어 드립니다.'], 6,
  '오늘 실습의 중심. 잔잔한 음악(찬양 연주곡)을 틀어 둔다. [음악·영상 삽입 후보]\n다 쓴 분 중 원하는 1~2분이 낭독. 울컥하는 분이 있으면 휴지를 건네고 기다린다.');

activity('질문 5', '5. 나의 의료·장례 희망 사항', 6, '내 뜻을 미리 정해 두면 남은 가족의 짐을 덜 수 있습니다.',
  ['마지막을 맞고 싶은 장소에 표시합니다. (집 · 호스피스·병원 · 아직)', '원하는 장례 방식에 표시합니다. (화장 후 봉안·자연장 · 매장 · 가족과 의논)', '장례에서 꼭 있었으면 하는 것을 적습니다. (찬송, 성도들의 기도 등)'], 4,
  '※ 법적 효력이 필요한 문서(사전연명의료의향서·유언장)는 지정 등록기관이나 전문가의 도움을 받아 작성하도록 반드시 안내.\n"이 쪽을 가족과 교회에 함께 전해 두시면 좋습니다."', s => {
    text(s, '※ 법적 효력이 필요한 문서는 지정 등록기관·전문가와 작성', MX + 0.3, 5.85, 7.7, 0.5, { font: G, size: 15, color: C.red });
  });

activity('질문 6', '6. 내가 남기고 싶은 믿음의 기억', 7, '나, ______ 은(는) 평생 ______ 을(를) 소중히 여기며 살아왔고, 가족과 이웃에게 ______ 으로 기억되기를 바랍니다.',
  ['빈칸을 채워 나의 문장을 완성합니다.', '사람들에게 남기고 싶은 가장 따뜻한 기억 하나를 적습니다.', '다음 세대에게 물려주고 싶은 신앙의 한마디를 적습니다.'], 4,
  '성찰 질문: "내 이름이 불릴 때 사람들이 가장 먼저 떠올렸으면 하는 단어는?"\n시간이 있으면 다음 슬라이드(소풍 부고장)를 함께 소개.');

add('선택 실습', s => {
  title(s, '더 해 보기 : 내가 쓰는 소풍 부고장');
  img(s, 'cheon', MX, 1.5, 4.0, 3.9, { shadow: true });
  box(s, MX, 5.5, 4.0, 1.25, { fill: C.cream, line: 'E6DCC6' });
  text(s, '“아름다운 이 세상 소풍 끝내는 날,\n가서, 아름다웠더라고 말하리라……”\n— 천상병, 「귀천」', MX + 0.1, 5.5, 3.8, 1.25, { size: 15, valign: 'middle', align: 'center' });
  box(s, 4.9, 1.5, 7.83, 5.25, { line: '666666', dash: 'dash' });
  text(s, '나 (          ) 은(는)\n_____년 __월 __일, ________ 에서 태어나,\n이제 __세를 일기로 세상을 떠나\n아름다운 하늘로 소풍을 떠난다.\n나의 가족은 _____ 외 __명으로 ________ 에 살고 있다.\n나의 죽음을 슬퍼하지 말고,\n장례식은 조용하고 평온하게 치러 주기를 부탁드린다.', 5.1, 1.6, 7.43, 4.6, { size: 19, ls: 1.45 });
  text(s, '2050. 2. 14.   이름 :', 9.0, 6.2, 3.6, 0.45, { size: 17, align: 'right' });
}, '시간이 넉넉할 때 또는 다음 모임 과제로. 미래의 어느 날짜(예: 2050년)를 쓰게 하면 무겁지 않게 웃으며 쓸 수 있다.\n워크북에는 없는 활동이므로 별도 인쇄물 또는 워크북 여백 활용.', { opt: true, min: 3 });

activity('질문 7', '7. 오늘, 한 걸음', 8, '큰 결심보다 오늘 드릴 수 있는 작은 순종 한 가지가 삶을 바꿉니다.',
  ['하나님께 더 맡기고 싶은 일을 적습니다.', '오늘 강의가 끝나면 바로 실천할 믿음의 한 가지를 적습니다.', '가족과 함께 나누고 싶은 기도 제목을 적습니다.'], 3,
  '마지막 질문은 반드시 "행동"으로 끝낸다. 다 쓴 뒤 두세 분의 "한 걸음"을 듣는다.');

// ═════════ 닫기 (약 10분) ═════════
add('신앙', s => {
  title(s, '영원한 생명과 위로의 약속');
  box(s, MX, 1.55, 2.2, 2.3, { fill: C.green, line: C.green });
  text(s, '부활과\n영생', MX, 1.55, 2.2, 2.3, { font: T, size: 28, align: 'center', valign: 'middle', color: 'FFFFFF' });
  box(s, MX + 2.35, 1.55, W - 2 * MX - 2.35, 2.3, { line: '444444' });
  text(s, '✓ 부활과 영생의 소망 (요한복음 11:25-26, 14:1-3)\n✓ 고통 없는 하늘나라의 위로 (요한계시록 21:4, 시편 23:4)\n✓ 영원한 집과 상급 (고린도후서 5:1, 디모데후서 4:7-8)', MX + 2.55, 1.6, W - 2 * MX - 2.75, 2.2, { size: 21, ls: 1.4, valign: 'middle' });
  const c = [['천국 환송', '이 땅에서의 수고를 다 하시고, 이제 아픔도 눈물도 없는 주님의 품에서 참된 안식을 누리시길.'], ['재회의 소망', '잠시 동안의 이별이지만, 천국에서 다시 만날 확실한 소망이 있음을 믿습니다.'], ['동행하시는 주님', '슬픔 중에 있는 유가족에게 성령 하나님의 세밀한 위로와 평안이 가득하기를.']];
  c.forEach(([h, b], i) => {
    const x = MX + i * 4.1;
    box(s, x, 4.05, 3.9, 2.6, { fill: C.cream, line: 'E6DCC6' });
    text(s, h, x + 0.15, 4.12, 3.6, 0.55, { font: T, size: 21, color: C.green });
    text(s, b, x + 0.15, 4.7, 3.6, 1.85, { size: 17, ls: 1.3 });
  });
}, '신앙 공동체 안에서 죽음을 바라보는 소망. 짧게 기도로 연결해도 좋다(교회 담당자와 사전 협의).', { min: 2 });

add('버킷리스트', s => {
  title(s, '버킷리스트는 삶의 선언입니다');
  box(s, MX, 1.55, 6.0, 4.6, { fill: C.cream, line: 'E6DCC6' });
  text(s, 'And now, the end is near\nAnd so I face the final curtain…\nI’ve lived a life that’s full.\n\n이제 끝이 가까워졌네. 나는 마지막 장을 마주하고 있다네.\n벗이여, 나는 충만한 삶을 살아왔다고 분명히 말하네.\n\nMY WAY _ Frank Sinatra', MX + 0.2, 1.65, 5.6, 4.4, { size: 17, ls: 1.3, valign: 'middle', color: '333333' });
  text(s, '당하는 죽음 (말고),\n맞이하는 죽음~!', 7.0, 1.6, 5.7, 1.6, { font: T, size: 32, color: C.navy, ls: 1.3 });
  box(s, 7.0, 3.35, 5.73, 1.2, { line: '444444' });
  text(s, '죽기 전에 꼭 해 보고 싶은 일과\n보고 싶은 것들을 적은 목록', 7.1, 3.35, 5.53, 1.2, { size: 21, valign: 'middle' });
  text(s, '‘죽다’ ➔ ‘킥 더 버킷(kick the bucket)’\n양동이를 걷어차는 데서 유래한 말', 7.0, 4.75, 5.73, 1.3, { size: 17, color: C.gray });
}, '[영상 삽입 후보] My Way 1절.\n"남은 시간에 꼭 해 보고 싶은 일 세 가지" — 워크북 7쪽 여백에 적어도 좋다.', { opt: true, min: 2 });

add('정의', s => {
  title(s, '존엄한 삶의 완성');
  box(s, MX + 0.5, 1.6, W - 2 * MX - 1, 1.5, { line: 'D0D7D2' });
  text(s, '웰다잉은 죽음을 기다리는 것이 아니라,\n마지막 순간까지 나답게 살아가는 과정입니다.', MX + 0.6, 1.6, W - 2 * MX - 1.2, 1.5, { font: M, size: 28, align: 'center', valign: 'middle', color: C.green, ls: 1.3 });
  box(s, MX + 0.6, 3.35, W - 2 * MX - 1.2, 1.9, { dash: 'dash', line: C.green });
  text(s, '대한민국 헌법 제10조\n“모든 국민은 인간으로서의 존엄과 가치를 가지며, 행복을 추구할 권리를 가진다. 국가는 개인이 가지는 불가침의 기본적 인권을 확인하고 이를 보장할 의무를 진다.”', MX + 0.8, 3.4, W - 2 * MX - 1.6, 1.8, { size: 19, ls: 1.3, valign: 'middle' });
  highlight(s, '잘 죽는다는 것은 잘 살았다는 것의 증명입니다.', 5.55, { size: 28, h: 0.85 });
}, '오늘의 결론 문장. 다 같이 마지막 줄을 읽는다.', { min: 2 });

add('실천', s => {
  title(s, '아름다운 마무리, 이번 주에 할 세 가지');
  const c = [['대화', '가장 믿을 수 있는 사람과\n내 가치관과 바람을 나눕니다.', '산책이나 식사 자리에서\n“첫 대화”만 열어도 충분합니다.'], ['의향서', '사전연명의료의향서\n등록기관을 확인합니다.', '보건소·국민건강보험공단 지사 등\n전화로 먼저 문의하면 수월합니다.'], ['실천', '이번 주에 할 수 있는\n작은 한 가지를 정합니다.', '오늘 쓴 감사 편지를\n전하는 것부터 시작해 보세요.']];
  c.forEach(([h, b, tip], i) => {
    const x = MX + i * 4.1;
    box(s, x, 1.6, 3.9, 0.8, { fill: C.green, line: C.green });
    text(s, h, x, 1.6, 3.9, 0.8, { font: T, size: 26, align: 'center', valign: 'middle', color: 'FFFFFF' });
    box(s, x, 2.5, 3.9, 3.2, { fill: C.sage, line: C.sage });
    text(s, b, x + 0.15, 2.6, 3.6, 1.4, { size: 21, align: 'center', valign: 'middle', ls: 1.3 });
    text(s, tip, x + 0.15, 4.1, 3.6, 1.5, { font: G, size: 15, align: 'center', valign: 'middle', color: '444444' });
  });
  text(s, '그리고 지금, 그 준비를 시작해 봅시다~!!!', MX, 5.95, W - 2 * MX, 0.7, { font: T, size: 30, align: 'center', color: C.navy });
}, '등록기관 목록은 국립연명의료관리기관 누리집에서 확인 가능 — 수업 직전 연락처 재확인.', { min: 2 });

add('정리', s => {
  title(s, '날마다 한 문장');
  box(s, MX + 1, 1.6, W - 2 * MX - 2, 1.2, { line: '999999' });
  text(s, '이제부터 실천할 아름다운 마무리 한 가지는?', MX + 1, 1.6, W - 2 * MX - 2, 1.2, { size: 28, align: 'center', valign: 'middle' });
  [['가족에게', '고맙다, 사랑한다, 미안하다를\n하루도 미루지 않습니다.'], ['나에게', '말씀과 기도 속에서\n남은 시간을 나답게 선택합니다.']].forEach(([h, b], i) => {
    const x = MX + 1 + i * 5.6;
    box(s, x, 3.2, 5.2, 2.8, { fill: C.cream, line: 'E6DCC6' });
    text(s, h, x + 0.3, 3.35, 4.6, 0.7, { font: T, size: 26, color: C.green });
    text(s, b, x + 0.3, 4.1, 4.6, 1.7, { size: 23, ls: 1.35 });
  });
}, '마지막으로 한 문장을 마음에 새긴다. 워크북 8쪽의 "한 걸음"과 같은 내용임을 확인.', { min: 1 });

add('', s => {
  s.background = { color: 'FFFFFF' };
  text(s, '“내가 선한 싸움을 싸우고 나의 달려갈 길을 마치고 믿음을 지켰으니”  — 디모데후서 4:7', 0.8, 0.9, 11.7, 0.7, { size: 20, align: 'center', color: C.gray });
  text(s, '잘 사는 법을 배운 사람은\n잘 죽는 법도 알아갑니다.', 0.8, 1.9, 11.7, 2.2, { font: T, size: 44, align: 'center', valign: 'middle', color: C.green, ls: 1.3 });
  text(s, '오늘의 삶이 가장 아름다운 준비입니다.', 0.8, 4.2, 11.7, 0.9, { font: T, size: 32, align: 'center', color: C.green });
  text(s, '감사합니다.', 0.8, 5.3, 11.7, 0.9, { font: T, size: 36, align: 'center', color: C.ink });
  text(s, '삶잇다협동조합 이미경  ·  girin0822@gmail.com', 0.8, 6.55, 11.7, 0.45, { font: G, size: 14, align: 'center', color: C.gray });
}, '마무리 인사. 디모데후서 4:7은 워크북 마지막 쪽과 같은 말씀이며, 표지의 사도행전 20:24와 수미상관을 이룬다.\n질문 받기(시간이 있다면). 워크북은 집에 가져가 가족과 함께 보도록 권한다.', { bare: true, min: 2 });

const out = path.join(__dirname, 'out', '웰다잉특강_2시간_웰다잉을위한웰빙의삶.pptx');
pres.writeFile({ fileName: out }).then(() => {
  const must = slides.filter(x => !x.opt).reduce((a, b) => a + b.min, 0);
  const opt = slides.filter(x => x.opt).reduce((a, b) => a + b.min, 0);
  console.log(`${out}\nslides: ${slides.length} | 필수 ${must}분 + 선택 ${opt}분 = ${must + opt}분 (선택 ${slides.filter(x => x.opt).length}장)`);
});
