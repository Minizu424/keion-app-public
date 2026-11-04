import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp as FirestoreTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type ApplicationEventType = "live" | "camp" | "camp_live";

export type ApplicationEventStatus = "draft" | "open" | "closed" | "archived";

export type ApplicationEvent = {
  id: string;
  title: string;
  type: ApplicationEventType;
  venue: string;
  parentEventId: string;
  eventStartDate: FirestoreTimestamp | null;
  eventEndDate: FirestoreTimestamp | null;
  applicationStartAt: FirestoreTimestamp | null;
  applicationEndAt: FirestoreTimestamp | null;
  status: ApplicationEventStatus;
  createdAt: FirestoreTimestamp | null;
  updatedAt: FirestoreTimestamp | null;
};

type CreateApplicationEventParams = {
  title: string;
  type: ApplicationEventType;
  venue: string;
  parentEventId?: string;
  eventStartDate: Date | null;
  eventEndDate: Date | null;
  applicationStartAt: Date | null;
  applicationEndAt: Date | null;
  status?: ApplicationEventStatus;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asTimestampOrNull(value: unknown): FirestoreTimestamp | null {
  if (
    value !== null &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value as FirestoreTimestamp;
  }

  return null;
}

function toTimestampOrNull(value: Date | null): FirestoreTimestamp | null {
  if (!value) {
    return null;
  }

  return Timestamp.fromDate(value);
}

function asApplicationEventType(value: unknown): ApplicationEventType {
  if (value === "live" || value === "camp" || value === "camp_live") {
    return value;
  }

  return "live";
}

function asApplicationEventStatus(value: unknown): ApplicationEventStatus {
  if (
    value === "draft" ||
    value === "open" ||
    value === "closed" ||
    value === "archived"
  ) {
    return value;
  }

  return "draft";
}

function convertApplicationEvent(
  id: string,
  data: Record<string, unknown>
): ApplicationEvent {
  return {
    id,
    title: asString(data.title),
    type: asApplicationEventType(data.type),
    venue: asString(data.venue),
    parentEventId: asString(data.parentEventId),
    eventStartDate: asTimestampOrNull(data.eventStartDate),
    eventEndDate: asTimestampOrNull(data.eventEndDate),
    applicationStartAt: asTimestampOrNull(data.applicationStartAt),
    applicationEndAt: asTimestampOrNull(data.applicationEndAt),
    status: asApplicationEventStatus(data.status),
    createdAt: asTimestampOrNull(data.createdAt),
    updatedAt: asTimestampOrNull(data.updatedAt),
  };
}

function sortEventsByStartDateDesc(
  events: ApplicationEvent[]
): ApplicationEvent[] {
  return [...events].sort((a, b) => {
    const aTime = a.eventStartDate?.toMillis() ?? 0;
    const bTime = b.eventStartDate?.toMillis() ?? 0;

    return bTime - aTime;
  });
}

export function isApplicationEventClosed(event: ApplicationEvent): boolean {
  if (event.status === "closed" || event.status === "archived") {
    return true;
  }

  if (!event.applicationEndAt) {
    return false;
  }

  return event.applicationEndAt.toMillis() <= Date.now();
}

export async function createApplicationEvent(
  params: CreateApplicationEventParams
): Promise<string> {
  const eventsRef = collection(db, "events");

  const eventDoc = await addDoc(eventsRef, {
    title: params.title,
    type: params.type,
    venue: params.venue,
    parentEventId: params.parentEventId ?? "",
    eventStartDate: toTimestampOrNull(params.eventStartDate),
    eventEndDate: toTimestampOrNull(params.eventEndDate),
    applicationStartAt: toTimestampOrNull(params.applicationStartAt),
    applicationEndAt: toTimestampOrNull(params.applicationEndAt),
    status: params.status ?? ("open" satisfies ApplicationEventStatus),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return eventDoc.id;
}

export async function getOpenApplicationEvents(): Promise<ApplicationEvent[]> {
  const eventsRef = collection(db, "events");
  const eventsQuery = query(eventsRef, where("status", "==", "open"));
  const eventsSnap = await getDocs(eventsQuery);

  const events = eventsSnap.docs.map((eventDoc) =>
    convertApplicationEvent(
      eventDoc.id,
      eventDoc.data() as Record<string, unknown>
    )
  );

  return events.sort((a, b) => {
    const aTime = a.applicationEndAt?.toMillis() ?? 0;
    const bTime = b.applicationEndAt?.toMillis() ?? 0;

    return aTime - bTime;
  });
}

export async function getApplicationEvents(): Promise<ApplicationEvent[]> {
  const eventsRef = collection(db, "events");
  const eventsSnap = await getDocs(eventsRef);

  const events = eventsSnap.docs.map((eventDoc) =>
    convertApplicationEvent(
      eventDoc.id,
      eventDoc.data() as Record<string, unknown>
    )
  );

  return sortEventsByStartDateDesc(events);
}

export async function getApplicationEventById(
  eventId: string
): Promise<ApplicationEvent | null> {
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);

  if (!eventSnap.exists()) {
    return null;
  }

  return convertApplicationEvent(
    eventSnap.id,
    eventSnap.data() as Record<string, unknown>
  );
}

export async function getApplicationEventsByType(
  type: ApplicationEventType
): Promise<ApplicationEvent[]> {
  const eventsRef = collection(db, "events");
  const eventsQuery = query(eventsRef, where("type", "==", type));
  const eventsSnap = await getDocs(eventsQuery);

  const events = eventsSnap.docs.map((eventDoc) =>
    convertApplicationEvent(
      eventDoc.id,
      eventDoc.data() as Record<string, unknown>
    )
  );

  return sortEventsByStartDateDesc(events);
}

export async function getLiveEventsForTimetableEdit(): Promise<
  ApplicationEvent[]
> {
  const [liveEvents, campLiveEvents] = await Promise.all([
    getApplicationEventsByType("live"),
    getApplicationEventsByType("camp_live"),
  ]);

  return sortEventsByStartDateDesc(
    [...liveEvents, ...campLiveEvents].filter(
      (event) => event.status !== "draft" && event.status !== "archived"
    )
  );
}

export async function getClosedLiveEventsForTimetableEdit(): Promise<
  ApplicationEvent[]
> {
  const events = await getLiveEventsForTimetableEdit();

  return events.filter((event) => isApplicationEventClosed(event));
}

export async function getApplicationEventsByParentEventId(
  parentEventId: string
): Promise<ApplicationEvent[]> {
  const eventsRef = collection(db, "events");
  const eventsQuery = query(
    eventsRef,
    where("parentEventId", "==", parentEventId)
  );
  const eventsSnap = await getDocs(eventsQuery);

  const events = eventsSnap.docs.map((eventDoc) =>
    convertApplicationEvent(
      eventDoc.id,
      eventDoc.data() as Record<string, unknown>
    )
  );

  return events.sort((a, b) => {
    const aTime = a.applicationEndAt?.toMillis() ?? 0;
    const bTime = b.applicationEndAt?.toMillis() ?? 0;

    return aTime - bTime;
  });
}

export async function closeApplicationEvent(eventId: string): Promise<void> {
  const eventRef = doc(db, "events", eventId);

  await updateDoc(eventRef, {
    status: "closed" satisfies ApplicationEventStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function reopenApplicationEvent(eventId: string): Promise<void> {
  const eventRef = doc(db, "events", eventId);

  await updateDoc(eventRef, {
    status: "open" satisfies ApplicationEventStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveApplicationEvent(eventId: string): Promise<void> {
  const eventRef = doc(db, "events", eventId);

  await updateDoc(eventRef, {
    status: "archived" satisfies ApplicationEventStatus,
    updatedAt: serverTimestamp(),
  });
}