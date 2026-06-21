type Variant = "primary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-[background-color,transform,box-shadow,border-color] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";

const variantStyles: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-black shadow-card",
  ghost: "border border-line-strong bg-surface text-ink hover:bg-paper-2",
  danger: "border border-transparent text-danger hover:bg-danger-soft hover:border-danger/40",
};

export function buttonClasses(variant: Variant = "primary", className = ""): string {
  return `${base} ${variantStyles[variant]} ${className}`.trim();
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  return <button type={type} className={buttonClasses(variant, className)} {...rest} />;
}
