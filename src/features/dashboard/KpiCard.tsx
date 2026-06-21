export function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-xl p-4 space-y-1">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs opacity-60">{label}</div>
    </div>
  );
}
