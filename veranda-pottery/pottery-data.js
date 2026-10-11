/* Shared settings and piece-tracking logic for index.html and studio.html */

const VERANDA = {
  facebookId: '61567102842587',
  facebookPage: 'https://www.facebook.com/profile.php?id=61567102842587',
  // Optional: paste a Google Sheet "Publish to web → CSV" link here so staff can
  // update pieces from a phone. Leave empty to use data/pieces.json.
  sheetCsvUrl: '',
  piecesJson: 'data/pieces.json'
};

/* Each class type follows its own route through the studio. */
const CLASS_TYPES = {
  traditional: {
    label: { en: 'Traditional Cambodian Pottery', ko: '캄보디아 전통 도예' },
    stages: ['made', 'drying', 'firing', 'ready', 'collected'],
    weeks: 4
  },
  watersafe: {
    label: { en: 'Water-safe Ceramic', ko: '물을 담을 수 있는 도자기' },
    stages: ['made', 'drying', 'bisque', 'glazing', 'glaze_firing', 'ready', 'collected'],
    weeks: 4
  },
  painting: {
    label: { en: 'Painting on Pottery & Plant', ko: '도자기 페인팅 & 식물 심기' },
    stages: ['made', 'collected'],
    weeks: 0
  }
};

const STAGES = {
  made:         { en: ['Shaped by you', 'Your piece was formed by hand in class.'],
                  ko: ['직접 빚은 날', '수업에서 손으로 작품을 빚었습니다.'] },
  drying:       { en: ['Slow drying', 'Air-drying in the shade so it will not crack in the fire.'],
                  ko: ['천천히 말리기', '불에 들어가도 갈라지지 않도록 그늘에서 천천히 말립니다.'] },
  firing:       { en: ['Traditional firing', 'Fired using a traditional Cambodian method.'],
                  ko: ['전통 방식 소성', '캄보디아 전통 방식으로 굽습니다.'] },
  bisque:       { en: ['First firing', 'Bisque firing hardens the clay.'],
                  ko: ['초벌 굽기', '첫 번째 굽기로 흙을 단단하게 만듭니다.'] },
  glazing:      { en: ['Glazing', 'Glaze is applied so the piece can hold water.'],
                  ko: ['유약 바르기', '물을 담을 수 있도록 유약을 입힙니다.'] },
  glaze_firing: { en: ['Second firing', 'The glaze is fired and sealed.'],
                  ko: ['재벌 굽기', '두 번째 굽기로 유약을 단단히 입힙니다.'] },
  ready:        { en: ['Ready for pickup', 'Your piece is waiting for you at the studio.'],
                  ko: ['찾아가세요', '작품이 공방에서 기다리고 있습니다.'] },
  collected:    { en: ['Taken home', 'The journey is complete. Enjoy using it!'],
                  ko: ['집으로', '여정이 끝났습니다. 즐겁게 사용하세요!'] }
};

/* Order shown on the homepage journey strip. */
const JOURNEY = ['made', 'drying', 'bisque', 'glazing', 'glaze_firing', 'ready'];

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function routeFor(piece) {
  const type = CLASS_TYPES[piece.class] || CLASS_TYPES.traditional;
  return type.stages;
}

/* Minimal CSV parser (handles quoted fields and commas inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

/*
 * Sheet columns: code, maker, title, class, stage, made, pickup, note, photo, history
 * history = "drying:2026-09-22|firing:2026-10-05" (stage:date pairs)
 */
function piecesFromCsv(text) {
  const [head, ...rows] = parseCsv(text);
  const keys = head.map(h => h.trim().toLowerCase());
  return rows.map(r => {
    const o = {};
    keys.forEach((k, i) => { o[k] = (r[i] || '').trim(); });
    const history = [{ stage: 'made', date: o.made }];
    (o.history || '').split('|').filter(Boolean).forEach(pair => {
      const [stage, date] = pair.split(':').map(s => s.trim());
      if (STAGES[stage]) history.push({ stage, date });
    });
    if (o.photo) history[history.length - 1].photo = o.photo;
    if (o.note) history[history.length - 1].note = o.note;
    return {
      code: normalizeCode(o.code), maker: o.maker, title: o.title,
      class: o.class || 'traditional', stage: o.stage || 'made',
      pickupEstimate: o.pickup, history
    };
  });
}

async function loadPieces() {
  if (VERANDA.sheetCsvUrl) {
    const res = await fetch(VERANDA.sheetCsvUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('sheet ' + res.status);
    return piecesFromCsv(await res.text());
  }
  const res = await fetch(VERANDA.piecesJson, { cache: 'no-store' });
  if (!res.ok) throw new Error('json ' + res.status);
  const data = await res.json();
  return data.pieces || [];
}
