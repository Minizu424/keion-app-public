import type { Timestamp } from "firebase/firestore";

export type TimetableStatus = "draft" | "published";

export type TimetableRowType = "band" | "custom";

export type TimetableRowSong = {
  title: string;
  artist: string;
};

export type TimetableRow = {
  id: string;
  type: TimetableRowType;
  title: string;
  applicationId: string;
  bandName: string;
  songs: TimetableRowSong[];
  memberNames: string[];
  memberStudentIds: string[];
  startTime: string;
  durationMinutes: number;
  endTime: string;
  note: string;
};

export type Timetable = {
  id: string;
  eventId: string;
  eventTitle: string;
  status: TimetableStatus;
  isPublished: boolean;
  rows: TimetableRow[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};