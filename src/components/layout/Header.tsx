import type { ReactNode } from "react";

type HeaderProps = {
  title: string;
  description?: string;
  rightContent?: ReactNode;
};

export function Header({ title, description, rightContent }: HeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
      <div>
        <h1 className="text-2xl font-bold text-blue-950">{title}</h1>

        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </header>
  );
}