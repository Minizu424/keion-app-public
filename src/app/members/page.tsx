import type { ComponentProps } from "react";
import {
  getMembers,
  type Member,
  type MemberRole,
  type MemberStatus,
} from "@/lib/repositories/membersRepository";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

type StatusBadgeTone = NonNullable<ComponentProps<typeof StatusBadge>["tone"]>;

function getRoleLabel(role: MemberRole): string {
  switch (role) {
    case "admin":
      return "管理者";
    case "executive":
      return "幹部";
    case "member":
      return "一般";
  }
}

function getRoleTone(role: MemberRole): StatusBadgeTone {
  switch (role) {
    case "admin":
      return "purple";
    case "executive":
      return "blue";
    case "member":
      return "gray";
  }
}

function getStatusLabel(status: MemberStatus): string {
  switch (status) {
    case "active":
      return "在籍中";
    case "inactive":
      return "停止中";
  }
}

function getStatusTone(status: MemberStatus): StatusBadgeTone {
  switch (status) {
    case "active":
      return "green";
    case "inactive":
      return "gray";
  }
}

function countExecutiveMembers(members: Member[]): number {
  return members.filter(
    (member) => member.role === "executive" || member.role === "admin"
  ).length;
}

function countActiveMembers(members: Member[]): number {
  return members.filter((member) => member.status === "active").length;
}

function countIncompleteProfiles(members: Member[]): number {
  return members.filter((member) => !member.isProfileCompleted).length;
}

export default async function MembersPage() {
  const members = await getMembers();

  return (
    <div className="min-h-screen bg-slate-50 md:flex">

      <main className="min-w-0 flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
          <h1 className="text-2xl font-bold text-blue-950">メンバー一覧</h1>
          <p className="mt-1 text-sm text-slate-500">
            登録済みメンバーの情報を一覧で確認できます。
          </p>
        </header>

        <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 md:px-8">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-sm font-semibold text-slate-500">
                登録メンバー
              </p>
              <p className="mt-2 text-3xl font-bold text-blue-950">
                {members.length}
                <span className="ml-1 text-base">名</span>
              </p>
            </Card>

            <Card tone="blue">
              <p className="text-sm font-semibold text-slate-500">幹部</p>
              <p className="mt-2 text-3xl font-bold text-blue-950">
                {countExecutiveMembers(members)}
                <span className="ml-1 text-base">名</span>
              </p>
            </Card>

            <Card tone="green">
              <p className="text-sm font-semibold text-slate-500">在籍中</p>
              <p className="mt-2 text-3xl font-bold text-blue-950">
                {countActiveMembers(members)}
                <span className="ml-1 text-base">名</span>
              </p>
            </Card>

            <Card tone="orange">
              <p className="text-sm font-semibold text-slate-500">
                プロフィール未完了
              </p>
              <p className="mt-2 text-3xl font-bold text-blue-950">
                {countIncompleteProfiles(members)}
                <span className="ml-1 text-base">名</span>
              </p>
            </Card>
          </section>

          <Card>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-blue-950">メンバー一覧</h2>
                <p className="mt-1 text-sm text-slate-500">
                  氏名、学籍番号、学年、パートを表示します。
                </p>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="font-semibold text-blue-950">
                  登録済みメンバーがいません
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Firebase の members コレクションにメンバーを追加すると表示されます。
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="px-3 py-3">氏名</th>
                      <th className="px-3 py-3">学年</th>
                      <th className="px-3 py-3">メインパート</th>
                      <th className="px-3 py-3">サブパート</th>
                      <th className="px-3 py-3">権限</th>
                      <th className="px-3 py-3">状態</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {members.map((member) => (
                      <tr
                        key={member.id}
                        className="text-sm transition hover:bg-slate-50"
                      >
                        <td className="px-3 py-4 font-semibold text-blue-950">
                          {member.name || "-"}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {member.grade > 0 ? `${member.grade}年` : "-"}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {member.mainPart || "-"}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {member.subPart || "-"}
                        </td>
                        <td className="px-3 py-4">
                          <StatusBadge tone={getRoleTone(member.role)}>
                            {getRoleLabel(member.role)}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-4">
                          <StatusBadge tone={getStatusTone(member.status)}>
                            {getStatusLabel(member.status)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}