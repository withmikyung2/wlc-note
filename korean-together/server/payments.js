import crypto from 'node:crypto';

// 통화별 소수 자릿수 (KRW 0, USD 2 …). DB에는 최소 단위 정수로 저장함.
export function currencyDigits(currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}
export const toMajor = (minor, currency) => minor / 10 ** currencyDigits(currency);
export const toMinor = (major, currency) => Math.round(Number(major) * 10 ** currencyDigits(currency));
export const formatMoney = (minor, currency) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(toMajor(minor, currency));

/**
 * 결제서비스 공통 인터페이스
 *  - live: 실제 돈이 오가는 결제인지 (테스트·링크 확인 대기와 구분해 화면에 표시)
 *  - configured: 운영 키 등 필수 설정 완료 여부
 *  - checkout(order): 브라우저가 결제창을 열기 위한 공개 정보만 반환 (비밀 키 절대 포함 금지)
 *  - confirm(): 서버에서 결제사에 승인 요청 + 금액 검증
 *  - fetch(): 결제사에 직접 조회 (웹훅 본문을 믿지 않고 재확인)
 *  - cancel(): 전체/부분 취소
 */

function testProvider(db) {
  return {
    name: 'test',
    live: false,
    configured: true,
    supportsApiRefund: true,
    checkout(order, ctx) {
      // 테스트 결제사가 '결제 요청 금액'을 기억하게 함 (실제 결제사가 SDK 요청 금액을 기록하는 것과 동일)
      db.prepare(`INSERT INTO test_gateway_payments(payment_key, provider_order_id, amount, currency, status)
                  VALUES (?, ?, ?, ?, 'READY')`)
        .run('tpk_' + crypto.randomBytes(12).toString('hex'), order.provider_order_id, order.amount, order.currency);
      return {
        type: 'test',
        orderId: order.provider_order_id,
        amount: order.amount,
        currency: order.currency,
        orderName: ctx.orderName,
        checkoutUrl: `#/pay/test?orderId=${encodeURIComponent(order.provider_order_id)}`
      };
    },
    async confirm({ paymentKey, orderId, amount }) {
      const p = db.prepare('SELECT * FROM test_gateway_payments WHERE payment_key = ?').get(paymentKey);
      if (!p || p.provider_order_id !== orderId) return { ok: false, code: 'NOT_FOUND_PAYMENT' };
      if (p.amount !== amount) return { ok: false, code: 'AMOUNT_MISMATCH' };
      if (p.status === 'DONE') return { ok: true, paymentKey, amount: p.amount, currency: p.currency, status: 'DONE' };
      if (p.status !== 'AUTHORIZED') return { ok: false, code: 'NOT_AUTHORIZED' };
      db.prepare("UPDATE test_gateway_payments SET status = 'DONE' WHERE payment_key = ?").run(paymentKey);
      return { ok: true, paymentKey, amount: p.amount, currency: p.currency, status: 'DONE' };
    },
    async fetch(paymentKey) {
      const p = db.prepare('SELECT * FROM test_gateway_payments WHERE payment_key = ?').get(paymentKey);
      if (!p) return null;
      return { paymentKey, orderId: p.provider_order_id, amount: p.amount, currency: p.currency, status: p.status, cancelledAmount: p.cancelled_amount };
    },
    async cancel(paymentKey, amount) {
      const p = db.prepare('SELECT * FROM test_gateway_payments WHERE payment_key = ?').get(paymentKey);
      if (!p || !['DONE', 'PARTIAL_CANCELED'].includes(p.status)) return { ok: false, code: 'NOT_CANCELABLE' };
      if (p.cancelled_amount + amount > p.amount) return { ok: false, code: 'EXCEED_CANCEL_AMOUNT' };
      const total = p.cancelled_amount + amount;
      db.prepare('UPDATE test_gateway_payments SET cancelled_amount = ?, status = ? WHERE payment_key = ?')
        .run(total, total === p.amount ? 'CANCELED' : 'PARTIAL_CANCELED', paymentKey);
      return { ok: true, cancelledAmount: total };
    },
    // 테스트 결제창의 '성공/실패' 버튼 — 실제 카드 정보는 받지 않음
    authorize(orderId, outcome) {
      const p = db.prepare("SELECT * FROM test_gateway_payments WHERE provider_order_id = ? AND status = 'READY' ORDER BY rowid DESC").get(orderId);
      if (!p) return null;
      if (outcome !== 'success') {
        db.prepare("UPDATE test_gateway_payments SET status = 'ABORTED' WHERE payment_key = ?").run(p.payment_key);
        return { ok: false, code: outcome === 'cancel' ? 'PAY_PROCESS_CANCELED' : 'REJECT_CARD_PAYMENT', orderId };
      }
      db.prepare("UPDATE test_gateway_payments SET status = 'AUTHORIZED' WHERE payment_key = ?").run(p.payment_key);
      return { ok: true, paymentKey: p.payment_key, orderId, amount: p.amount };
    }
  };
}

// 토스페이먼츠 결제위젯/결제창 v2 연동 (https://docs.tosspayments.com)
function tossProvider(config) {
  const auth = 'Basic ' + Buffer.from(`${config.tossSecretKey}:`).toString('base64');
  const api = async (method, path, body) => {
    const res = await fetch(`https://api.tosspayments.com${path}`, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };
  const normalize = (d, currency) => ({
    paymentKey: d.paymentKey,
    orderId: d.orderId,
    amount: Math.round(Number(d.totalAmount) * 10 ** currencyDigits(d.currency || currency)),
    currency: d.currency || currency,
    status: d.status,
    cancelledAmount: Math.round((Number(d.totalAmount) - Number(d.balanceAmount ?? d.totalAmount)) * 10 ** currencyDigits(d.currency || currency))
  });
  return {
    name: 'toss',
    live: !String(config.tossClientKey).startsWith('test_'),
    configured: !!(config.tossClientKey && config.tossSecretKey),
    supportsApiRefund: true,
    checkout(order, ctx) {
      return {
        type: 'toss',
        clientKey: config.tossClientKey,
        customerKey: ctx.customerKey,
        orderId: order.provider_order_id,
        amount: toMajor(order.amount, order.currency),
        currency: order.currency,
        orderName: ctx.orderName,
        customerEmail: ctx.email,
        successUrl: `${config.publicBaseUrl}/?kt=success`,
        failUrl: `${config.publicBaseUrl}/?kt=fail`
      };
    },
    async confirm({ paymentKey, orderId, amount, currency }) {
      const r = await api('POST', '/v1/payments/confirm', { paymentKey, orderId, amount: toMajor(amount, currency) });
      if (!r.ok) {
        // 이미 승인된 결제(중복 요청)는 조회로 확인
        if (r.data.code === 'ALREADY_PROCESSED_PAYMENT') {
          const again = await api('GET', `/v1/payments/${encodeURIComponent(paymentKey)}`);
          if (again.ok) return { ok: true, ...normalize(again.data, currency) };
        }
        return { ok: false, code: r.data.code || 'CONFIRM_FAILED', message: r.data.message };
      }
      return { ok: true, ...normalize(r.data, currency) };
    },
    async fetch(paymentKey, currency = 'KRW') {
      const r = await api('GET', `/v1/payments/${encodeURIComponent(paymentKey)}`);
      return r.ok ? normalize(r.data, currency) : null;
    },
    async cancel(paymentKey, amount, reason, currency = 'KRW') {
      const r = await api('POST', `/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
        cancelReason: reason || '수강 취소', cancelAmount: toMajor(amount, currency)
      });
      if (!r.ok) return { ok: false, code: r.data.code, message: r.data.message };
      return { ok: true, cancelledAmount: normalize(r.data, currency).cancelledAmount };
    }
  };
}

// 엑심베이: 계약 후 제공되는 연동 문서(가맹점 ID, API 키, 서명 방식)에 맞춰 구현해야 함.
// 문서 확인 전에 추측으로 결제 요청을 만들지 않도록, 설정이 있어도 '구현 대기' 상태로 남김.
function eximbayProvider(config) {
  const pending = async () => ({ ok: false, code: 'EXIMBAY_NOT_IMPLEMENTED', message: '엑심베이 연동 문서 확인 후 구현 필요' });
  return {
    name: 'eximbay',
    live: false,
    configured: false,
    implemented: false,
    hasKeys: !!(config.eximbayMid && config.eximbayApiKey),
    supportsApiRefund: false,
    checkout() { return { type: 'unavailable', reason: 'eximbay_not_implemented' }; },
    confirm: pending,
    fetch: async () => null,
    cancel: pending
  };
}

// 초기 운영 A안: 관리자가 등록한 과정별 결제 링크로 이동 → 관리자가 결제내역 확인 후 수강 등록
function linkProvider() {
  return {
    name: 'link',
    live: true,
    configured: true,
    supportsApiRefund: false,
    checkout(order, ctx) {
      if (!ctx.paymentLinkUrl) return { type: 'unavailable', reason: 'no_payment_link' };
      const url = new URL(ctx.paymentLinkUrl);
      // 결제 링크 서비스가 참조값 파라미터를 지원하면 주문번호가 함께 전달됨. 지원하지 않아도 화면에 주문번호를 안내함.
      url.searchParams.set('orderNo', order.order_no);
      return { type: 'link', url: url.toString(), orderNo: order.order_no, amount: order.amount, currency: order.currency };
    },
    confirm: async () => ({ ok: false, code: 'MANUAL_CONFIRMATION_REQUIRED' }),
    fetch: async () => null,
    cancel: async () => ({ ok: false, code: 'MANUAL_REFUND_REQUIRED' })
  };
}

export function createPayments(db, config) {
  const providers = {
    test: testProvider(db),
    toss: tossProvider(config),
    eximbay: eximbayProvider(config),
    link: linkProvider()
  };
  return {
    providers,
    get(name) { return providers[name]; },
    active() { return providers[config.paymentMode] || providers.test; }
  };
}
