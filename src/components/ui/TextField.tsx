import { forwardRef, useId } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, id, className = "", ...rest }, ref
) {
  const generated = useId();
  const fieldId = id ?? rest.name ?? generated;
  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-2">
        {label}
      </label>
      <input
        id={fieldId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-volt-deep ${
          error ? "border-danger/50" : "border-line-strong"
        } ${className}`.trim()}
        {...rest}
      />
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
});
