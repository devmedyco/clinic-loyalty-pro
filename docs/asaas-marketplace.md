# Modelo Asaas recomendado para a Medyco

## Recomendação

Use a Medyco como plataforma marketplace e cada clínica como subconta/carteira Asaas própria.

Nesse modelo, a cobrança do paciente deve ser emitida pela conta da clínica. A Medyco entra como recebedora do split de comissão, hoje configurado como 10% por padrão.

## Por que esse modelo é melhor

- A clínica recebe a maior parte do valor diretamente na própria operação.
- A Medyco recebe a comissão automaticamente, sem repasse manual.
- O financeiro fica mais transparente para auditoria, suporte e conciliação.
- Evita tratar todo o valor pago pelo paciente como receita bruta da Medyco antes do repasse.

Essa decisão precisa ser validada com contador e jurídico, principalmente para emissão fiscal, contrato com a clínica e responsabilidade sobre a venda ao paciente.

## Configuração esperada

Secrets globais:

- `ASAAS_API_KEY`: chave da conta raiz/plataforma.
- `ASAAS_ENVIRONMENT`: `sandbox` ou `production`.
- `ASAAS_MEDYCO_WALLET_ID`: carteira Asaas da Medyco que receberá o split.
- `ASAAS_WEBHOOK_TOKEN`: token para validar webhooks do Asaas.

Por clínica:

- `asaas_account_id`: ID da subconta da clínica.
- `asaas_wallet_id`: wallet da clínica.
- `asaas_api_key_ref`: nome do secret que guarda a API key da subconta da clínica.
- `asaas_onboarding_status`: etapa de ativação da conta.
- `asaas_split_enabled`: define se o split deve ser solicitado.

Exemplo de secret por clínica:

- `ASAAS_TENANT_SANTAVIDA_API_KEY`

## Fluxo operacional

1. Criar ou vincular subconta Asaas da clínica.
2. Salvar `account_id`, `wallet_id` e o nome do secret da API key no cadastro da clínica.
3. Configurar a wallet da Medyco em `ASAAS_MEDYCO_WALLET_ID`.
4. Ao gerar cobrança do paciente, a plataforma usa a API key da clínica e envia split de 10% para a Medyco.
5. Webhook do Asaas atualiza pagamento, assinatura e status do paciente.

## Observação fiscal

A Medyco deve emitir nota/recibo apenas sobre a mensalidade da clínica e sobre a comissão/split que efetivamente recebe, salvo orientação diferente do contador.
