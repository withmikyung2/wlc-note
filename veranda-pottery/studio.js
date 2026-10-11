/* Studio tool: register pieces, move them through stages, export data, print pickup cards. */

const DRAFT_KEY = 'veranda-studio-draft';
const $ = sel => document.querySelector(sel);
const form = $('#pieceForm');
let pieces = [];
let editingCode = null;

const stageName = s => (STAGES[s] ? STAGES[s].ko[0] + ' · ' + STAGES[s].en[0] : s);
const isoLocal = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
const today = () => isoLocal(new Date());

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return isoLocal(d);
}

function newCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
  let code;
  do {
    let tail = '';
    const rnd = crypto.getRandomValues(new Uint32Array(4));
    rnd.forEach(n => { tail += chars[n % chars.length]; });
    code = `VP-${yymm}-${tail}`;
  } while (pieces.some(p => p.code === code));
  return code;
}

/* ---------- Storage ---------- */
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(pieces)); } catch (e) { /* storage unavailable */ }
}

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
}

async function loadPublic() {
  try {
    pieces = (await loadPieces()).filter(p => !p.demo);
  } catch (e) {
    pieces = [];
    $('#sourceNote').textContent = '공개 데이터를 불러오지 못했습니다. 새로 등록하거나 JSON 파일을 불러오세요.';
  }
}

/* ---------- Form ---------- */
function fillClassOptions() {
  form.class.replaceChildren(...Object.entries(CLASS_TYPES).map(([key, v]) => new Option(v.label.ko + ' · ' + v.label.en, key)));
}

function fillStageOptions(selected) {
  const route = CLASS_TYPES[form.class.value].stages;
  form.stage.replaceChildren(...route.map(s => new Option(stageName(s), s)));
  form.stage.value = route.includes(selected) ? selected : route[0];
}

function resetForm() {
  editingCode = null;
  form.reset();
  form.code.value = newCode();
  form.code.readOnly = false;
  form.class.value = 'traditional';
  fillStageOptions('made');
  form.date.value = today();
  $('#formTitle').textContent = '새 작품 등록';
}

function editPiece(code) {
  const p = pieces.find(x => x.code === code);
  if (!p) return;
  editingCode = code;
  const last = (p.history || []).find(h => h.stage === p.stage) || {};
  form.code.value = p.code;
  form.code.readOnly = true;
  form.maker.value = p.maker || '';
  form.title.value = p.title || '';
  form.class.value = CLASS_TYPES[p.class] ? p.class : 'traditional';
  fillStageOptions(p.stage);
  form.date.value = last.date || today();
  form.pickupEstimate.value = p.pickupEstimate || '';
  form.note.value = last.note || '';
  form.photo.value = last.photo || '';
  $('#formTitle').textContent = '수정: ' + p.code;
  $('#editor').scrollIntoView({ behavior: 'smooth' });
}

function upsertHistory(p, stage, date, note, photo) {
  p.history = p.history || [];
  const route = routeFor(p);
  // Keep only stages up to the chosen one, so moving a piece back removes later steps.
  const limit = route.indexOf(stage);
  p.history = p.history.filter(h => route.indexOf(h.stage) <= limit);
  let entry = p.history.find(h => h.stage === stage);
  if (!entry) { entry = { stage }; p.history.push(entry); }
  entry.date = date;
  if (note) entry.note = note; else delete entry.note;
  if (photo) entry.photo = photo; else delete entry.photo;
  p.history.sort((a, b) => route.indexOf(a.stage) - route.indexOf(b.stage));
  p.stage = stage;
}

form.class.addEventListener('change', () => fillStageOptions(form.stage.value));

form.addEventListener('submit', e => {
  e.preventDefault();
  const code = normalizeCode(form.code.value);
  if (!editingCode && pieces.some(p => p.code === code)) {
    alert('이미 있는 작품 번호입니다. This code already exists.');
    return;
  }
  let p = pieces.find(x => x.code === (editingCode || code));
  if (!p) { p = { code, history: [] }; pieces.unshift(p); }
  p.maker = form.maker.value.trim();
  p.title = form.title.value.trim();
  p.class = form.class.value;
  upsertHistory(p, form.stage.value, form.date.value, form.note.value.trim(), form.photo.value.trim());
  const made = (p.history.find(h => h.stage === 'made') || {}).date || form.date.value;
  p.pickupEstimate = form.pickupEstimate.value || addDays(made, CLASS_TYPES[p.class].weeks * 7);
  saveDraft();
  renderRows();
  const isNew = !editingCode;
  resetForm();
  if (isNew) showCard(code);
});

$('#resetBtn').addEventListener('click', resetForm);

/* ---------- Table ---------- */
function renderRows() {
  const q = $('#filter').value.trim().toLowerCase();
  const list = pieces.filter(p => !q || [p.code, p.maker, p.title].join(' ').toLowerCase().includes(q));
  $('#count').textContent = `(${pieces.length})`;
  $('#rows').replaceChildren(...list.map(p => {
    const route = routeFor(p);
    const next = route[route.indexOf(p.stage) + 1];
    const last = (p.history || []).slice(-1)[0] || {};
    const tr = document.createElement('tr');
    const cells = [p.code, p.maker || '', p.title || '', CLASS_TYPES[p.class] ? CLASS_TYPES[p.class].label.ko : p.class, stageName(p.stage), last.date || ''];
    cells.forEach((v, i) => { const td = tr.insertCell(); td.textContent = v; if (i === 0) td.className = 'code'; });
    const actions = tr.insertCell();
    const box = document.createElement('div');
    box.className = 'row-actions';
    if (next) box.append(button('다음 단계 ▶', 'btn btn-dark', () => advance(p.code)));
    box.append(button('수정', 'btn btn-line', () => editPiece(p.code)));
    box.append(button('수령 카드', 'btn btn-line', () => showCard(p.code)));
    box.append(button('삭제', 'btn btn-line', () => removePiece(p.code)));
    actions.append(box);
    return tr;
  }));
}

function button(label, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = cls; b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function advance(code) {
  const p = pieces.find(x => x.code === code);
  const route = routeFor(p);
  const next = route[route.indexOf(p.stage) + 1];
  if (!next) return;
  upsertHistory(p, next, today(), '', '');
  saveDraft();
  renderRows();
}

function removePiece(code) {
  if (!confirm(code + ' 작품을 목록에서 삭제할까요?')) return;
  pieces = pieces.filter(p => p.code !== code);
  saveDraft();
  renderRows();
}

$('#filter').addEventListener('input', renderRows);

/* ---------- Pickup card ---------- */
function trackUrl(code) {
  const url = new URL('index.html', location.href);
  url.search = '?piece=' + encodeURIComponent(code);
  url.hash = 'track';
  return url.toString();
}

function showCard(code) {
  const p = pieces.find(x => x.code === code);
  if (!p) return;
  const url = trackUrl(code);
  $('#cardCode').textContent = code;
  $('#cardClass').textContent = CLASS_TYPES[p.class].label.en + ' · ' + CLASS_TYPES[p.class].label.ko;
  $('#cardReady').textContent = p.pickupEstimate ? 'Ready around · 완성 예정 ' + p.pickupEstimate : '';
  $('#cardUrl').textContent = url;
  const box = $('#qrBox');
  box.replaceChildren();
  if (typeof qrcode === 'function') {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  $('#cardDialog').showModal();
}

/* ---------- Export / import ---------- */
$('#downloadBtn').addEventListener('click', () => {
  const data = {
    updated: today(),
    about: 'Piece tracking data. Do not store full names or phone numbers here: this file is public. Use the studio tool (studio.html) to edit.',
    pieces
  };
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pieces.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#csvBtn').addEventListener('click', async () => {
  const esc = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const rows = [['code', 'maker', 'title', 'class', 'stage', 'made', 'pickup', 'note', 'photo', 'history']];
  pieces.forEach(p => {
    const h = p.history || [];
    const made = (h.find(x => x.stage === 'made') || {}).date || '';
    const last = h.slice(-1)[0] || {};
    const later = h.filter(x => x.stage !== 'made').map(x => x.stage + ':' + (x.date || '')).join('|');
    rows.push([p.code, p.maker || '', p.title || '', p.class, p.stage, made, p.pickupEstimate || '', last.note || '', last.photo || '', later]);
  });
  const csv = rows.map(r => r.map(v => esc(String(v))).join(',')).join('\n');
  try { await navigator.clipboard.writeText(csv); alert('CSV를 복사했습니다. Google 시트 A1 칸에 붙여넣으세요.'); }
  catch (e) { window.prompt('CSV', csv); }
});

$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    pieces = (data.pieces || []).filter(p => !p.demo);
    saveDraft();
    renderRows();
  } catch (err) {
    alert('JSON 파일을 읽지 못했습니다.');
  }
  e.target.value = '';
});

$('#reloadBtn').addEventListener('click', async () => {
  if (!confirm('이 기기에 임시 저장된 변경 내용을 버리고 공개 데이터를 다시 불러올까요?')) return;
  await loadPublic();
  saveDraft();
  renderRows();
});

/* ---------- Start ---------- */
(async function start() {
  fillClassOptions();
  const draft = readDraft();
  if (Array.isArray(draft)) pieces = draft;
  else await loadPublic();
  resetForm();
  renderRows();
  if (VERANDA.sheetCsvUrl) {
    $('#sourceNote').textContent = '홈페이지는 Google 시트를 데이터로 사용 중입니다. 시트에서 직접 수정하거나, 이 화면에서 만든 CSV를 시트에 붙여넣으세요.';
  }
})();
