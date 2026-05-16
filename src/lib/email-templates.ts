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

export function clinicOnboardingEmail(input: {
  tenantName: string;
  inviteUrl: string;
  expiresAt: string;
}) {
  const subject = `${input.tenantName}: seu painel Medyco foi criado`;
  const text = [
    `Sua clínica foi cadastrada na Medyco.`,
    `Acesse o link abaixo para criar sua senha e entrar no painel administrativo da clínica.`,
    `Acesse: ${input.inviteUrl}`,
    `Este convite expira em ${formatDate(input.expiresAt)}.`,
  ].join("\n\n");

  const html = baseEmail({
    eyebrow: "Boas-vindas",
    title: "Seu painel Medyco foi criado",
    body: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#475569">
        A clínica <strong>${escapeHtml(input.tenantName)}</strong> já está cadastrada na Medyco.
      </p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">
        Use o botão abaixo para criar sua senha e acessar o painel administrativo da clínica. Por lá será possível configurar a operação, cadastrar pacientes e validar cartões.
      </p>
    `,
    buttonLabel: "Acessar painel da clínica",
    buttonUrl: input.inviteUrl,
    footer: `Este convite expira em ${formatDate(input.expiresAt)}. Se o botão não funcionar, copie este link:`,
  });

  return { subject, html, text };
}

type PatientInviteEmailInput = {
  tenantName: string;
  patientName: string;
  inviteUrl: string;
  expiresAt: string;
};

export function patientInviteEmail(input: PatientInviteEmailInput) {
  const subject = `${input.tenantName}: acesse seu cartão digital de benefícios`;
  const text = [
    `Olá, ${input.patientName}.`,
    `${input.tenantName} criou seu acesso ao cartão digital de benefícios na Medyco.`,
    `Acesse: ${input.inviteUrl}`,
    `Este convite expira em ${formatDate(input.expiresAt)}.`,
  ].join("\n\n");

  const html = baseEmail({
    eyebrow: "Cartão digital",
    title: "Seu acesso está pronto",
    body: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#475569">
        Olá, <strong>${escapeHtml(input.patientName)}</strong>.
      </p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">
        <strong>${escapeHtml(input.tenantName)}</strong> criou seu acesso ao cartão digital de benefícios. Entre pelo botão abaixo para criar senha ou fazer login com o mesmo e-mail.
      </p>
    `,
    buttonLabel: "Acessar meu cartão",
    buttonUrl: input.inviteUrl,
    footer: `Este convite expira em ${formatDate(input.expiresAt)}. Se o botão não funcionar, copie este link:`,
  });

  return { subject, html, text };
}

export function termAcceptedEmail(input: {
  tenantName: string;
  patientName: string;
  version: string;
}) {
  const subject = `Termo do cartão aceito - ${input.tenantName}`;
  const text = `${input.patientName} aceitou o termo do cartão de benefícios de ${input.tenantName}, versão ${input.version}.`;
  const html = baseEmail({
    eyebrow: "Termo aceito",
    title: "Aceite registrado",
    body: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#475569">
        <strong>${escapeHtml(input.patientName)}</strong> aceitou o termo do cartão de benefícios.
      </p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">
        Clínica: <strong>${escapeHtml(input.tenantName)}</strong><br/>
        Versão: <strong>${escapeHtml(input.version)}</strong>
      </p>
    `,
  });
  return { subject, html, text };
}

export function paymentReminderEmail(input: {
  tenantName: string;
  patientName: string;
  amount: number;
  dueDate?: string | null;
  invoiceUrl?: string | null;
}) {
  const subject = `${input.tenantName}: cobrança do seu cartão de benefícios`;
  const value = formatCurrency(input.amount);
  const due = input.dueDate ? formatDate(input.dueDate) : "vencimento não informado";
  const text = [
    `Olá, ${input.patientName}.`,
    `Existe uma cobrança de ${value} referente ao seu cartão de benefícios em ${input.tenantName}.`,
    `Vencimento: ${due}.`,
    input.invoiceUrl ? `Acesse: ${input.invoiceUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const html = baseEmail({
    eyebrow: "Cobrança",
    title: "Sua cobrança está disponível",
    body: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#475569">
        Olá, <strong>${escapeHtml(input.patientName)}</strong>.
      </p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">
        Existe uma cobrança de <strong>${value}</strong> referente ao cartão de benefícios em <strong>${escapeHtml(input.tenantName)}</strong>.<br/>
        Vencimento: <strong>${due}</strong>.
      </p>
    `,
    buttonLabel: input.invoiceUrl ? "Abrir cobrança" : undefined,
    buttonUrl: input.invoiceUrl ?? undefined,
  });

  return { subject, html, text };
}

function baseEmail({
  eyebrow,
  title,
  body,
  buttonLabel,
  buttonUrl,
  footer,
}: {
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel?: string;
  buttonUrl?: string;
  footer?: string;
}) {
  return `
    <div style="margin:0;padding:0;background:#f6f8fb;font-family:Inter,Arial,sans-serif;color:#0f172a">
      <div style="max-width:560px;margin:0 auto;padding:40px 20px">
        <div style="border-radius:18px;background:#ffffff;border:1px solid #e5e7eb;padding:32px;box-shadow:0 20px 50px rgba(15,23,42,.08)">
          <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0ea5e9;font-weight:700">Medyco</div>
          <div style="margin-top:18px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:700">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:8px 0 10px;font-size:26px;line-height:1.2;color:#0f172a">${escapeHtml(title)}</h1>
          ${body}
          ${
            buttonLabel && buttonUrl
              ? `<a href="${buttonUrl}" style="display:inline-block;border-radius:10px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px">${escapeHtml(buttonLabel)}</a>`
              : ""
          }
          ${
            footer && buttonUrl
              ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b">${escapeHtml(footer)}</p><p style="word-break:break-all;margin:8px 0 0;font-size:12px;line-height:1.5;color:#64748b">${buttonUrl}</p>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
