// 사용법: node build.js 01  → out/WLC2급_제01강_....pptx
const path = require('path');
const { build } = require('./lib');
const no = (process.argv[2] || '01').padStart(2, '0');
const L = require(`./lecture${no}.js`);
const out = path.join(__dirname, 'out', `WLC2급_제${no}강_${L.title.replace(/\s+/g, '')}.pptx`);
require('fs').mkdirSync(path.dirname(out), { recursive: true });
build(L, out).then(r => {
  console.log(out);
  console.log('slides:', L.slides.length, '| total min:', r.total, '| by block:', JSON.stringify(r.blocks));
  r.warn.forEach(w => console.log(w));
});
