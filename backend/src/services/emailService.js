const nodemailer = require('nodemailer');

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    connectionTimeout: 8000,  // 8s para conectar
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

/**
 * Envia o email de convite de forma não-bloqueante (fire-and-forget).
 * A rota responde imediatamente; erros de envio são logados no console.
 */
async function sendInviteEmail({ to, name, inviteUrl }) {
  const transport = createTransport();
  const fromName  = 'SM Torneio';
  const fromEmail = process.env.SMTP_FROM || 'noreply@sm-ttc.com.br';

  if (!transport) {
    console.log(`\n[INVITE] Sem SMTP configurado.\nPara: ${to}\nLink: ${inviteUrl}\n`);
    return;
  }

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: 'Convite para o painel administrativo — SM Torneio',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#9B2D3E">Secos &amp; Molhados — Tijuca Tênis Clube</h2>
        <p>Olá${name ? `, ${name}` : ''}!</p>
        <p>Você foi convidado para acessar o painel administrativo do SM Torneio.</p>
        <p>Clique no botão abaixo para definir sua senha e ativar o acesso.
           O link expira em <strong>72 horas</strong>.</p>
        <a href="${inviteUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#9B2D3E;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Definir senha
        </a>
        <p style="color:#888;font-size:12px">Se você não esperava este convite, ignore este e-mail.</p>
        <p style="color:#aaa;font-size:11px;word-break:break-all">Link direto: ${inviteUrl}</p>
      </div>
    `,
  };

  // Fire-and-forget: não bloqueia a resposta HTTP
  transport.sendMail(mailOptions).then((info) => {
    console.log(`[email] Convite enviado para ${to} — messageId: ${info.messageId}`);
  }).catch((err) => {
    console.error(`[email] ERRO ao enviar para ${to}: ${err.message}`);
    // Fallback: loga o link para recuperação manual via Railway logs
    console.log(`[INVITE-FALLBACK] Para: ${to}\nLink: ${inviteUrl}`);
  });
}

module.exports = { sendInviteEmail };
