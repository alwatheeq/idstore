import type { LucideIcon } from "lucide-react";

export type Metric = {
  label: string;
  value: string;
  note: string;
  noteTone?: "good" | "warn";
  icon: LucideIcon;
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="metric-strip">
      {metrics.map(({ label, value, note, noteTone, icon: Icon }) => (
        <article className="metric" key={label}>
          <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon /></span></div>
          <div className="metric-value mono">{value}</div>
          <div className={`metric-note ${noteTone ?? ""}`}>{note}</div>
        </article>
      ))}
    </section>
  );
}
