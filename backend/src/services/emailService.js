const nodemailer = require('nodemailer');

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

async function sendInviteEmail({ to, name, inviteUrl }) {
  const transport = createTransport();
  const fromName = 'SM Torneio';
  const fromEmail = process.env.SMTP_FROM || 'noreply@sm-ttc.com.br';

  if (!transport) {
    // Sem SMTP configurado: loga o link no console (útil em dev)
    console.log(`\n[INVITE] Para: ${to}\nLink: ${inviteUrl}\n`);
    return;
  }

  await transport.sendMail({
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
      </div>
    `,
  });
}

module.exports = { sendInviteEmail };
