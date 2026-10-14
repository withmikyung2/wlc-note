// 이메일 안내: 발송 서비스가 연결되지 않았으면 'not_configured'로 기록하고 발송된 것처럼 표시하지 않음
const TEMPLATES = {
  signup: (d) => ({
    subject: `[${d.site}] 가입을 환영합니다 / Welcome`,
    body: `${d.site}에 가입해 주셔서 감사합니다.\nThank you for joining ${d.site}.`
  }),
  password_reset: (d) => ({
    subject: `[${d.site}] 비밀번호 재설정 / Password reset`,
    body: `아래 링크에서 비밀번호를 다시 설정하세요 (1시간 유효).\nReset your password (valid for 1 hour):\n${d.link}`
  }),
  order_created: (d) => ({
    subject: `[${d.site}] 수강 신청 접수 ${d.orderNo} / Application received`,
    body: `과정 Course: ${d.course}\n주문번호 Order: ${d.orderNo}\n금액 Amount: ${d.amount}\n결제를 완료하면 수강이 확정됩니다.\nYour seat is confirmed once payment is complete.`
  }),
  payment_paid: (d) => ({
    subject: `[${d.site}] 결제 완료 · 수강 등록 ${d.orderNo} / Payment complete`,
    body: `과정 Course: ${d.course}\n금액 Amount: ${d.amount}\n'나의 학습'에서 수업 일정과 참여 링크를 확인하세요.\nSee schedule and class link in My Learning.`
  }),
  schedule_notice: (d) => ({
    subject: `[${d.site}] 수업 안내 / Class schedule`,
    body: d.text
  }),
  refund_result: (d) => ({
    subject: `[${d.site}] 취소·환불 처리 결과 ${d.orderNo} / Refund result`,
    body: `처리 상태 Status: ${d.status}\n환불 금액 Refunded: ${d.amount}\n${d.note || ''}`
  }),
  inquiry_reply: (d) => ({
    subject: `[${d.site}] 문의 답변 / Reply to your inquiry`,
    body: d.reply
  })
};

export function createMailer(config) {
  const provider = config.emailProvider;
  const configured = provider === 'resend' && config.resendApiKey && config.emailFrom;

  async function deliver(to, subject, body) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, to: [to], subject, text: body })
    });
    if (!res.ok) throw new Error(`resend ${res.status}`);
  }

  return {
    configured: !!configured,
    providerName: provider,
    async send(db, to, template, data) {
      const { subject, body } = TEMPLATES[template](data);
      let status = 'not_configured';
      let error = null;
      if (configured) {
        try { await deliver(to, subject, body); status = 'sent'; } catch (e) { status = 'failed'; error = e.message; }
      }
      // 재설정 링크는 관리자 화면 발송함에도 남기지 않음
      const stored = data.link ? body.replace(data.link, '[link hidden]') : body;
      db.prepare('INSERT INTO email_outbox(to_email, template, subject, body, status, error) VALUES (?, ?, ?, ?, ?, ?)')
        .run(to, template, subject, stored, status, error);
      return status;
    }
  };
}
