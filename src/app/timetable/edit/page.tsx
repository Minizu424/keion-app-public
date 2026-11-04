"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  closeApplicationEvent,
  getLiveEventsForTimetableEdit,
  isApplicationEventClosed,
  type ApplicationEvent,
} from "@/lib/repositories/eventsRepository";
import {
  getApplicationsByEventId,
  type Application,
} from "@/lib/repositories/applicationsRepository";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import {
  getTimetableByEventId,
  saveTimetable,
} from "@/lib/repositories/timetablesRepository";
import type { TimetableRow, TimetableStatus } from "@/types/timetable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SelectBox } from "@/components/ui/SelectBox";
import { StatusBadge } from "@/components/ui/StatusBadge";

function canManageTimetable(member: Member): boolean {
  return member.role === "executive" || member.role === "admin";
}

function createRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timeToMinutes(time: string): number | null {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function minutesToTime(totalMinutes: number): string {
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = timeToMinutes(startTime);

  if (startMinutes === null) {
    return "";
  }

  return minutesToTime(startMinutes + durationMinutes);
}

function recalculateRowTimes(
  rows: TimetableRow[],
  fixedStartTime: string
): TimetableRow[] {
  if (rows.length === 0) {
    return rows;
  }

  const baseStartMinutes = timeToMinutes(fixedStartTime) ?? 600;

  let currentStartMinutes = baseStartMinutes;

  return rows.map((row) => {
    const startTime = minutesToTime(currentStartMinutes);
    const endTime = minutesToTime(currentStartMinutes + row.durationMinutes);

    currentStartMinutes += row.durationMinutes;

    return {
      ...row,
      startTime,
      endTime,
    };
  });
}

function getRowColorClass(row: TimetableRow, index: number): string {
  if (row.type === "custom") {
    return "border-orange-300 bg-orange-50/80 shadow-orange-100";
  }

  const colorIndex = index % 5;

  switch (colorIndex) {
    case 0:
      return "border-blue-300 bg-blue-50/70 shadow-blue-100";
    case 1:
      return "border-emerald-300 bg-emerald-50/70 shadow-emerald-100";
    case 2:
      return "border-violet-300 bg-violet-50/70 shadow-violet-100";
    case 3:
      return "border-sky-300 bg-sky-50/70 shadow-sky-100";
    default:
      return "border-indigo-300 bg-indigo-50/70 shadow-indigo-100";
  }
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

function getEventStatusLabel(event: ApplicationEvent): string {
  if (event.status === "closed") {
    return "申請終了";
  }

  if (event.status === "open" && isApplicationEventClosed(event)) {
    return "締切済み";
  }

  if (event.status === "open") {
    return "申請受付中";
  }

  if (event.status === "archived") {
    return "アーカイブ";
  }

  return "下書き";
}

function getEventStatusTone(
  event: ApplicationEvent
): "gray" | "blue" | "green" | "orange" | "red" {
  if (event.status === "closed") {
    return "green";
  }

  if (event.status === "open" && isApplicationEventClosed(event)) {
    return "orange";
  }

  if (event.status === "open") {
    return "blue";
  }

  if (event.status === "archived") {
    return "gray";
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

function formatApplicationSongs(application: Application): string {
  if (application.songs.length === 0) {
    return "曲未定";
  }

  return application.songs
    .map((song) => {
      if (song.artist) {
        return `${song.title} / ${song.artist}`;
      }

      return song.title;
    })
    .join("、");
}

function formatRowSongs(row: TimetableRow): string {
  if (row.songs.length === 0) {
    return row.type === "band" ? "曲未定" : "-";
  }

  return row.songs
    .map((song) => {
      if (song.artist) {
        return `${song.title} / ${song.artist}`;
      }

      return song.title;
    })
    .join("、");
}

function createBandRow(application: Application): TimetableRow {
  const startTime = application.preferredStartTime || "";
  const durationMinutes = application.requiredMinutes || 30;

  return {
    id: createRowId(),
    type: "band",
    title: application.bandName,
    applicationId: application.id,
    bandName: application.bandName,
    songs: application.songs,
    memberNames: application.members.map((member) => member.name),
    memberStudentIds: application.members.map((member) => member.studentId ?? ""),
    startTime,
    durationMinutes,
    endTime: startTime ? calculateEndTime(startTime, durationMinutes) : "",
    note: application.note,
  };
}

function createCsv(rows: TimetableRow[]): string {
  const headers = [
    "順番",
    "種別",
    "項目名",
    "開始時刻",
    "所要時間",
    "終了時刻",
    "曲",
    "メンバー",
    "備考",
  ];

  const body = rows.map((row, index) => [
    String(index + 1),
    row.type === "band" ? "バンド" : "セル",
    row.title,
    row.startTime,
    String(row.durationMinutes),
    row.endTime,
    row.songs
      .map((song) =>
        song.artist ? `${song.title} / ${song.artist}` : song.title
      )
      .join(" / "),
    row.memberNames.join(" / "),
    row.note,
  ]);

  const escapeCsvCell = (value: string) => {
    const escapedValue = value.replace(/"/g, '""');
    return `"${escapedValue}"`;
  };

  return [headers, ...body]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

function downloadCsv(filename: string, csv: string): void {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function reorderRows(
  rows: TimetableRow[],
  sourceId: string,
  destinationId: string
): TimetableRow[] {
  const sourceIndex = rows.findIndex((row) => row.id === sourceId);
  const destinationIndex = rows.findIndex((row) => row.id === destinationId);

  if (sourceIndex === -1 || destinationIndex === -1) {
    return rows;
  }

  const nextRows = [...rows];
  const [movedRow] = nextRows.splice(sourceIndex, 1);
  nextRows.splice(destinationIndex, 0, movedRow);

  return nextRows;
}

function createTransparentDragImage(): HTMLImageElement {
  const image = new Image();

  image.src =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  return image;
}

export default function TimetableEditPage() {
  const router = useRouter();

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [approvedApplications, setApprovedApplications] = useState<
    Application[]
  >([]);
  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [status, setStatus] = useState<TimetableStatus>("draft");
  const [isPublished, setIsPublished] = useState(false);

  const [newCellTitle, setNewCellTitle] = useState("転換");
  const [newCellDuration, setNewCellDuration] = useState("10");

  const [draggingRowId, setDraggingRowId] = useState("");
  const [dragOverRowId, setDragOverRowId] = useState("");

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedEvent = useMemo(() => {
    return events.find((event) => event.id === selectedEventId) ?? null;
  }, [events, selectedEventId]);

  const canEditSelectedEvent = useMemo(() => {
    return selectedEvent ? isApplicationEventClosed(selectedEvent) : false;
  }, [selectedEvent]);

  const addedApplicationIds = useMemo(() => {
    return new Set(
      rows
        .map((row) => row.applicationId)
        .filter((applicationId) => applicationId.length > 0)
    );
  }, [rows]);

  const candidateApplications = useMemo(() => {
    return approvedApplications.filter(
      (application) => !addedApplicationIds.has(application.id)
    );
  }, [approvedApplications, addedApplicationIds]);

  const totalDurationMinutes = useMemo(() => {
    return rows.reduce((sum, row) => sum + row.durationMinutes, 0);
  }, [rows]);

  const firstStartTime = rows[0]?.startTime || "";
  const lastEndTime = rows[rows.length - 1]?.endTime || "";

  async function loadEvents(): Promise<ApplicationEvent[]> {
    return getLiveEventsForTimetableEdit();
  }

  async function loadEventData(eventId: string): Promise<void> {
    setIsEventLoading(true);
    setErrorMessage("");
    setMessage("");

    try {
      const [applications, timetable] = await Promise.all([
        getApplicationsByEventId(eventId),
        getTimetableByEventId(eventId),
      ]);

      const approvedApplicationData = applications.filter(
        (application) => application.status === "approved"
      );

      setApprovedApplications(approvedApplicationData);

      if (timetable) {
        setRows(timetable.rows);
        setStatus(timetable.status);
        setIsPublished(timetable.isPublished);
      } else {
        setRows([]);
        setStatus("draft");
        setIsPublished(false);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("イベント情報の読み込みに失敗しました。");
    } finally {
      setIsEventLoading(false);
    }
  }

  async function refreshEvents(nextSelectedEventId?: string): Promise<void> {
    const eventData = await loadEvents();
    setEvents(eventData);

    const nextEventId =
      nextSelectedEventId || selectedEventId || eventData[0]?.id || "";

    setSelectedEventId(nextEventId);

    if (nextEventId) {
      await loadEventData(nextEventId);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsInitialLoading(true);
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

        setCurrentMember(memberData);

        if (!canManageTimetable(memberData)) {
          setIsInitialLoading(false);
          return;
        }

        const eventData = await loadEvents();
        setEvents(eventData);

        const firstEventId = eventData[0]?.id ?? "";
        setSelectedEventId(firstEventId);

        if (firstEventId) {
          await loadEventData(firstEventId);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage("画面の読み込みに失敗しました。");
      } finally {
        setIsInitialLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleChangeEvent(eventId: string): Promise<void> {
    setSelectedEventId(eventId);
    await loadEventData(eventId);
  }

  async function handleCloseEvent(): Promise<void> {
    if (!selectedEvent) {
      return;
    }

    const ok = window.confirm(
      `${selectedEvent.title} の申請受付を終了しますか？\n\n終了後、このライブでタイムテーブルを作成できるようになります。`
    );

    if (!ok) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await closeApplicationEvent(selectedEvent.id);
      await refreshEvents(selectedEvent.id);
      setMessage("申請受付を終了しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("申請受付の終了に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  function handleAddBand(application: Application): void {
    if (!canEditSelectedEvent) {
      setErrorMessage("申請終了後にタイムテーブルを作成できます。");
      return;
    }

    setRows((currentRows) => {
      const nextRows = [...currentRows, createBandRow(application)];
      const fixedStartTime =
        currentRows[0]?.startTime || nextRows[0]?.startTime || "10:00";

      return recalculateRowTimes(nextRows, fixedStartTime);
    });
  }

  function handleAddCustomCell(): void {
    if (!canEditSelectedEvent) {
      setErrorMessage("申請終了後にタイムテーブルを作成できます。");
      return;
    }

    const title = newCellTitle.trim();
    const durationMinutes = Number(newCellDuration);

    if (!title) {
      setErrorMessage("セル名を入力してください。");
      return;
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setErrorMessage("所要時間を正しく入力してください。");
      return;
    }

    const previousRow = rows[rows.length - 1];
    const startTime = previousRow?.endTime || previousRow?.startTime || "";

    const customRow: TimetableRow = {
      id: createRowId(),
      type: "custom",
      title,
      applicationId: "",
      bandName: "",
      songs: [],
      memberNames: [],
      memberStudentIds: [],
      startTime,
      durationMinutes,
      endTime: startTime ? calculateEndTime(startTime, durationMinutes) : "",
      note: "",
    };

    setRows((currentRows) => {
      const nextRows = [...currentRows, customRow];
      const fixedStartTime =
        currentRows[0]?.startTime || nextRows[0]?.startTime || "10:00";

      return recalculateRowTimes(nextRows, fixedStartTime);
    });

    setNewCellTitle("転換");
    setNewCellDuration("10");
    setErrorMessage("");
  }

  function handleUpdateRow(
    rowId: string,
    updates: Partial<TimetableRow>
  ): void {
    setRows((currentRows) => {
      const firstRowId = currentRows[0]?.id;

      const fixedStartTime =
        rowId === firstRowId && updates.startTime !== undefined
          ? updates.startTime
          : currentRows[0]?.startTime || "10:00";

      const nextRows = currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          ...updates,
        };
      });

      if (
        updates.startTime !== undefined ||
        updates.durationMinutes !== undefined
      ) {
        return recalculateRowTimes(nextRows, fixedStartTime);
      }

      return nextRows;
    });
  }

  function handleMoveRow(rowId: string, direction: "up" | "down"): void {
    setRows((currentRows) => {
      const index = currentRows.findIndex((row) => row.id === rowId);

      if (index === -1) {
        return currentRows;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= currentRows.length) {
        return currentRows;
      }

      const fixedStartTime = currentRows[0]?.startTime || "10:00";

      const nextRows = [...currentRows];
      const [targetRow] = nextRows.splice(index, 1);
      nextRows.splice(targetIndex, 0, targetRow);

      return recalculateRowTimes(nextRows, fixedStartTime);
    });
  }

  function handleRemoveRow(rowId: string): void {
    const ok = window.confirm("この行を削除しますか？");

    if (!ok) {
      return;
    }

    setRows((currentRows) => {
      const fixedStartTime = currentRows[0]?.startTime || "10:00";
      const nextRows = currentRows.filter((row) => row.id !== rowId);

      return recalculateRowTimes(nextRows, fixedStartTime);
    });
  }

  function handleAutoArrange(): void {
    setRows((currentRows) => {
      const fixedStartTime = currentRows[0]?.startTime || "10:00";

      return recalculateRowTimes(currentRows, fixedStartTime);
    });
  }

  async function handleSave(publish: boolean): Promise<void> {
    if (!selectedEvent) {
      setErrorMessage("イベントを選択してください。");
      return;
    }

    if (!canEditSelectedEvent) {
      setErrorMessage("申請終了後にタイムテーブルを作成できます。");
      return;
    }

    if (rows.length === 0) {
      setErrorMessage("タイムテーブルに1件以上追加してください。");
      return;
    }

    const hasInvalidRow = rows.some(
      (row) => !row.title || !row.startTime || row.durationMinutes <= 0
    );

    if (hasInvalidRow) {
      setErrorMessage("項目名、開始時刻、所要時間が未入力の行があります。");
      return;
    }

    if (publish) {
      const ok = window.confirm(
        "このタイムテーブルを一般メンバーに反映しますか？"
      );

      if (!ok) {
        return;
      }
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const nextStatus: TimetableStatus = publish ? "published" : "draft";

      await saveTimetable({
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        status: nextStatus,
        isPublished: publish,
        rows,
      });

      setStatus(nextStatus);
      setIsPublished(publish);
      setMessage(
        publish
          ? "タイムテーブルを一般メンバー画面に反映しました。"
          : "下書き保存しました。"
      );
    } catch (error) {
      console.error(error);
      setErrorMessage("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportCsv(): void {
    if (!selectedEvent) {
      return;
    }

    const csv = createCsv(rows);
    downloadCsv(`${selectedEvent.title}_タイムテーブル.csv`, csv);
  }

  function handleDragStart(
    event: DragEvent<HTMLDivElement>,
    rowId: string
  ): void {
    if (!canEditSelectedEvent) {
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", rowId);
    event.dataTransfer.setDragImage(createTransparentDragImage(), 0, 0);

    setDraggingRowId(rowId);
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
    rowId: string
  ): void {
    if (!canEditSelectedEvent || !draggingRowId) {
      return;
    }

    event.preventDefault();

    if (draggingRowId === rowId) {
      return;
    }

    setRows((currentRows) => {
      const fixedStartTime = currentRows[0]?.startTime || "10:00";
      const nextRows = reorderRows(currentRows, draggingRowId, rowId);

      return recalculateRowTimes(nextRows, fixedStartTime);
    });

    setDragOverRowId(rowId);
  }

  function handleDrop(): void {
    setDraggingRowId("");
    setDragOverRowId("");
  }

  function handleDragEnd(): void {
    setDraggingRowId("");
    setDragOverRowId("");
  }

  if (isInitialLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <p className="text-sm font-semibold text-slate-500">
          タイムテーブル作成画面を読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember) {
    return null;
  }

  if (!canManageTimetable(currentMember)) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <div className="mx-auto max-w-3xl">
          <Card>
            <h1 className="text-xl font-bold text-blue-950">
              権限がありません
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              タイムテーブル作成ページは幹部・管理者のみ利用できます。
            </p>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Timetable Edit
            </p>
            <h1 className="mt-1 text-2xl font-bold text-blue-950">
              タイムテーブル作成
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              申請終了後のライブを選択し、承認済みバンドからタイムテーブルを作成します。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={handleExportCsv}
            >
              CSV出力
            </Button>

            <Button
              variant="outline"
              disabled={isSaving || rows.length === 0}
              onClick={() => handleSave(false)}
            >
              下書き保存
            </Button>

            <Button
              disabled={isSaving || rows.length === 0}
              onClick={() => handleSave(true)}
            >
              反映する
            </Button>
          </div>
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <SelectBox
                  label="タイムテーブルを作るライブ"
                  value={selectedEventId}
                  onChange={(event) => handleChangeEvent(event.target.value)}
                  options={events.map((event) => ({
                    label: `${event.title}（${getEventTypeLabel(event.type)} / ${getEventStatusLabel(event)}）`,
                    value: event.id,
                  }))}
                  placeholder="ライブを選択してください"
                />

                <Button
                  variant="outline"
                  disabled={!selectedEventId || isEventLoading}
                  onClick={() =>
                    selectedEventId && loadEventData(selectedEventId)
                  }
                  className="w-full lg:w-auto"
                >
                  再読み込み
                </Button>
              </div>

              {selectedEvent && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                  <StatusBadge tone={getEventStatusTone(selectedEvent)}>
                    {getEventStatusLabel(selectedEvent)}
                  </StatusBadge>

                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    種別：{getEventTypeLabel(selectedEvent.type)}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    開催日：{formatDate(selectedEvent.eventStartDate)}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    申請締切：{formatDateTime(selectedEvent.applicationEndAt)}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    公開状態：{isPublished ? "反映済み" : "未反映"}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    保存状態：{status === "published" ? "公開済み" : "下書き"}
                  </span>
                </div>
              )}

              {selectedEvent && !canEditSelectedEvent && (
                <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-sm font-semibold text-orange-800">
                    このライブはまだ申請受付中です。申請を終了するとタイムテーブルを作成できます。
                  </p>

                  {selectedEvent.status === "open" && (
                    <Button
                      className="mt-3"
                      disabled={isSaving}
                      onClick={handleCloseEvent}
                    >
                      このライブの申請を終了する
                    </Button>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-blue-950">
                    タイムテーブル
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    先頭の開始時刻を基準に、順番と所要時間から全体の時間を自動計算します。
                  </p>
                </div>

                <Button
                  variant="outline"
                  disabled={rows.length === 0 || !canEditSelectedEvent}
                  onClick={handleAutoArrange}
                >
                  自動整列
                </Button>
              </div>

              {isEventLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                  読み込み中...
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="font-bold text-blue-950">
                    まだタイムテーブルに追加されていません
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    右側の承認済みバンドか、自由セルを追加してください。
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rows.map((row, index) => {
                    const isDragOver = dragOverRowId === row.id;
                    const isDragging = draggingRowId === row.id;
                    const isBand = row.type === "band";
                    const isFirstRow = index === 0;

                    return (
                      <div
                        key={row.id}
                        onDragOver={(event) => handleDragOver(event, row.id)}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        className={[
                          "group rounded-xl border-2 px-3 py-2 shadow-md transition-all duration-500 ease-in-out",
                          getRowColorClass(row, index),
                          isDragOver
                            ? "scale-[1.015] border-blue-500 ring-4 ring-blue-100"
                            : "",
                          isDragging
                            ? "scale-[0.97] opacity-40"
                            : "translate-y-0 opacity-100",
                        ].join(" ")}
                      >
                        <div className="grid grid-cols-[36px_42px_minmax(240px,1fr)_132px_108px_132px_126px] items-center gap-2">
                          <div
                            draggable={canEditSelectedEvent}
                            onDragStart={(event) =>
                              handleDragStart(event, row.id)
                            }
                            onDragEnd={handleDragEnd}
                            className={[
                              "flex h-12 select-none items-center justify-center rounded-lg border text-slate-400 transition",
                              canEditSelectedEvent
                                ? "cursor-grab border-slate-200 bg-white/80 hover:border-blue-300 hover:bg-white active:cursor-grabbing"
                                : "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50",
                            ].join(" ")}
                            title="ドラッグして順番を変更"
                          >
                            ⋮⋮
                          </div>

                          <div className="text-center">
                            <p className="text-xs font-bold text-slate-400">
                              #{index + 1}
                            </p>

                            <div
                              className={[
                                "mt-1 flex h-8 w-8 items-center justify-center rounded-full text-base shadow-sm",
                                isBand
                                  ? "bg-white text-blue-600"
                                  : "bg-white text-orange-600",
                              ].join(" ")}
                              title={isBand ? "バンド" : "セル"}
                            >
                              {isBand ? "🎵" : "⏱️"}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <Input
                              label=""
                              value={row.title}
                              disabled={!canEditSelectedEvent}
                              onChange={(event) =>
                                handleUpdateRow(row.id, {
                                  title: event.target.value,
                                })
                              }
                              className="h-9 bg-white/80 font-bold text-blue-950"
                            />

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {formatRowSongs(row)}
                            </p>
                          </div>

                          <div>
                            <p className="mb-1 text-[11px] font-bold text-slate-500">
                              {isFirstRow ? "開始" : "開始（自動）"}
                            </p>
                            <Input
                              label=""
                              type="time"
                              value={row.startTime}
                              disabled={!canEditSelectedEvent || !isFirstRow}
                              onChange={(event) =>
                                handleUpdateRow(row.id, {
                                  startTime: event.target.value,
                                })
                              }
                              className={[
                                "h-9 bg-white/80",
                                !isFirstRow ? "text-slate-500" : "",
                              ].join(" ")}
                            />
                          </div>

                          <div>
                            <p className="mb-1 text-[11px] font-bold text-slate-500">
                              所要時間
                            </p>
                            <div className="flex items-center gap-1">
                              <Input
                                label=""
                                type="number"
                                min={1}
                                value={String(row.durationMinutes)}
                                disabled={!canEditSelectedEvent}
                                onChange={(event) =>
                                  handleUpdateRow(row.id, {
                                    durationMinutes: Number(event.target.value),
                                  })
                                }
                                className="h-9 bg-white/80"
                              />

                              <span className="text-xs font-bold text-slate-500">
                                分
                              </span>
                            </div>
                          </div>

                          <div>
                            <p className="mb-1 text-[11px] font-bold text-slate-500">
                              終了
                            </p>
                            <Input
                              label=""
                              value={row.endTime}
                              readOnly
                              className="h-9 bg-white/80 font-semibold"
                            />
                          </div>

                          <div className="flex justify-end gap-1 pt-5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={index === 0 || !canEditSelectedEvent}
                              onClick={() => handleMoveRow(row.id, "up")}
                            >
                              ↑
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                index === rows.length - 1 ||
                                !canEditSelectedEvent
                              }
                              onClick={() => handleMoveRow(row.id, "down")}
                            >
                              ↓
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canEditSelectedEvent}
                              onClick={() => handleRemoveRow(row.id)}
                            >
                              削除
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <aside className="space-y-4">
            <div className="sticky top-5 space-y-4">
              <Card tone="blue" className="p-4">
                <h2 className="text-lg font-bold text-blue-950">時間</h2>

                <dl className="mt-4 grid gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">追加済み</dt>
                    <dd className="font-bold text-blue-950">{rows.length}件</dd>
                  </div>

                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">合計時間</dt>
                    <dd className="font-bold text-blue-950">
                      {totalDurationMinutes}分
                    </dd>
                  </div>

                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">開始</dt>
                    <dd className="font-bold text-blue-950">
                      {firstStartTime || "-"}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">終了予定</dt>
                    <dd className="font-bold text-blue-950">
                      {lastEndTime || "-"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {rows.map((row, index) => (
                    <div
                      key={row.id}
                      className={[
                        "rounded-xl border-2 px-3 py-2 shadow-sm",
                        getRowColorClass(row, index),
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 text-xs font-bold text-slate-400">
                          #{index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-blue-950">
                            {row.startTime || "--:--"}
                          </p>
                          <p className="truncate text-xs text-slate-600">
                            {row.title}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h2 className="text-lg font-bold text-blue-950">
                  承認済みバンド
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  未追加の承認済みバンドだけ表示します。
                </p>

                <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {candidateApplications.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                      追加できる承認済みバンドはありません。
                    </div>
                  ) : (
                    candidateApplications.map((application) => (
                      <div
                        key={application.id}
                        className="rounded-xl border-2 border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-blue-950">
                              {application.bandName}
                            </p>

                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                              {formatApplicationSongs(application)}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-400">
                              {application.requiredMinutes || 30}分 /{" "}
                              {application.members.length}人
                            </p>
                          </div>

                          <Button
                            size="sm"
                            disabled={!canEditSelectedEvent}
                            onClick={() => handleAddBand(application)}
                          >
                            追加
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card tone="orange" className="p-4">
                <h2 className="text-lg font-bold text-blue-950">セル追加</h2>

                <div className="mt-4 space-y-3">
                  <Input
                    label="セル名"
                    value={newCellTitle}
                    disabled={!canEditSelectedEvent}
                    onChange={(event) => setNewCellTitle(event.target.value)}
                    placeholder="例：転換"
                  />

                  <Input
                    label="所要時間"
                    type="number"
                    min={1}
                    value={newCellDuration}
                    disabled={!canEditSelectedEvent}
                    onChange={(event) => setNewCellDuration(event.target.value)}
                  />

                  <Button
                    onClick={handleAddCustomCell}
                    className="w-full"
                    disabled={!canEditSelectedEvent}
                  >
                    セルを追加
                  </Button>
                </div>
              </Card>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}