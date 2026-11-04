"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import {
  getApplications,
  type Application,
  type ApplicationStatus,
} from "@/lib/repositories/applicationsRepository";
import {
  getCampParticipationsByEventId,
  type CampParticipation,
  type CampParticipationStatus,
} from "@/lib/repositories/campParticipationsRepository";
import {
  getApplicationEventsByType,
  type ApplicationEvent,
} from "@/lib/repositories/eventsRepository";
import {
  getMemberByUid,
  getMembers,
  type Member,
} from "@/lib/repositories/membersRepository";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SelectBox } from "@/components/ui/SelectBox";
import { StatusBadge } from "@/components/ui/StatusBadge";

type AdminApplicationMode = "live" | "camp";
type ParticipationFilter = "all" | CampParticipationStatus;
type ApplicationStatusFilter = "all" | ApplicationStatus;

type ParticipationRow = CampParticipation & {
  studentId: string;
  mainPart: string;
  grade: number;
};

type CampParticipationCount = {
  join: number;
  absent: number;
  undecided: number;
  total: number;
};

function canAccessAdminPage(member: Member): boolean {
  return member.role === "executive" || member.role === "admin";
}

function formatEventDate(timestamp: ApplicationEvent["eventStartDate"]): string {
  if (!timestamp) {
    return "-";
  }

  return timestamp.toDate().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatEventDateRange(event: ApplicationEvent): string {
  const start = formatEventDate(event.eventStartDate);
  const end = formatEventDate(event.eventEndDate);

  if (start === "-" && end === "-") {
    return "-";
  }

  if (start === end || end === "-") {
    return start;
  }

  return `${start} 〜 ${end}`;
}

function getParticipationStatusLabel(status: CampParticipationStatus): string {
  switch (status) {
    case "join":
      return "参加";
    case "absent":
      return "不参加";
    case "undecided":
      return "未定";
  }
}

function getParticipationStatusTone(
  status: CampParticipationStatus
): "green" | "red" | "orange" {
  switch (status) {
    case "join":
      return "green";
    case "absent":
      return "red";
    case "undecided":
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

function getApplicationTypeLabel(application: Application): string {
  if (application.applicationType === "camp_live") {
    return "合宿ライブ";
  }

  return "通常ライブ";
}

function getSongTitle(application: Application): string {
  return (
    application.songs
      .map((song) => song.title)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

function formatTimeRange(application: Application): string {
  if (!application.preferredStartTime && !application.preferredEndTime) {
    return "希望なし";
  }

  return `${application.preferredStartTime || "-"} - ${
    application.preferredEndTime || "-"
  }`;
}

function createParticipationRows(
  participations: CampParticipation[],
  members: Member[]
): ParticipationRow[] {
  return participations.map((participation) => {
    const member = members.find(
      (memberItem) => memberItem.uid === participation.uid
    );

    return {
      ...participation,
      studentId: member?.studentId ?? "-",
      mainPart: member?.mainPart ?? "-",
      grade: member?.grade ?? 0,
    };
  });
}

function countCampParticipations(
  participations: CampParticipation[]
): CampParticipationCount {
  return {
    join: participations.filter(
      (participation) => participation.status === "join"
    ).length,
    absent: participations.filter(
      (participation) => participation.status === "absent"
    ).length,
    undecided: participations.filter(
      (participation) => participation.status === "undecided"
    ).length,
    total: participations.length,
  };
}

function sortEvents(events: ApplicationEvent[]): ApplicationEvent[] {
  return [...events].sort((a, b) => {
    const aTime = a.eventStartDate?.toMillis() ?? 0;
    const bTime = b.eventStartDate?.toMillis() ?? 0;

    return bTime - aTime;
  });
}

export default function AdminApplicationsPage() {
  const router = useRouter();

  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [mode, setMode] = useState<AdminApplicationMode>("live");

  const [liveEvents, setLiveEvents] = useState<ApplicationEvent[]>([]);
  const [campLiveEvents, setCampLiveEvents] = useState<ApplicationEvent[]>([]);
  const [campEvents, setCampEvents] = useState<ApplicationEvent[]>([]);

  const [selectedLiveEventId, setSelectedLiveEventId] = useState("");
  const [selectedCampEventId, setSelectedCampEventId] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [campParticipations, setCampParticipations] = useState<
    CampParticipation[]
  >([]);
  const [campParticipationCounts, setCampParticipationCounts] = useState<
    Record<string, CampParticipationCount>
  >({});

  const [applicationSearchWord, setApplicationSearchWord] = useState("");
  const [applicationStatusFilter, setApplicationStatusFilter] =
    useState<ApplicationStatusFilter>("all");

  const [participationSearchWord, setParticipationSearchWord] = useState("");
  const [participationFilter, setParticipationFilter] =
    useState<ParticipationFilter>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isCampDataLoading, setIsCampDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const allLiveCategoryEvents = useMemo(() => {
    return sortEvents([...liveEvents, ...campLiveEvents]);
  }, [liveEvents, campLiveEvents]);

  const selectedLiveEvent = useMemo(() => {
    return (
      allLiveCategoryEvents.find((event) => event.id === selectedLiveEventId) ??
      null
    );
  }, [allLiveCategoryEvents, selectedLiveEventId]);

  const selectedCampEvent = useMemo(() => {
    return campEvents.find((event) => event.id === selectedCampEventId) ?? null;
  }, [campEvents, selectedCampEventId]);

  const selectedLiveApplications = useMemo(() => {
    if (!selectedLiveEventId) {
      return [];
    }

    return applications.filter(
      (application) =>
        application.eventId === selectedLiveEventId &&
        (application.applicationType === "live" ||
          application.applicationType === "camp_live")
    );
  }, [applications, selectedLiveEventId]);

  const filteredLiveApplications = useMemo(() => {
    const searchWord = applicationSearchWord.trim().toLowerCase();

    return selectedLiveApplications.filter((application) => {
      const matchesStatus =
        applicationStatusFilter === "all" ||
        application.status === applicationStatusFilter;

      const matchesSearch =
        searchWord.length === 0 ||
        application.eventTitle.toLowerCase().includes(searchWord) ||
        application.bandName.toLowerCase().includes(searchWord) ||
        application.applicantName.toLowerCase().includes(searchWord) ||
        getSongTitle(application).toLowerCase().includes(searchWord);

      return matchesStatus && matchesSearch;
    });
  }, [
    selectedLiveApplications,
    applicationSearchWord,
    applicationStatusFilter,
  ]);

  const participationRows = useMemo(
    () => createParticipationRows(campParticipations, members),
    [campParticipations, members]
  );

  const participationSummary = useMemo(
    () => countCampParticipations(campParticipations),
    [campParticipations]
  );

  const filteredParticipationRows = useMemo(() => {
    const searchWord = participationSearchWord.trim().toLowerCase();

    return participationRows.filter((row) => {
      const matchesStatus =
        participationFilter === "all" || row.status === participationFilter;

      const matchesSearch =
        searchWord.length === 0 ||
        row.memberName.toLowerCase().includes(searchWord) ||
        row.studentId.toLowerCase().includes(searchWord) ||
        row.mainPart.toLowerCase().includes(searchWord) ||
        row.note.toLowerCase().includes(searchWord);

      return matchesStatus && matchesSearch;
    });
  }, [participationRows, participationFilter, participationSearchWord]);

  const liveSummary = useMemo(
    () => ({
      total: applications.filter(
        (application) =>
          application.applicationType === "live" ||
          application.applicationType === "camp_live"
      ).length,
      submitted: applications.filter(
        (application) =>
          (application.applicationType === "live" ||
            application.applicationType === "camp_live") &&
          application.status === "submitted"
      ).length,
      checking: applications.filter(
        (application) =>
          (application.applicationType === "live" ||
            application.applicationType === "camp_live") &&
          application.status === "checking"
      ).length,
      approved: applications.filter(
        (application) =>
          (application.applicationType === "live" ||
            application.applicationType === "camp_live") &&
          application.status === "approved"
      ).length,
    }),
    [applications]
  );

  const campSummary = useMemo(() => {
    const counts = Object.values(campParticipationCounts);

    return {
      total: counts.reduce((sum, count) => sum + count.total, 0),
      join: counts.reduce((sum, count) => sum + count.join, 0),
      absent: counts.reduce((sum, count) => sum + count.absent, 0),
      undecided: counts.reduce((sum, count) => sum + count.undecided, 0),
    };
  }, [campParticipationCounts]);

  async function loadCampParticipations(campEventId: string): Promise<void> {
    setIsCampDataLoading(true);
    setErrorMessage("");

    try {
      const participations = await getCampParticipationsByEventId(campEventId);
      setCampParticipations(participations);
    } catch (error) {
      console.error(error);
      setErrorMessage("合宿参加申請の取得に失敗しました。");
    } finally {
      setIsCampDataLoading(false);
    }
  }

  async function loadCampParticipationCounts(
    targetCampEvents: ApplicationEvent[]
  ): Promise<void> {
    const entries = await Promise.all(
      targetCampEvents.map(async (campEvent) => {
        const participations = await getCampParticipationsByEventId(
          campEvent.id
        );

        return [campEvent.id, countCampParticipations(participations)] as const;
      })
    );

    setCampParticipationCounts(Object.fromEntries(entries));
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const [
          member,
          applicationList,
          liveEventList,
          campLiveEventList,
          campEventList,
          memberList,
        ] = await Promise.all([
          getMemberByUid(user.uid),
          getApplications(),
          getApplicationEventsByType("live"),
          getApplicationEventsByType("camp_live"),
          getApplicationEventsByType("camp"),
          getMembers(),
        ]);

        if (!member || !canAccessAdminPage(member)) {
          router.push("/");
          return;
        }

        const sortedCampEvents = sortEvents(campEventList);

        setCurrentMember(member);
        setApplications(applicationList);
        setLiveEvents(sortEvents(liveEventList));
        setCampLiveEvents(sortEvents(campLiveEventList));
        setCampEvents(sortedCampEvents);
        setMembers(memberList);

        await loadCampParticipationCounts(sortedCampEvents);
      } catch (error) {
        console.error(error);
        setErrorMessage("申請管理ページの読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  function handleSelectLiveEvent(eventId: string): void {
    setSelectedLiveEventId(eventId);
    setApplicationSearchWord("");
    setApplicationStatusFilter("all");
  }

  async function handleSelectCampEvent(eventId: string): Promise<void> {
    setSelectedCampEventId(eventId);
    setParticipationSearchWord("");
    setParticipationFilter("all");
    await loadCampParticipations(eventId);
  }

  function handleChangeMode(nextMode: AdminApplicationMode): void {
    setMode(nextMode);
    setSelectedLiveEventId("");
    setSelectedCampEventId("");
    setCampParticipations([]);
    setApplicationSearchWord("");
    setApplicationStatusFilter("all");
    setParticipationSearchWord("");
    setParticipationFilter("all");
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">
          申請管理ページを読み込み中...
        </p>
      </main>
    );
  }

  if (!currentMember) {
    return null;
  }

  return (
    <main className="min-w-0 flex-1">
      <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
        <h1 className="text-2xl font-bold text-blue-950">申請管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          ライブ申請と合宿参加申請をイベントごとに確認します。
        </p>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-5 py-6 md:px-8">
        {errorMessage && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {errorMessage}
          </div>
        )}

        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-blue-950">申請種別</h2>
              <p className="mt-1 text-sm text-slate-500">
                先に申請の種類を選び、次にイベントを選択します。
              </p>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => handleChangeMode("live")}
                className={[
                  "rounded-lg px-5 py-2 text-sm font-semibold transition",
                  mode === "live"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-blue-700",
                ].join(" ")}
              >
                ライブ申請
              </button>

              <button
                type="button"
                onClick={() => handleChangeMode("camp")}
                className={[
                  "rounded-lg px-5 py-2 text-sm font-semibold transition",
                  mode === "camp"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-blue-700",
                ].join(" ")}
              >
                合宿申請
              </button>
            </div>
          </div>
        </Card>

        {mode === "live" ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card tone="blue">
                <p className="text-sm font-semibold text-slate-500">
                  ライブ申請
                </p>
                <p className="mt-2 text-3xl font-bold text-blue-950">
                  {liveSummary.total}件
                </p>
              </Card>

              <Card>
                <p className="text-sm font-semibold text-slate-500">未確認</p>
                <p className="mt-2 text-3xl font-bold text-blue-950">
                  {liveSummary.submitted}件
                </p>
              </Card>

              <Card tone="blue">
                <p className="text-sm font-semibold text-slate-500">確認中</p>
                <p className="mt-2 text-3xl font-bold text-blue-950">
                  {liveSummary.checking}件
                </p>
              </Card>

              <Card tone="green">
                <p className="text-sm font-semibold text-slate-500">承認済み</p>
                <p className="mt-2 text-3xl font-bold text-blue-950">
                  {liveSummary.approved}件
                </p>
              </Card>
            </div>

            {!selectedLiveEvent ? (
              <Card>
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-blue-950">
                    ライブ申請カテゴリ
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    6月ライブ、夏合宿ライブなど、確認したいイベントを選択してください。
                  </p>
                </div>

                {allLiveCategoryEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="font-semibold text-blue-950">
                      ライブ申請イベントがありません
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {allLiveCategoryEvents.map((event) => {
                      const eventApplications = applications.filter(
                        (application) => application.eventId === event.id
                      );

                      const uncheckedCount = eventApplications.filter(
                        (application) => application.status === "submitted"
                      ).length;

                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => handleSelectLiveEvent(event.id)}
                          className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <StatusBadge
                              tone={
                                event.type === "camp_live" ? "orange" : "blue"
                              }
                            >
                              {event.type === "camp_live"
                                ? "合宿ライブ"
                                : "通常ライブ"}
                            </StatusBadge>

                            <span className="text-xs font-semibold text-slate-400">
                              {eventApplications.length}件
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-blue-950">
                            {event.title}
                          </h3>

                          <p className="mt-2 text-sm text-slate-500">
                            日程：{formatEventDateRange(event)}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            会場：{event.venue || "-"}
                          </p>

                          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            未確認：{uncheckedCount}件 / 全申請：
                            {eventApplications.length}件
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <Card>
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="mb-2">
                      <StatusBadge
                        tone={
                          selectedLiveEvent.type === "camp_live"
                            ? "orange"
                            : "blue"
                        }
                      >
                        {selectedLiveEvent.type === "camp_live"
                          ? "合宿ライブ"
                          : "通常ライブ"}
                      </StatusBadge>
                    </div>

                    <h2 className="text-lg font-bold text-blue-950">
                      {selectedLiveEvent.title}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      日程：{formatEventDateRange(selectedLiveEvent)} / 会場：
                      {selectedLiveEvent.venue || "-"}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedLiveEventId("")}
                  >
                    カテゴリ一覧に戻る
                  </Button>
                </div>

                <ApplicationTableSection
                  applications={filteredLiveApplications}
                  searchWord={applicationSearchWord}
                  statusFilter={applicationStatusFilter}
                  onChangeSearchWord={setApplicationSearchWord}
                  onChangeStatusFilter={setApplicationStatusFilter}
                  emptyMessage="条件に合うライブ申請はありません"
                />
              </Card>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card tone="blue">
                <p className="text-sm font-semibold text-slate-500">
                  合宿参加申請
                </p>
                <p className="mt-2 text-3xl font-bold text-blue-950">
                  {campSummary.total}件
                </p>
              </Card>

              <Card tone="green">
                <p className="text-sm font-semibold text-slate-500">参加</p>
                <p className="mt-2 text-3xl font-bold text-blue-950">
                  {campSummary.join}人
                </p>
              </Card>

              <Card>
                <p className="text-sm font-semibold text-slate-500">不参加</p>
                <p className="mt-2 text-3xl font-bold text-blue-950">
                  {campSummary.absent}人
                </p>
              </Card>

              <Card tone="orange">
                <p className="text-sm font-semibold text-slate-500">未定</p>
                <p className="mt-2 text-3xl font-bold text-blue-950">
                  {campSummary.undecided}人
                </p>
              </Card>
            </div>

            {!selectedCampEvent ? (
              <Card>
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-blue-950">
                    合宿申請カテゴリ
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    夏合宿、冬合宿など、確認したい合宿を選択してください。
                  </p>
                </div>

                {campEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="font-semibold text-blue-950">
                      合宿イベントがありません
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {campEvents.map((event) => {
                      const count = campParticipationCounts[event.id] ?? {
                        join: 0,
                        absent: 0,
                        undecided: 0,
                        total: 0,
                      };

                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => handleSelectCampEvent(event.id)}
                          className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <StatusBadge tone="orange">合宿参加</StatusBadge>

                            <span className="text-xs font-semibold text-slate-400">
                              {count.total}件
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-blue-950">
                            {event.title}
                          </h3>

                          <p className="mt-2 text-sm text-slate-500">
                            日程：{formatEventDateRange(event)}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            会場：{event.venue || "-"}
                          </p>

                          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            参加：{count.join}人 / 不参加：{count.absent}人 /
                            未定：{count.undecided}人
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <Card>
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="mb-2">
                      <StatusBadge tone="orange">合宿参加</StatusBadge>
                    </div>

                    <h2 className="text-lg font-bold text-blue-950">
                      {selectedCampEvent.title}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      日程：{formatEventDateRange(selectedCampEvent)} / 会場：
                      {selectedCampEvent.venue || "-"}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedCampEventId("");
                      setCampParticipations([]);
                    }}
                  >
                    カテゴリ一覧に戻る
                  </Button>
                </div>

                <div className="mb-5 grid gap-4 md:grid-cols-3">
                  <Card tone="green">
                    <p className="text-sm font-semibold text-slate-500">参加</p>
                    <p className="mt-2 text-3xl font-bold text-blue-950">
                      {participationSummary.join}人
                    </p>
                  </Card>

                  <Card>
                    <p className="text-sm font-semibold text-slate-500">
                      不参加
                    </p>
                    <p className="mt-2 text-3xl font-bold text-blue-950">
                      {participationSummary.absent}人
                    </p>
                  </Card>

                  <Card tone="orange">
                    <p className="text-sm font-semibold text-slate-500">未定</p>
                    <p className="mt-2 text-3xl font-bold text-blue-950">
                      {participationSummary.undecided}人
                    </p>
                  </Card>
                </div>

                {isCampDataLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="font-semibold text-blue-950">読み込み中...</p>
                  </div>
                ) : (
                  <CampParticipationTableSection
                    rows={filteredParticipationRows}
                    searchWord={participationSearchWord}
                    statusFilter={participationFilter}
                    onChangeSearchWord={setParticipationSearchWord}
                    onChangeStatusFilter={setParticipationFilter}
                  />
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
}

type ApplicationTableSectionProps = {
  applications: Application[];
  searchWord: string;
  statusFilter: ApplicationStatusFilter;
  onChangeSearchWord: (value: string) => void;
  onChangeStatusFilter: (value: ApplicationStatusFilter) => void;
  emptyMessage: string;
};

function ApplicationTableSection({
  applications,
  searchWord,
  statusFilter,
  onChangeSearchWord,
  onChangeStatusFilter,
  emptyMessage,
}: ApplicationTableSectionProps) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <Input
          label="検索"
          name="applicationSearch"
          value={searchWord}
          onChange={(event) => onChangeSearchWord(event.target.value)}
          placeholder="バンド名・曲名・申請者で検索"
        />

        <SelectBox
          label="ステータス"
          name="applicationStatusFilter"
          value={statusFilter}
          onChange={(event) =>
            onChangeStatusFilter(event.target.value as ApplicationStatusFilter)
          }
          placeholder=""
          options={[
            { label: "すべて", value: "all" },
            { label: "未確認", value: "submitted" },
            { label: "確認中", value: "checking" },
            { label: "承認済み", value: "approved" },
            { label: "却下", value: "rejected" },
          ]}
        />
      </div>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="font-semibold text-blue-950">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">種別</th>
                  <th className="px-4 py-3">バンド名</th>
                  <th className="px-4 py-3">曲名</th>
                  <th className="px-4 py-3">希望日</th>
                  <th className="px-4 py-3">希望時間</th>
                  <th className="px-4 py-3">人数</th>
                  <th className="px-4 py-3">ステータス</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge
                        tone={
                          application.applicationType === "camp_live"
                            ? "orange"
                            : "blue"
                        }
                      >
                        {getApplicationTypeLabel(application)}
                      </StatusBadge>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-950">
                      {application.bandName || "-"}
                      <p className="mt-0.5 text-xs font-normal text-slate-500">
                        申請者：{application.applicantName || "-"}
                      </p>
                    </td>

                    <td className="min-w-56 px-4 py-3 text-slate-600">
                      {getSongTitle(application)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {application.preferredDate || "希望なし"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatTimeRange(application)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {application.members.length}人
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge
                        tone={getApplicationStatusTone(application.status)}
                      >
                        {getApplicationStatusLabel(application.status)}
                      </StatusBadge>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <Link href={`/admin/applications/${application.id}`}>
                        <Button size="sm" variant="outline">
                          申請管理
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

type CampParticipationTableSectionProps = {
  rows: ParticipationRow[];
  searchWord: string;
  statusFilter: ParticipationFilter;
  onChangeSearchWord: (value: string) => void;
  onChangeStatusFilter: (value: ParticipationFilter) => void;
};

function CampParticipationTableSection({
  rows,
  searchWord,
  statusFilter,
  onChangeSearchWord,
  onChangeStatusFilter,
}: CampParticipationTableSectionProps) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <Input
          label="検索"
          name="participationSearch"
          value={searchWord}
          onChange={(event) => onChangeSearchWord(event.target.value)}
          placeholder="名前・学籍番号・パート・備考で検索"
        />

        <SelectBox
          label="参加状況"
          name="participationFilter"
          value={statusFilter}
          onChange={(event) =>
            onChangeStatusFilter(event.target.value as ParticipationFilter)
          }
          placeholder=""
          options={[
            { label: "すべて", value: "all" },
            { label: "参加", value: "join" },
            { label: "不参加", value: "absent" },
            { label: "未定", value: "undecided" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="font-semibold text-blue-950">
            条件に合う合宿参加申請はありません
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">名前</th>
                  <th className="px-4 py-3">学籍番号</th>
                  <th className="px-4 py-3">学年</th>
                  <th className="px-4 py-3">パート</th>
                  <th className="px-4 py-3">参加状況</th>
                  <th className="px-4 py-3">備考</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-950">
                      {row.memberName}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.studentId}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.grade > 0 ? `${row.grade}年` : "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.mainPart}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge
                        tone={getParticipationStatusTone(row.status)}
                      >
                        {getParticipationStatusLabel(row.status)}
                      </StatusBadge>
                    </td>

                    <td className="min-w-64 px-4 py-3 text-slate-600">
                      {row.note || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}