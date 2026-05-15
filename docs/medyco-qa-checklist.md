# Medyco - checklist de conferência

Use este roteiro depois de cada publish no Lovable para conferir se os três perfis principais continuam funcionando.

## 1. Dono da plataforma

- Entrar com o super admin em `/admin`.
- Conferir se o painel mostra clínicas, pacientes, receita e validações.
- Abrir `/admin/tenants` e criar uma clínica de teste.
- Abrir `/admin/metrics` e confirmar que a clínica aparece nos números.
- Abrir `/admin/audit` e conferir se a linha do tempo carrega sem tela quebrada.
- Abrir `/admin/billing` e `/admin/settings` para validar estados vazios e mensagens.

## 2. Clínica

- Entrar no portal da clínica em `/app/slug-da-clinica`.
- Criar um paciente em `/app/slug-da-clinica/patients`.
- Abrir a ficha do paciente e conferir dados, cartão, assinatura, pagamentos, termos, convites, validações e atendimentos.
- Enviar convite de acesso para o paciente.
- Importar pacientes por CSV usando as colunas `nome, cpf, email, telefone, status`.
- Criar ou revisar serviços em `/app/slug-da-clinica/services`.
- Validar o cartão em `/app/slug-da-clinica/validate`.
- Registrar atendimento em `/app/slug-da-clinica/executions`.
- Registrar cobrança ou pagamento em `/app/slug-da-clinica/billing`.
- Exportar CSV de pacientes, pagamentos e atendimentos.
- Revisar o portal no celular: menu inferior, lista de pacientes, ficha do paciente, validação e billing.

## 3. Paciente

- Abrir o link recebido por convite e criar acesso com o mesmo e-mail convidado.
- Entrar em `/patient`.
- Conferir cartão digital, assinatura, histórico, rede e perfil.
- Aceitar termos obrigatórios em `/patient/terms`.
- Validar que o cartão só é autorizado se o paciente estiver ativo e com termos aceitos.

## 4. Fluxo financeiro

- Criar cobrança pendente para um paciente.
- Enviar lembrete de cobrança por e-mail.
- Marcar pagamento como pago e confirmar que o paciente volta para ativo.
- Marcar assinatura como inadimplente, cancelada, pausada e reativada.
- Conferir se a ficha do paciente reflete a alteração.

## 5. Critérios de pronto para rua

- Nenhuma rota principal deve abrir tela "not found".
- Toda lista precisa mostrar carregando, erro e estado vazio amigável.
- Os três perfis precisam estar separados: admin global, clínica e paciente.
- Convite, termo, cartão, cobrança e validação precisam funcionar ponta a ponta.
- Os textos legais devem passar por revisão jurídica antes de vender para clientes reais.
