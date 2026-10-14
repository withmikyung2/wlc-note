import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { Router, HttpError, fail, readBody, send, serveStatic } from './http.js';
import { loadSession } from './auth.js';
import { createPayments } from './payments.js';
import { createMailer } from './email.js';
import { seed } from './seed.js';
import { registerSite } from './routes/site.js';
import { registerAdmin } from './routes/admin.js';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 8080);
  return {
    port,
    production: env.NODE_ENV === 'production',
    secureCookies: env.NODE_ENV === 'production',
    publicBaseUrl: (env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, ''),
    databasePath: env.DATABASE_PATH || './data/korean-together.db',
    adminRequireMfa: env.ADMIN_REQUIRE_MFA === 'true',
    paymentMode: env.PAYMENT_MODE || 'test',
    tossClientKey: env.TOSS_CLIENT_KEY || '',
    tossSecretKey: env.TOSS_SECRET_KEY || '',
    eximbayMid: env.EXIMBAY_MID || '',
    eximbayApiKey: env.EXIMBAY_API_KEY || '',
    seatHoldMinutes: Number(env.SEAT_HOLD_MINUTES || 15),
    emailProvider: env.EMAIL_PROVIDER || 'none',
    emailFrom: env.EMAIL_FROM || '',
    resendApiKey: env.RESEND_API_KEY || ''
  };
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://js.tosspayments.com",
  "connect-src 'self' https://*.tosspayments.com",
  "frame-src https://*.tosspayments.com",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'self' https://*.tosspayments.com",
  "frame-ancestors 'none'"
].join('; ');

export function createApp(config = loadConfig()) {
  const db = openDb(config.databasePath);
  seed(db);
  const payments = createPayments(db, config);
  const mailer = createMailer(config);
  const router = new Router();

  const ctx = {
    db, config, payments, mailer,
    requireUser(user) { if (!user) fail(401, 'login_required'); },
    // 관리자: 역할 확인 + (설정 시) 2단계 인증 통과 여부를 서버에서 검증
    requireAdmin(user) {
      if (!user) fail(401, 'login_required');
      if (user.role !== 'admin') fail(403, 'forbidden');
      if ((config.adminRequireMfa || user.totp_enabled) && !user.mfa_passed) fail(403, 'mfa_required');
    }
  };
  registerSite(router, ctx);
  registerAdmin(router, ctx);

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const url = new URL(req.url, 'http://local');
    try {
      if (url.pathname.startsWith('/api/')) {
        const isWebhook = url.pathname.startsWith('/api/payments/webhook/');
        if (req.method !== 'GET' && !isWebhook) {
          // CSRF 방지: 사이트 자체 스크립트만 붙이는 헤더 + 출처 확인
          if (req.headers['x-kt-request'] !== '1') fail(403, 'csrf_check_failed');
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host) fail(403, 'csrf_check_failed');
        }
        const match = router.match(req.method, url.pathname);
        if (!match) fail(404, 'not_found');
        const body = req.method === 'GET' ? {} : await readBody(req);
        const user = loadSession(db, req);
        const out = await match.handler(req, res, { params: match.params, query: url.searchParams, body, user });
        return send(res, 200, out ?? { ok: true });
      }
      if (req.method === 'GET' && serveStatic(res, PUBLIC_DIR, url.pathname)) return;
      send(res, 404, 'Not found');
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.code, message: err.message !== err.code ? err.message : undefined });
      console.error(err);
      send(res, 500, { error: 'server_error' });
    }
  });
  return { server, db, ctx };
}
