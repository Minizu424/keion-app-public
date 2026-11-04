import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

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

    await requestRef.update({
      status: "rejected",
      rejectedBy: currentMember.uid,
      rejectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: "申請を却下しました。",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "却下処理に失敗しました。" },
      { status: 500 }
    );
  }
}