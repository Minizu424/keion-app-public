import { Suspense } from "react";
import { AuthActionForm } from "@/components/auth/AuthActionForm";

export default function AuthActionPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-sky-50">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-100/80 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-8 md:px-8">
        <section className="mx-auto w-full max-w-md">
          <Suspense
            fallback={
              <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl shadow-blue-950/10 md:p-8">
                <p className="text-sm font-semibold text-slate-500">
                  リンクを確認しています...
                </p>
              </div>
            }
          >
            <AuthActionForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}