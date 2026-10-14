import { createApp, loadConfig } from './app.js';

const config = loadConfig();
const { server, ctx } = createApp(config);
server.listen(config.port, () => {
  const p = ctx.payments.active();
  console.log(`한국어로 잇다 · Korean Together — ${config.publicBaseUrl}`);
  console.log(`결제: ${p.name} (${p.configured ? '설정됨' : '미설정'}${p.live ? ', 실결제' : ', 실결제 아님'}) / 이메일: ${ctx.mailer.configured ? '연결됨' : '미연결(발송 안 됨)'}`);
});
