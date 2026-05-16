import { createFileRoute } from "@tanstack/react-router";
import { LandingNav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import {
  Problems,
  Solution,
  Benefits,
  Modules,
  ProductShowcase,
  Plans,
  CTA,
  Footer,
} from "@/components/landing/Sections";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <Problems />
        <Solution />
        <Benefits />
        <Modules />
        <ProductShowcase />
        <Plans />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
