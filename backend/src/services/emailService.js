/**
 * Email service via Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email)
 * Usa HTTPS porta 443 — sem SMTP, sem bloqueio de porta no Railway.
 *
 * Variáveis de ambiente necessárias:
 *   RESEND_API_KEY  — chave da API do Resend (re_xxxxxxxxxxxx)
 *   RESEND_FROM     — remetente (ex: "SM Torneio <noreply@sm-ttc.com.br>")
 */

async function sendInviteEmail({ to, name, inviteUrl }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Sem API key: loga o link no console para uso em dev
    console.log(`\n[INVITE] Sem RESEND_API_KEY configurada.\nPara: ${to}\nLink: ${inviteUrl}\n`);
    return;
  }

  const from = process.env.RESEND_FROM || 'SM Torneio <noreply@sm-ttc.com.br>';

  const body = {
    from,
    to: [to],
    subject: 'Convite para o painel administrativo — SM Torneio',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#9B2D3E">Secos &amp; Molhados — Tijuca Tênis Clube</h2>
        <p>Olá${name ? `, ${name}` : ''}!</p>
        <p>Você foi convidado para acessar o painel administrativo do SM Torneio.</p>
        <p>Clique no botão abaixo para definir sua senha e ativar o acesso.
           O link expira em <strong>72 horas</strong>.</p>
        <a href="${inviteUrl}"
           style="display:inline-block;margin:16px 0;padding:12px 24px;background:#9B2D3E;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Definir senha
        </a>
        <p style="color:#888;font-size:12px">Se você não esperava este convite, ignore este e-mail.</p>
        <p style="color:#aaa;font-size:11px;word-break:break-all">Link direto: ${inviteUrl}</p>
      </div>
    `,
  };

  // Fire-and-forget: não bloqueia a resposta HTTP
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) {
      console.error(`[email] ERRO Resend para ${to}: ${JSON.stringify(data)}`);
      console.log(`[INVITE-FALLBACK] Para: ${to}\nLink: ${inviteUrl}`);
    } else {
      console.log(`[email] Convite enviado para ${to} — id: ${data.id}`);
    }
  }).catch((err) => {
    console.error(`[email] ERRO de rede para ${to}: ${err.message}`);
    console.log(`[INVITE-FALLBACK] Para: ${to}\nLink: ${inviteUrl}`);
  });
}

module.exports = { sendInviteEmail };
