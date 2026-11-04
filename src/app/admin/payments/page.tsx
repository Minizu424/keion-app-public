"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getApplicationEventsByType,
  type ApplicationEvent,
} from "@/lib/repositories/eventsRepository";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import {
  countPaymentStatuses,
  createPaymentTargetsFromApprovedApplications,
  getPaymentStatusLabel,
  getPaymentTargetsByEventId,
  updateManyPaymentStatuses,
  updatePaymentStatus,
} from "@/lib/repositories/paymentsRepository";
import type { PaymentStatus, PaymentTarget } from "@/types/payment";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SelectBox } from "@/components/ui/SelectBox";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PaymentStatusFilter = "all" | PaymentStatus;

type TimestampLike = {
  toDate: () => Date;
} | null;

const paymentStatusOptions: { label: string; value: PaymentStatusFilter }[] = [
  { label: "すべて", value: "all" },
  { label: "未報告", value: "unreported" },
  { label: "報告済み", value: "reported" },
  { label: "確認済み", value: "confirmed" },
  { label: "不足あり", value: "shortage" },
];

const updateStatusOptions: { label: string; value: PaymentStatus }[] = [
  { label: "未報告", value: "unreported" },
  { label: "報告済み", value: "reported" },
  { label: "確認済み", value: "confirmed" },
  { label: "不足あり", value: "shortage" },
];

function canManagePayments(member: Member): boolean {
  return member.role === "executive" || member.role === "admin";
}

function formatTimestamp(timestamp: TimestampLike): string {
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

function formatDate(timestamp: TimestampLike): string {
  if (!timestamp) {
    return "-";
  }

  return timestamp.toDate().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function getPaymentStatusTone(
  status: PaymentStatus
): "gray" | "blue" | "green" | "orange" {
  switch (status) {
    case "unreported":
      return "gray";
    case "reported":
      return "blue";
    case "confirmed":
      return "green";
    case "shortage":
      return "orange";
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

function sortEvents(events: ApplicationEvent[]): ApplicationEvent[] {
  return [...events].sort((a, b) => {
    const aTime = a.eventStartDate?.toMillis() ?? 0;
    const bTime = b.eventStartDate?.toMillis() ?? 0;

    return bTime - aTime;
  });
}

function createCsv(paymentTargets: PaymentTarget[]): string {
  const headers = [
    "氏名",
    "学籍番号",
    "バンド名",
    "請求額",
    "報告日時",
    "支払い状況",
    "備考",
  ];

  const rows = paymentTargets.map((paymentTarget) => [
    paymentTarget.memberName,
    paymentTarget.studentId,
    paymentTarget.bandName,
    String(paymentTarget.amount),
    formatTimestamp(paymentTarget.reportedAt),
    getPaymentStatusLabel(paymentTarget.status),
    paymentTarget.note,
  ]);

  const escapeCsvCell = (value: string) => {
    const escapedValue = value.replace(/"/g, '""');
    return `"${escapedValue}"`;
  };

  return [headers, ...rows]
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

export default function AdminPaymentsPage() {
  const router = useRouter();

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [paymentTargets, setPaymentTargets] = useState<PaymentTarget[]>([]);
  const [searchWord, setSearchWord] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<PaymentStatusFilter>("all");
  const [amountInput, setAmountInput] = useState("3000");
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<PaymentStatus>("confirmed");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedEvent = useMemo(() => {
    return events.find((event) => event.id === selectedEventId) ?? null;
  }, [events, selectedEventId]);

  const counts = useMemo(() => {
    return countPaymentStatuses(paymentTargets);
  }, [paymentTargets]);

  const filteredPaymentTargets = useMemo(() => {
    const normalizedSearchWord = searchWord.trim().toLowerCase();

    return paymentTargets.filter((paymentTarget) => {
      const matchesStatus =
        statusFilter === "all" || paymentTarget.status === statusFilter;

      const matchesSearch =
        normalizedSearchWord.length === 0 ||
        paymentTarget.memberName.toLowerCase().includes(normalizedSearchWord) ||
        paymentTarget.studentId.toLowerCase().includes(normalizedSearchWord) ||
        paymentTarget.bandName.toLowerCase().includes(normalizedSearchWord);

      return matchesStatus && matchesSearch;
    });
  }, [paymentTargets, searchWord, statusFilter]);

  const allFilteredSelected = useMemo(() => {
    if (filteredPaymentTargets.length === 0) {
      return false;
    }

    return filteredPaymentTargets.every((paymentTarget) =>
      selectedPaymentIds.includes(paymentTarget.id)
    );
  }, [filteredPaymentTargets, selectedPaymentIds]);

  async function loadEvents(): Promise<ApplicationEvent[]> {
    const [liveEvents, campLiveEvents, campEvents] = await Promise.all([
      getApplicationEventsByType("live"),
      getApplicationEventsByType("camp_live"),
      getApplicationEventsByType("camp"),
    ]);

    return sortEvents([...liveEvents, ...campLiveEvents, ...campEvents]);
  }

  async function loadPaymentTargets(eventId: string): Promise<void> {
    setIsPaymentLoading(true);
    setErrorMessage("");

    try {
      if (!eventId) {
        setPaymentTargets([]);
        return;
      }

      const paymentTargetData = await getPaymentTargetsByEventId(eventId);
      setPaymentTargets(paymentTargetData);
      setSelectedPaymentIds([]);
    } catch (error) {
      console.error(error);
      setErrorMessage("支払い情報を読み込めませんでした。");
    } finally {
      setIsPaymentLoading(false);
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

        if (!canManagePayments(memberData)) {
          router.push("/");
          return;
        }

        setCurrentMember(memberData);

        const eventData = await loadEvents();
        setEvents(eventData);

        let firstEventId = eventData[0]?.id ?? "";
        let firstPaymentTargets: PaymentTarget[] = [];

        for (const event of eventData) {
          const targets = await getPaymentTargetsByEventId(event.id);

          if (targets.length > 0) {
            firstEventId = event.id;
            firstPaymentTargets = targets;
            break;
          }
        }

        setSelectedEventId(firstEventId);

        if (firstPaymentTargets.length > 0) {
          setPaymentTargets(firstPaymentTargets);
          setSelectedPaymentIds([]);
        } else if (firstEventId) {
          await loadPaymentTargets(firstEventId);
        } else {
          setPaymentTargets([]);
          setSelectedPaymentIds([]);
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
    setMessage("");
    await loadPaymentTargets(eventId);
  }

  async function handleGeneratePaymentTargets(): Promise<void> {
    if (!selectedEventId) {
      return;
    }

    const amount = Number(amountInput);

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("請求額を正しく入力してください。");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const result = await createPaymentTargetsFromApprovedApplications({
        eventId: selectedEventId,
        amount,
      });

      await loadPaymentTargets(selectedEventId);

      setMessage(
        `支払い対象者を生成しました。新規 ${result.createdCount} 件 / 既存更新 ${result.skippedCount} 件`
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "支払い対象者の生成に失敗しました。承認済み申請があるか確認してください。"
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateStatus(
    paymentTarget: PaymentTarget,
    status: PaymentStatus
  ): Promise<void> {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await updatePaymentStatus({
        paymentTargetId: paymentTarget.id,
        status,
        note: paymentTarget.note,
      });

      await loadPaymentTargets(selectedEventId);
      setMessage("支払いステータスを更新しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("支払いステータスの更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateNote(
    paymentTarget: PaymentTarget,
    note: string
  ): Promise<void> {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await updatePaymentStatus({
        paymentTargetId: paymentTarget.id,
        status: paymentTarget.status,
        note,
      });

      await loadPaymentTargets(selectedEventId);
      setMessage("備考を更新しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("備考の更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkUpdate(): Promise<void> {
    if (selectedPaymentIds.length === 0) {
      return;
    }

    const ok = window.confirm(
      `${selectedPaymentIds.length}件の支払いステータスを「${getPaymentStatusLabel(
        bulkStatus
      )}」に変更しますか？`
    );

    if (!ok) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await updateManyPaymentStatuses({
        paymentTargetIds: selectedPaymentIds,
        status: bulkStatus,
      });

      await loadPaymentTargets(selectedEventId);
      setMessage("選択した支払いステータスを一括更新しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("一括更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  function handleTogglePaymentId(paymentTargetId: string): void {
    setSelectedPaymentIds((currentIds) => {
      if (currentIds.includes(paymentTargetId)) {
        return currentIds.filter((id) => id !== paymentTargetId);
      }

      return [...currentIds, paymentTargetId];
    });
  }

  function handleToggleAllFiltered(): void {
    if (allFilteredSelected) {
      setSelectedPaymentIds((currentIds) =>
        currentIds.filter(
          (id) =>
            !filteredPaymentTargets.some(
              (paymentTarget) => paymentTarget.id === id
            )
        )
      );
      return;
    }

    setSelectedPaymentIds((currentIds) => {
      const nextIds = [...currentIds];

      filteredPaymentTargets.forEach((paymentTarget) => {
        if (!nextIds.includes(paymentTarget.id)) {
          nextIds.push(paymentTarget.id);
        }
      });

      return nextIds;
    });
  }

  function handleExportCsv(): void {
    const csv = createCsv(filteredPaymentTargets);
    const eventTitle = selectedEvent?.title ?? "payment-status";
    downloadCsv(`${eventTitle}_支払い状況.csv`, csv);
  }

  if (isInitialLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <p className="text-sm font-semibold text-slate-500">
          支払い管理を読み込み中...
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
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Payment Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold text-blue-950">
              支払い状況管理
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              ライブや合宿の参加費・出演費の報告状況を管理します。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={isPaymentLoading || isSaving || !selectedEventId}
              onClick={() => loadPaymentTargets(selectedEventId)}
            >
              更新
            </Button>
            <Button
              variant="outline"
              disabled={filteredPaymentTargets.length === 0}
              onClick={handleExportCsv}
            >
              CSV出力
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

        <Card className="mb-5">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_auto] lg:items-end">
            <SelectBox
              label="イベント"
              value={selectedEventId}
              onChange={(event) => handleChangeEvent(event.target.value)}
              options={events.map((event) => ({
                label: `${event.title}（${getEventTypeLabel(event.type)}）`,
                value: event.id,
              }))}
              placeholder="イベントを選択してください"
            />

            <Input
              label="請求額"
              value={amountInput}
              inputMode="numeric"
              onChange={(event) => setAmountInput(event.target.value)}
              helperText="承認済み申請から対象者を生成するときに使います。"
            />

            <Button
              disabled={!selectedEventId || isSaving}
              onClick={handleGeneratePaymentTargets}
              className="w-full lg:w-auto"
            >
              対象者を生成
            </Button>
          </div>

          {selectedEvent && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">
                種別：{getEventTypeLabel(selectedEvent.type)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                開催日：{formatDate(selectedEvent.eventStartDate)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1">
                申請締切：{formatTimestamp(selectedEvent.applicationEndAt)}
              </span>
            </div>
          )}
        </Card>

        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Card>
            <p className="text-sm font-semibold text-slate-500">未報告</p>
            <p className="mt-2 text-3xl font-bold text-blue-950">
              {counts.unreported}
              <span className="ml-1 text-base">名</span>
            </p>
          </Card>

          <Card tone="blue">
            <p className="text-sm font-semibold text-blue-700">報告済み</p>
            <p className="mt-2 text-3xl font-bold text-blue-950">
              {counts.reported}
              <span className="ml-1 text-base">名</span>
            </p>
          </Card>

          <Card tone="green">
            <p className="text-sm font-semibold text-emerald-700">確認済み</p>
            <p className="mt-2 text-3xl font-bold text-blue-950">
              {counts.confirmed}
              <span className="ml-1 text-base">名</span>
            </p>
          </Card>

          <Card tone="orange">
            <p className="text-sm font-semibold text-orange-700">不足あり</p>
            <p className="mt-2 text-3xl font-bold text-blue-950">
              {counts.shortage}
              <span className="ml-1 text-base">名</span>
            </p>
          </Card>
        </div>

        <Card className="mb-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <SelectBox
              label="ステータス"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as PaymentStatusFilter)
              }
              options={paymentStatusOptions}
              placeholder=""
            />

            <Input
              label="検索"
              placeholder="氏名・学籍番号・バンド名で検索"
              value={searchWord}
              onChange={(event) => setSearchWord(event.target.value)}
            />

            <Button
              variant="outline"
              onClick={() => {
                setSearchWord("");
                setStatusFilter("all");
              }}
              className="w-full lg:w-auto"
            >
              リセット
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {paymentTargets.length}件中 {filteredPaymentTargets.length}
                件を表示
              </p>
              <p className="mt-1 text-xs text-slate-500">
                選択中：{selectedPaymentIds.length}件
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <SelectBox
                value={bulkStatus}
                onChange={(event) =>
                  setBulkStatus(event.target.value as PaymentStatus)
                }
                options={updateStatusOptions}
                placeholder=""
                className="min-w-40"
              />
              <Button
                disabled={selectedPaymentIds.length === 0 || isSaving}
                onClick={handleBulkUpdate}
              >
                一括更新
              </Button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="whitespace-nowrap px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={handleToggleAllFiltered}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="whitespace-nowrap px-3 py-3">氏名</th>
                  <th className="whitespace-nowrap px-3 py-3">学籍番号</th>
                  <th className="whitespace-nowrap px-3 py-3">バンド名</th>
                  <th className="whitespace-nowrap px-3 py-3">請求額</th>
                  <th className="whitespace-nowrap px-3 py-3">報告日時</th>
                  <th className="whitespace-nowrap px-3 py-3">支払い状況</th>
                  <th className="whitespace-nowrap px-3 py-3">備考</th>
                  <th className="whitespace-nowrap px-3 py-3">操作</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isPaymentLoading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-10 text-center text-sm font-semibold text-slate-500"
                    >
                      支払い情報を読み込み中...
                    </td>
                  </tr>
                ) : filteredPaymentTargets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-10 text-center text-sm font-semibold text-slate-500"
                    >
                      支払い対象者がいません。
                    </td>
                  </tr>
                ) : (
                  filteredPaymentTargets.map((paymentTarget) => (
                    <tr key={paymentTarget.id} className="bg-white">
                      <td className="whitespace-nowrap px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedPaymentIds.includes(
                            paymentTarget.id
                          )}
                          onChange={() =>
                            handleTogglePaymentId(paymentTarget.id)
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-950">
                        {paymentTarget.memberName}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {paymentTarget.studentId}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {paymentTarget.bandName || "-"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-blue-950">
                        {formatYen(paymentTarget.amount)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                        {formatTimestamp(paymentTarget.reportedAt)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <StatusBadge
                          tone={getPaymentStatusTone(paymentTarget.status)}
                        >
                          {getPaymentStatusLabel(paymentTarget.status)}
                        </StatusBadge>
                      </td>

                      <td className="min-w-48 px-3 py-3">
                        <input
                          defaultValue={paymentTarget.note}
                          onBlur={(event) => {
                            if (event.target.value !== paymentTarget.note) {
                              handleUpdateNote(
                                paymentTarget,
                                event.target.value
                              );
                            }
                          }}
                          placeholder="不足額・確認事項など"
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>

                      <td className="whitespace-nowrap px-3 py-3">
                        <select
                          value={paymentTarget.status}
                          disabled={isSaving}
                          onChange={(event) =>
                            handleUpdateStatus(
                              paymentTarget,
                              event.target.value as PaymentStatus
                            )
                          }
                          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-blue-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        >
                          {updateStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            この画面では提出日時のみを記録します。領収書や振込明細画像は保存しません。
          </p>
        </Card>
      </div>
    </main>
  );
}