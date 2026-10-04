import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "@/firebase";

type NotificationType = "comment" | "answer" | "reaction";

type CreateNotificationParams = {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  problemId: string;
  problemTitle: string;
  message: string;
};

export async function createNotification({
  recipientId,
  actorId,
  type,
  problemId,
  problemTitle,
  message,
}: CreateNotificationParams) {
  const currentUser = auth.currentUser;

  const actualActorId = actorId || currentUser?.uid;

  if (!actualActorId) {
    return;
  }

  // Never notify yourself.
  if (recipientId === actualActorId) {
    return;
  }

  let actorUsername = "User";

  try {
    const userSnapshot = await getDoc(doc(db, "users", actualActorId));

    if (userSnapshot.exists()) {
      actorUsername = userSnapshot.data().username || "User";
    }
  } catch (error) {
    console.log("LOAD ACTOR USERNAME ERROR:", error);
  }

  await addDoc(collection(db, "notifications"), {
    recipientId,
    actorId: actualActorId,
    actorUsername,
    type,
    problemId,
    problemTitle,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
}
