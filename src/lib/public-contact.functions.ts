import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendEmail } from "@/lib/email.server";

const contactLeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clinic: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1000).optional(),
  website: z.string().trim().max(120).optional(),
});

export const sendContactLead = createServerFn({ method: "POST" })
  .inputValidator((input) => contactLeadSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { sent: true, ignored: true };

    const to = process.env.SALES_EMAIL || "contato@medyco.com.br";
    const subject = `Novo contato comercial - ${data.clinic}`;
    const text = [
      `Nome: ${data.name}`,
      `Clínica: ${data.clinic}`,
      `E-mail: ${data.email}`,
      `Telefone: ${data.phone || "não informado"}`,
      "",
      data.message || "Sem mensagem adicional.",
    ].join("\n");

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:24px">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:#0ea5e9;font-weight:800">Medyco</div>
          <h1 style="margin:10px 0 18px;font-size:24px;line-height:1.2">Novo contato comercial</h1>
          <p><strong>Nome:</strong> ${escapeHtml(data.name)}</p>
          <p><strong>Clínica:</strong> ${escapeHtml(data.clinic)}</p>
          <p><strong>E-mail:</strong> ${escapeHtml(data.email)}</p>
          <p><strong>Telefone:</strong> ${escapeHtml(data.phone || "não informado")}</p>
          <div style="margin-top:18px;padding-top:18px;border-top:1px solid #e2e8f0">
            <p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(data.message || "Sem mensagem adicional.")}</p>
          </div>
        </div>
      </div>
    `;

    const result = await sendEmail({ to, subject, html, text });
    if (!result.sent) {
      throw new Error(
        result.reason === "missing_resend_api_key"
          ? "Envio de e-mail ainda não configurado."
          : result.error || "Não foi possível enviar a mensagem.",
      );
    }

    return { sent: true };
  });

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
