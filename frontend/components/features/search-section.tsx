"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
  status: string;
  isCompleted: boolean;
}

const PROJECTS_DATA: Project[] = [
  {
    id: "aws-exploration",
    title: "AWS Cloud Architecture & Portfolio",
    description:
      "Showcasing a live cloud-native serverless architecture. Integrates Bedrock Agent Runtime, S3 vector search, DynamoDB telemetry, API Gateway, and Lambda.",
    tags: ["AWS", "Serverless", "SAM", "Bedrock KB", "DynamoDB", "TypeScript"],
    date: "June 18, 2026",
    status: "Explored",
    isCompleted: true,
  },
  {
    id: "structured-extraction",
    title: "Structured Data Extraction",
    description:
      "Deep dive into parsing unstructured text into reliable, validated JSON structures. Explores schema definitions, prompt routing, and validation recovery strategies.",
    tags: ["NLP", "JSON Schema", "Python", "TypeScript", "Gemini API"],
    date: "June 14, 2026",
    status: "Explored",
    isCompleted: true,
  },
  {
    id: "rag-exploration",
    title: "Retrieval-Augmented Generation (RAG)",
    description:
      "Exploring semantic search pipelines, text chunking heuristics, overlap parameters, metadata filtering, and reducing LLM hallucinations with citation models.",
    tags: ["RAG", "Vector DB", "Semantic Search", "Python", "Embeddings"],
    date: "June 15, 2026",
    status: "Explored",
    isCompleted: true,
  },
  {
    id: "agentic-workflows",
    title: "Agentic Workflows & Tool Calling",
    description:
      "Designing autonomous loops where LLMs invoke local APIs, verify schema responses, handle failure exceptions, and synthesize multi-turn goals.",
    tags: ["Agents", "Tool Calling", "Function Calling", "ReAct", "Python"],
    date: "Planned",
    status: "In Progress",
    isCompleted: false,
  },
  {
    id: "legacy-extraction",
    title: "Legacy Rule-Based Extraction",
    description:
      "Old pipeline using regular expressions and heuristic-based templates for data parsing. Deprecated in favor of modern LLM structured extraction.",
    tags: ["NLP", "Regex", "Python"],
    date: "May 20, 2026",
    status: "Deprecated",
    isCompleted: false,
  },
];

const ALL_TAGS = ["All", "NLP", "RAG", "Vector DB", "Agents", "AWS"];

const STATUS_STYLES: Record<string, string> = {
  "In Progress": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Explored: "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400/90 border-emerald-500/10",
  Deprecated: "bg-red-500/5 text-red-600 dark:text-red-400/90 border-red-500/10",
};

export default function SearchSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All");

  const filteredDocs = PROJECTS_DATA.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = selectedTag === "All" || project.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Search Input Container */}
      <div className="relative w-full">
        <Input
          type="text"
          placeholder="Search explorations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 pl-11 pr-4 rounded-full bg-bg-secondary border border-border-color text-text-primary placeholder:text-text-muted focus:bg-bg-primary focus-visible:border-text-secondary focus-visible:ring-2 focus-visible:ring-text-primary/10 outline-none transition-all shadow-none"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-text-muted pointer-events-none" />
      </div>

      {/* Filter Tags */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`px-3 py-1 rounded-full text-[0.75rem] font-medium border transition-all cursor-pointer ${
              selectedTag === tag
                ? "bg-text-primary text-bg-primary border-text-primary"
                : "bg-bg-secondary text-text-secondary border-border-color hover:bg-bg-tertiary"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* List of explorations (roselle-tabuena blog list style) */}
      <div className="flex flex-col gap-2 w-full -mx-4">
        {filteredDocs.length > 0 ? (
          filteredDocs.map((project) => (
            <div
              key={project.id}
              className={`p-4 rounded-xl flex flex-col gap-2 transition-colors duration-150 group ${
                project.isCompleted ? "hover:bg-bg-tertiary cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[0.95rem] font-medium text-text-primary flex items-center gap-2">
                    {project.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-[0.65rem] font-semibold tracking-wider uppercase ${
                      STATUS_STYLES[project.status] ||
                      "bg-bg-secondary text-text-secondary border-border-color"
                    }`}
                  >
                    {project.status === "In Progress" && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                      </span>
                    )}
                    {project.status}
                  </Badge>
                </div>
                <span className="text-[0.75rem] text-text-muted whitespace-nowrap sm:text-right shrink-0">
                  {project.date}
                </span>
              </div>

              <p className="text-[0.9rem] text-text-secondary leading-relaxed">
                {project.description}
              </p>

              <div className="flex flex-wrap gap-2 mt-1">
                {project.tags.map((tag) => (
                  <span key={tag} className="text-[0.7rem] text-text-muted">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-text-muted text-[0.9rem]">
            No explorations match your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
