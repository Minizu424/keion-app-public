"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getMemberByUid,
  type Member,
} from "@/lib/repositories/membersRepository";
import {
  getPaymentStatusLabel,
  getPaymentTargetsByMember,
  reportPayment,
} from "@/lib/repositories/paymentsRepository";
import type { PaymentStatus, PaymentTarget } from "@/types/payment";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

type TimestampLike = {
  toDate: () => Date;
} | null;

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

function getPaymentStatusDescription(status: PaymentStatus): string {
  switch (status) {
    case "unreported":
      return "支払いが完了したら、報告ボタンを押してください。";
    case "reported":
      return "報告済みです。幹部の確認を待っています。";
    case "confirmed":
      return "幹部による確認が完了しています。";
    case "shortage":
      return "不足または確認事項があります。備考を確認してください。";
  }
}

export default function PaymentPage() {
  const router = useRouter();

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [paymentTargets, setPaymentTargets] = useState<PaymentTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sortedPaymentTargets = useMemo(() => {
    const statusOrder: Record<PaymentStatus, number> = {
      unreported: 1,
      shortage: 2,
      reported: 3,
      confirmed: 4,
    };

    return [...paymentTargets].sort((a, b) => {
      if (a.status !== b.status) {
        return statusOrder[a.status] - statusOrder[b.status];
      }

      const aTime = a.createdAt?.toMillis() ?? 0;
      const bTime = b.createdAt?.toMillis() ?? 0;

      return bTime - aTime;
    });
  }, [paymentTargets]);

  async function loadPaymentTargets(member: Member): Promise<void> {
    setErrorMessage("");

    try {
      const paymentTargetData = await getPaymentTargetsByMember({
        memberUid: member.uid,
        studentId: member.studentId,
      });

      setPaymentTargets(paymentTargetData);
    } catch (error) {
      console.error(error);
      setErrorMessage("支払い情報を読み込めませんでした。");
    }
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

        setCurrentMember(memberData);
        await loadPaymentTargets(memberData);
      } catch (error) {
        console.error(error);
        setErrorMessage("画面の読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleReportPayment(paymentTarget: PaymentTarget): Promise<void> {
    if (!currentMember) {
      return;
    }

    const ok = window.confirm(
      `${paymentTarget.eventTitle} の支払いを報告しますか？\n\n報告日時が記録されます。`
    );

    if (!ok) {
      return;
    }

    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      await reportPayment(paymentTarget.id);
      await loadPaymentTargets(currentMember);
      setMessage("支払い報告を記録しました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("支払い報告に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <p className="text-sm font-semibold text-slate-500">
          支払い状況を読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-sm font-semibold text-blue-600">Payment</p>
          <h1 className="mt-1 text-2xl font-bold text-blue-950">
            支払い状況
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            自分に関係するライブ・合宿費用の支払い状況を確認できます。
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

        {sortedPaymentTargets.length === 0 ? (
          <Card>
            <h2 className="text-lg font-bold text-blue-950">
              支払い対象はありません
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              幹部が支払い対象者を登録すると、ここに表示されます。
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedPaymentTargets.map((paymentTarget) => (
              <Card key={paymentTarget.id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-blue-950">
                        {paymentTarget.eventTitle}
                      </h2>
                      <StatusBadge
                        tone={getPaymentStatusTone(paymentTarget.status)}
                      >
                        {getPaymentStatusLabel(paymentTarget.status)}
                      </StatusBadge>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      {getPaymentStatusDescription(paymentTarget.status)}
                    </p>

                    <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-500">
                          バンド名
                        </dt>
                        <dd className="mt-1 font-semibold text-blue-950">
                          {paymentTarget.bandName || "-"}
                        </dd>
                      </div>

                      <div>
                        <dt className="font-semibold text-slate-500">
                          請求額
                        </dt>
                        <dd className="mt-1 font-semibold text-blue-950">
                          {formatYen(paymentTarget.amount)}
                        </dd>
                      </div>

                      <div>
                        <dt className="font-semibold text-slate-500">
                          報告日時
                        </dt>
                        <dd className="mt-1 font-semibold text-blue-950">
                          {formatTimestamp(paymentTarget.reportedAt)}
                        </dd>
                      </div>

                      <div>
                        <dt className="font-semibold text-slate-500">備考</dt>
                        <dd className="mt-1 font-semibold text-blue-950">
                          {paymentTarget.note || "-"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="shrink-0">
                    <Button
                      disabled={
                        isSaving ||
                        paymentTarget.status === "reported" ||
                        paymentTarget.status === "confirmed"
                      }
                      onClick={() => handleReportPayment(paymentTarget)}
                    >
                      支払い報告する
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="mt-5 text-xs leading-relaxed text-slate-500">
          支払い報告では、振込明細や証明写真は提出しません。報告ボタンを押した日時のみ記録されます。
        </p>
      </div>
    </main>
  );
}