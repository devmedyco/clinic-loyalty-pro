import { createFileRoute } from "@tanstack/react-router";
import { LegalSection, PublicPage } from "@/components/public/PublicPage";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="Privacidade"
      title="Política de privacidade"
      subtitle="Modelo inicial alinhado à operação da Medyco. A versão final deve passar por revisão jurídica/LGPD."
    >
      <LegalSection title="Dados tratados">
        <p>
          A Medyco pode tratar dados de cadastro, contato, identificação, vínculo com clínica,
          assinatura, pagamentos, cartão digital, validações por QR Code e histórico operacional de
          atendimentos.
        </p>
      </LegalSection>
      <LegalSection title="Finalidades">
        <p>
          Os dados são usados para autenticação, gestão do programa de benefícios, emissão e
          validação do cartão, cobrança, suporte, segurança, auditoria e cumprimento de obrigações
          legais.
        </p>
      </LegalSection>
      <LegalSection title="Compartilhamento">
        <p>
          Dados podem ser compartilhados com a clínica responsável, provedores essenciais de
          tecnologia, pagamento, e-mail transacional e autoridades quando exigido por lei.
        </p>
      </LegalSection>
      <LegalSection title="Direitos do titular">
        <p>
          O titular pode solicitar acesso, correção, informação sobre uso, portabilidade, oposição
          ou exclusão quando aplicável, observadas obrigações legais e contratuais.
        </p>
      </LegalSection>
    </PublicPage>
  );
}
