"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  getPublishedTimetables,
} from "@/lib/repositories/timetablesRepository";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import type { Timetable, TimetableRow } from "@/types/timetable";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

function formatUpdatedAt(timetable: Timetable): string {
  if (!timetable.updatedAt) {
    return "-";
  }

  return timetable.updatedAt.toDate().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSongs(row: TimetableRow): string {
  if (row.songs.length === 0) {
    return "曲情報なし";
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

function isMyBand(row: TimetableRow, currentMember: Member | null): boolean {
  if (!currentMember) {
    return false;
  }

  if (
    currentMember.studentId &&
    row.memberStudentIds.includes(currentMember.studentId)
  ) {
    return true;
  }

  return row.memberNames.includes(currentMember.name);
}

export default function TimetablePage() {
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedTimetable = useMemo(() => {
    return (
      timetables.find((timetable) => timetable.eventId === selectedEventId) ??
      null
    );
  }, [timetables, selectedEventId]);

  useEffect(() => {
    async function loadTimetables() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const timetableData = await getPublishedTimetables();
        setTimetables(timetableData);
        setSelectedEventId(timetableData[0]?.eventId ?? "");
      } catch (error) {
        console.error(error);
        setErrorMessage("タイムテーブルを読み込めませんでした。");
      } finally {
        setIsLoading(false);
      }
    }

    loadTimetables();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setCurrentMember(null);
          return;
        }

        const memberData = await getMemberByUid(user.uid);
        setCurrentMember(memberData);
      } catch (error) {
        console.error(error);
        setCurrentMember(null);
      }
    });

    return () => unsubscribe();
  }, []);

  function toggleRow(rowId: string): void {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <p className="text-sm font-semibold text-slate-500">
          タイムテーブルを読み込み中...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-600">Timetable</p>
          <h1 className="mt-1 text-2xl font-bold text-blue-950">
            タイムテーブル
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            公開済みのライブタイムテーブルを確認できます。
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {timetables.length === 0 ? (
          <Card>
            <h2 className="text-lg font-bold text-blue-950">
              公開中のタイムテーブルはありません
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              幹部がタイムテーブルを反映すると、ここに表示されます。
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <h2 className="text-lg font-bold text-blue-950">
                表示するライブ
              </h2>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {timetables.map((timetable) => {
                  const isSelected = timetable.eventId === selectedEventId;

                  return (
                    <button
                      key={timetable.eventId}
                      type="button"
                      onClick={() => {
                        setSelectedEventId(timetable.eventId);
                        setExpandedRowId(null);
                      }}
                      className={[
                        "rounded-2xl border p-4 text-left transition",
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                          : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-bold text-blue-950">
                            {timetable.eventTitle}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            最終更新：{formatUpdatedAt(timetable)}
                          </p>
                        </div>

                        <StatusBadge tone="green">公開済み</StatusBadge>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-1">
                          {timetable.rows.length}件
                        </span>

                        {isSelected && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                            選択中
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {selectedTimetable && (
              <Card>
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-blue-950">
                      {selectedTimetable.eventTitle}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      開始時刻とバンド名を表示しています。詳細を見たい場合は各項目をタップしてください。
                    </p>
                  </div>

                  {currentMember && (
                    <div className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      あなたが出演するバンドは強調表示されます
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {selectedTimetable.rows.map((row, index) => {
                    const expanded = expandedRowId === row.id;
                    const mine = isMyBand(row, currentMember);

                    return (
                      <div
                        key={row.id}
                        className={[
                          "overflow-hidden rounded-2xl border transition",
                          mine
                            ? "border-amber-300 bg-amber-50/70 ring-2 ring-amber-100"
                            : "border-slate-200 bg-white",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          onClick={() => toggleRow(row.id)}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/60"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-400">
                                #{index + 1}
                              </span>

                              {row.type === "band" ? (
                                <StatusBadge tone={mine ? "orange" : "blue"}>
                                  {mine ? "自分の出演" : "出演"}
                                </StatusBadge>
                              ) : (
                                <StatusBadge tone="gray">進行</StatusBadge>
                              )}
                            </div>

                            <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-center md:gap-4">
                              <p className="text-2xl font-bold text-blue-950">
                                {row.startTime || "--:--"}
                              </p>
                              <p className="text-lg font-bold text-slate-800">
                                {row.title}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-sm font-semibold text-blue-600">
                            {expanded ? "閉じる" : "詳細"}
                          </div>
                        </button>

                        {expanded && (
                          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                            <div className="space-y-2 text-sm text-slate-600">
                              <div className="grid gap-2 md:grid-cols-2">
                                <div>
                                  <p className="font-semibold text-slate-500">
                                    時間
                                  </p>
                                  <p className="mt-1 font-semibold text-blue-950">
                                    {row.startTime || "--:--"} - {row.endTime || "--:--"}（{row.durationMinutes}分）
                                  </p>
                                </div>

                                <div>
                                  <p className="font-semibold text-slate-500">
                                    バンド名 / 項目名
                                  </p>
                                  <p className="mt-1 font-semibold text-blue-950">
                                    {row.title}
                                  </p>
                                </div>
                              </div>

                              {row.type === "band" && (
                                <>
                                  <div>
                                    <p className="font-semibold text-slate-500">
                                      曲
                                    </p>
                                    <p className="mt-1">{formatSongs(row)}</p>
                                  </div>

                                  {row.memberNames.length > 0 && (
                                    <div>
                                      <p className="font-semibold text-slate-500">
                                        メンバー
                                      </p>
                                      <p className="mt-1">
                                        {row.memberNames.join(" / ")}
                                      </p>
                                    </div>
                                  )}
                                </>
                              )}

                              {row.note && (
                                <div>
                                  <p className="font-semibold text-slate-500">
                                    備考
                                  </p>
                                  <p className="mt-1">{row.note}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  );
}