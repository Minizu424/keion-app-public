import type { HTMLAttributes, ReactNode } from "react";

type StatusBadgeTone =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple";

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

export function StatusBadge({
  children,
  tone = "gray",
  className = "",
  ...props
}: StatusBadgeProps) {
  const baseClass =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

  const toneClass: Record<StatusBadgeTone, string> = {
    gray: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-yellow-100 text-yellow-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-violet-100 text-violet-700",
  };

  return (
    <span className={`${baseClass} ${toneClass[tone]} ${className}`} {...props}>
      {children}
    </span>
  );
}