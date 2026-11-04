"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type ActionState = "checking" | "ready" | "completed" | "invalid";

export function AuthActionForm() {
  const searchParams = useSearchParams();

  const [actionState, setActionState] = useState<ActionState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    async function verifyActionCode() {
      if (mode !== "resetPassword" || !oobCode) {
        setActionState("invalid");
        return;
      }

      try {
        const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(verifiedEmail);
        setActionState("ready");
      } catch (error) {
        console.error(error);
        setActionState("invalid");
      }
    }

    verifyActionCode();
  }, [mode, oobCode]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");

    if (!oobCode) {
      setActionState("invalid");
      return;
    }

    if (!password || !passwordConfirm) {
      setErrorMessage("新しいパスワードと確認用パスワードを入力してください。");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("パスワードは6文字以上で入力してください。");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("パスワードが一致していません。");
      return;
    }

    try {
      setIsSubmitting(true);

      await confirmPasswordReset(auth, oobCode, password);

      setActionState("completed");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "パスワードの設定に失敗しました。リンクの有効期限が切れている可能性があります。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (actionState === "checking") {
    return (
      <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl shadow-blue-950/10 md:p-8">
        <p className="text-sm font-semibold text-slate-500">
          リンクを確認しています...
        </p>
      </div>
    );
  }

  if (actionState === "invalid") {
    return (
      <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl shadow-blue-950/10 md:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl font-bold text-red-600">
          !
        </div>

        <h1 className="text-2xl font-bold text-blue-950">
          リンクを確認できませんでした
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          リンクの有効期限が切れているか、すでに使用済みの可能性があります。
          <br />
          もう一度、パスワード設定メールを送ってもらってください。
        </p>

        <Link href="/login" className="mt-6 block">
          <Button className="w-full" size="lg">
            ログイン画面に戻る
          </Button>
        </Link>
      </div>
    );
  }

  if (actionState === "completed") {
    return (
      <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl shadow-blue-950/10 md:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-700">
          ✓
        </div>

        <h1 className="text-2xl font-bold text-blue-950">
          パスワードを設定しました
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          次回から、学籍番号と設定したパスワードでログインできます。
        </p>

        <Link href="/login" className="mt-6 block">
          <Button className="w-full" size="lg">
            ログイン画面へ
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-blue-950/10 backdrop-blur md:p-8">
      <div className="mb-7 text-center">
        <p className="mb-2 text-sm font-semibold text-blue-600">CROSS OVER</p>

        <h1 className="text-2xl font-bold text-blue-950">
          パスワード設定
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          新しいパスワードを設定してください。
        </p>

        {email && (
          <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-xs font-medium text-blue-800">
            対象メール：{email}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="新しいパスワード"
          name="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6文字以上で入力"
          autoComplete="new-password"
          leftIcon={<span>🔒</span>}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {showPassword ? "非表示" : "表示"}
            </button>
          }
        />

        <Input
          label="新しいパスワード（確認）"
          name="passwordConfirm"
          type={showPassword ? "text" : "password"}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="確認のためもう一度入力"
          autoComplete="new-password"
          leftIcon={<span>🔒</span>}
        />

        {errorMessage && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {errorMessage}
          </div>
        )}

        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-center text-xs leading-5 text-blue-800">
          設定したパスワードは次回以降のログインで使用します。
          <br />
          他サービスと同じパスワードは避けてください。
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "設定中..." : "パスワードを設定する"}
        </Button>
      </form>
    </div>
  );
}