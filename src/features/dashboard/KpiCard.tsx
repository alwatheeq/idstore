export function KpiCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="micro">{label}</div>
      <div
        className={`num mt-3 text-3xl font-semibold tracking-tight ${
          accent ? "text-volt-deep" : "text-ink"
        }`}
      >
        {value}
      </div>
      {/* decorative volt accent tick — instrument motif, uniform across cards */}
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-paper-2">
        <div className="h-full w-10 rounded-full bg-volt" />
      </div>
    </div>
  );
}
