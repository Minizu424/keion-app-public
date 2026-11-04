import type { HTMLAttributes, ReactNode } from "react";

type CardTone = "default" | "blue" | "green" | "orange" | "purple";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: CardTone;
};

export function Card({
  children,
  tone = "default",
  className = "",
  ...props
}: CardProps) {
  const baseClass =
    "rounded-2xl border p-5 shadow-sm transition";

  const toneClass: Record<CardTone, string> = {
    default: "border-slate-200 bg-white",
    blue: "border-blue-100 bg-blue-50/60",
    green: "border-emerald-100 bg-emerald-50/60",
    orange: "border-orange-100 bg-orange-50/60",
    purple: "border-violet-100 bg-violet-50/60",
  };

  return (
    <div
      className={`${baseClass} ${toneClass[tone]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}