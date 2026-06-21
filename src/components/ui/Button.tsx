type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" };

const styles: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  ghost: "border hover:bg-gray-50",
  danger: "text-red-600 hover:bg-red-50",
};

export function Button({ variant = "primary", className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
