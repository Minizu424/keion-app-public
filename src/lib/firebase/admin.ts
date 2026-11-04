import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminPrivateKey() {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("FIREBASE_ADMIN_PRIVATE_KEY is not set.");
  }

  return privateKey.replace(/\\n/g, "\n");
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  if (!projectId) {
    throw new Error("FIREBASE_ADMIN_PROJECT_ID is not set.");
  }

  if (!clientEmail) {
    throw new Error("FIREBASE_ADMIN_CLIENT_EMAIL is not set.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: getAdminPrivateKey(),
    }),
  });
}

export const adminApp = getAdminApp();

export const adminAuth = getAuth(adminApp);

export const adminDb = getFirestore(adminApp);