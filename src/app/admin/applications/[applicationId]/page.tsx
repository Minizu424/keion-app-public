"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getApplicationById,
  updateApplicationAdminNote,
  updateApplicationStatus,
  type Application,
  type ApplicationStatus,
  type ApplicationType,
} from "@/lib/repositories/applicationsRepository";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

function canAccessAdminPage(member: Member): boolean {
  return member.role === "executive" || member.role === "admin";
}

function getApplicationTypeLabel(type: ApplicationType): string {
  switch (type) {
    case "live":
      return "通常ライブ";
    case "camp":
      return "合宿";
    case "camp_live":
      return "合宿ライブ";
  }
}

function getApplicationTypeTone(type: ApplicationType): "blue" | "orange" {
  switch (type) {
    case "live":
      return "blue";
    case "camp":
      return "orange";
    case "camp_live":
      return "orange";
  }
}

function getApplicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "submitted":
      return "未確認";
    case "checking":
      return "確認中";
    case "approved":
      return "承認済み";
    case "rejected":
      return "却下";
  }
}

function getApplicationStatusTone(
  status: ApplicationStatus
): "gray" | "blue" | "green" | "red" {
  switch (status) {
    case "submitted":
      return "gray";
    case "checking":
      return "blue";
    case "approved":
      return "green";
    case "rejected":
      return "red";
  }
}

function getApplicationStatusDescription(status: ApplicationStatus): string {
  switch (status) {
    case "submitted":
      return "まだ幹部が確認していない申請です。";
    case "checking":
      return "幹部が内容を確認している途中です。";
    case "approved":
      return "幹部が申請を承認しました。";
    case "rejected":
      return "幹部が申請を却下しました。";
  }
}

function formatDateTime(timestamp: Application["createdAt"]): string {
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

function formatTimeRange(application: Application): string {
  if (!application.preferredStartTime && !application.preferredEndTime) {
    return "希望なし";
  }

  return `${application.preferredStartTime || "-"} - ${
    application.preferredEndTime || "-"
  }`;
}

function getSongTitle(application: Application): string {
  return (
    application.songs
      .map((song) => song.title)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

export default function AdminApplicationDetailPage() {
  const router = useRouter();
  const params = useParams<{ applicationId: string }>();
  const applicationId = params.applicationId;

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>("submitted");
  const [adminNote, setAdminNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadApplication(): Promise<void> {
    const applicationData = await getApplicationById(applicationId);

    if (!applicationData) {
      setErrorMessage("申請が見つかりません。");
      setApplication(null);
      return;
    }

    setApplication(applicationData);
    setStatus(applicationData.status);
    setAdminNote(applicationData.adminNote ?? "");
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const member = await getMemberByUid(user.uid);

        if (!member || !canAccessAdminPage(member)) {
          router.push("/");
          return;
        }

        setCurrentMember(member);
        await loadApplication();
      } catch (error) {
        console.error(error);
        setErrorMessage("申請詳細の取得に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [applicationId, router]);

  async function handleChangeStatus(
    nextStatus: ApplicationStatus
  ): Promise<void> {
    if (!application) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSavingStatus(true);

    try {
      await updateApplicationStatus(application.id, nextStatus);

      setApplication({
        ...application,
        status: nextStatus,
      });

      setStatus(nextStatus);
      setSuccessMessage("申請ステータスを更新しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("申請ステータスの更新に失敗しました。");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function handleSaveAdminNote(): Promise<void> {
    if (!application) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSavingNote(true);

    try {
      await updateApplicationAdminNote(application.id, adminNote);

      setApplication({
        ...application,
        adminNote,
      });

      setSuccessMessage("幹部メモを保存しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("幹部メモの保存に失敗しました。");
    } finally {
      setIsSavingNote(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">
          申請詳細を読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember) {
    return null;
  }

  if (!application) {
    return (
      <main className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
          <h1 className="text-2xl font-bold text-blue-950">申請詳細</h1>
        </header>

        <div className="mx-auto max-w-4xl px-5 py-6 md:px-8">
          <Card>
            <p className="font-semibold text-blue-950">
              {errorMessage || "申請が見つかりません。"}
            </p>

            <div className="mt-4">
              <Link href="/admin/applications">
                <Button variant="outline">申請管理に戻る</Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1">
      <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-950">申請詳細</h1>
            <p className="mt-1 text-sm text-slate-500">
              申請内容を確認し、幹部がステータスを変更します。
            </p>
          </div>

          <Link href="/admin/applications">
            <Button variant="outline">申請管理に戻る</Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 md:px-8">
        {errorMessage && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {successMessage}
          </div>
        )}

        <Card>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <StatusBadge
                  tone={getApplicationTypeTone(application.applicationType)}
                >
                  {getApplicationTypeLabel(application.applicationType)}
                </StatusBadge>

                <StatusBadge
                  tone={getApplicationStatusTone(application.status)}
                >
                  {getApplicationStatusLabel(application.status)}
                </StatusBadge>
              </div>

              <h2 className="text-2xl font-bold text-blue-950">
                {application.bandName || "-"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                イベント：{application.eventTitle || "-"}
              </p>

              <p className="mt-2 text-sm text-slate-500">
                曲名：{getSongTitle(application)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-blue-950">申請者：</span>
                {application.applicantName || "-"}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-blue-950">申請日時：</span>
                {formatDateTime(application.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">希望日</p>
              <p className="mt-1 font-bold text-blue-950">
                {application.preferredDate || "希望なし"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">希望時間</p>
              <p className="mt-1 font-bold text-blue-950">
                {formatTimeRange(application)}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">所要時間</p>
              <p className="mt-1 font-bold text-blue-950">
                {application.requiredMinutes}分
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">メンバー数</p>
              <p className="mt-1 font-bold text-blue-950">
                {application.members.length}人
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card>
              <h2 className="mb-4 text-lg font-bold text-blue-950">
                メンバー一覧
              </h2>

              {application.members.length === 0 ? (
                <p className="text-sm text-slate-500">
                  メンバー情報がありません。
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">名前</th>
                        <th className="px-4 py-3">学籍番号</th>
                        <th className="px-4 py-3">パート</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {application.members.map((member) => (
                        <tr key={`${member.uid}-${member.studentId}`}>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-950">
                            {member.name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {member.studentId || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {member.parts.length > 0
                              ? member.parts.join(", ")
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-bold text-blue-950">曲一覧</h2>

              {application.songs.length === 0 ? (
                <p className="text-sm text-slate-500">曲情報がありません。</p>
              ) : (
                <div className="space-y-3">
                  {application.songs.map((song, index) => (
                    <div
                      key={`${song.title}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <p className="font-bold text-blue-950">
                        {index + 1}. {song.title || "-"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        アーティスト：{song.artist || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-bold text-blue-950">備考</h2>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {application.note || "備考はありません。"}
              </p>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <h2 className="mb-4 text-lg font-bold text-blue-950">
                ステータス管理
              </h2>

              <div className="mb-4 rounded-xl bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-blue-950">
                  現在の状態
                </p>

                <StatusBadge tone={getApplicationStatusTone(application.status)}>
                  {getApplicationStatusLabel(application.status)}
                </StatusBadge>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {getApplicationStatusDescription(application.status)}
                </p>
              </div>

              <div className="grid gap-2">
                <Button
                  type="button"
                  variant={
                    application.status === "submitted" ? "primary" : "outline"
                  }
                  disabled={isSavingStatus || application.status === "submitted"}
                  onClick={() => handleChangeStatus("submitted")}
                  className="w-full"
                >
                  未確認にする
                </Button>

                <Button
                  type="button"
                  variant={
                    application.status === "checking" ? "primary" : "outline"
                  }
                  disabled={isSavingStatus || application.status === "checking"}
                  onClick={() => handleChangeStatus("checking")}
                  className="w-full"
                >
                  確認中にする
                </Button>

                <Button
                  type="button"
                  variant={
                    application.status === "approved" ? "primary" : "outline"
                  }
                  disabled={isSavingStatus || application.status === "approved"}
                  onClick={() => handleChangeStatus("approved")}
                  className="w-full"
                >
                  承認する
                </Button>

                <Button
                  type="button"
                  variant={
                    application.status === "rejected" ? "primary" : "outline"
                  }
                  disabled={isSavingStatus || application.status === "rejected"}
                  onClick={() => handleChangeStatus("rejected")}
                  className="w-full"
                >
                  却下する
                </Button>
              </div>

              {isSavingStatus && (
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  更新中...
                </p>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-bold text-blue-950">
                幹部メモ
              </h2>

              <textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                rows={8}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-blue-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                placeholder="幹部内で共有したいメモを入力"
              />

              <Button
                className="mt-4 w-full"
                onClick={handleSaveAdminNote}
                disabled={isSavingNote}
              >
                {isSavingNote ? "保存中..." : "幹部メモを保存"}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}