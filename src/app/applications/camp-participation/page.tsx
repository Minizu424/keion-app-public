"use client";

import { Suspense, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getApplicationEventById,
  type ApplicationEvent,
} from "@/lib/repositories/eventsRepository";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import {
  getCampParticipationByEventAndUid,
  saveCampParticipation,
  type CampParticipationStatus,
} from "@/lib/repositories/campParticipationsRepository";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/Input";

function getStatusLabel(status: CampParticipationStatus): string {
  switch (status) {
    case "join":
      return "参加する";
    case "absent":
      return "不参加";
    case "undecided":
      return "未定";
  }
}

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

function CampParticipationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [event, setEvent] = useState<ApplicationEvent | null>(null);
  const [status, setStatus] = useState<CampParticipationStatus>("undecided");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      if (!eventId) {
        router.push("/applications");
        return;
      }

      try {
        const [member, selectedEvent] = await Promise.all([
          getMemberByUid(user.uid),
          getApplicationEventById(eventId),
        ]);

        if (!member || member.status !== "active") {
          router.push("/login");
          return;
        }

        if (!selectedEvent || selectedEvent.type !== "camp") {
          router.push("/applications");
          return;
        }

        const existingParticipation =
          await getCampParticipationByEventAndUid(eventId, user.uid);

        if (existingParticipation) {
          setStatus(existingParticipation.status);
          setNote(existingParticipation.note);
        }

        setCurrentMember(member);
        setEvent(selectedEvent);
      } catch (error) {
        console.error(error);
        setErrorMessage("合宿参加申請の読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [eventId, router]);

  async function handleSubmit() {
    if (!currentMember || !event) {
      setErrorMessage("ログイン情報またはイベント情報を取得できませんでした。");
      return;
    }

    setErrorMessage("");

    try {
      setIsSubmitting(true);

      await saveCampParticipation({
        eventId: event.id,
        uid: currentMember.uid,
        memberName: currentMember.name,
        status,
        note,
      });

      router.push("/applications");
    } catch (error) {
      console.error(error);
      setErrorMessage("合宿参加申請の保存に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">
          合宿参加申請を読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember || !event) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">

      <main className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
          <h1 className="text-2xl font-bold text-blue-950">
            合宿参加申請
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            合宿に参加するかどうかを選択してください。
          </p>
        </header>

        <div className="mx-auto max-w-4xl space-y-6 px-5 py-6 md:px-8">
          {errorMessage && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {errorMessage}
            </div>
          )}

          <Card>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-blue-950">
                  {event.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  会場：{event.venue || "-"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  日程：{formatDateRange(event)}
                </p>
              </div>

              <StatusBadge tone="orange">合宿</StatusBadge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(["join", "absent", "undecided"] as const).map((option) => {
                const isSelected = status === option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    className={[
                      "rounded-2xl border px-4 py-5 text-center transition",
                      isSelected
                        ? "border-blue-600 bg-blue-50 text-blue-950 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300",
                    ].join(" ")}
                  >
                    <p className="text-lg font-bold">
                      {getStatusLabel(option)}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <Input
                label="備考"
                name="note"
                value={note}
                onChange={(changeEvent) => setNote(changeEvent.target.value)}
                placeholder="例: 途中参加予定、遅れて到着予定など"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/applications")}
              >
                戻る
              </Button>

              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "保存中..." : "参加申請を保存する"}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function CampParticipationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm font-semibold text-slate-500">
            合宿参加申請を読み込み中...
          </p>
        </main>
      }
    >
      <CampParticipationPageContent />
    </Suspense>
  );
}