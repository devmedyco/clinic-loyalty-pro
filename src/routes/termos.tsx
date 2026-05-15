import { createFileRoute } from "@tanstack/react-router";
import { LegalSection, PublicPage } from "@/components/public/PublicPage";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <PublicPage
      eyebrow="Termos"
      title="Termos de uso da plataforma Medyco"
      subtitle="Modelo operacional inicial. Deve ser revisado por assessoria jurídica antes do uso comercial definitivo."
    >
      <LegalSection title="Natureza da plataforma">
        <p>
          A Medyco é uma infraestrutura operacional para programas de benefícios em saúde, cartões
          digitais, assinaturas, validação de elegibilidade e gestão de atendimentos por clínicas.
        </p>
        <p>
          A Medyco não é plano de saúde, seguradora, operadora de saúde, convênio médico ou
          prestadora direta dos serviços clínicos oferecidos pelas clínicas cadastradas.
        </p>
      </LegalSection>
      <LegalSection title="Responsabilidades da clínica">
        <p>
          A clínica é responsável pelas informações cadastradas, serviços divulgados, preços,
          descontos, atendimento ao paciente, emissão fiscal, cumprimento regulatório e relação
          contratual com seus pacientes.
        </p>
      </LegalSection>
      <LegalSection title="Uso adequado">
        <p>
          O usuário deve acessar a plataforma com credenciais próprias, manter dados atualizados e
          não utilizar o sistema para fraude, compartilhamento indevido de cartão ou violação de
          direitos de terceiros.
        </p>
      </LegalSection>
      <LegalSection title="Disponibilidade e evolução">
        <p>
          A plataforma poderá evoluir, receber melhorias, ajustes, novas integrações ou mudanças
          operacionais para segurança, desempenho e conformidade.
        </p>
      </LegalSection>
    </PublicPage>
  );
}
