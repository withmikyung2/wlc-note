// GitHub Pages 등 서버 없는 곳에 올릴 '미리보기'용 공개 데이터 생성
// 회원가입·신청·결제는 동작하지 않으며, 화면 상단에 그렇게 표시됨.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, loadConfig } from '../server/app.js';
import { publicBootstrap } from '../server/routes/site.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { ctx, db } = createApp({ ...loadConfig(), databasePath: process.env.DATABASE_PATH || ':memory:' });
const data = publicBootstrap(ctx);
data.serverConnected = false;
data.payment = { mode: 'none', live: false, configured: false };
const out = path.join(root, 'public', 'data', 'public-snapshot.json');
fs.writeFileSync(out, JSON.stringify(data, null, 2));
db.close();
console.log('written', path.relative(root, out));
