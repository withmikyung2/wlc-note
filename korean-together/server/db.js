import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner','admin')),
  display_name TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT '',
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mfa_passed INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS instructors (
  id INTEGER PRIMARY KEY,
  name_ko TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  bio_ko TEXT NOT NULL DEFAULT '',
  bio_en TEXT NOT NULL DEFAULT '',
  qualifications TEXT NOT NULL DEFAULT '',
  career TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  sort INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  title_ko TEXT NOT NULL,
  title_en TEXT NOT NULL,
  summary_ko TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  level_ko TEXT NOT NULL DEFAULT '',
  level_en TEXT NOT NULL DEFAULT '',
  prerequisites_ko TEXT NOT NULL DEFAULT '',
  prerequisites_en TEXT NOT NULL DEFAULT '',
  goals_ko TEXT NOT NULL DEFAULT '[]',
  goals_en TEXT NOT NULL DEFAULT '[]',
  formats TEXT NOT NULL DEFAULT '[]',
  purposes TEXT NOT NULL DEFAULT '[]',
  level_min INTEGER NOT NULL DEFAULT 0,
  level_max INTEGER NOT NULL DEFAULT 4,
  session_count INTEGER,
  minutes_per_session INTEGER,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  materials_ko TEXT NOT NULL DEFAULT '',
  materials_en TEXT NOT NULL DEFAULT '',
  refund_policy_ko TEXT NOT NULL DEFAULT '',
  refund_policy_en TEXT NOT NULL DEFAULT '',
  price_amount INTEGER,
  currency TEXT NOT NULL DEFAULT 'KRW',
  payment_link_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  no INTEGER NOT NULL,
  title_ko TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  UNIQUE (course_id, no)
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  label_ko TEXT NOT NULL DEFAULT '',
  label_en TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'group' CHECK (format IN ('group','private','recorded')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  capacity INTEGER NOT NULL DEFAULT 6,
  enroll_deadline TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','draft'))
);

CREATE TABLE IF NOT EXISTS class_sessions (
  id INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  no INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  meeting_url TEXT NOT NULL DEFAULT '',
  UNIQUE (section_id, no)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  section_id INTEGER NOT NULL REFERENCES sections(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_confirmation','paid','failed','cancelled','expired','partially_refunded','refunded')),
  provider TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  provider_order_id TEXT,
  provider_payment_key TEXT,
  provider_reference TEXT,
  applicant TEXT NOT NULL DEFAULT '{}',
  consents TEXT NOT NULL DEFAULT '{}',
  refund_policy_snapshot TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL,
  hold_expires_at TEXT,
  needs_review TEXT,
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_order ON orders(provider_order_id) WHERE provider_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  order_no TEXT,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, event_key)
);

-- 테스트 결제서비스가 '결제사 쪽 기록'을 흉내 내기 위해 사용 (test 모드 전용)
CREATE TABLE IF NOT EXISTS test_gateway_payments (
  payment_key TEXT PRIMARY KEY,
  provider_order_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  cancelled_amount INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  section_id INTEGER NOT NULL REFERENCES sections(id),
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('present','late','absent','excused')),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  lesson_no INTEGER NOT NULL,
  done_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id, lesson_no)
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
  lesson_no INTEGER,
  kind TEXT NOT NULL DEFAULT 'file' CHECK (kind IN ('file','recording','link')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  rights_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_items (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_no INTEGER,
  prompt TEXT NOT NULL,
  choices TEXT NOT NULL DEFAULT '[]',
  answer INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  meaning TEXT NOT NULL DEFAULT '',
  UNIQUE (user_id, phrase)
);

CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  email TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  admin_reply TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refund_requests (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','rejected','processed','failed')),
  approved_amount INTEGER,
  revoke_access INTEGER NOT NULL DEFAULT 1,
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY,
  title_ko TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_ko TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY,
  sort INTEGER NOT NULL DEFAULT 0,
  q_ko TEXT NOT NULL DEFAULT '',
  q_en TEXT NOT NULL DEFAULT '',
  a_ko TEXT NOT NULL DEFAULT '',
  a_en TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY,
  to_email TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('not_configured','sent','failed')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  actor_user_id INTEGER,
  actor TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

// 동시 결제 통지·중복 클릭에서 좌석·주문 상태가 꼬이지 않도록 쓰기 잠금 트랜잭션 사용
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getSettings(db) {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    out[row.key] = JSON.parse(row.value);
  }
  return out;
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

export function audit(db, actor, action, target, detail = {}) {
  db.prepare('INSERT INTO audit_log(actor_user_id, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
    .run(actor?.id ?? null, actor?.email ?? 'system', action, String(target), JSON.stringify(detail));
}

export const nowIso = () => new Date().toISOString();
