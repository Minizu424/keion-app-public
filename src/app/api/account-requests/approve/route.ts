import { NextResponse } from "next/server";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  sendPasswordResetEmail,
} from "firebase/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { firebaseConfig } from "@/lib/firebase/client";
import { studentIdToAuthEmail } from "@/lib/firebase/authEmail";

type AccountRequestData = {
  name?: string;
  studentId?: string;
  grade?: number;
  mainPart?: string;
  subPart?: string;
  note?: string;
  status?: string;
};

function generateTemporaryPassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!?#$";
  const passwordLength = 16;

  return Array.from({ length: passwordLength })
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");
}

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function getEmailSenderAuth() {
  const appName = "email-sender";

  const existingApp = getApps().find((app) => app.name === appName);

  const app = existingApp ?? initializeApp(firebaseConfig, appName);

  return getAuth(app);
}

async function getCurrentAdminMember(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authorization.replace("Bearer ", "");

  const decodedToken = await adminAuth.verifyIdToken(idToken);

  const memberSnap = await adminDb
    .collection("members")
    .doc(decodedToken.uid)
    .get();

  if (!memberSnap.exists) {
    return null;
  }

  const member = memberSnap.data();

  if (member?.role !== "admin" && member?.role !== "executive") {
    return null;
  }

  return {
    uid: decodedToken.uid,
    role: member.role,
  };
}

export async function POST(request: Request) {
  let createdUid: string | null = null;

  try {
    const currentMember = await getCurrentAdminMember(request);

    if (!currentMember) {
      return NextResponse.json(
        { message: "権限がありません。" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { requestId?: string };
    const requestId = body.requestId;

    if (!requestId) {
      return NextResponse.json(
        { message: "requestId が指定されていません。" },
        { status: 400 }
      );
    }

    const requestRef = adminDb.collection("accountRequests").doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return NextResponse.json(
        { message: "申請が見つかりません。" },
        { status: 404 }
      );
    }

    const requestData = requestSnap.data() as AccountRequestData;

    if (requestData.status !== "pending") {
      return NextResponse.json(
        { message: "この申請はすでに処理済みです。" },
        { status: 409 }
      );
    }

    if (
      !requestData.studentId ||
      !requestData.name ||
      typeof requestData.grade !== "number" ||
      !requestData.mainPart
    ) {
      return NextResponse.json(
        { message: "申請データが不完全です。" },
        { status: 400 }
      );
    }

    const email = studentIdToAuthEmail(requestData.studentId);
    const temporaryPassword = generateTemporaryPassword();

    const userRecord = await adminAuth.createUser({
      email,
      password: temporaryPassword,
      emailVerified: false,
      disabled: false,
    });

    createdUid = userRecord.uid;

    await adminDb.collection("members").doc(userRecord.uid).set({
      uid: userRecord.uid,
      studentId: requestData.studentId,
      name: requestData.name,
      grade: requestData.grade,
      mainPart: requestData.mainPart,
      subPart: requestData.subPart ?? "",
      role: "member",
      status: "active",
      isProfileCompleted: true,
      isPasswordChanged: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const emailSenderAuth = getEmailSenderAuth();
    emailSenderAuth.languageCode = "ja";

    await sendPasswordResetEmail(emailSenderAuth, email, {
      url: `${getAppBaseUrl()}/auth/action`,
      handleCodeInApp: false,
    });

    await requestRef.update({
      status: "approved",
      approvedBy: currentMember.uid,
      approvedUid: userRecord.uid,
      approvedEmail: email,
      passwordSetupEmailSent: true,
      passwordSetupUrl: `${getAppBaseUrl()}/auth/action`,
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "アカウントを発行し、パスワード設定メールを送信しました。",
      uid: userRecord.uid,
      email,
    });
  } catch (error) {
    console.error(error);

    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
        await adminDb.collection("members").doc(createdUid).delete();
      } catch (rollbackError) {
        console.error("rollback failed:", rollbackError);
      }
    }

    return NextResponse.json(
      {
        message:
          "承認処理に失敗しました。すでに同じメールのユーザーが存在する、またはメール送信に失敗した可能性があります。",
      },
      { status: 500 }
    );
  }
}