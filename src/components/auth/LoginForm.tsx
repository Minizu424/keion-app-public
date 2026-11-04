"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import { studentIdToAuthEmail } from "@/lib/firebase/authEmail";
import { getMemberByUid } from "@/lib/repositories/membersRepository";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const router = useRouter();

  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");

    const normalizedStudentId = studentId.trim();

    if (!normalizedStudentId || !password) {
      setErrorMessage("学籍番号とパスワードを入力してください。");
      return;
    }

    try {
      setIsSubmitting(true);

      const email = studentIdToAuthEmail(normalizedStudentId);

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const member = await getMemberByUid(userCredential.user.uid);

      if (!member) {
        setErrorMessage(
          "メンバー情報が見つかりません。幹部にアカウント状態を確認してください。"
        );
        return;
      }

      if (member.status !== "active") {
        setErrorMessage("このアカウントは現在利用できません。");
        return;
      }

      router.push("/");
    } catch (error) {
      console.error(error);
      setErrorMessage("学籍番号またはパスワードが間違っています。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-blue-950/10 backdrop-blur md:p-8">
      <div className="mb-7 text-center">
        <p className="mb-2 text-sm font-semibold text-blue-600">CROSS OVER</p>

        <h1 className="text-2xl font-bold text-blue-950">ログイン</h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          学籍番号と設定済みのパスワードでログインしてください
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <Input
            label="学籍番号"
            name="studentId"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="例: 4624078"
            autoComplete="username"
            leftIcon={<span>👤</span>}
          />

          <Input
            label="パスワード"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワードを入力"
            autoComplete="current-password"
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
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {errorMessage}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "ログイン中..." : "ログインする"}
        </Button>

        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-center text-xs leading-5 text-blue-800">
          アカウント承認後、学生メール宛にパスワード設定メールが届きます。
          <br />
          メール内のリンクからパスワードを設定してください。
        </div>

        <div className="space-y-2 text-center text-sm">
          <Link
            href="/account-request"
            className="block font-semibold text-blue-600 hover:text-blue-700"
          >
            アカウントをお持ちでない方はこちら
          </Link>

          <button
            type="button"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            パスワードを忘れた方はこちら
          </button>

          <p className="text-xs text-slate-400">
            ログインできない場合は幹部に連絡してください
          </p>
        </div>
      </form>
    </div>
  );
}