"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EXPLORATIONS, type Exploration } from "@/lib/explorations";

const ALL_TAGS = ["All", ...Array.from(new Set(EXPLORATIONS.flatMap((p) => p.tags)))];

const STATUS_STYLES: Record<string, string> = {
  Planned: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  Seedling: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "In Progress": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Explored: "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400/90 border-emerald-500/10",
  Deprecated: "bg-red-500/5 text-red-600 dark:text-red-400/90 border-red-500/10",
};

export default function SearchSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All");

  const filteredDocs = EXPLORATIONS.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = selectedTag === "All" || project.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  const renderProjectCard = (project: Exploration) => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[0.95rem] font-medium text-text-primary flex items-center gap-1.5 group-hover:text-accent-primary transition-colors">
            <span>{project.title}</span>
            {project.isCompleted && (
              <ArrowUpRight className="w-3.5 h-3.5 text-text-muted opacity-0 -translate-x-1 translate-y-1 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 shrink-0" />
            )}
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

      <p className="text-[0.9rem] text-text-secondary leading-relaxed">{project.description}</p>

      <div className="flex flex-wrap gap-2 mt-1">
        {project.tags.map((tag) => (
          <span key={tag} className="text-[0.7rem] text-text-muted">
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Search Input Container */}
      <div className="relative w-full">
        <Input
          type="text"
          placeholder="Search ideas and explorations..."
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
          filteredDocs.map((project) =>
            project.isCompleted ? (
              <Link
                key={project.id}
                href={`/explorations/${project.id}`}
                className="p-4 rounded-xl transition-colors duration-150 group hover:bg-bg-tertiary cursor-pointer block"
              >
                {renderProjectCard(project)}
              </Link>
            ) : (
              <div
                key={project.id}
                className="p-4 rounded-xl transition-colors duration-150 group cursor-default"
              >
                {renderProjectCard(project)}
              </div>
            )
          )
        ) : (
          <div className="text-center py-12 text-text-muted text-[0.9rem]">
            Nothing matches your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
