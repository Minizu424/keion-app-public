"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getOpenApplicationEvents,
  type ApplicationEvent,
} from "@/lib/repositories/eventsRepository";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

function formatDate(timestamp: ApplicationEvent["eventStartDate"]): string {
  if (!timestamp) {
    return "-";
  }

  return timestamp.toDate().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateRange(event: ApplicationEvent): string {
  const start = formatDate(event.eventStartDate);
  const end = formatDate(event.eventEndDate);

  if (start === "-" && end === "-") {
    return "-";
  }

  if (start === end || end === "-") {
    return start;
  }

  return `${start} 〜 ${end}`;
}

function formatDateTime(timestamp: ApplicationEvent["applicationStartAt"]): string {
  if (!timestamp) {
    return "-";
  }

  return timestamp.toDate().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventTypeLabel(type: ApplicationEvent["type"]): string {
  switch (type) {
    case "live":
      return "ライブ";
    case "camp":
      return "合宿";
    case "camp_live":
      return "合宿ライブ";
  }
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

export default function ApplicationsPage() {
  const router = useRouter();

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const member = await getMemberByUid(user.uid);

        if (!member || member.status !== "active") {
          router.push("/login");
          return;
        }

        const openEvents = await getOpenApplicationEvents();

        setCurrentMember(member);
        setEvents(openEvents);
      } catch (error) {
        console.error(error);
        setErrorMessage("申請可能なイベントの取得に失敗しました。");
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
          申請可能なイベントを読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">

      <main className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
          <h1 className="text-2xl font-bold text-blue-950">
            ライブ / 合宿申請
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            申請受付中のライブ・合宿を選択して、出演申請を開始します。
          </p>
          <p className="mt-2 text-xs text-slate-400">
            ログイン中：{currentMember.name}（{getUserDescription(currentMember)}）
          </p>
        </header>

        <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 md:px-8">
          {errorMessage && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {errorMessage}
            </div>
          )}

          <Card>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-blue-950">
                  申請可能なイベント
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  幹部が申請受付中にしたイベントのみ表示されます。
                </p>
              </div>

              <StatusBadge tone="blue">{events.length}件</StatusBadge>
            </div>

            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="font-semibold text-blue-950">
                  現在申請できるイベントはありません
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  申請受付が開始されると、ここに表示されます。
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <StatusBadge tone={event.type === "camp" ? "orange" : "blue"}>
                            {getEventTypeLabel(event.type)}
                          </StatusBadge>
                          <StatusBadge tone="green">受付中</StatusBadge>
                        </div>

                        <h3 className="text-lg font-bold text-blue-950">
                          {event.title}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          会場：{event.venue || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                      <p>
                        <span className="font-semibold text-blue-950">
                          開催日：
                        </span>
                        {formatDateRange(event)}
                      </p>
                      <p>
                        <span className="font-semibold text-blue-950">
                          申請開始：
                        </span>
                        {formatDateTime(event.applicationStartAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-blue-950">
                          申請締切：
                        </span>
                        {formatDateTime(event.applicationEndAt)}
                      </p>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <Link
                        href={
                          event.type === "camp"
                            ? `/applications/camp-participation?eventId=${event.id}`
                            : `/applications/new?eventId=${event.id}`
                        }
                      >
                        <Button>
                          {event.type === "camp" ? "合宿参加申請へ" : "申請する"}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}