type Variant = "primary" | "ghost" | "danger";

const variantStyles: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  ghost: "border hover:bg-gray-50",
  danger: "text-red-600 hover:bg-red-50",
};

export function buttonClasses(variant: Variant = "primary", className = ""): string {
  return `inline-block rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${variantStyles[variant]} ${className}`.trim();
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  return <button type={type} className={buttonClasses(variant, className)} {...rest} />;
}
