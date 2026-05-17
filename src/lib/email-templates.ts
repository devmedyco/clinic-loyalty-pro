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

  const html = baseEmail({
    eyebrow: "Convite de equipe",
    title: "Você recebeu um convite",
    body: `
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">
        Você foi convidado para acessar <strong>${escapeHtml(input.tenantName)}</strong> na Medyco como <strong>${escapeHtml(input.roleLabel)}</strong>.
      </p>
    `,
    buttonLabel: "Aceitar convite",
    buttonUrl: input.inviteUrl,
    footer: `Este convite expira em ${formatDate(input.expiresAt)}. Se o botão não funcionar, copie este link:`,
  });

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
        <strong>${escapeHtml(input.tenantName)}</strong> criou seu acesso ao cartão digital de benefícios. Use o botão abaixo para definir sua senha com segurança.
      </p>
    `,
    buttonLabel: "Criar senha do cartão",
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
    <div style="margin:0;padding:0;background:#eef6f9;font-family:Inter,Arial,sans-serif;color:#0f172a">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px">
        <div style="overflow:hidden;border-radius:24px;background:#ffffff;border:1px solid #dbe7ee;box-shadow:0 24px 70px rgba(15,23,42,.10)">
          <div style="background:linear-gradient(135deg,#042f3a,#0ea5e9 55%,#14b8a6);padding:28px 32px;color:#ffffff">
            <div style="display:inline-block;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);padding:7px 12px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Medyco</div>
            <div style="margin-top:18px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.78);font-weight:800">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:8px 0 0;font-size:30px;line-height:1.12;color:#ffffff">${escapeHtml(title)}</h1>
          </div>
          <div style="padding:30px 32px 32px">
            ${body}
            ${
              buttonLabel && buttonUrl
                ? `<a href="${buttonUrl}" style="display:inline-block;border-radius:12px;background:#042f3a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;padding:13px 18px">${escapeHtml(buttonLabel)}</a>`
                : ""
            }
            ${
              footer && buttonUrl
                ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b">${escapeHtml(footer)}</p><p style="word-break:break-all;margin:8px 0 0;font-size:12px;line-height:1.5;color:#64748b">${buttonUrl}</p>`
                : ""
            }
            <div style="margin-top:28px;border-top:1px solid #e5edf2;padding-top:16px;font-size:12px;line-height:1.5;color:#94a3b8">
              Medyco envia apenas mensagens operacionais sobre acesso, cobrança, termos e uso do cartão de benefícios.
            </div>
          </div>
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
