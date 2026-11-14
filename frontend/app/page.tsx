import Image from "next/image";
import Footer from "@/components/layout/footer";
import SearchSection from "@/components/features/search-section";
import type { ChatPayload } from "@genai-lab/contracts";

export default function Home() {
  // Reference ChatPayload type ensuring page-level contract compilation
  const _typeCheckPayload: ChatPayload | null = null;
  void _typeCheckPayload;

  return (
    <div className="min-h-screen flex flex-col max-w-[640px] mx-auto px-6 py-16 w-full justify-between bg-bg-primary text-text-primary">
      <main className="grow w-full flex flex-col">
        {/* Hero Banner Area */}
        <section className="mb-10 flex flex-col gap-4 border-b border-border-color pb-10">
          <div className="flex items-center gap-3">
            <Image
              src="/display-picture.jpg"
              alt="Roselle"
              width={36}
              height={36}
              className="shrink-0 rounded-[10px] object-cover"
            />
            <h1 className="text-[1.8rem] font-semibold text-text-primary tracking-tight leading-tight">
              Hi, I&apos;m Roselle.
            </h1>
          </div>
          <p className="text-[0.95rem] text-text-secondary leading-relaxed">
            A full-stack software engineer who can&apos;t stop tinkering with Generative AI. I turn{" "}
            <span className="text-text-primary font-medium">
              &ldquo;wouldn&apos;t it be cool if an AI could&hellip;&rdquo;
            </span>{" "}
            into things that actually ship, and I write down what breaks along the way.
          </p>
          <a
            href="https://github.com/roselletabuena"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-[0.85rem] text-text-muted hover:text-text-primary underline-offset-4 hover:underline transition-colors"
          >
            github.com/roselletabuena &rarr;
          </a>
        </section>

        <section className="mb-6">
          <h2 className="text-[0.75rem] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Ideas & Explorations
          </h2>
          <p className="text-[0.85rem] text-text-muted leading-relaxed">
            Deep dives, code templates, and reflections on bringing Generative AI into web
            workflows. Start anywhere.
          </p>
        </section>

        {/* Stateful Search and List Feature Component */}
        <SearchSection />
      </main>

      {/* Footer Layout Component */}
      <Footer />
    </div>
  );
}
