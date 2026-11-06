export interface ExplorationBlock {
  title: string;
  owner: string;
  role: string;
  description: string;
}

export interface ExplorationContent {
  summary: string;
  sourceContext: string[];
  problemStatement: {
    overview: string;
    silos: {
      role: string;
      tools: string;
      focus: string;
    }[];
    impactOfNotSolving: string[];
  };
  proposal: {
    coreConcept: string;
    modularBlocks: ExplorationBlock[];
    gitBridge: {
      description: string;
      workflow: string[];
    };
    techStack: {
      layer: string;
      tech: string;
      reason: string;
    }[];
    mvpScope: {
      phase: string;
      items: string[];
    };
  };
  gutCheck: {
    value: "High" | "Medium" | "Low";
    effort: "High" | "Medium" | "Low";
    reversibility: string;
    notes: string;
  };
  openQuestions: string[];
  nextSteps: string[];
}

export interface Exploration {
  id: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
  status: "Planned" | "In Progress" | "Explored" | "Deprecated" | "Seedling";
  isCompleted: boolean;
  content?: ExplorationContent;
}

export const EXPLORATIONS: Exploration[] = [
  {
    id: "enterprise-speckit-ui",
    title: 'Enterprise SpecKit UI: The "Living Spec" Platform',
    description:
      "A centralized, visual application that treats software specifications as composite, modular objects with role-based ownership (PO, TA, UI/UX, Dev) and automated Git synchronization.",
    tags: ["SpecKit", "Workflows", "Next.js", "Git", "Developer Experience"],
    date: "November 6, 2026",
    status: "Planned",
    isCompleted: true,
    content: {
      summary:
        "A centralized, visual web application that treats software specifications as modular, role-owned blocks (PO, TA, UI/UX, Dev) with an invisible two-way Git synchronization bridge.",
      sourceContext: [
        "In standard R&D scrum teams, product owners, architects, designers, and developers work in isolated silos with disjointed tools.",
        "Non-technical stakeholders (POs) are effectively locked out of code-repository specification tools, while engineers lose context jumping across Jira, Confluence, Swagger, Figma, and Storybook.",
      ],
      problemStatement: {
        overview:
          "In a standard R&D scrum team, specification ownership is heavily fragmented across isolated tools, forcing developers to constantly context-switch to piece together a single feature and locking POs out of engineering execution.",
        silos: [
          {
            role: "Product Owners (PO)",
            tools: "Jira, Confluence",
            focus: "Business logic and acceptance criteria",
          },
          {
            role: "Technical Architects (TA)",
            tools: "Swagger, Backstage, Docs",
            focus: "API contracts and database schemas",
          },
          {
            role: "Designers (UI/UX)",
            tools: "Figma, Zeplin",
            focus: "Component visual states and design tokens",
          },
          {
            role: "Developers (Dev)",
            tools: "GitHub, Storybook, IDE",
            focus: "Implementation and code change requests",
          },
        ],
        impactOfNotSolving: [
          "Constant context-switching across 4+ disconnected tools slows sprint velocity.",
          "Specifications drift out of sync with actual code immediately after release.",
          "Misalignment leads to expensive late-cycle rework when code diverges from product intent.",
        ],
      },
      proposal: {
        coreConcept:
          "The platform acts as a single source of truth by assigning strict, block-level ownership to a unified specification schema. Non-technical stakeholders interact via a Notion-style rich-text UI, while the system automatically serializes and syncs changes to Git under the hood.",
        modularBlocks: [
          {
            title: "Block A (Business)",
            owner: "Product Owner",
            role: "PO",
            description:
              "Notion-style rich-text editor for User Stories and Acceptance Criteria. Once approved, the block is locked for the sprint.",
          },
          {
            title: "Block B (Architecture)",
            owner: "Technical Architect",
            role: "TA",
            description: "API contracts (OpenAPI/Swagger) and database schemas.",
          },
          {
            title: "Block C (Design)",
            owner: "UI/UX Designer",
            role: "UI/UX",
            description: "Component mapping, design tokens, and visual state previews.",
          },
          {
            title: "Block D (Implementation)",
            owner: "Developer",
            role: "Dev",
            description:
              "Technical notes, change requests, and real-time implementation status tracking.",
          },
        ],
        gitBridge: {
          description:
            "When a PO hits 'Approve' in the UI, the Node.js backend automatically serializes the rich-text blocks into a standard format and commits or opens a PR in GitHub.",
          workflow: [
            "PO authors requirements in the rich-text block editor.",
            "PO clicks 'Approve & Sync' upon story finalization.",
            "Backend serializes rich-text blocks into a standard schema (e.g. speckit.json or Markdown).",
            "GitHub REST API opens a Pull Request or commits directly to a designated specs branch.",
          ],
        },
        techStack: [
          {
            layer: "Frontend Dashboard",
            tech: "Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui",
            reason:
              "Rapid, component-first enterprise interface with dark mode and high accessibility.",
          },
          {
            layer: "Data & Permissions",
            tech: "PostgreSQL + Prisma",
            reason:
              "Complex relational mapping of draft states, block-level RBAC, and threaded reviews.",
          },
          {
            layer: "Integration Engine",
            tech: "Node.js + GitHub REST API & Webhooks",
            reason:
              "Bi-directional synchronization between UI edits, Jira webhooks, and GitHub pull requests.",
          },
        ],
        mvpScope: {
          phase: "Phase 1 MVP Scope: PO-to-Developer Handoff",
          items: [
            "PO Interface: Notion-style rich-text editor to write and approve business requirements.",
            "Dev Interface: Read-only UI view of the PO block with threaded comments and change requests.",
            "Two-Way Sync: Automated JSON/Markdown serialization and GitHub branch commit upon approval.",
          ],
        },
      },
      gutCheck: {
        value: "High",
        effort: "Medium",
        reversibility: "Two-way door",
        notes:
          "Runs non-destructively alongside existing repositories without altering production build configs.",
      },
      openQuestions: [
        "Which rich-text editor library offers the cleanest AST serialization (Tiptap vs Lexical vs Novel)?",
        "How will concurrent edits between Git markdown and the web UI handle merge conflict resolution?",
        "Should GitHub authentication rely on a shared GitHub App bot token or granular user OAuth?",
        "How should spec approval lifecycles link to sprint branching models (e.g. main vs feature branches)?",
      ],
      nextSteps: [
        "Validate Phase 1 MVP scope with engineering and product stakeholders.",
        "Build a technical spike demonstrating Tiptap rich-text AST export to GitHub REST API commit.",
        "Promote into formal architectural Spec artifact under specs/003-enterprise-speckit-ui.",
      ],
    },
  },
];

export function getExplorations(): Exploration[] {
  return EXPLORATIONS;
}

export function getExplorationById(id: string): Exploration | undefined {
  return EXPLORATIONS.find((e) => e.id === id);
}
