import Link from "next/link";

type SidebarItem = {
  label: string;
  href: string;
  icon?: string;
  adminOnly?: boolean;
};

const sidebarItems: SidebarItem[] = [
  {
    label: "ホーム",
    href: "/",
    icon: "⌂",
  },
  {
    label: "ライブ / 合宿申請",
    href: "/applications",
    icon: "✎",
  },
  {
    label: "支払い状況",
    href: "/payment",
    icon: "¥",
  },
  {
    label: "タイムテーブル",
    href: "/timetable",
    icon: "▦",
  },
  {
    label: "タイムテーブル作成",
    href: "/timetable/edit",
    icon: "☷",
    adminOnly: true,
  },
  {
    label: "イベント管理",
    href: "/admin/events",
    icon: "＋",
    adminOnly: true,
  },
  {
    label: "防音室予約",
    href: "/rooms",
    icon: "⌂",
  },
  {
    label: "お知らせ",
    href: "/notices",
    icon: "♢",
  },
  {
    label: "バンド募集",
    href: "/recruitment",
    icon: "♪",
  },
  {
    label: "申請管理",
    href: "/admin/applications",
    icon: "□",
    adminOnly: true,
  },
  {
    label: "支払い管理",
    href: "/admin/payments",
    icon: "✓",
    adminOnly: true,
  },
  {
    label: "アカウント申請管理",
    href: "/admin/account-requests",
    icon: "✓",
    adminOnly: true,
  },
  {
    label: "プロフィール",
    href: "/profile",
    icon: "○",
  },
];

type SidebarProps = {
  activePath?: string;
  userName?: string;
  userDescription?: string;
  isExecutive?: boolean;
  showAdminLinks?: boolean;
};

export function Sidebar({
  activePath = "/",
  userName = "ゲスト",
  userDescription = "未設定",
  isExecutive = false,
  showAdminLinks,
}: SidebarProps) {
  const shouldShowAdminLinks = showAdminLinks ?? isExecutive;

  const visibleSidebarItems = sidebarItems.filter((item) => {
    if (item.adminOnly) {
      return shouldShowAdminLinks;
    }

    return true;
  });

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-blue-900 bg-blue-950 px-4 py-6 text-white md:flex md:flex-col">
      <div className="mb-8 px-2">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">
          🎸
        </div>

        <p className="text-xs font-semibold text-blue-200">軽音サークル</p>
        <h1 className="mt-1 text-lg font-bold leading-snug">
          運営支援アプリ
        </h1>
      </div>

      <nav className="space-y-1">
        {visibleSidebarItems.map((item) => {
          const isActive =
            activePath === item.href ||
            (item.href !== "/" && activePath.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-blue-100 hover:bg-blue-900 hover:text-white",
              ].join(" ")}
            >
              {item.icon && (
                <span className="flex h-6 w-6 items-center justify-center text-base">
                  {item.icon}
                </span>
              )}

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-5">
        <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg text-blue-950">
            👤
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="mt-0.5 truncate text-xs text-blue-200">
              {userDescription}
            </p>
          </div>

          <span className="text-blue-200">›</span>
        </div>
      </div>
    </aside>
  );
}