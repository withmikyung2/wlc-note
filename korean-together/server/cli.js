// 관리자 계정 생성: ADMIN_PASSWORD=... npm run create-admin -- admin@example.com
import { openDb } from './db.js';
import { loadConfig } from './app.js';
import { hashPassword } from './auth.js';
import { seed } from './seed.js';

const [cmd, email] = process.argv.slice(2);
if (cmd !== 'create-admin' || !email) {
  console.error('사용법: ADMIN_PASSWORD=<10자 이상> npm run create-admin -- <email>');
  process.exit(1);
}
const password = process.env.ADMIN_PASSWORD || '';
if (password.length < 10) {
  console.error('ADMIN_PASSWORD 환경변수에 10자 이상의 비밀번호를 지정하세요.');
  process.exit(1);
}
const db = openDb(loadConfig().databasePath);
seed(db);
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (existing) {
  db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?").run(hashPassword(password), existing.id);
  console.log(`기존 계정을 관리자로 변경했습니다: ${email}`);
} else {
  db.prepare("INSERT INTO users(email, password_hash, role) VALUES (?, ?, 'admin')").run(email.toLowerCase(), hashPassword(password));
  console.log(`관리자 계정을 만들었습니다: ${email}`);
}
console.log('관리자 화면: /admin — 첫 로그인 후 2단계 인증(OTP) 설정을 권장합니다.');
