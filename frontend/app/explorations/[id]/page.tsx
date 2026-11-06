import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleHelp,
  GitBranch,
  Layers,
  Lightbulb,
  OctagonAlert,
  Rocket,
  Scale,
  Target,
  type LucideIcon,
} from "lucide-react";
import { getExplorationById, getExplorations } from "@/lib/explorations";
import { Badge } from "@/components/ui/badge";
import Footer from "@/components/layout/footer";

interface PageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return getExplorations().map((item) => ({
    id: item.id,
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const exploration = getExplorationById(id);
  if (!exploration) return { title: "Exploration Not Found" };
  return {
    title: `${exploration.title} | Ideas & Explorations`,
    description: exploration.description,
  };
}

const STATUS_STYLES: Record<string, string> = {
  Planned: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  Seedling: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "In Progress": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Explored: "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400/90 border-emerald-500/10",
  Deprecated: "bg-red-500/5 text-red-600 dark:text-red-400/90 border-red-500/10",
};

function Heading({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <>
      <Icon className="w-4.5 h-4.5 text-text-muted shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </>
  );
}

export default async function ExplorationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const exploration = getExplorationById(id);

  if (!exploration || !exploration.content) {
    notFound();
  }

  const { content } = exploration;

  return (
    <div className="min-h-screen flex flex-col max-w-[680px] mx-auto px-6 py-12 w-full justify-between bg-bg-primary text-text-primary">
      <main className="grow w-full flex flex-col gap-10">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[0.85rem] text-text-muted hover:text-text-primary transition-colors duration-150 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Ideas & Explorations</span>
          </Link>
        </div>

        {/* Article Header */}
        <header className="flex flex-col gap-3.5 border-b border-border-color pb-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge
              variant="outline"
              className={`text-[0.65rem] font-semibold tracking-wider uppercase ${
                STATUS_STYLES[exploration.status] ||
                "bg-bg-secondary text-text-secondary border-border-color"
              }`}
            >
              {exploration.status}
            </Badge>
            <span className="text-[0.8rem] text-text-muted">{exploration.date}</span>
          </div>

          <h1 className="text-[1.85rem] font-bold text-text-primary tracking-tight leading-tight">
            {exploration.title}
          </h1>

          <p className="text-[1rem] text-text-secondary leading-relaxed mt-1">{content.summary}</p>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {exploration.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full text-[0.7rem] bg-bg-secondary text-text-muted border border-border-color"
              >
                #{tag}
              </span>
            ))}
          </div>
        </header>

        {/* 1. Context & Source */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[1.1rem] font-semibold text-text-primary flex items-center gap-2">
            <Heading icon={Target}>1. Source & Context</Heading>
          </h2>
          <div className="flex flex-col gap-2 text-[0.92rem] text-text-secondary leading-relaxed">
            {content.sourceContext.map((item, idx) => (
              <p key={idx}>{item}</p>
            ))}
          </div>
        </section>

        {/* 2. The Friction (Problem Statement) */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[1.1rem] font-semibold text-text-primary flex items-center gap-2">
            <Heading icon={OctagonAlert}>2. The Friction (Problem Statement)</Heading>
          </h2>
          <p className="text-[0.92rem] text-text-secondary leading-relaxed">
            {content.problemStatement.overview}
          </p>

          {/* Silo Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {content.problemStatement.silos.map((silo, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-border-color bg-bg-secondary/50 flex flex-col gap-1 text-[0.85rem]"
              >
                <div className="font-semibold text-text-primary">{silo.role}</div>
                <div className="text-[0.75rem] text-text-muted">Tools: {silo.tools}</div>
                <div className="text-text-secondary mt-1">{silo.focus}</div>
              </div>
            ))}
          </div>

          <div className="mt-2 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col gap-1.5">
            <span className="text-[0.8rem] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
              Impact of NOT Solving
            </span>
            <ul className="list-disc list-inside text-[0.87rem] text-text-secondary space-y-1">
              {content.problemStatement.impactOfNotSolving.map((impact, idx) => (
                <li key={idx}>{impact}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. The Proposal */}
        <section className="flex flex-col gap-5">
          <h2 className="text-[1.1rem] font-semibold text-text-primary flex items-center gap-2">
            <Heading icon={Lightbulb}>3. The Proposal: Modular Block Ownership</Heading>
          </h2>
          <p className="text-[0.92rem] text-text-secondary leading-relaxed">
            {content.proposal.coreConcept}
          </p>

          {/* Modular Blocks */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-[0.95rem] font-medium text-text-primary flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-accent-primary" />
              <span>Specification Block Schema</span>
            </h3>
            <div className="flex flex-col gap-2">
              {content.proposal.modularBlocks.map((block, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-border-color bg-bg-secondary flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[0.9rem] font-semibold text-text-primary">
                      {block.title}
                    </span>
                    <Badge variant="outline" className="text-[0.7rem]">
                      Owner: {block.owner} ({block.role})
                    </Badge>
                  </div>
                  <p className="text-[0.85rem] text-text-secondary">{block.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The Git Bridge */}
          <div className="p-4 rounded-xl border border-border-color bg-bg-secondary/40 flex flex-col gap-3">
            <h3 className="text-[0.95rem] font-semibold text-text-primary flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-500" />
              <span>The Git Bridge (Two-Way Invisible Sync)</span>
            </h3>
            <p className="text-[0.88rem] text-text-secondary leading-relaxed">
              {content.proposal.gitBridge.description}
            </p>
            <ol className="list-decimal list-inside text-[0.85rem] text-text-secondary space-y-1">
              {content.proposal.gitBridge.workflow.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>

          {/* Technical Stack */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-[0.95rem] font-medium text-text-primary">Architecture & Stack</h3>
            <div className="flex flex-col gap-2">
              {content.proposal.techStack.map((tech, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-border-color bg-bg-secondary/30 flex flex-col gap-1 text-[0.85rem]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">{tech.layer}</span>
                    <span className="text-[0.78rem] text-text-muted">{tech.tech}</span>
                  </div>
                  <p className="text-text-secondary text-[0.82rem]">{tech.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 1 MVP Scope */}
          <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 flex flex-col gap-2">
            <h3 className="text-[0.9rem] font-semibold text-sky-600 dark:text-sky-400">
              {content.proposal.mvpScope.phase}
            </h3>
            <ul className="list-disc list-inside text-[0.85rem] text-text-secondary space-y-1">
              {content.proposal.mvpScope.items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. Gut-Check */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[1.1rem] font-semibold text-text-primary flex items-center gap-2">
            <Heading icon={Scale}>4. Quick Gut-Check</Heading>
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl border border-border-color bg-bg-secondary">
              <span className="text-[0.75rem] text-text-muted block">Impact / Value</span>
              <span className="text-[1rem] font-bold text-emerald-600 dark:text-emerald-400">
                {content.gutCheck.value}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-border-color bg-bg-secondary">
              <span className="text-[0.75rem] text-text-muted block">Complexity</span>
              <span className="text-[1rem] font-bold text-sky-600 dark:text-sky-400">
                {content.gutCheck.effort}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-border-color bg-bg-secondary">
              <span className="text-[0.75rem] text-text-muted block">Reversibility</span>
              <span className="text-[0.85rem] font-medium text-text-primary">
                {content.gutCheck.reversibility}
              </span>
            </div>
          </div>
          <p className="text-[0.85rem] text-text-muted mt-1">{content.gutCheck.notes}</p>
        </section>

        {/* 5. Open Questions */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[1.1rem] font-semibold text-text-primary flex items-center gap-2">
            <Heading icon={CircleHelp}>5. Open Questions & Unknowns</Heading>
          </h2>
          <div className="flex flex-col gap-2">
            {content.openQuestions.map((q, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 text-[0.88rem] text-text-secondary"
              >
                <Circle className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                <span>{q}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Next Steps */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[1.1rem] font-semibold text-text-primary flex items-center gap-2">
            <Heading icon={Rocket}>6. Next Steps</Heading>
          </h2>
          <div className="flex flex-col gap-2">
            {content.nextSteps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 text-[0.88rem] text-text-secondary"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Back Button */}
        <div className="pt-6 border-t border-border-color">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[0.85rem] text-text-muted hover:text-text-primary transition-colors duration-150 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to all ideas & explorations</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
