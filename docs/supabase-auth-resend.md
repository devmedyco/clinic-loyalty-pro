# Supabase Auth com Resend

Os e-mails enviados pelo código da Medyco usam `RESEND_API_KEY` no ambiente do Lovable.
Os e-mails nativos do Supabase Auth, como confirmação de conta e recuperação de senha, usam a configuração SMTP do próprio Supabase.

## Aplicar por script

Crie um token pessoal em:

`https://supabase.com/dashboard/account/tokens`

Depois rode localmente, sem commitar as chaves:

```bash
export SUPABASE_ACCESS_TOKEN="seu-token-pessoal-do-supabase"
export RESEND_API_KEY="sua-chave-do-resend"
export SUPABASE_PROJECT_REF="bpupkgstumvgbxhdhlrx"
node scripts/configure-supabase-auth-email.mjs
```

Para conferir o payload sem chamar a API:

```bash
node scripts/configure-supabase-auth-email.mjs --dry-run
```

## Dados SMTP

- Host: `smtp.resend.com`
- Port: `465`
- User: `resend`
- Password: chave do Resend
- From email: `no-reply@medyco.com.br`
- Sender name: `Medyco`

## O que o script configura

- SMTP externo do Supabase Auth via Resend.
- Confirmação de conta com template Medyco.
- Recuperação de senha com template Medyco.
- Convite, magic link, troca de e-mail e reautenticação com templates Medyco.
- `mailer_autoconfirm=false`, mantendo confirmação de e-mail ativa.

## Referências

- Supabase Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Resend SMTP: https://resend.com/docs/send-with-smtp
