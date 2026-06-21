import { forwardRef, useId } from "react";

type Option = { value: string; label: string };
type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: Option[]; error?: string };

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, error, id, ...rest }, ref
) {
  const generated = useId();
  const fieldId = id ?? rest.name ?? generated;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium">{label}</label>
      <select id={fieldId} ref={ref} className="w-full border rounded-lg px-3 py-2 bg-transparent" {...rest}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
