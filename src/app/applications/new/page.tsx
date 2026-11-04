"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  createApplication,
  type ApplicationMember,
  type ApplicationPart,
  type ApplicationSong,
} from "@/lib/repositories/applicationsRepository";
import {
  getApplicationEventById,
  type ApplicationEvent,
} from "@/lib/repositories/eventsRepository";
import {
  getMemberByUid,
  getMembers,
  type Member,
} from "@/lib/repositories/membersRepository";
import { hasJoinedCampParticipation } from "@/lib/repositories/campParticipationsRepository";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";

const partOptions: { label: string; value: ApplicationPart }[] = [
  { label: "ボーカル", value: "Vocal" },
  { label: "ギター", value: "Guitar" },
  { label: "ベース", value: "Bass" },
  { label: "ドラム", value: "Drums" },
  { label: "キーボード", value: "Keyboard" },
  { label: "PA", value: "PA" },
  { label: "その他", value: "Other" },
];

function toApplicationPart(value: string): ApplicationPart {
  const foundPart = partOptions.find((part) => part.value === value);

  return foundPart?.value ?? "Other";
}

function formatDate(timestamp: ApplicationEvent["eventStartDate"]): string {
  if (!timestamp) {
    return "";
  }

  return timestamp.toDate().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getEventTypeLabel(type: ApplicationEvent["type"]): string {
  switch (type) {
    case "live":
      return "ライブ申請";
    case "camp":
      return "合宿参加申請";
    case "camp_live":
      return "合宿ライブ申請";
  }
}

function getEventTypeTone(type: ApplicationEvent["type"]): "green" | "orange" {
  switch (type) {
    case "live":
      return "green";
    case "camp":
      return "orange";
    case "camp_live":
      return "orange";
  }
}

function getMemberInitialPart(member: Member): ApplicationPart {
  return toApplicationPart(member.mainPart);
}

function createApplicationMember(member: Member): ApplicationMember {
  return {
    uid: member.uid,
    name: member.name,
    studentId: member.studentId,
    parts: [getMemberInitialPart(member)],
  };
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

function NewApplicationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [event, setEvent] = useState<ApplicationEvent | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMemberUid, setSelectedMemberUid] = useState("");
  const [memberSearchWord, setMemberSearchWord] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bandName, setBandName] = useState("");
  const [songs, setSongs] = useState<ApplicationSong[]>([
    { title: "", artist: "" },
  ]);
  const [applicationMembers, setApplicationMembers] = useState<
    ApplicationMember[]
  >([]);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredStartTime, setPreferredStartTime] = useState("");
  const [preferredEndTime, setPreferredEndTime] = useState("");
  const [hasNoPreferredSchedule, setHasNoPreferredSchedule] = useState(false);
  const [requiredMinutes, setRequiredMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectableMembers = useMemo(() => {
    const searchWord = memberSearchWord.trim().toLowerCase();

    return allMembers.filter((member) => {
      const isActive = member.status === "active";
      const isAlreadyAdded = applicationMembers.some(
        (applicationMember) => applicationMember.uid === member.uid
      );

      const matchesSearch =
        searchWord.length === 0 ||
        member.name.toLowerCase().includes(searchWord) ||
        member.studentId.toLowerCase().includes(searchWord) ||
        member.mainPart.toLowerCase().includes(searchWord);

      return isActive && !isAlreadyAdded && matchesSearch;
    });
  }, [allMembers, applicationMembers, memberSearchWord]);

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
        const [member, selectedEvent, members] = await Promise.all([
          getMemberByUid(user.uid),
          getApplicationEventById(eventId),
          getMembers(),
        ]);

        if (!member || member.status !== "active") {
          router.push("/login");
          return;
        }

        if (!selectedEvent || selectedEvent.status !== "open") {
          router.push("/applications");
          return;
        }

        if (selectedEvent.type === "camp_live") {
          if (!selectedEvent.parentEventId) {
            setErrorMessage("対応する合宿イベントが設定されていません。");
            setIsLoading(false);
            return;
          }

          const hasJoined = await hasJoinedCampParticipation(
            selectedEvent.parentEventId,
            user.uid
          );

          if (!hasJoined) {
            setErrorMessage(
              "この合宿ライブ申請は、合宿参加申請で「参加する」を選択した人のみ申請できます。"
            );
            setIsLoading(false);
            return;
          }
        }

        setCurrentMember(member);
        setEvent(selectedEvent);
        setAllMembers(members);
        setApplicationMembers([createApplicationMember(member)]);
        setPreferredDate(
          formatDate(selectedEvent.eventStartDate).replaceAll("/", "-")
        );
      } catch (error) {
        console.error(error);
        setErrorMessage("申請フォームの読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [eventId, router]);

  function handleSongChange(
    index: number,
    field: keyof ApplicationSong,
    value: string
  ): void {
    setSongs((prevSongs) =>
      prevSongs.map((song, songIndex) =>
        songIndex === index ? { ...song, [field]: value } : song
      )
    );
  }

  function handleAddSong(): void {
    setSongs((prevSongs) => [...prevSongs, { title: "", artist: "" }]);
  }

  function handleRemoveSong(index: number): void {
    setSongs((prevSongs) =>
      prevSongs.filter((_, songIndex) => songIndex !== index)
    );
  }

  function handleAddMember(): void {
    const selectedMember = allMembers.find(
      (member) => member.uid === selectedMemberUid
    );

    if (!selectedMember) {
      return;
    }

    setApplicationMembers((prevMembers) => [
      ...prevMembers,
      createApplicationMember(selectedMember),
    ]);
    setSelectedMemberUid("");
    setMemberSearchWord("");
  }

  function handleRemoveMember(uid: string): void {
    setApplicationMembers((prevMembers) =>
      prevMembers.filter((member) => member.uid !== uid)
    );
  }

  function handleToggleMemberPart(uid: string, part: ApplicationPart): void {
    setApplicationMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (member.uid !== uid) {
          return member;
        }

        const nextParts = member.parts.includes(part)
          ? member.parts.filter((memberPart) => memberPart !== part)
          : [...member.parts, part];

        return {
          ...member,
          parts: nextParts.length > 0 ? nextParts : [part],
        };
      })
    );
  }

  function handleChangeNoPreferredSchedule(checked: boolean): void {
    setHasNoPreferredSchedule(checked);

    if (checked) {
      setPreferredDate("");
      setPreferredStartTime("");
      setPreferredEndTime("");
    } else if (event) {
      setPreferredDate(formatDate(event.eventStartDate).replaceAll("/", "-"));
    }
  }

  async function handleSubmit(eventObject: FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    setErrorMessage("");

    if (!currentMember || !event) {
      setErrorMessage("ログイン情報またはイベント情報を取得できませんでした。");
      return;
    }

    const cleanedSongs = songs
      .map((song) => ({
        title: song.title.trim(),
        artist: song.artist.trim(),
      }))
      .filter((song) => song.title.length > 0);

    const parsedRequiredMinutes = Number(requiredMinutes);

    if (!bandName.trim()) {
      setErrorMessage("バンド名を入力してください。");
      return;
    }

    if (cleanedSongs.length === 0) {
      setErrorMessage("曲名を1曲以上入力してください。");
      return;
    }

    if (applicationMembers.length === 0) {
      setErrorMessage("メンバーを1人以上追加してください。");
      return;
    }

    if (
      !hasNoPreferredSchedule &&
      (!preferredDate || !preferredStartTime || !preferredEndTime)
    ) {
      setErrorMessage("希望日、開始時間、終了時間を入力してください。");
      return;
    }

    if (!Number.isFinite(parsedRequiredMinutes) || parsedRequiredMinutes <= 0) {
      setErrorMessage("所要時間を正しく入力してください。");
      return;
    }

    try {
      setIsSubmitting(true);

      await createApplication({
        eventId: event.id,
        eventTitle: event.title,
        applicationType: event.type,
        applicantUid: currentMember.uid,
        applicantName: currentMember.name,
        bandName: bandName.trim(),
        songs: cleanedSongs,
        members: applicationMembers,
        preferredDate: hasNoPreferredSchedule ? "" : preferredDate,
        preferredStartTime: hasNoPreferredSchedule ? "" : preferredStartTime,
        preferredEndTime: hasNoPreferredSchedule ? "" : preferredEndTime,
        requiredMinutes: parsedRequiredMinutes,
        note: note.trim(),
      });

      router.push("/applications");
    } catch (error) {
      console.error(error);
      setErrorMessage("申請の保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">
          申請フォームを読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember || !event) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-blue-950">
            申請フォームを表示できません
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {errorMessage ||
              "ログイン情報またはイベント情報を取得できませんでした。"}
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push("/applications")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              申請一覧に戻る
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1">
      <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
        <h1 className="text-2xl font-bold text-blue-950">
          ライブ / 合宿申請
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          選択したイベントに対して出演申請を行います。
        </p>
        <p className="mt-2 text-xs text-slate-400">
          ログイン中：{currentMember.name}（{getUserDescription(currentMember)}）
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-6 md:px-8 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-blue-950">申請情報</h2>
              <p className="mt-1 text-sm text-slate-500">
                バンド名、曲名、メンバー、希望時間を入力してください。
              </p>
            </div>

            <StatusBadge tone={getEventTypeTone(event.type)}>
              {getEventTypeLabel(event.type)}
            </StatusBadge>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="バンド名"
              name="bandName"
              value={bandName}
              onChange={(changeEvent: ChangeEvent<HTMLInputElement>) =>
                setBandName(changeEvent.target.value)
              }
              placeholder="例: ミッドナイトブルー"
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-blue-950">曲名</p>
                <Button type="button" variant="outline" onClick={handleAddSong}>
                  曲を追加
                </Button>
              </div>

              {songs.map((song, index) => (
                <div
                  key={`song-${index}`}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <Input
                    label={`曲名 ${index + 1}`}
                    name={`song-title-${index}`}
                    value={song.title}
                    onChange={(changeEvent: ChangeEvent<HTMLInputElement>) =>
                      handleSongChange(index, "title", changeEvent.target.value)
                    }
                    placeholder="例: 青と夏"
                  />

                  <Input
                    label="アーティスト"
                    name={`song-artist-${index}`}
                    value={song.artist}
                    onChange={(changeEvent: ChangeEvent<HTMLInputElement>) =>
                      handleSongChange(index, "artist", changeEvent.target.value)
                    }
                    placeholder="例: Mrs. GREEN APPLE"
                  />

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={songs.length <= 1}
                      onClick={() => handleRemoveSong(index)}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-blue-950">メンバー</p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                  <Input
                    label="メンバー検索"
                    name="memberSearch"
                    value={memberSearchWord}
                    onChange={(changeEvent: ChangeEvent<HTMLInputElement>) => {
                      setMemberSearchWord(changeEvent.target.value);
                      setSelectedMemberUid("");
                    }}
                    placeholder="名前・学籍番号・パートで検索"
                  />

                  <div>
                    <label
                      htmlFor="selectedMemberUid"
                      className="mb-1.5 block text-sm font-semibold text-blue-950"
                    >
                      追加するメンバー
                    </label>

                    <select
                      id="selectedMemberUid"
                      value={selectedMemberUid}
                      onChange={(changeEvent) =>
                        setSelectedMemberUid(changeEvent.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-blue-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">
                        {memberSearchWord.trim()
                          ? "検索結果から選択"
                          : "メンバーを選択"}
                      </option>

                      {selectableMembers.map((member) => (
                        <option key={member.uid} value={member.uid}>
                          {member.name} / {member.studentId} / {member.mainPart}
                        </option>
                      ))}
                    </select>

                    <p className="mt-1 text-xs text-slate-500">
                      {selectableMembers.length}件表示中
                    </p>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      disabled={!selectedMemberUid}
                      onClick={handleAddMember}
                      className="w-full"
                    >
                      メンバーを追加
                    </Button>
                  </div>
                </div>

                {memberSearchWord.trim() && selectableMembers.length === 0 && (
                  <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-500">
                    条件に合うメンバーが見つかりません。
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {applicationMembers.map((member) => (
                  <div
                    key={member.uid}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-blue-950">
                          {member.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          学籍番号：{member.studentId}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={member.uid === currentMember.uid}
                        onClick={() => handleRemoveMember(member.uid)}
                      >
                        削除
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {partOptions.map((part) => {
                        const isSelected = member.parts.includes(part.value);

                        return (
                          <button
                            key={part.value}
                            type="button"
                            onClick={() =>
                              handleToggleMemberPart(member.uid, part.value)
                            }
                            className={[
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              isSelected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700",
                            ].join(" ")}
                          >
                            {part.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-950">
                    希望日時
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    希望がない場合は「希望なし」を選択してください。
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                  <input
                    type="checkbox"
                    checked={hasNoPreferredSchedule}
                    onChange={(changeEvent) =>
                      handleChangeNoPreferredSchedule(changeEvent.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  希望なし
                </label>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <Input
                  label="希望日"
                  name="preferredDate"
                  type="date"
                  value={preferredDate}
                  onChange={(changeEvent: ChangeEvent<HTMLInputElement>) =>
                    setPreferredDate(changeEvent.target.value)
                  }
                  disabled={hasNoPreferredSchedule}
                />

                <Input
                  label="開始時間"
                  name="preferredStartTime"
                  type="time"
                  value={preferredStartTime}
                  onChange={(changeEvent: ChangeEvent<HTMLInputElement>) =>
                    setPreferredStartTime(changeEvent.target.value)
                  }
                  disabled={hasNoPreferredSchedule}
                />

                <Input
                  label="終了時間"
                  name="preferredEndTime"
                  type="time"
                  value={preferredEndTime}
                  onChange={(changeEvent: ChangeEvent<HTMLInputElement>) =>
                    setPreferredEndTime(changeEvent.target.value)
                  }
                  disabled={hasNoPreferredSchedule}
                />
              </div>
            </div>

            <Input
              label="所要時間（分）"
              name="requiredMinutes"
              type="number"
              value={requiredMinutes}
              onChange={(changeEvent: ChangeEvent<HTMLInputElement>) =>
                setRequiredMinutes(changeEvent.target.value)
              }
              placeholder="例: 30"
            />

            <div>
              <label
                htmlFor="note"
                className="mb-1.5 block text-sm font-semibold text-blue-950"
              >
                備考
              </label>

              <textarea
                id="note"
                name="note"
                value={note}
                onChange={(changeEvent) => setNote(changeEvent.target.value)}
                rows={5}
                placeholder="希望や注意事項があれば入力してください。"
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-blue-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/applications")}
              >
                戻る
              </Button>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "申請中..." : "申請する"}
              </Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-5">
          <Card tone="blue">
            <h2 className="text-lg font-bold text-blue-950">申請サマリー</h2>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-blue-950">イベント：</span>
                {event.title}
              </p>
              <p>
                <span className="font-semibold text-blue-950">会場：</span>
                {event.venue || "-"}
              </p>
              <p>
                <span className="font-semibold text-blue-950">バンド名：</span>
                {bandName || "-"}
              </p>
              <p>
                <span className="font-semibold text-blue-950">曲数：</span>
                {songs.filter((song) => song.title.trim().length > 0).length}曲
              </p>
              <p>
                <span className="font-semibold text-blue-950">メンバー：</span>
                {applicationMembers.length}名
              </p>
              <p>
                <span className="font-semibold text-blue-950">希望日時：</span>
                {hasNoPreferredSchedule
                  ? "希望なし"
                  : `${preferredDate || "-"} / ${preferredStartTime || "-"} - ${
                      preferredEndTime || "-"
                    }`}
              </p>
            </div>
          </Card>

          <Card tone="orange">
            <h2 className="text-lg font-bold text-blue-950">注意事項</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
              <li>申請内容は幹部が確認します。</li>
              <li>希望時間は必ず通るとは限りません。</li>
              <li>希望なしの場合は、幹部側で時間を調整します。</li>
              <li>メンバーや曲目の変更は締切前に相談してください。</li>
            </ul>
          </Card>
        </aside>
      </div>
    </main>
  );
}

export default function NewApplicationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm font-semibold text-slate-500">
            申請フォームを読み込み中...
          </p>
        </main>
      }
    >
      <NewApplicationPageContent />
    </Suspense>
  );
}