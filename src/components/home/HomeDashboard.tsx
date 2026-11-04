"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

const quickActions = [
  {
    title: "ライブ / 合宿申請",
    description: "申請を新しく作成",
    href: "/applications",
    icon: "📝",
    tone: "blue" as const,
  },
  {
    title: "支払い状況確認",
    description: "支払いステータスを確認",
    href: "/payment",
    icon: "¥",
    tone: "green" as const,
  },
  {
    title: "タイムテーブル",
    description: "作成・編集する",
    href: "/timetable",
    icon: "📅",
    tone: "orange" as const,
  },
  {
    title: "防音室予約",
    description: "予約状況を確認",
    href: "/rooms",
    icon: "🚪",
    tone: "purple" as const,
  },
  {
    title: "メンバー一覧",
    description: "メンバー情報を確認",
    href: "/members",
    icon: "👥",
    tone: "default" as const,
  },
];

const notices = [
  {
    label: "重要",
    tone: "red" as const,
    title: "夏合宿の申請を開始しました",
    detail: "申請締切：6月15日（日）まで",
    date: "2025/05/24",
  },
  {
    label: "締切",
    tone: "orange" as const,
    title: "6月ライブの出演申請締切について",
    detail: "締切：5月31日（土）23:59まで",
    date: "2025/05/23",
  },
  {
    label: "連絡",
    tone: "blue" as const,
    title: "新歓ライブのお知らせ",
    detail: "日時：6月7日（土） 会場：メインホール",
    date: "2025/05/20",
  },
  {
    label: "連絡",
    tone: "blue" as const,
    title: "機材講習会について",
    detail: "日時：5月28日（水）18:00〜",
    date: "2025/05/18",
  },
];

const schedules = [
  {
    date: "5/31（土）",
    label: "締切",
    tone: "red" as const,
    title: "6月ライブ出演申請締切",
  },
  {
    date: "6/7（土）",
    label: "予定",
    tone: "blue" as const,
    title: "新歓ライブ",
  },
  {
    date: "6/15（日）",
    label: "締切",
    tone: "red" as const,
    title: "夏合宿申請締切",
  },
  {
    date: "7/12（土）",
    label: "予定",
    tone: "blue" as const,
    title: "夏合宿説明会",
  },
];

function isExecutiveMember(member: Member): boolean {
  return member.role === "executive" || member.role === "admin";
}

export function HomeDashboard() {
  const router = useRouter();

  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);

      try {
        if (!user) {
          router.push("/login");
          return;
        }

        const memberData = await getMemberByUid(user.uid);

        if (!memberData) {
          router.push("/account-request");
          return;
        }

        if (memberData.status !== "active") {
          router.push("/login");
          return;
        }

        setMember(memberData);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">
          ホーム画面を読み込み中...
        </p>
      </main>
    );
  }

  if (!member) {
    return null;
  }

  const isExecutive = isExecutiveMember(member);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-600 md:hidden">
              軽音サークル 運営支援アプリ
            </p>

            <h1 className="mt-1 text-2xl font-bold text-blue-950">
              こんにちは、{member.name}さん
              {isExecutive ? "（幹部）" : "！"}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              今日も素敵なライブをつくりましょう！
            </p>
          </div>

          <div className="flex items-center gap-4">
            <p className="hidden text-sm font-medium text-slate-600 sm:block">
              2025年5月26日（月）
            </p>

            <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl">
              🔔
              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {isExecutive ? 3 : 2}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 pb-24 md:px-8 md:pb-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/applications">
            <Card
              tone="blue"
              className="h-full cursor-pointer hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl">
                    🧾
                  </div>

                  <p className="text-sm font-bold text-blue-950">
                    {isExecutive ? "申請中の件数" : "ライブ / 合宿申請"}
                  </p>

                  <p className="mt-4 text-4xl font-bold text-blue-950">
                    {isExecutive ? "12" : "1"}
                    <span className="ml-1 text-base">件</span>
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {isExecutive ? "ライブ：8件 / 合宿：4件" : "提出済み"}
                  </p>
                </div>

                <span className="mt-10 text-2xl text-slate-400">›</span>
              </div>
            </Card>
          </Link>

          <Link href={isExecutive ? "/admin/payments" : "/payment"}>
            <Card
              tone="green"
              className="h-full cursor-pointer hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xl">
                    ✅
                  </div>

                  <p className="text-sm font-bold text-blue-950">
                    {isExecutive ? "支払い管理" : "支払い状況"}
                  </p>

                  <p className="mt-4 text-4xl font-bold text-blue-950">
                    {isExecutive ? "管理" : "確認"}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    {isExecutive
                      ? "未報告・報告済みを確認"
                      : "自分の支払い状況を確認"}
                  </p>
                </div>

                <span className="mt-10 text-2xl text-slate-400">›</span>
              </div>
            </Card>
          </Link>

          <Link href="/timetable">
            <Card
              tone="orange"
              className="h-full cursor-pointer hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-xl">
                    📅
                  </div>

                  <p className="text-sm font-bold text-blue-950">
                    タイムテーブル
                  </p>

                  <p className="mt-4 text-4xl font-bold text-blue-950">確認</p>

                  <p className="mt-2 text-xs text-slate-500">
                    出演順・時間を確認
                  </p>
                </div>

                <span className="mt-10 text-2xl text-slate-400">›</span>
              </div>
            </Card>
          </Link>

          <Link href="/notices">
            <Card
              tone="purple"
              className="h-full cursor-pointer hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-xl">
                    📣
                  </div>

                  <p className="text-sm font-bold text-blue-950">
                    未読のお知らせ
                  </p>

                  <p className="mt-4 text-4xl font-bold text-blue-950">
                    {isExecutive ? "3" : "2"}
                    <span className="ml-1 text-base">件</span>
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    重要なお知らせがあります
                  </p>
                </div>

                <span className="mt-10 text-2xl text-slate-400">›</span>
              </div>
            </Card>
          </Link>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-blue-950">お知らせ</h2>

              <Link
                href="/notices"
                className="text-sm font-semibold text-blue-600"
              >
                すべて見る
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {notices.map((notice) => (
                <div key={notice.title} className="flex gap-3 py-4">
                  <StatusBadge tone={notice.tone}>{notice.label}</StatusBadge>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-blue-950">
                        {notice.title}
                      </p>

                      <p className="shrink-0 text-xs text-slate-400">
                        {notice.date}
                      </p>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {notice.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-blue-950">
                {isExecutive ? "今後のスケジュール" : "自分の申請・提出状況"}
              </h2>

              <Link
                href="/applications"
                className="text-sm font-semibold text-blue-600"
              >
                すべて見る
              </Link>
            </div>

            {isExecutive ? (
              <div className="divide-y divide-slate-100">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.title}
                    className="grid grid-cols-[80px_64px_1fr] items-center gap-3 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-600">
                      {schedule.date}
                    </p>

                    <StatusBadge tone={schedule.tone}>
                      {schedule.label}
                    </StatusBadge>

                    <p className="font-semibold text-blue-950">
                      {schedule.title}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Link
                  href="/applications"
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-blue-950">
                      ライブ / 合宿申請
                    </p>
                    <StatusBadge tone="green">提出済み</StatusBadge>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">夏合宿 2025</p>
                </Link>

                <Link
                  href="/payment"
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-blue-950">支払い状況</p>
                    <StatusBadge tone="orange">未報告</StatusBadge>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    支払い状況を確認してください
                  </p>
                </Link>

                <Link
                  href="/rooms"
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-blue-950">防音室予約</p>
                    <StatusBadge tone="purple">予約希望中</StatusBadge>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    希望日時：5/29（木）18:00〜20:00
                  </p>
                </Link>
              </div>
            )}
          </Card>
        </section>

        {isExecutive && (
          <section className="grid gap-4 lg:grid-cols-2">
            <Card tone="blue">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600">
                    幹部メニュー
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-blue-950">
                    アカウント発行申請の確認
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    新規メンバーから届いたアカウント作成申請を確認し、
                    承認または却下できます。
                  </p>
                </div>

                <Link
                  href="/admin/account-requests"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                >
                  申請管理を開く
                </Link>
              </div>
            </Card>

            <Card tone="green">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    支払い管理
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-blue-950">
                    支払い状況の確認
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    イベントごとの支払い対象者を生成し、報告状況を確認できます。
                  </p>
                </div>

                <Link
                  href="/admin/payments"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  支払い管理を開く
                </Link>
              </div>
            </Card>
          </section>
        )}

        <Card>
          <h2 className="mb-4 text-lg font-bold text-blue-950">
            クイックメニュー
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Card
                  tone={action.tone}
                  className="h-full cursor-pointer text-center hover:-translate-y-0.5"
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                    {action.icon}
                  </div>

                  <p className="font-bold text-blue-950">{action.title}</p>

                  <p className="mt-1 text-xs text-slate-500">
                    {action.description}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white px-2 py-2 shadow-lg md:hidden">
        <div className="grid grid-cols-5 text-center text-xs font-semibold">
          <Link href="/" className="text-blue-600">
            <div className="text-xl">⌂</div>
            ホーム
          </Link>

          <Link href="/applications" className="text-slate-500">
            <div className="text-xl">□</div>
            申請
          </Link>

          <Link href="/payment" className="text-slate-500">
            <div className="text-xl">¥</div>
            支払い
          </Link>

          <Link href="/notices" className="text-slate-500">
            <div className="text-xl">♢</div>
            お知らせ
          </Link>

          <Link
            href={isExecutive ? "/admin/account-requests" : "/profile"}
            className="text-slate-500"
          >
            <div className="text-xl">☰</div>
            {isExecutive ? "管理" : "メニュー"}
          </Link>
        </div>
      </nav>
    </main>
  );
}