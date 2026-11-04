import {
    addDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    where,
    type Timestamp,
  } from "firebase/firestore";
  import { auth, db } from "@/lib/firebase/client";
  
  export type AccountRequestStatus = "pending" | "approved" | "rejected";
  
  export type AccountRequest = {
    id: string;
    name: string;
    studentId: string;
    grade: number;
    mainPart: string;
    subPart: string;
    note: string;
    status: AccountRequestStatus;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
  };
  
  type CreateAccountRequestParams = {
    name: string;
    studentId: string;
    grade: number;
    mainPart: string;
    subPart: string;
    note?: string;
  };
  
  type ApproveAccountRequestParams = {
    request: AccountRequest;
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
  
  function asAccountRequestStatus(value: unknown): AccountRequestStatus {
    if (value === "pending" || value === "approved" || value === "rejected") {
      return value;
    }
  
    return "pending";
  }
  
  function convertAccountRequest(
    id: string,
    data: Record<string, unknown>
  ): AccountRequest {
    return {
      id,
      name: asString(data.name),
      studentId: asString(data.studentId),
      grade: asNumber(data.grade),
      mainPart: asString(data.mainPart),
      subPart: asString(data.subPart),
      note: asString(data.note),
      status: asAccountRequestStatus(data.status),
      createdAt: asTimestampOrNull(data.createdAt),
      updatedAt: asTimestampOrNull(data.updatedAt),
    };
  }
  
  async function getCurrentUserIdToken(): Promise<string> {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("ログイン状態を確認できません。");
    }
  
    return user.getIdToken();
  }
  
  async function postWithAuth(path: string, body: unknown): Promise<void> {
    const idToken = await getCurrentUserIdToken();
  
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });
  
    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
  
      throw new Error(errorData?.message ?? "処理に失敗しました。");
    }
  }
  
  export async function createAccountRequest(
    params: CreateAccountRequestParams
  ): Promise<void> {
    const accountRequestsRef = collection(db, "accountRequests");
  
    await addDoc(accountRequestsRef, {
      name: params.name,
      studentId: params.studentId.trim(),
      grade: params.grade,
      mainPart: params.mainPart,
      subPart: params.subPart,
      note: params.note ?? "",
      status: "pending" satisfies AccountRequestStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  
  export async function getPendingAccountRequests(): Promise<AccountRequest[]> {
    const accountRequestsRef = collection(db, "accountRequests");
  
    const accountRequestsQuery = query(
      accountRequestsRef,
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );
  
    const accountRequestsSnap = await getDocs(accountRequestsQuery);
  
    return accountRequestsSnap.docs.map((requestDoc) =>
      convertAccountRequest(
        requestDoc.id,
        requestDoc.data() as Record<string, unknown>
      )
    );
  }
  
  export async function approveAccountRequest(
    params: ApproveAccountRequestParams
  ): Promise<void> {
    await postWithAuth("/api/account-requests/approve", {
      requestId: params.request.id,
    });
  }
  
  export async function rejectAccountRequest(requestId: string): Promise<void> {
    await postWithAuth("/api/account-requests/reject", {
      requestId,
    });
  }