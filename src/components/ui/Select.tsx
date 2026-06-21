import { forwardRef, useId } from "react";

type Option = { value: string; label: string };
type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Option[];
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, error, id, className = "", ...rest }, ref
) {
  const generated = useId();
  const fieldId = id ?? rest.name ?? generated;
  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-2">
        {label}
      </label>
      <select
        id={fieldId}
        ref={ref}
        className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-volt-deep ${
          error ? "border-danger/50" : "border-line-strong"
        } ${className}`.trim()}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
});
