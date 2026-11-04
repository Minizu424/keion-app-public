import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    updateDoc,
  } from "firebase/firestore";
  import { db } from "@/lib/firebase/client";
  
  export type MemberRole = "member" | "executive" | "admin";
  export type MemberStatus = "active" | "inactive";
  
  export type Member = {
    id: string;
    uid: string;
    studentId: string;
    name: string;
    grade: number;
    mainPart: string;
    subPart: string;
    role: MemberRole;
    status: MemberStatus;
    isProfileCompleted: boolean;
    isPasswordChanged: boolean;
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
  
  function asMemberRole(value: unknown): MemberRole {
    if (value === "admin" || value === "executive" || value === "member") {
      return value;
    }
  
    return "member";
  }
  
  function asMemberStatus(value: unknown): MemberStatus {
    if (value === "active" || value === "inactive") {
      return value;
    }
  
    return "active";
  }
  
  function convertMember(id: string, data: Record<string, unknown>): Member {
    return {
      id,
      uid: asString(data.uid, id),
      studentId: asString(data.studentId),
      name: asString(data.name),
      grade: asNumber(data.grade),
      mainPart: asString(data.mainPart),
      subPart: asString(data.subPart),
      role: asMemberRole(data.role),
      status: asMemberStatus(data.status),
      isProfileCompleted: asBoolean(data.isProfileCompleted),
      isPasswordChanged: asBoolean(data.isPasswordChanged, true),
    };
  }
  
  export async function getMemberByUid(uid: string): Promise<Member | null> {
    const memberRef = doc(db, "members", uid);
    const memberSnap = await getDoc(memberRef);
  
    if (!memberSnap.exists()) {
      return null;
    }
  
    return convertMember(
      memberSnap.id,
      memberSnap.data() as Record<string, unknown>
    );
  }
  
  export async function getMembers(): Promise<Member[]> {
    const membersRef = collection(db, "members");
    const membersQuery = query(membersRef, orderBy("studentId", "asc"));
    const membersSnap = await getDocs(membersQuery);
  
    return membersSnap.docs.map((memberDoc) =>
      convertMember(memberDoc.id, memberDoc.data() as Record<string, unknown>)
    );
  }
  
  export async function markPasswordChanged(uid: string): Promise<void> {
    const memberRef = doc(db, "members", uid);
  
    await updateDoc(memberRef, {
      isPasswordChanged: true,
    });
  }