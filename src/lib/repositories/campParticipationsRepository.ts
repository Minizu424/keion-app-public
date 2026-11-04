import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type CampParticipationStatus = "join" | "absent" | "undecided";

export type CampParticipation = {
  id: string;
  eventId: string;
  uid: string;
  memberName: string;
  status: CampParticipationStatus;
  note: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

type SaveCampParticipationParams = {
  eventId: string;
  uid: string;
  memberName: string;
  status: CampParticipationStatus;
  note?: string;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
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

function asCampParticipationStatus(
  value: unknown
): CampParticipationStatus {
  if (value === "join" || value === "absent" || value === "undecided") {
    return value;
  }

  return "undecided";
}

function convertCampParticipation(
  id: string,
  data: Record<string, unknown>
): CampParticipation {
  return {
    id,
    eventId: asString(data.eventId),
    uid: asString(data.uid),
    memberName: asString(data.memberName),
    status: asCampParticipationStatus(data.status),
    note: asString(data.note),
    createdAt: asTimestampOrNull(data.createdAt),
    updatedAt: asTimestampOrNull(data.updatedAt),
  };
}

export async function getCampParticipationByEventAndUid(
  eventId: string,
  uid: string
): Promise<CampParticipation | null> {
  const participationsRef = collection(db, "campParticipations");

  const participationsQuery = query(
    participationsRef,
    where("eventId", "==", eventId),
    where("uid", "==", uid)
  );

  const participationsSnap = await getDocs(participationsQuery);
  const participationDoc = participationsSnap.docs[0];

  if (!participationDoc) {
    return null;
  }

  return convertCampParticipation(
    participationDoc.id,
    participationDoc.data() as Record<string, unknown>
  );
}

export async function hasJoinedCampParticipation(
  eventId: string,
  uid: string
): Promise<boolean> {
  const participation = await getCampParticipationByEventAndUid(eventId, uid);

  return participation?.status === "join";
}

export async function saveCampParticipation(
  params: SaveCampParticipationParams
): Promise<void> {
  const existingParticipation = await getCampParticipationByEventAndUid(
    params.eventId,
    params.uid
  );

  if (existingParticipation) {
    const participationRef = doc(
      db,
      "campParticipations",
      existingParticipation.id
    );

    await updateDoc(participationRef, {
      status: params.status,
      note: params.note ?? "",
      memberName: params.memberName,
      updatedAt: serverTimestamp(),
    });

    return;
  }

  const participationsRef = collection(db, "campParticipations");

  await addDoc(participationsRef, {
    eventId: params.eventId,
    uid: params.uid,
    memberName: params.memberName,
    status: params.status,
    note: params.note ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getCampParticipationsByEventId(
  eventId: string
): Promise<CampParticipation[]> {
  const participationsRef = collection(db, "campParticipations");
  const participationsQuery = query(
    participationsRef,
    where("eventId", "==", eventId)
  );
  const participationsSnap = await getDocs(participationsQuery);

  const participations = participationsSnap.docs.map((participationDoc) =>
    convertCampParticipation(
      participationDoc.id,
      participationDoc.data() as Record<string, unknown>
    )
  );

  return participations.sort((a, b) => {
    const aTime = a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
    const bTime = b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;

    return bTime - aTime;
  });
}