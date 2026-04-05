import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function Card({ children, className, glow }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-card p-4",
        glow && "shadow-glow",
        className
      )}
    >
      {children}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
}

export function KpiCard({ label, value, unit, sub }: KpiCardProps) {
  return (
    <Card>
      <p className="label-tag mb-2">{label}</p>
      <p className="kpi-number text-3xl">
        {value}
        {unit && <span className="text-slate text-sm font-mono ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-slate text-xs mt-1">{sub}</p>}
    </Card>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="section-heading text-lg">{title}</h2>
        {subtitle && <p className="text-slate text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "blue" | "red" | "green";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const variants = {
    default: "bg-border text-slate",
    blue: "bg-ai-blue/20 text-blue-light",
    red: "bg-velocity-red/20 text-velocity-red",
    green: "bg-green-900/30 text-green-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="mb-4 text-slate opacity-60">{icon}</div>}
      <h3 className="text-off-white font-medium mb-1">{title}</h3>
      {description && <p className="text-slate text-sm max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
