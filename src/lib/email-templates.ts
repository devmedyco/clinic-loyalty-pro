type StaffInviteEmailInput = {
  tenantName: string;
  roleLabel: string;
  inviteUrl: string;
  expiresAt: string;
};

export function staffInviteEmail(input: StaffInviteEmailInput) {
  const subject = `Convite para acessar ${input.tenantName} na Medyco`;
  const text = [
    `Você foi convidado para acessar ${input.tenantName} na Medyco como ${input.roleLabel}.`,
    `Acesse: ${input.inviteUrl}`,
    `Este convite expira em ${formatDate(input.expiresAt)}.`,
  ].join("\n\n");

  const html = `
    <div style="margin:0;padding:0;background:#f6f8fb;font-family:Inter,Arial,sans-serif;color:#0f172a">
      <div style="max-width:560px;margin:0 auto;padding:40px 20px">
        <div style="border-radius:18px;background:#ffffff;border:1px solid #e5e7eb;padding:32px;box-shadow:0 20px 50px rgba(15,23,42,.08)">
          <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0ea5e9;font-weight:700">Medyco</div>
          <h1 style="margin:18px 0 10px;font-size:26px;line-height:1.2;color:#0f172a">Você recebeu um convite</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">
            Você foi convidado para acessar <strong>${escapeHtml(input.tenantName)}</strong> na Medyco como <strong>${escapeHtml(input.roleLabel)}</strong>.
          </p>
          <a href="${input.inviteUrl}" style="display:inline-block;border-radius:10px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px">
            Aceitar convite
          </a>
          <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b">
            Este convite expira em ${formatDate(input.expiresAt)}. Se o botão não funcionar, copie este link:
          </p>
          <p style="word-break:break-all;margin:8px 0 0;font-size:12px;line-height:1.5;color:#64748b">${input.inviteUrl}</p>
        </div>
      </div>
    </div>
  `;

  return { subject, html, text };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
