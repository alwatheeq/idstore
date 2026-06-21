import { forwardRef } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, id, ...rest }, ref
) {
  const fieldId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium">{label}</label>
      <input
        id={fieldId}
        ref={ref}
        className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
