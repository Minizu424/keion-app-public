"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import { Sidebar } from "@/components/layout/Sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

const publicPaths = ["/login", "/account-request", "/profile/setup"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.startsWith(path));
}

function getUserDescription(member: Member): string {
  const roleLabel =
    member.role === "admin"
      ? "管理者"
      : member.role === "executive"
        ? "幹部"
        : "一般メンバー";

  return `${member.mainPart}・${member.grade}年 / ${roleLabel}`;
}

function canShowAdminLinks(member: Member): boolean {
  return member.role === "admin" || member.role === "executive";
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const shouldHideShell = useMemo(() => {
    return isPublicPath(pathname);
  }, [pathname]);

  useEffect(() => {
    if (shouldHideShell) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMember(null);
        setIsLoading(false);
        return;
      }

      const memberData = await getMemberByUid(user.uid);

      setMember(memberData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [shouldHideShell]);

  if (shouldHideShell) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">
          画面を読み込み中...
        </p>
      </main>
    );
  }

  if (!member) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar
        activePath={pathname}
        userName={member.name}
        userDescription={getUserDescription(member)}
        showAdminLinks={canShowAdminLinks(member)}
      />

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}