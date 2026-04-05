export function cn(...classes: (string | undefined | null | false | 0)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateRelative(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "zojuist";
  if (diffMins < 60) return `${diffMins}m geleden`;
  if (diffHours < 24) return `${diffHours}u geleden`;
  if (diffDays < 7) return `${diffDays}d geleden`;
  return formatDate(dateString);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Concept",
    active: "Actief",
    archived: "Gearchiveerd",
    paused: "Gepauzeerd",
  };
  return labels[status] ?? status;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "text-slate",
    active: "text-blue-light",
    archived: "text-slate/50",
    paused: "text-velocity-red",
  };
  return colors[status] ?? "text-slate";
}

export function opportunityLabel(score: number | null): string {
  if (score === null) return "Onbekend";
  if (score >= 8) return "Hoog";
  if (score >= 5) return "Middel";
  return "Laag";
}

export function opportunityColor(score: number | null): string {
  if (score === null) return "text-slate";
  if (score >= 8) return "text-blue-light";
  if (score >= 5) return "text-yellow-400";
  return "text-slate";
}
