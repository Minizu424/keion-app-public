import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-sky-50">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-100/80 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-8 md:px-8">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_480px]">
          <section className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-5xl shadow-lg shadow-blue-950/10">
              🎸
            </div>

            <h2 className="text-center text-4xl font-bold leading-tight text-blue-950">
              軽音サークル
              <br />
              運営支援アプリ
            </h2>

            <p className="mt-6 max-w-sm text-center text-base leading-8 text-slate-600">
              ライブや合宿の申請、支払い状況、メンバー管理を
              ひとつのアプリでわかりやすく管理します。
            </p>

            <div className="mt-12 w-full max-w-sm rounded-3xl border border-blue-100 bg-white/70 p-6 shadow-sm">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl">📝</p>
                  <p className="mt-2 text-xs font-semibold text-blue-950">
                    申請管理
                  </p>
                </div>
                <div>
                  <p className="text-2xl">💴</p>
                  <p className="mt-2 text-xs font-semibold text-blue-950">
                    支払い確認
                  </p>
                </div>
                <div>
                  <p className="text-2xl">👥</p>
                  <p className="mt-2 text-xs font-semibold text-blue-950">
                    メンバー管理
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="mb-6 text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-md shadow-blue-950/10">
                🎸
              </div>

              <h2 className="text-2xl font-bold text-blue-950">
                軽音サークル
                <br />
                運営支援アプリ
              </h2>
            </div>

            <LoginForm />

            <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <span>ヘルプ</span>
              <span>利用規約</span>
              <span>プライバシーポリシー</span>
              <span>お問い合わせ</span>
            </footer>

            <p className="mt-4 text-center text-xs text-slate-400">
              © 2026 軽音サークル運営支援アプリ
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}