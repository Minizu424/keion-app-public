"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import {
  approveAccountRequest,
  getPendingAccountRequests,
  rejectAccountRequest,
  type AccountRequest,
} from "@/lib/repositories/accountRequestsRepository";
import { studentIdToAuthEmail } from "@/lib/firebase/authEmail";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

function isExecutiveMember(member: Member): boolean {
  return member.role === "executive" || member.role === "admin";
}

function getUserDescription(member: Member) {
  const roleLabel =
    member.role === "admin"
      ? "管理者"
      : member.role === "executive"
        ? "幹部"
        : "一般メンバー";

  return `${member.mainPart}・${member.grade}年 / ${roleLabel}`;
}

export default function AdminAccountRequestsPage() {
  const router = useRouter();

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadRequests(): Promise<void> {
    const pendingRequests = await getPendingAccountRequests();
    setRequests(pendingRequests);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const member = await getMemberByUid(user.uid);

      if (!member || !isExecutiveMember(member)) {
        router.push("/");
        return;
      }

      setCurrentMember(member);
      await loadRequests();
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  async function handleApprove(request: AccountRequest): Promise<void> {
    if (!currentMember) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      setProcessingRequestId(request.id);

      await approveAccountRequest({
        request,
      });

      setSuccessMessage(
        `${request.name}さんのアカウントを発行し、${studentIdToAuthEmail(
          request.studentId
        )} 宛にパスワード設定メールを送信しました。`
      );

      await loadRequests();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "承認処理に失敗しました。すでに同じ学籍番号のアカウントが存在する、またはメール送信に失敗した可能性があります。"
      );
    } finally {
      setProcessingRequestId(null);
    }
  }

  async function handleReject(requestId: string): Promise<void> {
    if (!currentMember) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      setProcessingRequestId(requestId);

      await rejectAccountRequest(requestId);

      setSuccessMessage("申請を却下しました。");

      await loadRequests();
    } catch (error) {
      console.error(error);
      setErrorMessage("却下処理に失敗しました。");
    } finally {
      setProcessingRequestId(null);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">
          アカウント申請を読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember) {
    return null;
  }

  const userDescription = getUserDescription(currentMember);

  return (
    <div className="min-h-screen bg-slate-50 md:flex">

      <main className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-blue-600 md:hidden">
                軽音サークル 運営支援アプリ
              </p>

              <h1 className="text-2xl font-bold text-blue-950">
                アカウント発行申請
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                メンバーから届いた申請を確認し、ログイン用アカウントを発行します。
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => loadRequests()}
              disabled={processingRequestId !== null}
            >
              更新
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 pb-24 md:px-8 md:pb-6">
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

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card tone="blue">
              <p className="text-sm font-bold text-blue-950">未対応の申請</p>
              <p className="mt-4 text-4xl font-bold text-blue-950">
                {requests.length}
                <span className="ml-1 text-base">件</span>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                現在承認待ちのアカウント申請です
              </p>
            </Card>

            <Card tone="green">
              <p className="text-sm font-bold text-blue-950">承認後の処理</p>
              <p className="mt-4 text-2xl font-bold text-blue-950">
                自動メール送信
              </p>
              <p className="mt-2 text-xs text-slate-500">
                学籍番号@ed.tus.ac.jp 宛にパスワード設定メールを送信します
              </p>
            </Card>

            <Card tone="orange">
              <p className="text-sm font-bold text-blue-950">
                作成される権限
              </p>
              <p className="mt-4 text-2xl font-bold text-blue-950">
                一般メンバー
              </p>
              <p className="mt-2 text-xs text-slate-500">
                必要に応じて後から幹部・管理者に変更してください
              </p>
            </Card>
          </section>

          <Card>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-blue-950">
                  未対応の申請一覧
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  承認すると Firebase Auth にアカウントを作成し、学生メール宛にパスワード設定メールを送信します。
                </p>
              </div>

              <StatusBadge tone="blue">{requests.length}件</StatusBadge>
            </div>

            {requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="font-semibold text-blue-950">
                  未対応の申請はありません
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  新しい申請が届くと、ここに表示されます。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const email = studentIdToAuthEmail(request.studentId);

                  return (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-bold text-blue-950">
                              {request.name}
                            </p>

                            <StatusBadge tone="orange">承認待ち</StatusBadge>
                          </div>

                          <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                            <p>学籍番号：{request.studentId}</p>
                            <p>学年：{request.grade}年</p>
                            <p>メインパート：{request.mainPart}</p>
                            <p>サブパート：{request.subPart || "-"}</p>
                            <p className="sm:col-span-2">送信先：{email}</p>
                          </div>

                          {request.note && (
                            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                              {request.note}
                            </p>
                          )}

                          <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                            承認すると、上記の学生メール宛にパスワード設定メールが送信されます。
                            初期パスワードを幹部が管理する必要はありません。
                            <br />
                            メールが届かない場合は、迷惑メールフォルダも確認するよう案内してください。
                          </p>
                        </div>

                        <div className="flex flex-col justify-end gap-2">
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={processingRequestId === request.id}
                            onClick={() => handleReject(request.id)}
                          >
                            却下
                          </Button>

                          <Button
                            className="w-full"
                            disabled={processingRequestId === request.id}
                            onClick={() => handleApprove(request)}
                          >
                            {processingRequestId === request.id
                              ? "処理中..."
                              : "承認してメール送信"}
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

        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white px-2 py-2 shadow-lg md:hidden">
          <div className="grid grid-cols-5 text-center text-xs font-semibold">
            <a href="/" className="text-slate-500">
              <div className="text-xl">⌂</div>
              ホーム
            </a>

            <a href="/applications" className="text-slate-500">
              <div className="text-xl">□</div>
              申請
            </a>

            <a href="/payment" className="text-slate-500">
              <div className="text-xl">¥</div>
              支払い
            </a>

            <a href="/notices" className="text-slate-500">
              <div className="text-xl">♢</div>
              お知らせ
            </a>

            <a href="/admin/account-requests" className="text-blue-600">
              <div className="text-xl">☰</div>
              管理
            </a>
          </div>
        </nav>
      </main>
    </div>
  );
}