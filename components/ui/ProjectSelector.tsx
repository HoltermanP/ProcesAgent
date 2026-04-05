"use client";

import { useState, useEffect, useCallback } from "react";
import { type Project } from "@/lib/db";
import { formatDateRelative, statusLabel } from "@/lib/utils";

interface ProjectSelectorProps {
  selectedId: string | null;
  onSelect: (project: Project) => void;
  onNew: (name: string) => void;
}

export default function ProjectSelector({
  selectedId,
  onSelect,
  onNew,
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = (await res.json()) as Project[];
        setProjects(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const project = (await res.json()) as Project;
        setProjects((prev) => [project, ...prev]);
        onNew(project.id);
        onSelect(project);
        setIsCreating(false);
        setNewName("");
      }
    } catch {
      // silently fail
    }
  };

  return (
    <div className="bg-surface border border-border rounded-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-off-white">Project</span>
        <button
          onClick={() => setIsCreating((v) => !v)}
          className="text-xs text-blue-light hover:underline"
          aria-label="Nieuw project aanmaken"
        >
          + Nieuw
        </button>
      </div>

      {isCreating && (
        <div className="p-3 border-b border-border flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            placeholder="Projectnaam…"
            autoFocus
            className="flex-1 bg-deep-black border border-border rounded px-2 py-1 text-sm text-off-white placeholder-slate focus:outline-none focus:border-ai-blue/60"
          />
          <button onClick={() => void handleCreate()} className="btn-primary text-xs px-3">
            Aanmaken
          </button>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto">
        {loading && (
          <p className="text-slate text-sm p-4">Laden…</p>
        )}
        {!loading && projects.length === 0 && (
          <p className="text-slate text-sm p-4">Geen projecten gevonden.</p>
        )}
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelect(project)}
            className={`w-full text-left px-4 py-3 flex items-start justify-between hover:bg-deep-black/50 transition-colors border-b border-border/50 last:border-0 ${
              selectedId === project.id ? "bg-ai-blue/10" : ""
            }`}
            aria-pressed={selectedId === project.id}
          >
            <div className="min-w-0">
              <p className="text-sm text-off-white font-medium truncate">{project.name}</p>
              <p className="text-xs text-slate mt-0.5">{formatDateRelative(project.updated_at)}</p>
            </div>
            <span className={`text-xs shrink-0 ml-2 mt-0.5 ${
              project.status === "active" ? "text-blue-light" : "text-slate"
            }`}>
              {statusLabel(project.status)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
