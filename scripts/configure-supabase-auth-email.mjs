#!/usr/bin/env node

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || process.env.PROJECT_REF || "bpupkgstumvgbxhdhlrx";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
const SMTP_HOST = process.env.SMTP_HOST || "smtp.resend.com";
const SMTP_PORT = process.env.SMTP_PORT || "465";
const SMTP_USER = process.env.SMTP_USER || "resend";
const FROM_EMAIL = process.env.SMTP_ADMIN_EMAIL || "no-reply@medyco.com.br";
const FROM_NAME = process.env.SMTP_SENDER_NAME || "Medyco";
const SITE_URL = process.env.APP_BASE_URL || "https://medyco.com.br";
const DRY_RUN = process.argv.includes("--dry-run");

const payload = {
  site_url: SITE_URL,
  external_email_enabled: true,
  mailer_secure_email_change_enabled: true,
  mailer_autoconfirm: false,
  smtp_admin_email: FROM_EMAIL,
  smtp_host: SMTP_HOST,
  smtp_port: SMTP_PORT,
  smtp_user: SMTP_USER,
  smtp_pass: RESEND_API_KEY || "__RESEND_API_KEY__",
  smtp_sender_name: FROM_NAME,
  mailer_subjects_confirmation: "Confirme seu e-mail na Medyco",
  mailer_subjects_recovery: "Redefina sua senha da Medyco",
  mailer_subjects_invite: "Você recebeu um convite para a Medyco",
  mailer_subjects_magic_link: "Seu link de acesso à Medyco",
  mailer_subjects_email_change: "Confirme a alteração de e-mail",
  mailer_subjects_reauthentication: "Confirme sua identidade",
  mailer_templates_confirmation_content: authEmailTemplate({
    eyebrow: "Confirmação de conta",
    title: "Confirme seu e-mail",
    intro:
      "Recebemos uma solicitação para criar uma conta na Medyco. Confirme seu e-mail para finalizar o acesso com segurança.",
    buttonLabel: "Confirmar e-mail",
    buttonUrl: "{{ .ConfirmationURL }}",
    footer:
      "Se você não solicitou este acesso, ignore esta mensagem. O link expira automaticamente.",
  }),
  mailer_templates_recovery_content: authEmailTemplate({
    eyebrow: "Recuperação de senha",
    title: "Redefina sua senha",
    intro:
      "Use o botão abaixo para criar uma nova senha de acesso à Medyco. Por segurança, este link expira automaticamente.",
    buttonLabel: "Redefinir senha",
    buttonUrl: "{{ .ConfirmationURL }}",
    footer: "Se você não pediu a recuperação de senha, ignore esta mensagem.",
  }),
  mailer_templates_invite_content: authEmailTemplate({
    eyebrow: "Convite",
    title: "Você recebeu um convite",
    intro:
      "Você foi convidado para acessar a Medyco. Use o botão abaixo para aceitar o convite e configurar seu acesso.",
    buttonLabel: "Aceitar convite",
    buttonUrl: "{{ .ConfirmationURL }}",
    footer: "Se o botão não funcionar, copie e cole o link no navegador.",
  }),
  mailer_templates_magic_link_content: authEmailTemplate({
    eyebrow: "Acesso seguro",
    title: "Seu link de acesso",
    intro:
      "Use o botão abaixo para entrar na Medyco com segurança. Este link só deve ser usado por você.",
    buttonLabel: "Entrar na Medyco",
    buttonUrl: "{{ .ConfirmationURL }}",
    footer: "Se você não solicitou este link, ignore esta mensagem.",
  }),
  mailer_templates_email_change_content: authEmailTemplate({
    eyebrow: "Alteração de e-mail",
    title: "Confirme seu novo e-mail",
    intro:
      "Recebemos uma solicitação para alterar o e-mail da sua conta. Confirme para concluir a mudança.",
    buttonLabel: "Confirmar alteração",
    buttonUrl: "{{ .ConfirmationURL }}",
    footer: "Se você não solicitou esta mudança, ignore esta mensagem.",
  }),
  mailer_templates_reauthentication_content: authCodeTemplate({
    eyebrow: "Verificação",
    title: "Confirme sua identidade",
    intro: "Use o código abaixo para confirmar que é você tentando continuar.",
    code: "{{ .Token }}",
  }),
};

if (DRY_RUN) {
  const printable = { ...payload, smtp_pass: payload.smtp_pass ? "***" : undefined };
  console.log(JSON.stringify(printable, null, 2));
  process.exit(0);
}

if (!ACCESS_TOKEN) {
  throw new Error(
    "Defina SUPABASE_ACCESS_TOKEN com um token pessoal do Supabase antes de rodar este script.",
  );
}

if (!RESEND_API_KEY) {
  throw new Error(
    "Defina RESEND_API_KEY com a chave SMTP/API do Resend antes de rodar este script.",
  );
}

const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const responseText = await response.text();
if (!response.ok) {
  throw new Error(`Supabase respondeu HTTP ${response.status}: ${responseText}`);
}

console.log(`Supabase Auth SMTP e templates atualizados para o projeto ${PROJECT_REF}.`);

function authEmailTemplate({ eyebrow, title, intro, buttonLabel, buttonUrl, footer }) {
  return `
<div style="margin:0;padding:0;background:#eef6f9;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="overflow:hidden;border-radius:24px;background:#ffffff;border:1px solid #dbe7ee;box-shadow:0 24px 70px rgba(15,23,42,.10)">
      <div style="background:linear-gradient(135deg,#042f3a,#0ea5e9 55%,#14b8a6);padding:28px 32px;color:#ffffff">
        <div style="display:inline-block;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);padding:7px 12px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Medyco</div>
        <div style="margin-top:18px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.78);font-weight:800">${eyebrow}</div>
        <h1 style="margin:8px 0 0;font-size:30px;line-height:1.12;color:#ffffff">${title}</h1>
      </div>
      <div style="padding:30px 32px 32px">
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569">${intro}</p>
        <a href="${buttonUrl}" style="display:inline-block;border-radius:12px;background:#042f3a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;padding:13px 18px">${buttonLabel}</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b">${footer}</p>
        <p style="word-break:break-all;margin:8px 0 0;font-size:12px;line-height:1.5;color:#64748b">${buttonUrl}</p>
        <div style="margin-top:28px;border-top:1px solid #e5edf2;padding-top:16px;font-size:12px;line-height:1.5;color:#94a3b8">Medyco envia mensagens operacionais sobre acesso, seguranca e uso da plataforma.</div>
      </div>
    </div>
  </div>
</div>`.trim();
}

function authCodeTemplate({ eyebrow, title, intro, code }) {
  return `
<div style="margin:0;padding:0;background:#f6f8fb;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">
    <div style="border-radius:18px;background:#ffffff;border:1px solid #e5e7eb;padding:32px;box-shadow:0 20px 50px rgba(15,23,42,.08)">
      <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0ea5e9;font-weight:700">Medyco</div>
      <div style="margin-top:18px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;font-weight:700">${eyebrow}</div>
      <h1 style="margin:8px 0 10px;font-size:26px;line-height:1.2;color:#0f172a">${title}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569">${intro}</p>
      <div style="display:inline-block;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#0f172a;font-size:28px;letter-spacing:.2em;font-weight:800;padding:14px 18px">${code}</div>
    </div>
  </div>
</div>`.trim();
}
