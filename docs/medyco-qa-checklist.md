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
- Confirmar que o paciente ganhou número de cartão curto no formato `MED-123456`.
- Confirmar que a primeira cobrança pendente foi criada com vencimento imediato.
- Abrir a ficha do paciente e conferir dados, cartão, assinatura, pagamentos, termos, convites, validações e atendimentos.
- Enviar convite de acesso para o paciente.
- Importar pacientes por CSV usando as colunas `nome, cpf, email, telefone, status`.
- Criar ou revisar serviços em `/app/slug-da-clinica/services`.
- Validar o cartão em `/app/slug-da-clinica/validate`.
- Testar validação por câmera no celular usando o QR Code do cartão do paciente.
- Registrar atendimento em `/app/slug-da-clinica/executions`.
- Registrar cobrança ou pagamento em `/app/slug-da-clinica/billing`.
- Exportar CSV de pacientes, pagamentos e atendimentos.
- Revisar o portal no celular: menu inferior, lista de pacientes, ficha do paciente, validação e billing.

## 3. Paciente

- Abrir o link recebido por convite e criar acesso com o mesmo e-mail convidado.
- Conferir que o convite pede apenas senha e confirmação de senha, sem recadastrar nome/e-mail.
- Entrar em `/patient`.
- Conferir cartão digital com cor e logo da clínica, QR Code real, assinatura, histórico, rede e perfil.
- Aceitar termos obrigatórios em `/patient/terms`.
- Validar que o cartão só é autorizado se o paciente estiver ativo e com termos aceitos.
- Se aparecer a tela de criar clínica, sair da conta atual e repetir o teste em janela anônima ou outro navegador. Isso indica sessão misturada, não fluxo de paciente.

## 4. Fluxo financeiro

- Em `/admin/settings`, conferir se Asaas sandbox mostra API, wallet e webhook configurados.
- Em `/app/slug-da-clinica/settings`, criar subconta Asaas sandbox para a clínica.
- Salvar a API key da subconta no Lovable com o nome de secret exibido pela Medyco.
- Criar cobrança pendente para um paciente.
- Abrir o link de cobrança Asaas e simular o pagamento no sandbox.
- Conferir se webhook atualiza pagamento, assinatura, paciente e status do split.
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

## 6. Roteiro recomendado para teste limpo

- Usar três navegadores ou perfis diferentes: um para super admin, um para clínica e um para paciente.
- Criar uma clínica com CNPJ, e-mail, telefone e CEP reais de teste.
- Confirmar se a clínica recebeu convite da Medyco e boas-vindas do Asaas quando a subconta for criada.
- Criar um paciente com outro e-mail, enviar convite e aceitar pelo navegador reservado ao paciente.
- Testar login direto depois do aceite: `/admin` para dono da plataforma, `/app/slug-da-clinica` para clínica e `/patient` para paciente.
- Ao apagar uma clínica de teste, conferir no Asaas sandbox se a subconta/carteira antiga não será reutilizada em novo teste com dados iguais.
