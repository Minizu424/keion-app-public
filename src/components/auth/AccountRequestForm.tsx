"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SelectBox } from "@/components/ui/SelectBox";
import { createAccountRequest } from "@/lib/repositories/accountRequestsRepository";

const gradeOptions = [
  { label: "1年", value: "1" },
  { label: "2年", value: "2" },
  { label: "3年", value: "3" },
  { label: "4年", value: "4" },
  { label: "院1年", value: "5" },
  { label: "院2年", value: "6" },
  { label: "その他", value: "0" },
];

const partOptions = [
  { label: "ボーカル", value: "Vocal" },
  { label: "ギター", value: "Guitar" },
  { label: "ベース", value: "Bass" },
  { label: "ドラム", value: "Drums" },
  { label: "キーボード", value: "Keyboard" },
  { label: "PA", value: "PA" },
  { label: "その他", value: "Other" },
];

export function AccountRequestForm() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [grade, setGrade] = useState("");
  const [mainPart, setMainPart] = useState("");
  const [subPart, setSubPart] = useState("");
  const [note, setNote] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");

    if (!name || !studentId || !grade || !mainPart) {
      setErrorMessage("必須項目を入力してください。");
      return;
    }

    try {
      setIsSubmitting(true);

      await createAccountRequest({
        name,
        studentId,
        grade: Number(grade),
        mainPart,
        subPart,
        note,
      });

      setIsCompleted(true);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "申請の送信に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCompleted) {
    return (
      <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl shadow-blue-950/10 md:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-700">
          ✓
        </div>

        <h1 className="text-2xl font-bold text-blue-950">
          申請を送信しました
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          幹部が内容を確認したあと、アカウントを発行します。
          <br />
          発行後に、学籍番号と初期パスワードでログインしてください。
        </p>

        <Link href="/login" className="mt-6 block">
          <Button className="w-full" size="lg">
            ログイン画面に戻る
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-blue-950/10 backdrop-blur md:p-8">
      <div className="mb-7 text-center">
        <p className="mb-2 text-sm font-semibold text-blue-600">
          CROSS OVER
        </p>

        <h1 className="text-2xl font-bold text-blue-950">
          アカウント発行申請
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          アカウントをお持ちでない方は、幹部に発行を依頼してください。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="氏名"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 田村龍之介"
          leftIcon={<span>👤</span>}
        />

        <Input
          label="学籍番号"
          name="studentId"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="例: 4624078"
          leftIcon={<span>🎓</span>}
        />

        <SelectBox
          label="学年"
          name="grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          options={gradeOptions}
          placeholder="選択してください"
        />

        <SelectBox
          label="メインパート"
          name="mainPart"
          value={mainPart}
          onChange={(e) => setMainPart(e.target.value)}
          options={partOptions}
          placeholder="選択してください"
        />

        <SelectBox
          label="サブパート（任意）"
          name="subPart"
          value={subPart}
          onChange={(e) => setSubPart(e.target.value)}
          options={partOptions}
          placeholder="選択してください"
        />

        <Input
          label="備考（任意）"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="幹部に伝えたいことがあれば入力"
        />

        {errorMessage && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {errorMessage}
          </div>
        )}

        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-center text-xs leading-5 text-blue-800">
            幹部が内容を確認したあと、学生メール宛にパスワード設定メールを送信します。
            <br />
            メール内のリンクからパスワードを設定してください。
            <br />
            メールが届かない場合は、迷惑メールフォルダも確認してください。

        </div>

       
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "送信中..." : "申請を送信する"}
        </Button>

        <Link
          href="/login"
          className="block text-center text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          すでにアカウントをお持ちの方はこちら
        </Link>
      </form>
    </div>
  );
}