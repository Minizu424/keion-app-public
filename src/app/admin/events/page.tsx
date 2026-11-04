"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  archiveApplicationEvent,
  closeApplicationEvent,
  createApplicationEvent,
  getApplicationEvents,
  isApplicationEventClosed,
  reopenApplicationEvent,
  type ApplicationEvent,
  type ApplicationEventType,
} from "@/lib/repositories/eventsRepository";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SelectBox } from "@/components/ui/SelectBox";
import { StatusBadge } from "@/components/ui/StatusBadge";

type EventFilter = "all" | ApplicationEventType;

const eventTypeOptions: { label: string; value: ApplicationEventType }[] = [
  { label: "通常ライブ", value: "live" },
  { label: "合宿ライブ", value: "camp_live" },
  { label: "合宿参加申請", value: "camp" },
];

const filterOptions: { label: string; value: EventFilter }[] = [
  { label: "すべて", value: "all" },
  { label: "通常ライブ", value: "live" },
  { label: "合宿ライブ", value: "camp_live" },
  { label: "合宿参加申請", value: "camp" },
];

function canManageEvents(member: Member): boolean {
  return member.role === "executive" || member.role === "admin";
}

function getEventTypeLabel(type: ApplicationEventType): string {
  switch (type) {
    case "live":
      return "通常ライブ";
    case "camp_live":
      return "合宿ライブ";
    case "camp":
      return "合宿参加申請";
  }
}

function getEventTypeTone(
  type: ApplicationEventType
): "blue" | "orange" | "purple" {
  switch (type) {
    case "live":
      return "blue";
    case "camp_live":
      return "orange";
    case "camp":
      return "purple";
  }
}

function getEventStatusLabel(event: ApplicationEvent): string {
  if (event.status === "closed") {
    return "申請終了";
  }

  if (event.status === "archived") {
    return "アーカイブ";
  }

  if (event.status === "open" && isApplicationEventClosed(event)) {
    return "締切済み";
  }

  if (event.status === "open") {
    return "申請受付中";
  }

  return "下書き";
}

function getEventStatusTone(
  event: ApplicationEvent
): "gray" | "blue" | "green" | "orange" {
  if (event.status === "closed") {
    return "green";
  }

  if (event.status === "archived") {
    return "gray";
  }

  if (event.status === "open" && isApplicationEventClosed(event)) {
    return "orange";
  }

  if (event.status === "open") {
    return "blue";
  }

  return "gray";
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

function formatDateTime(timestamp: ApplicationEvent["applicationEndAt"]): string {
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

function dateInputToDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

function dateTimeInputToDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultApplicationEndInputValue(): string {
  const now = new Date();

  now.setDate(now.getDate() + 7);
  now.setHours(23, 59, 0, 0);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export default function AdminEventsPage() {
  const router = useRouter();

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ApplicationEventType>("live");
  const [venue, setVenue] = useState("");
  const [eventStartDate, setEventStartDate] = useState(getTodayDateInputValue());
  const [eventEndDate, setEventEndDate] = useState("");
  const [applicationStartAt, setApplicationStartAt] = useState("");
  const [applicationEndAt, setApplicationEndAt] = useState(
    getDefaultApplicationEndInputValue()
  );

  const [filter, setFilter] = useState<EventFilter>("all");
  const [searchWord, setSearchWord] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const filteredEvents = useMemo(() => {
    const normalizedSearchWord = searchWord.trim().toLowerCase();

    return events.filter((event) => {
      const matchesFilter = filter === "all" || event.type === filter;

      const matchesSearch =
        normalizedSearchWord.length === 0 ||
        event.title.toLowerCase().includes(normalizedSearchWord) ||
        event.venue.toLowerCase().includes(normalizedSearchWord);

      return matchesFilter && matchesSearch;
    });
  }, [events, filter, searchWord]);

  async function loadEvents(): Promise<void> {
    setErrorMessage("");

    try {
      const eventData = await getApplicationEvents();
      setEvents(eventData);
    } catch (error) {
      console.error(error);
      setErrorMessage("イベント一覧を読み込めませんでした。");
    }
  }

  function resetForm(): void {
    setTitle("");
    setType("live");
    setVenue("");
    setEventStartDate(getTodayDateInputValue());
    setEventEndDate("");
    setApplicationStartAt("");
    setApplicationEndAt(getDefaultApplicationEndInputValue());
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      setErrorMessage("");

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

        if (!canManageEvents(memberData)) {
          router.push("/");
          return;
        }

        setCurrentMember(memberData);
        await loadEvents();
      } catch (error) {
        console.error(error);
        setErrorMessage("イベント管理ページの読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleCreateEvent(): Promise<void> {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setErrorMessage("イベント名を入力してください。");
      return;
    }

    if (!eventStartDate) {
      setErrorMessage("開催日を入力してください。");
      return;
    }

    if (!applicationEndAt) {
      setErrorMessage("申請締切を入力してください。");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await createApplicationEvent({
        title: trimmedTitle,
        type,
        venue: venue.trim(),
        eventStartDate: dateInputToDate(eventStartDate),
        eventEndDate: eventEndDate
          ? dateInputToDate(eventEndDate)
          : dateInputToDate(eventStartDate),
        applicationStartAt: dateTimeInputToDate(applicationStartAt),
        applicationEndAt: dateTimeInputToDate(applicationEndAt),
        status: "open",
      });

      await loadEvents();
      resetForm();
      setMessage("イベントを追加しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("イベントの追加に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCloseEvent(event: ApplicationEvent): Promise<void> {
    const ok = window.confirm(
      `${event.title} の申請受付を終了しますか？\n\n終了後、このライブはタイムテーブル作成の対象になります。`
    );

    if (!ok) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await closeApplicationEvent(event.id);
      await loadEvents();
      setMessage("申請受付を終了しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("申請受付の終了に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReopenEvent(event: ApplicationEvent): Promise<void> {
    const ok = window.confirm(`${event.title} の申請受付を再開しますか？`);

    if (!ok) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await reopenApplicationEvent(event.id);
      await loadEvents();
      setMessage("申請受付を再開しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("申請受付の再開に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveEvent(event: ApplicationEvent): Promise<void> {
    const ok = window.confirm(
      `${event.title} をアーカイブしますか？\n\n通常の一覧や申請対象から外したい場合だけ実行してください。`
    );

    if (!ok) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await archiveApplicationEvent(event.id);
      await loadEvents();
      setMessage("イベントをアーカイブしました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("イベントのアーカイブに失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <p className="text-sm font-semibold text-slate-500">
          イベント管理を読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-600">Event Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-blue-950">
            イベント管理
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            ライブや合宿ライブを追加し、申請受付の終了を管理します。
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card>
            <h2 className="text-lg font-bold text-blue-950">
              イベントを追加
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              申請対象にしたいライブ・合宿イベントを作成します。
            </p>

            <div className="mt-5 space-y-4">
              <Input
                label="イベント名"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例：6月ライブ"
              />

              <SelectBox
                label="イベント種別"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as ApplicationEventType)
                }
                options={eventTypeOptions}
              />

              <Input
                label="会場"
                value={venue}
                onChange={(event) => setVenue(event.target.value)}
                placeholder="例：メインホール"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="開催日"
                  type="date"
                  value={eventStartDate}
                  onChange={(event) => setEventStartDate(event.target.value)}
                />

                <Input
                  label="終了日"
                  type="date"
                  value={eventEndDate}
                  onChange={(event) => setEventEndDate(event.target.value)}
                  helperText="1日開催なら空欄でOK"
                />
              </div>

              <Input
                label="申請開始日時"
                type="datetime-local"
                value={applicationStartAt}
                onChange={(event) => setApplicationStartAt(event.target.value)}
                helperText="空欄なら今すぐ開始扱いで運用できます"
              />

              <Input
                label="申請締切日時"
                type="datetime-local"
                value={applicationEndAt}
                onChange={(event) => setApplicationEndAt(event.target.value)}
              />

              <Button
                onClick={handleCreateEvent}
                disabled={isSaving}
                className="w-full"
              >
                イベントを追加
              </Button>
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <div className="grid gap-4 lg:grid-cols-[240px_1fr_auto] lg:items-end">
                <SelectBox
                  label="種別"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as EventFilter)
                  }
                  options={filterOptions}
                  placeholder=""
                />

                <Input
                  label="検索"
                  value={searchWord}
                  onChange={(event) => setSearchWord(event.target.value)}
                  placeholder="イベント名・会場で検索"
                />

                <Button
                  variant="outline"
                  onClick={() => {
                    setFilter("all");
                    setSearchWord("");
                  }}
                >
                  リセット
                </Button>
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-blue-950">
                    イベント一覧
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {events.length}件中 {filteredEvents.length}件を表示
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={loadEvents}
                  disabled={isSaving}
                >
                  更新
                </Button>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="font-semibold text-blue-950">
                    イベントがありません
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone={getEventTypeTone(event.type)}>
                              {getEventTypeLabel(event.type)}
                            </StatusBadge>

                            <StatusBadge tone={getEventStatusTone(event)}>
                              {getEventStatusLabel(event)}
                            </StatusBadge>
                          </div>

                          <h3 className="mt-2 text-lg font-bold text-blue-950">
                            {event.title}
                          </h3>

                          <dl className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                            <div>
                              <dt className="font-semibold text-slate-500">
                                開催日
                              </dt>
                              <dd className="mt-0.5 text-blue-950">
                                {formatDate(event.eventStartDate)}
                              </dd>
                            </div>

                            <div>
                              <dt className="font-semibold text-slate-500">
                                会場
                              </dt>
                              <dd className="mt-0.5 text-blue-950">
                                {event.venue || "-"}
                              </dd>
                            </div>

                            <div>
                              <dt className="font-semibold text-slate-500">
                                申請締切
                              </dt>
                              <dd className="mt-0.5 text-blue-950">
                                {formatDateTime(event.applicationEndAt)}
                              </dd>
                            </div>

                            <div>
                              <dt className="font-semibold text-slate-500">
                                ID
                              </dt>
                              <dd className="mt-0.5 break-all text-blue-950">
                                {event.id}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {event.status === "open" ? (
                            <Button
                              variant="outline"
                              disabled={isSaving}
                              onClick={() => handleCloseEvent(event)}
                            >
                              申請終了
                            </Button>
                          ) : event.status === "closed" ? (
                            <Button
                              variant="outline"
                              disabled={isSaving}
                              onClick={() => handleReopenEvent(event)}
                            >
                              再開
                            </Button>
                          ) : null}

                          {event.status !== "archived" && (
                            <Button
                              variant="outline"
                              disabled={isSaving}
                              onClick={() => handleArchiveEvent(event)}
                            >
                              アーカイブ
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}