# Checklist Asaas para colocar a Medyco para cobrar

## Modelo escolhido

A Medyco usa:

- Mensalidade da clínica: R$ 197/mês.
- Paciente pago: R$ 2,90 fixos + 7,9% via split.
- Cobrança do paciente emitida pela conta/subconta da clínica.
- Split automático enviando a parte da Medyco para a carteira Asaas da Medyco.

## O que fazer na conta Asaas da Medyco

1. Acesse a conta Asaas principal da Medyco.
2. Vá em integrações/API e gere a API key da conta principal.
3. No Lovable, salve:
   - `ASAAS_API_KEY`: API key da conta principal Medyco.
   - `ASAAS_ENVIRONMENT`: `production` quando for cobrança real.
4. Recupere o walletId da conta Medyco pela rota `GET /v3/wallets/` usando a API key principal.
5. No Lovable, salve:
   - `ASAAS_MEDYCO_WALLET_ID`: walletId da conta Medyco.
6. Crie um token secreto para webhook, qualquer texto forte, e salve no Lovable:
   - `ASAAS_WEBHOOK_TOKEN`: token que o Asaas usará para avisar pagamentos.
7. No Asaas, configure o webhook apontando para:
   - `https://medyco.com.br/api/asaas/webhook`
8. No webhook, envie o token configurado no header esperado pelo sistema.

## Para cada clínica cliente

1. Crie uma subconta Asaas para a clínica ou vincule uma conta Asaas da clínica.
2. Guarde imediatamente:
   - `account_id` da subconta.
   - `walletId` da clínica.
   - `apiKey` da subconta.
3. No Lovable, crie um secret para a API key da clínica, por exemplo:
   - `ASAAS_TENANT_SANTAVIDA_API_KEY`
4. No painel Admin da Medyco, abra a clínica e preencha:
   - ID da conta Asaas.
   - Wallet ID da clínica.
   - Nome do secret da API key da clínica.
   - Status Asaas como ativo.
   - Split ativo marcado.

## O que nao precisa criar manualmente

- Nao precisa criar produto no Asaas.
- Nao precisa criar link de pagamento manual para cada paciente.
- A Medyco cria a cobrança do paciente via API quando a clínica manda gerar cobrança.

## Observações importantes

- O split do Asaas é exclusivo da API, não é gerenciado manualmente pelo site.
- Para split, é necessário o walletId de todas as contas envolvidas.
- A porcentagem do split é calculada sobre o valor líquido da cobrança, depois das taxas do Asaas.
- A mensalidade da clínica ainda precisa de cobrança própria: pode começar manual no Asaas e depois virar automação dentro da Medyco.
