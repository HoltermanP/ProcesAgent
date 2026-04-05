import Link from "next/link";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";

const STEPS = [
  {
    number: "01",
    title: "Procesanalyse",
    description:
      "Analyseer je bedrijfsproces via een AI-gesprek. Identificeer stappen, betrokkenen en knelpunten.",
    href: "/procesanalyse",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    number: "02",
    title: "Visueel Ontwerp",
    description:
      "Genereer automatisch een visueel procesdiagram. Bekijk agent-kansen gemarkeerd in je proces.",
    href: "/visueel-ontwerp",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M17.5 14v7M14 17.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    number: "03",
    title: "Agent Ontwerp",
    description:
      "Ontwerp Claude-agents voor elke geïdentificeerde kans. Definieer prompts, tools en configuratie.",
    href: "/agent-ontwerp",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M18 12l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    number: "04",
    title: "Applicatie Ontwerp",
    description:
      "Genereer een volledig applicatie-ontwerp met architectuur, componenten en startcode.",
    href: "/applicatie-ontwerp",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 9l3 3-3 3M13 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 8h18" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    number: "05",
    title: "Applicatie Bouwen",
    description:
      "Genereer werkende Next.js code met je procesflow. Agents per stap aan/uit schakelbaar.",
    href: "/bouwen",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-deep-black">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 py-20 text-center max-w-4xl mx-auto">
          <p className="label-tag mb-4">AI-Group · Intern platform</p>
          <h1 className="page-heading text-4xl md:text-6xl mb-4 leading-tight">
            Processen modelleren,<br />
            <span className="text-blue-light">agents bouwen</span>
          </h1>
          <p className="text-slate text-lg max-w-xl mx-auto mb-8">
            Analyseer je bedrijfsprocessen met AI, identificeer automatiseringskansen en ontwerp productie-klare Claude-agents — stap voor stap.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/procesanalyse" className="btn-cta px-6 py-3 text-base">
              Start met analyse →
            </Link>
            <Link href="/visueel-ontwerp" className="btn-outline px-6 py-3 text-base">
              Bekijk ontwerpen
            </Link>
          </div>
        </section>

        {/* Steps */}
        <section className="px-6 pb-20 max-w-5xl mx-auto">
          <p className="label-tag text-center mb-10">Werkwijze</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STEPS.map((step) => (
              <Link
                key={step.number}
                href={step.href}
                className="group bg-surface border border-border rounded-card p-6 hover:border-ai-blue/40 hover:shadow-glow transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded bg-ai-blue/10 border border-ai-blue/20 flex items-center justify-center text-blue-light group-hover:bg-ai-blue/20 transition-colors">
                    {step.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="kpi-number text-sm">{step.number}</span>
                      <h2 className="section-heading text-base">{step.title}</h2>
                    </div>
                    <p className="text-slate text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* KPI strip */}
        <section className="border-t border-border py-10">
          <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-6 text-center">
            {[
              { value: "4", unit: "stappen", sub: "van analyse tot code" },
              { value: "100%", unit: "", sub: "AI-gedreven ontwerp" },
              { value: "Claude", unit: "", sub: "Anthropic · claude-sonnet-4-6" },
            ].map((kpi, i) => (
              <div key={i}>
                <p className="kpi-number text-3xl md:text-4xl">
                  {kpi.value}
                  {kpi.unit && (
                    <span className="text-slate text-base font-mono ml-1">{kpi.unit}</span>
                  )}
                </p>
                <p className="text-slate text-xs mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
