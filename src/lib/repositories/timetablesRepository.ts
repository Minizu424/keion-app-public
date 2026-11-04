import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  Timetable,
  TimetableRow,
  TimetableRowSong,
  TimetableRowType,
  TimetableStatus,
} from "@/types/timetable";

type SaveTimetableParams = {
  eventId: string;
  eventTitle: string;
  status: TimetableStatus;
  isPublished: boolean;
  rows: TimetableRow[];
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

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
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

function asTimetableStatus(value: unknown): TimetableStatus {
  if (value === "draft" || value === "published") {
    return value;
  }

  return "draft";
}

function asTimetableRowType(value: unknown): TimetableRowType {
  if (value === "band" || value === "custom") {
    return value;
  }

  return "custom";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function asTimetableRowSong(value: unknown): TimetableRowSong | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  return {
    title: asString(data.title),
    artist: asString(data.artist),
  };
}

function asTimetableRowSongs(value: unknown): TimetableRowSong[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((song) => asTimetableRowSong(song))
    .filter((song): song is TimetableRowSong => song !== null);
}

function asTimetableRow(value: unknown): TimetableRow | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  return {
    id: asString(data.id),
    type: asTimetableRowType(data.type),
    title: asString(data.title),
    applicationId: asString(data.applicationId),
    bandName: asString(data.bandName),
    songs: asTimetableRowSongs(data.songs),
    memberNames: asStringArray(data.memberNames),
    memberStudentIds: asStringArray(data.memberStudentIds),
    startTime: asString(data.startTime),
    durationMinutes: asNumber(data.durationMinutes, 30),
    endTime: asString(data.endTime),
    note: asString(data.note),
  };
}

function asTimetableRows(value: unknown): TimetableRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => asTimetableRow(row))
    .filter((row): row is TimetableRow => row !== null);
}

function convertTimetable(
  id: string,
  data: Record<string, unknown>
): Timetable {
  return {
    id,
    eventId: asString(data.eventId),
    eventTitle: asString(data.eventTitle),
    status: asTimetableStatus(data.status),
    isPublished: asBoolean(data.isPublished),
    rows: asTimetableRows(data.rows),
    createdAt: asTimestampOrNull(data.createdAt),
    updatedAt: asTimestampOrNull(data.updatedAt),
  };
}

export async function getTimetableByEventId(
  eventId: string
): Promise<Timetable | null> {
  const timetableRef = doc(db, "timetables", eventId);
  const timetableSnap = await getDoc(timetableRef);

  if (!timetableSnap.exists()) {
    return null;
  }

  return convertTimetable(
    timetableSnap.id,
    timetableSnap.data() as Record<string, unknown>
  );
}

export async function getPublishedTimetables(): Promise<Timetable[]> {
  const timetablesRef = collection(db, "timetables");
  const timetablesQuery = query(
    timetablesRef,
    where("isPublished", "==", true)
  );
  const timetablesSnap = await getDocs(timetablesQuery);

  const timetables = timetablesSnap.docs.map((timetableDoc) =>
    convertTimetable(
      timetableDoc.id,
      timetableDoc.data() as Record<string, unknown>
    )
  );

  return timetables.sort((a, b) => {
    const aTime = a.updatedAt?.toMillis() ?? 0;
    const bTime = b.updatedAt?.toMillis() ?? 0;

    return bTime - aTime;
  });
}

export async function saveTimetable(
  params: SaveTimetableParams
): Promise<void> {
  const timetableRef = doc(db, "timetables", params.eventId);
  const timetableSnap = await getDoc(timetableRef);

  await setDoc(
    timetableRef,
    {
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      status: params.status,
      isPublished: params.isPublished,
      rows: params.rows,
      createdAt: timetableSnap.exists()
        ? timetableSnap.data().createdAt
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}