import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  getApplicationsByEventId,
  type Application,
  type ApplicationMember,
} from "@/lib/repositories/applicationsRepository";
import type {
  PaymentStatus,
  PaymentStatusCount,
  PaymentTarget,
} from "@/types/payment";

type CreatePaymentTargetsResult = {
  createdCount: number;
  skippedCount: number;
};

type PaymentMemberCandidate = {
  eventId: string;
  eventTitle: string;
  memberUid: string;
  memberName: string;
  studentId: string;
  bandNames: string[];
  applicationIds: string[];
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function asTimestampOrNull(value: unknown): Timestamp | null {
  if (
    value !== null &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value as Timestamp;
  }

  return null;
}

function asPaymentStatus(value: unknown): PaymentStatus {
  if (
    value === "unreported" ||
    value === "reported" ||
    value === "confirmed" ||
    value === "shortage"
  ) {
    return value;
  }

  return "unreported";
}

function sanitizeDocIdPart(value: string): string {
  return value.replace(/\//g, "_").trim() || "unknown";
}

function createPaymentTargetId(params: {
  eventId: string;
  studentId: string;
  memberUid: string;
}): string {
  const memberKey = params.studentId || params.memberUid;

  return [
    sanitizeDocIdPart(params.eventId),
    sanitizeDocIdPart(memberKey),
  ].join("__");
}

function convertPaymentTarget(
  id: string,
  data: Record<string, unknown>
): PaymentTarget {
  const bandNames = asStringArray(data.bandNames);
  const applicationIds = asStringArray(data.applicationIds);
  const fallbackBandName = asString(data.bandName);
  const fallbackApplicationId = asString(data.applicationId);

  return {
    id,
    eventId: asString(data.eventId),
    eventTitle: asString(data.eventTitle),
    applicationId: fallbackApplicationId,
    applicationIds:
      applicationIds.length > 0
        ? applicationIds
        : fallbackApplicationId
          ? [fallbackApplicationId]
          : [],
    bandName:
      bandNames.length > 0
        ? bandNames.join(" / ")
        : fallbackBandName,
    bandNames:
      bandNames.length > 0
        ? bandNames
        : fallbackBandName
          ? [fallbackBandName]
          : [],
    memberUid: asString(data.memberUid),
    memberName: asString(data.memberName),
    studentId: asString(data.studentId),
    amount: asNumber(data.amount),
    status: asPaymentStatus(data.status),
    reportedAt: asTimestampOrNull(data.reportedAt),
    note: asString(data.note),
    createdAt: asTimestampOrNull(data.createdAt),
    updatedAt: asTimestampOrNull(data.updatedAt),
  };
}

function shouldCreatePaymentFromApplication(application: Application): boolean {
  return (
    application.status === "approved" &&
    (application.applicationType === "live" ||
      application.applicationType === "camp_live" ||
      application.applicationType === "camp")
  );
}

function getMemberKey(member: ApplicationMember): string {
  return member.studentId || member.uid || member.name;
}

function buildPaymentMemberCandidates(
  applications: Application[]
): PaymentMemberCandidate[] {
  const candidateMap = new Map<string, PaymentMemberCandidate>();

  applications
    .filter((application) => shouldCreatePaymentFromApplication(application))
    .forEach((application) => {
      application.members.forEach((member) => {
        const memberKey = getMemberKey(member);

        if (!memberKey) {
          return;
        }

        const mapKey = `${application.eventId}__${memberKey}`;
        const existingCandidate = candidateMap.get(mapKey);

        if (existingCandidate) {
          if (
            application.bandName &&
            !existingCandidate.bandNames.includes(application.bandName)
          ) {
            existingCandidate.bandNames.push(application.bandName);
          }

          if (!existingCandidate.applicationIds.includes(application.id)) {
            existingCandidate.applicationIds.push(application.id);
          }

          if (!existingCandidate.memberUid && member.uid) {
            existingCandidate.memberUid = member.uid;
          }

          if (!existingCandidate.studentId && member.studentId) {
            existingCandidate.studentId = member.studentId;
          }

          if (!existingCandidate.memberName && member.name) {
            existingCandidate.memberName = member.name;
          }

          return;
        }

        candidateMap.set(mapKey, {
          eventId: application.eventId,
          eventTitle: application.eventTitle,
          memberUid: member.uid,
          memberName: member.name,
          studentId: member.studentId,
          bandNames: application.bandName ? [application.bandName] : [],
          applicationIds: [application.id],
        });
      });
    });

  return Array.from(candidateMap.values());
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "unreported":
      return "未報告";
    case "reported":
      return "報告済み";
    case "confirmed":
      return "確認済み";
    case "shortage":
      return "不足あり";
  }
}

export function countPaymentStatuses(
  paymentTargets: PaymentTarget[]
): PaymentStatusCount {
  return {
    unreported: paymentTargets.filter(
      (paymentTarget) => paymentTarget.status === "unreported"
    ).length,
    reported: paymentTargets.filter(
      (paymentTarget) => paymentTarget.status === "reported"
    ).length,
    confirmed: paymentTargets.filter(
      (paymentTarget) => paymentTarget.status === "confirmed"
    ).length,
    shortage: paymentTargets.filter(
      (paymentTarget) => paymentTarget.status === "shortage"
    ).length,
    total: paymentTargets.length,
  };
}

export async function getPaymentTargetsByEventId(
  eventId: string
): Promise<PaymentTarget[]> {
  const paymentTargetsRef = collection(db, "paymentStatuses");
  const paymentTargetsQuery = query(
    paymentTargetsRef,
    where("eventId", "==", eventId)
  );
  const paymentTargetsSnap = await getDocs(paymentTargetsQuery);

  const paymentTargets = paymentTargetsSnap.docs.map((paymentTargetDoc) =>
    convertPaymentTarget(
      paymentTargetDoc.id,
      paymentTargetDoc.data() as Record<string, unknown>
    )
  );

  return paymentTargets.sort((a, b) => {
    const statusOrder: Record<PaymentStatus, number> = {
      unreported: 1,
      reported: 2,
      shortage: 3,
      confirmed: 4,
    };

    if (a.status !== b.status) {
      return statusOrder[a.status] - statusOrder[b.status];
    }

    return a.studentId.localeCompare(b.studentId);
  });
}

export async function getPaymentTargetsByMember(params: {
  memberUid: string;
  studentId: string;
}): Promise<PaymentTarget[]> {
  const paymentTargetsRef = collection(db, "paymentStatuses");

  const paymentQueries = [
    query(paymentTargetsRef, where("memberUid", "==", params.memberUid)),
  ];

  if (params.studentId) {
    paymentQueries.push(
      query(paymentTargetsRef, where("studentId", "==", params.studentId))
    );
  }

  const paymentSnaps = await Promise.all(
    paymentQueries.map((paymentQuery) => getDocs(paymentQuery))
  );

  const paymentTargetMap = new Map<string, PaymentTarget>();

  paymentSnaps.forEach((paymentSnap) => {
    paymentSnap.docs.forEach((paymentTargetDoc) => {
      paymentTargetMap.set(
        paymentTargetDoc.id,
        convertPaymentTarget(
          paymentTargetDoc.id,
          paymentTargetDoc.data() as Record<string, unknown>
        )
      );
    });
  });

  return Array.from(paymentTargetMap.values()).sort((a, b) => {
    const statusOrder: Record<PaymentStatus, number> = {
      unreported: 1,
      shortage: 2,
      reported: 3,
      confirmed: 4,
    };

    if (a.status !== b.status) {
      return statusOrder[a.status] - statusOrder[b.status];
    }

    const aTime = a.createdAt?.toMillis() ?? 0;
    const bTime = b.createdAt?.toMillis() ?? 0;

    return bTime - aTime;
  });
}

export async function createPaymentTargetsFromApprovedApplications(params: {
  eventId: string;
  amount: number;
}): Promise<CreatePaymentTargetsResult> {
  const applications = await getApplicationsByEventId(params.eventId);
  const candidates = buildPaymentMemberCandidates(applications);

  let createdCount = 0;
  let skippedCount = 0;

  for (const candidate of candidates) {
    const paymentTargetId = createPaymentTargetId({
      eventId: candidate.eventId,
      studentId: candidate.studentId,
      memberUid: candidate.memberUid,
    });

    const paymentTargetRef = doc(db, "paymentStatuses", paymentTargetId);
    const paymentTargetSnap = await getDoc(paymentTargetRef);

    const baseData = {
      eventId: candidate.eventId,
      eventTitle: candidate.eventTitle,
      applicationId: candidate.applicationIds[0] ?? "",
      applicationIds: candidate.applicationIds,
      bandName: candidate.bandNames.join(" / "),
      bandNames: candidate.bandNames,
      memberUid: candidate.memberUid,
      memberName: candidate.memberName,
      studentId: candidate.studentId,
      amount: params.amount,
      updatedAt: serverTimestamp(),
    };

    if (paymentTargetSnap.exists()) {
      skippedCount += 1;

      await updateDoc(paymentTargetRef, baseData);

      continue;
    }

    await setDoc(paymentTargetRef, {
      ...baseData,
      status: "unreported" satisfies PaymentStatus,
      reportedAt: null,
      note: "",
      createdAt: serverTimestamp(),
    });

    createdCount += 1;
  }

  return {
    createdCount,
    skippedCount,
  };
}

export async function reportPayment(paymentTargetId: string): Promise<void> {
  const paymentTargetRef = doc(db, "paymentStatuses", paymentTargetId);

  await updateDoc(paymentTargetRef, {
    status: "reported" satisfies PaymentStatus,
    reportedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePaymentStatus(params: {
  paymentTargetId: string;
  status: PaymentStatus;
  note?: string;
}): Promise<void> {
  const paymentTargetRef = doc(db, "paymentStatuses", params.paymentTargetId);

  await updateDoc(paymentTargetRef, {
    status: params.status,
    note: params.note ?? "",
    updatedAt: serverTimestamp(),
  });
}

export async function updateManyPaymentStatuses(params: {
  paymentTargetIds: string[];
  status: PaymentStatus;
}): Promise<void> {
  await Promise.all(
    params.paymentTargetIds.map((paymentTargetId) =>
      updatePaymentStatus({
        paymentTargetId,
        status: params.status,
      })
    )
  );
}