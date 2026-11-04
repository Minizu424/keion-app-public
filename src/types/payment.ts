import type { Timestamp } from "firebase/firestore";

export type PaymentStatus =
  | "unreported"
  | "reported"
  | "confirmed"
  | "shortage";

export type PaymentTarget = {
  id: string;
  eventId: string;
  eventTitle: string;
  applicationId: string;
  applicationIds: string[];
  bandName: string;
  bandNames: string[];
  memberUid: string;
  memberName: string;
  studentId: string;
  amount: number;
  status: PaymentStatus;
  reportedAt: Timestamp | null;
  note: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type PaymentStatusCount = {
  unreported: number;
  reported: number;
  confirmed: number;
  shortage: number;
  total: number;
};