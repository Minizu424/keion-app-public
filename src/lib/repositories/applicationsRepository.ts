import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type ApplicationType = "live" | "camp" | "camp_live";

export type ApplicationStatus =
  | "submitted"
  | "checking"
  | "approved"
  | "rejected";

export type ApplicationPart =
  | "Vocal"
  | "Guitar"
  | "Bass"
  | "Drums"
  | "Keyboard"
  | "PA"
  | "Other";

export type ApplicationSong = {
  title: string;
  artist: string;
};

export type ApplicationMember = {
  uid: string;
  name: string;
  studentId: string;
  parts: ApplicationPart[];
};

export type Application = {
  id: string;
  eventId: string;
  eventTitle: string;
  applicationType: ApplicationType;
  applicantUid: string;
  applicantName: string;
  bandName: string;
  songs: ApplicationSong[];
  members: ApplicationMember[];
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  requiredMinutes: number;
  note: string;
  adminNote: string;
  status: ApplicationStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

type CreateApplicationParams = {
  eventId: string;
  eventTitle: string;
  applicationType: ApplicationType;
  applicantUid: string;
  applicantName: string;
  bandName: string;
  songs: ApplicationSong[];
  members: ApplicationMember[];
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  requiredMinutes: number;
  note?: string;
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

function asApplicationType(value: unknown): ApplicationType {
  if (value === "live" || value === "camp" || value === "camp_live") {
    return value;
  }

  return "live";
}

function asApplicationStatus(value: unknown): ApplicationStatus {
  if (
    value === "submitted" ||
    value === "checking" ||
    value === "approved" ||
    value === "rejected"
  ) {
    return value;
  }

  return "submitted";
}

function asApplicationPart(value: unknown): ApplicationPart | null {
  if (
    value === "Vocal" ||
    value === "Guitar" ||
    value === "Bass" ||
    value === "Drums" ||
    value === "Keyboard" ||
    value === "PA" ||
    value === "Other"
  ) {
    return value;
  }

  return null;
}

function asApplicationParts(value: unknown): ApplicationPart[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((part) => asApplicationPart(part))
    .filter((part): part is ApplicationPart => part !== null);
}

function asApplicationSong(value: unknown): ApplicationSong | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  return {
    title: asString(data.title),
    artist: asString(data.artist),
  };
}

function asApplicationSongs(value: unknown): ApplicationSong[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((song) => asApplicationSong(song))
    .filter((song): song is ApplicationSong => song !== null);
}

function asApplicationMember(value: unknown): ApplicationMember | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  return {
    uid: asString(data.uid),
    name: asString(data.name),
    studentId: asString(data.studentId),
    parts: asApplicationParts(data.parts),
  };
}

function asApplicationMembers(value: unknown): ApplicationMember[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((member) => asApplicationMember(member))
    .filter((member): member is ApplicationMember => member !== null);
}

function convertApplication(
  id: string,
  data: Record<string, unknown>
): Application {
  return {
    id,
    eventId: asString(data.eventId),
    eventTitle: asString(data.eventTitle),
    applicationType: asApplicationType(data.applicationType),
    applicantUid: asString(data.applicantUid),
    applicantName: asString(data.applicantName),
    bandName: asString(data.bandName),
    songs: asApplicationSongs(data.songs),
    members: asApplicationMembers(data.members),
    preferredDate: asString(data.preferredDate),
    preferredStartTime: asString(data.preferredStartTime),
    preferredEndTime: asString(data.preferredEndTime),
    requiredMinutes: asNumber(data.requiredMinutes),
    note: asString(data.note),
    adminNote: asString(data.adminNote),
    status: asApplicationStatus(data.status),
    createdAt: asTimestampOrNull(data.createdAt),
    updatedAt: asTimestampOrNull(data.updatedAt),
  };
}

export async function createApplication(
  params: CreateApplicationParams
): Promise<void> {
  const applicationsRef = collection(db, "applications");

  await addDoc(applicationsRef, {
    eventId: params.eventId,
    eventTitle: params.eventTitle,
    applicationType: params.applicationType,
    applicantUid: params.applicantUid,
    applicantName: params.applicantName,
    bandName: params.bandName,
    songs: params.songs,
    members: params.members,
    preferredDate: params.preferredDate,
    preferredStartTime: params.preferredStartTime,
    preferredEndTime: params.preferredEndTime,
    requiredMinutes: params.requiredMinutes,
    note: params.note ?? "",
    adminNote: "",
    status: "submitted" satisfies ApplicationStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getApplications(): Promise<Application[]> {
  const applicationsRef = collection(db, "applications");
  const applicationsSnap = await getDocs(applicationsRef);

  const applications = applicationsSnap.docs.map((applicationDoc) =>
    convertApplication(
      applicationDoc.id,
      applicationDoc.data() as Record<string, unknown>
    )
  );

  return applications.sort((a, b) => {
    const aTime = a.createdAt?.toMillis() ?? 0;
    const bTime = b.createdAt?.toMillis() ?? 0;

    return bTime - aTime;
  });
}

export async function getApplicationById(
  applicationId: string
): Promise<Application | null> {
  const applicationRef = doc(db, "applications", applicationId);
  const applicationSnap = await getDoc(applicationRef);

  if (!applicationSnap.exists()) {
    return null;
  }

  return convertApplication(
    applicationSnap.id,
    applicationSnap.data() as Record<string, unknown>
  );
}

export async function getApplicationsByEventId(
  eventId: string
): Promise<Application[]> {
  const applicationsRef = collection(db, "applications");
  const applicationsQuery = query(
    applicationsRef,
    where("eventId", "==", eventId)
  );
  const applicationsSnap = await getDocs(applicationsQuery);

  const applications = applicationsSnap.docs.map((applicationDoc) =>
    convertApplication(
      applicationDoc.id,
      applicationDoc.data() as Record<string, unknown>
    )
  );

  return applications.sort((a, b) => {
    const aTime = a.createdAt?.toMillis() ?? 0;
    const bTime = b.createdAt?.toMillis() ?? 0;

    return bTime - aTime;
  });
}

export async function getApplicationsByApplicantUid(
  applicantUid: string
): Promise<Application[]> {
  const applicationsRef = collection(db, "applications");
  const applicationsQuery = query(
    applicationsRef,
    where("applicantUid", "==", applicantUid)
  );
  const applicationsSnap = await getDocs(applicationsQuery);

  const applications = applicationsSnap.docs.map((applicationDoc) =>
    convertApplication(
      applicationDoc.id,
      applicationDoc.data() as Record<string, unknown>
    )
  );

  return applications.sort((a, b) => {
    const aTime = a.createdAt?.toMillis() ?? 0;
    const bTime = b.createdAt?.toMillis() ?? 0;

    return bTime - aTime;
  });
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus
): Promise<void> {
  const applicationRef = doc(db, "applications", applicationId);

  await updateDoc(applicationRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function updateApplicationAdminNote(
  applicationId: string,
  adminNote: string
): Promise<void> {
  const applicationRef = doc(db, "applications", applicationId);

  await updateDoc(applicationRef, {
    adminNote,
    updatedAt: serverTimestamp(),
  });
}