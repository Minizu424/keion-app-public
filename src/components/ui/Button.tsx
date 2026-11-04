import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const baseClass =
    "inline-flex items-center justify-center rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  const variantClass: Record<ButtonVariant, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    outline:
      "border border-blue-600 bg-white text-blue-600 hover:bg-blue-50",
  };

  const sizeClass: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button
      type={type}
      className={`${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}