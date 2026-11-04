import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type QuickActionCardTone = "blue" | "green" | "orange" | "purple";

type QuickActionCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  tone?: QuickActionCardTone;
  onClick?: () => void;
};

export function QuickActionCard({
  title,
  description,
  icon,
  tone = "blue",
  onClick,
}: QuickActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full rounded-2xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <Card
        tone={tone}
        className="flex min-h-36 flex-col justify-between transition group-hover:-translate-y-0.5 group-hover:shadow-md"
      >
        <div>
          <div className="mb-4 text-3xl">{icon}</div>

          <h3 className="text-base font-bold text-blue-950">{title}</h3>

          <p className="mt-4 whitespace-pre-line text-sm font-medium leading-6 text-blue-950">
            {description}
          </p>
        </div>

        <div className="mt-4 flex justify-end text-2xl text-blue-950 transition group-hover:translate-x-1">
          ›
        </div>
      </Card>
    </button>
  );
}