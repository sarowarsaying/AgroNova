import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import GoogleMap from "@/components/google-map.web";
import { auth, db } from "@/firebase";
import { createNotification } from "@/services/notification-service";

type AIAnalysis = {
  possibleProblem: string;
  likelyCauses: string;
  recommendedNextSteps: string;
  warningSigns: string;
};

type Problem = {
  category?: string;
  type?: string;
  cropName: string;
  title: string;
  description: string;
  userId: string;
  aiAnalysis?: AIAnalysis | null;
  imageUri?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  createdAt?: any;
  updatedAt?: any;
};

type Reporter = {
  name?: string;
  username?: string;
  role?: string;
};

type Comment = {
  id: string;
  text: string;
  userId: string;
  problemId: string;
  createdAt?: any;
  updatedAt?: any;
  username?: string;
};

type Reaction = {
  id: string;
  problemId: string;
  userId: string;
  type: "like" | "dislike";
};

type Answer = {
  id: string;
  text: string;
  userId: string;
  problemId: string;
  createdAt?: any;
  updatedAt?: any;
  username?: string;
};

export default function ProblemDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [reporter, setReporter] = useState<Reporter | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [commentActionLoading, setCommentActionLoading] = useState(false);

  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [myReactionId, setMyReactionId] = useState<string | null>(null);
  const [myReactionType, setMyReactionType] = useState<
    "like" | "dislike" | null
  >(null);
  const [reactionLoading, setReactionLoading] = useState(false);

  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [userRole, setUserRole] = useState("");
  const [answerSubmitting, setAnswerSubmitting] = useState(false);

  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editingAnswerText, setEditingAnswerText] = useState("");
  const [answerActionLoading, setAnswerActionLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(true);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [commentError, setCommentError] = useState("");
  const [reactionError, setReactionError] = useState("");
  const [answerError, setAnswerError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);

  useEffect(() => {
    loadProblem();
    loadUserRole();
  }, [id]);

  /*
   * REAL-TIME COMMENTS
   */
  useEffect(() => {
    if (!id) {
      return;
    }

    const commentsQuery = query(
      collection(db, "comments"),
      where("problemId", "==", id),
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      async (snapshot) => {
        const commentList: Comment[] = snapshot.docs.map((commentDoc) => ({
          id: commentDoc.id,
          ...(commentDoc.data() as Omit<Comment, "id">),
        }));

        commentList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;

          return timeA - timeB;
        });

        const commentsWithUsername = await Promise.all(
          commentList.map(async (comment) => {
            try {
              const userRef = doc(db, "users", comment.userId);
              const userSnapshot = await getDoc(userRef);

              if (userSnapshot.exists()) {
                const userData = userSnapshot.data();

                return {
                  ...comment,
                  username: userData.username || "User",
                };
              }

              return {
                ...comment,
                username: "User",
              };
            } catch {
              return {
                ...comment,
                username: "User",
              };
            }
          }),
        );

        setComments(commentsWithUsername);
        setCommentsLoading(false);
        setCommentError("");
      },
      (error) => {
        console.log("COMMENTS LISTENER ERROR:", error);

        setCommentError(error.message || "Failed to load comments.");
        setCommentsLoading(false);
      },
    );

    return unsubscribe;
  }, [id]);

  /*
   * REAL-TIME REACTIONS
   */
  useEffect(() => {
    if (!id) {
      return;
    }

    const reactionsQuery = query(
      collection(db, "reactions"),
      where("problemId", "==", id),
    );

    const unsubscribe = onSnapshot(
      reactionsQuery,
      (snapshot) => {
        let likes = 0;
        let dislikes = 0;

        let currentReactionId: string | null = null;
        let currentReactionType: "like" | "dislike" | null = null;

        const currentUser = auth.currentUser;

        snapshot.docs.forEach((reactionDoc) => {
          const reaction = reactionDoc.data() as Reaction;

          if (reaction.type === "like") {
            likes++;
          }

          if (reaction.type === "dislike") {
            dislikes++;
          }

          if (currentUser && reaction.userId === currentUser.uid) {
            currentReactionId = reactionDoc.id;
            currentReactionType = reaction.type;
          }
        });

        setLikeCount(likes);
        setDislikeCount(dislikes);
        setMyReactionId(currentReactionId);
        setMyReactionType(currentReactionType);
      },
      (error) => {
        console.log("REACTIONS LISTENER ERROR:", error);

        setReactionError(error.message || "Failed to load reactions.");
      },
    );

    return unsubscribe;
  }, [id]);

  /*
   * REAL-TIME AGRICULTURIST ANSWERS
   */
  useEffect(() => {
    if (!id) {
      return;
    }

    const answersQuery = query(
      collection(db, "answers"),
      where("problemId", "==", id),
    );

    const unsubscribe = onSnapshot(
      answersQuery,
      async (snapshot) => {
        const answerList: Answer[] = snapshot.docs.map((answerDoc) => ({
          id: answerDoc.id,
          ...(answerDoc.data() as Omit<Answer, "id">),
        }));

        answerList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;

          return timeA - timeB;
        });

        const answersWithUsername = await Promise.all(
          answerList.map(async (answer) => {
            try {
              const userRef = doc(db, "users", answer.userId);
              const userSnapshot = await getDoc(userRef);

              if (userSnapshot.exists()) {
                const userData = userSnapshot.data();

                return {
                  ...answer,
                  username: userData.username || "Agriculturist",
                };
              }

              return {
                ...answer,
                username: "Agriculturist",
              };
            } catch {
              return {
                ...answer,
                username: "Agriculturist",
              };
            }
          }),
        );

        setAnswers(answersWithUsername);
        setAnswersLoading(false);
        setAnswerError("");
      },
      (error) => {
        console.log("ANSWERS LISTENER ERROR:", error);

        setAnswerError(error.message || "Failed to load answers.");
        setAnswersLoading(false);
      },
    );

    return unsubscribe;
  }, [id]);

  async function loadUserRole() {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        setUserRole(snapshot.data().role || "");
      }
    } catch (error) {
      console.log("LOAD USER ROLE ERROR:", error);
    }
  }

  async function loadProblem() {
    if (!id) {
      setErrorMessage("Problem ID is missing.");
      setLoading(false);
      return;
    }

    try {
      const problemRef = doc(db, "problems", id);
      const snapshot = await getDoc(problemRef);

      if (!snapshot.exists()) {
        setErrorMessage("This problem no longer exists.");
        setLoading(false);
        return;
      }

      const problemData = snapshot.data() as Problem;

      setProblem(problemData);

      try {
        const reporterRef = doc(db, "users", problemData.userId);
        const reporterSnapshot = await getDoc(reporterRef);

        if (reporterSnapshot.exists()) {
          setReporter(reporterSnapshot.data() as Reporter);
        }
      } catch (error) {
        console.log("LOAD REPORTER ERROR:", error);
      }
    } catch (error: any) {
      console.log("LOAD PROBLEM ERROR:", error);

      setErrorMessage(error.message || "Failed to load problem.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProblem() {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Login Required", "You must be logged in.");
      return;
    }

    if (!id || !problem) {
      return;
    }

    if (problem.userId !== user.uid) {
      Alert.alert(
        "Not Allowed",
        "You can only edit your own reported problems.",
      );
      return;
    }

    const trimmedTitle = editTitle.trim();
    const trimmedDescription = editDescription.trim();

    if (trimmedTitle === "") {
      Alert.alert("Invalid Title", "Please enter a problem title.");
      return;
    }

    if (trimmedDescription === "") {
      Alert.alert("Invalid Description", "Please enter a problem description.");
      return;
    }

    try {
      setEditSubmitting(true);

      await updateDoc(doc(db, "problems", id), {
        title: trimmedTitle,
        description: trimmedDescription,
        updatedAt: serverTimestamp(),
      });

      setProblem((previous) =>
        previous
          ? {
              ...previous,
              title: trimmedTitle,
              description: trimmedDescription,
              updatedAt: {
                toDate: () => new Date(),
              },
            }
          : previous,
      );

      setIsEditing(false);

      Alert.alert("Success", "Your problem has been updated.");
    } catch (error: any) {
      console.log("UPDATE PROBLEM ERROR:", error);

      Alert.alert(
        "Update Failed",
        error.message || "Failed to update the problem.",
      );
    } finally {
      setEditSubmitting(false);
    }
  }

  /*
   * OPEN DELETE CONFIRMATION
   */
  function handleDeleteProblem() {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Login Required", "You must be logged in.");
      return;
    }

    if (!id || !problem) {
      Alert.alert("Error", "Problem information is missing.");
      return;
    }

    if (problem.userId !== user.uid) {
      Alert.alert(
        "Not Allowed",
        "You can only delete your own reported problems.",
      );
      return;
    }

    setDeleteError("");
    setDeleteConfirmVisible(true);
  }

  /*
   * ACTUAL DELETE
   */
  async function confirmDeleteProblem() {
    const user = auth.currentUser;

    if (!user) {
      setDeleteError("You must be logged in.");
      return;
    }

    if (!id || !problem) {
      setDeleteError("Problem information is missing.");
      return;
    }

    if (problem.userId !== user.uid) {
      setDeleteError("You can only delete your own reported problems.");
      return;
    }

    try {
      setDeleteSubmitting(true);
      setDeleteError("");

      console.log("STARTING PROBLEM DELETE:", id);

      const commentsQuery = query(
        collection(db, "comments"),
        where("problemId", "==", id),
      );

      const reactionsQuery = query(
        collection(db, "reactions"),
        where("problemId", "==", id),
      );

      const answersQuery = query(
        collection(db, "answers"),
        where("problemId", "==", id),
      );

      const [commentsSnapshot, reactionsSnapshot, answersSnapshot] =
        await Promise.all([
          getDocs(commentsQuery),
          getDocs(reactionsQuery),
          getDocs(answersQuery),
        ]);

      console.log(
        "RELATED DOCUMENTS:",
        "comments:",
        commentsSnapshot.size,
        "reactions:",
        reactionsSnapshot.size,
        "answers:",
        answersSnapshot.size,
      );

      const batch = writeBatch(db);

      batch.delete(doc(db, "problems", id));

      commentsSnapshot.docs.forEach((commentDoc) => {
        batch.delete(commentDoc.ref);
      });

      reactionsSnapshot.docs.forEach((reactionDoc) => {
        batch.delete(reactionDoc.ref);
      });

      answersSnapshot.docs.forEach((answerDoc) => {
        batch.delete(answerDoc.ref);
      });

      await batch.commit();

      console.log("PROBLEM DELETE SUCCESS:", id);

      setDeleteSubmitting(false);
      setDeleteConfirmVisible(false);

      router.replace("/problem");
    } catch (error: any) {
      console.log("DELETE PROBLEM ERROR:", error);

      setDeleteSubmitting(false);

      setDeleteError(
        error?.message || "Failed to delete the problem and related data.",
      );
    }
  }

  /*
   * ADD COMMENT
   */
  async function handleAddComment() {
    const user = auth.currentUser;

    setCommentError("");

    if (!user) {
      setCommentError("You must be logged in to comment.");
      return;
    }

    if (!id || !problem) {
      setCommentError("Problem information is missing.");
      return;
    }

    const trimmedComment = commentText.trim();

    if (trimmedComment === "") {
      setCommentError("Please write a comment.");
      return;
    }

    try {
      setCommentSubmitting(true);

      await addDoc(collection(db, "comments"), {
        problemId: id,
        text: trimmedComment,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setCommentText("");

      /*
       * BRICK 29:
       * Notify problem owner.
       *
       * Notification failure does not affect
       * the successful comment.
       */
      await createNotification({
        recipientId: problem.userId,
        actorId: user.uid,
        type: "comment",
        problemId: id,
        problemTitle: problem.title,
        message: "Someone commented on your problem.",
      });
    } catch (error: any) {
      console.log("ADD COMMENT ERROR:", error);

      setCommentError(error.message || "Failed to post comment.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  /*
   * START COMMENT EDIT
   */
  function handleStartEditComment(comment: Comment) {
    const user = auth.currentUser;

    if (!user || user.uid !== comment.userId) {
      return;
    }

    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
    setCommentError("");
  }

  /*
   * CANCEL COMMENT EDIT
   */
  function handleCancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentText("");
  }

  /*
   * SAVE COMMENT EDIT
   */
  async function handleSaveComment(comment: Comment) {
    const user = auth.currentUser;

    setCommentError("");

    if (!user) {
      setCommentError("You must be logged in.");
      return;
    }

    if (user.uid !== comment.userId) {
      setCommentError("You can only edit your own comments.");
      return;
    }

    const trimmedText = editingCommentText.trim();

    if (trimmedText === "") {
      setCommentError("Comment cannot be empty.");
      return;
    }

    try {
      setCommentActionLoading(true);

      await updateDoc(doc(db, "comments", comment.id), {
        text: trimmedText,
        updatedAt: serverTimestamp(),
      });

      handleCancelEditComment();
    } catch (error: any) {
      console.log("EDIT COMMENT ERROR:", error);

      setCommentError(error.message || "Failed to update the comment.");
    } finally {
      setCommentActionLoading(false);
    }
  }

  /*
   * DELETE COMMENT
   */
  async function handleDeleteComment(comment: Comment) {
    const user = auth.currentUser;

    setCommentError("");

    if (!user) {
      setCommentError("You must be logged in.");
      return;
    }

    const isCommentOwner = comment.userId === user.uid;
    const isProblemOwner = problem?.userId === user.uid;

    if (!isCommentOwner && !isProblemOwner) {
      setCommentError("You are not allowed to delete this comment.");
      return;
    }

    try {
      setCommentActionLoading(true);

      await deleteDoc(doc(db, "comments", comment.id));

      if (editingCommentId === comment.id) {
        handleCancelEditComment();
      }
    } catch (error: any) {
      console.log("DELETE COMMENT ERROR:", error);

      setCommentError(error.message || "Failed to delete the comment.");
    } finally {
      setCommentActionLoading(false);
    }
  }

  /*
   * REACTION
   */
  async function handleReaction(type: "like" | "dislike") {
    const user = auth.currentUser;

    setReactionError("");

    if (!user) {
      setReactionError("You must be logged in to react.");
      return;
    }

    if (!id || !problem) {
      setReactionError("Problem information is missing.");
      return;
    }

    try {
      setReactionLoading(true);

      /*
       * Same reaction = remove reaction.
       * No notification for removing a reaction.
       */
      if (myReactionId && myReactionType === type) {
        await deleteDoc(doc(db, "reactions", myReactionId));
        return;
      }

      /*
       * Switching reaction:
       * delete old reaction first.
       */
      if (myReactionId) {
        await deleteDoc(doc(db, "reactions", myReactionId));
      }

      /*
       * Create new reaction.
       */
      await addDoc(collection(db, "reactions"), {
        problemId: id,
        userId: user.uid,
        type,
        createdAt: serverTimestamp(),
      });

      /*
       * BRICK 29:
       * One notification for the newly selected reaction.
       */
      await createNotification({
        recipientId: problem.userId,
        actorId: user.uid,
        type: "reaction",
        problemId: id,
        problemTitle: problem.title,
        message:
          type === "like"
            ? "Someone liked your problem."
            : "Someone disliked your problem.",
      });
    } catch (error: any) {
      console.log("REACTION ERROR:", error);

      setReactionError(error.message || "Failed to update reaction.");
    } finally {
      setReactionLoading(false);
    }
  }

  /*
   * ADD AGRICULTURIST ANSWER
   */
  async function handleAddAnswer() {
    const user = auth.currentUser;

    setAnswerError("");

    if (!user) {
      setAnswerError("You must be logged in.");
      return;
    }

    if (userRole !== "agriculturist") {
      setAnswerError("Only agriculturists can provide answers.");
      return;
    }

    if (!id || !problem) {
      setAnswerError("Problem information is missing.");
      return;
    }

    const trimmedAnswer = answerText.trim();

    if (trimmedAnswer === "") {
      setAnswerError("Please write an answer.");
      return;
    }

    try {
      setAnswerSubmitting(true);

      await addDoc(collection(db, "answers"), {
        problemId: id,
        text: trimmedAnswer,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setAnswerText("");

      /*
       * BRICK 29:
       * Notify problem owner.
       */
      await createNotification({
        recipientId: problem.userId,
        actorId: user.uid,
        type: "answer",
        problemId: id,
        problemTitle: problem.title,
        message: "An agriculturist provided an answer to your problem.",
      });
    } catch (error: any) {
      console.log("ADD ANSWER ERROR:", error);

      setAnswerError(error.message || "Failed to post answer.");
    } finally {
      setAnswerSubmitting(false);
    }
  }

  /*
   * START ANSWER EDIT
   */
  function handleStartEditAnswer(answer: Answer) {
    const user = auth.currentUser;

    if (!user || user.uid !== answer.userId) {
      return;
    }

    setEditingAnswerId(answer.id);
    setEditingAnswerText(answer.text);
    setAnswerError("");
  }

  /*
   * CANCEL ANSWER EDIT
   */
  function handleCancelEditAnswer() {
    setEditingAnswerId(null);
    setEditingAnswerText("");
  }

  /*
   * SAVE ANSWER EDIT
   */
  async function handleSaveAnswer(answer: Answer) {
    const user = auth.currentUser;

    setAnswerError("");

    if (!user) {
      setAnswerError("You must be logged in.");
      return;
    }

    if (user.uid !== answer.userId) {
      setAnswerError("You can only edit your own answers.");
      return;
    }

    const trimmedText = editingAnswerText.trim();

    if (trimmedText === "") {
      setAnswerError("Answer cannot be empty.");
      return;
    }

    try {
      setAnswerActionLoading(true);

      await updateDoc(doc(db, "answers", answer.id), {
        text: trimmedText,
        updatedAt: serverTimestamp(),
      });

      handleCancelEditAnswer();
    } catch (error: any) {
      console.log("EDIT ANSWER ERROR:", error);

      setAnswerError(error.message || "Failed to update the answer.");
    } finally {
      setAnswerActionLoading(false);
    }
  }

  /*
   * DELETE ANSWER
   */
  async function handleDeleteAnswer(answer: Answer) {
    const user = auth.currentUser;

    setAnswerError("");

    if (!user) {
      setAnswerError("You must be logged in.");
      return;
    }

    const isAnswerOwner = answer.userId === user.uid;
    const isProblemOwner = problem?.userId === user.uid;

    if (!isAnswerOwner && !isProblemOwner) {
      setAnswerError("You are not allowed to delete this answer.");
      return;
    }

    try {
      setAnswerActionLoading(true);

      await deleteDoc(doc(db, "answers", answer.id));

      if (editingAnswerId === answer.id) {
        handleCancelEditAnswer();
      }
    } catch (error: any) {
      console.log("DELETE ANSWER ERROR:", error);

      setAnswerError(error.message || "Failed to delete the answer.");
    } finally {
      setAnswerActionLoading(false);
    }
  }

  function formatDateTime(timestamp: any) {
    if (!timestamp) {
      return null;
    }

    try {
      const date = timestamp?.toDate
        ? timestamp.toDate()
        : timestamp instanceof Date
          ? timestamp
          : null;

      if (!date) {
        return null;
      }

      return date.toLocaleString();
    } catch {
      return null;
    }
  }

  const reportedDate = formatDateTime(problem?.createdAt);
  const updatedDate = formatDateTime(problem?.updatedAt);

  const problemStatus =
    answers.length > 0
      ? {
          label: "Answered",
          icon: "🔵",
        }
      : {
          label: "Open",
          icon: "🟢",
        };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading problem...</Text>
      </View>
    );
  }

  if (errorMessage || !problem) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {errorMessage || "Problem not found."}
        </Text>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const categoryLabel =
    problem.category === "cattle"
      ? "🐄 Cattle"
      : problem.category === "goat_sheep"
        ? "🐐 Goat & Sheep"
        : problem.category === "poultry"
          ? "🐔 Poultry"
          : problem.category === "fish"
            ? "🐟 Fish Farming"
            : problem.category === "pet"
              ? "🐕 Pet Animals"
              : problem.category === "beekeeping"
                ? "🐝 Beekeeping"
                : "🌾 Crops";

  const currentUserId = auth.currentUser?.uid;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>

        {/* CATEGORY */}
        <View style={styles.badgeRow}>
          <View style={styles.cropBadge}>
            <Text style={styles.cropBadgeText}>{categoryLabel}</Text>
          </View>

          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {problem.type || problem.cropName || "General"}
            </Text>
          </View>

          {problem.aiAnalysis ? (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>🤖 AI Analyzed</Text>
            </View>
          ) : null}
        </View>

        {/* STATUS + METADATA */}
        <View style={styles.metadataBox}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {problemStatus.icon} {problemStatus.label}
            </Text>
          </View>

          <View style={styles.metadataDetails}>
            {reportedDate && (
              <Text style={styles.metadataText}>
                🕒 Reported: {reportedDate}
              </Text>
            )}

            {updatedDate && (
              <Text style={styles.metadataText}>
                ✏️ Last updated: {updatedDate}
              </Text>
            )}
          </View>
        </View>

        {/* OWNER ACTIONS */}
        {currentUserId === problem.userId && (
          <View style={styles.ownerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.pressedButton,
                (editSubmitting || deleteSubmitting) && styles.disabledButton,
              ]}
              onPress={() => {
                setEditTitle(problem.title);
                setEditDescription(problem.description);
                setIsEditing(true);
              }}
              disabled={editSubmitting || deleteSubmitting}
            >
              <Text style={styles.editButtonText}>✏️ Edit</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.pressedDeleteButton,
                deleteSubmitting && styles.disabledButton,
              ]}
              onPress={handleDeleteProblem}
              disabled={deleteSubmitting}
            >
              <Text style={styles.deleteButtonText}>
                {deleteSubmitting ? "Deleting..." : "🗑️ Delete"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* EDIT / PROBLEM */}
        {isEditing ? (
          <View style={styles.editBox}>
            <Text style={styles.editBoxTitle}>Edit Your Problem</Text>

            <Text style={styles.editLabel}>Problem Title</Text>

            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Problem title"
              placeholderTextColor="#888888"
              style={styles.editInput}
            />

            <Text style={styles.editLabel}>Problem Description</Text>

            <TextInput
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Problem description"
              placeholderTextColor="#888888"
              multiline
              style={[styles.editInput, styles.editDescriptionInput]}
            />

            <View style={styles.editActionRow}>
              <Pressable
                style={styles.cancelEditButton}
                onPress={() => setIsEditing(false)}
                disabled={editSubmitting}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.saveEditButton,
                  editSubmitting && styles.disabledButton,
                ]}
                onPress={handleUpdateProblem}
                disabled={editSubmitting}
              >
                <Text style={styles.saveEditText}>
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.title}>{problem.title}</Text>

            <Text style={styles.sectionTitle}>Problem Description</Text>

            <Text style={styles.description}>{problem.description}</Text>
          </>
        )}

        {/* AI ANALYSIS */}
        {problem.aiAnalysis && (
          <View style={styles.aiContainer}>
            <View style={styles.aiHeader}>
              <View style={styles.aiHeaderIcon}>
                <Text style={styles.aiHeaderIconText}>🤖</Text>
              </View>

              <View style={styles.aiHeaderTextContainer}>
                <Text style={styles.aiTitle}>AgroNova AI Analysis</Text>

                <Text style={styles.aiSubtitle}>
                  AI-generated agricultural guidance
                </Text>
              </View>
            </View>

            <View style={styles.aiDivider} />

            <View style={styles.aiCard}>
              <Text style={styles.aiNumber}>01</Text>

              <View style={styles.aiCardContent}>
                <Text style={styles.aiCardTitle}>
                  Possible Problem or Disease
                </Text>

                <Text style={styles.aiCardText}>
                  {problem.aiAnalysis.possibleProblem}
                </Text>
              </View>
            </View>

            <View style={styles.aiCard}>
              <Text style={styles.aiNumber}>02</Text>

              <View style={styles.aiCardContent}>
                <Text style={styles.aiCardTitle}>Likely Causes</Text>

                <Text style={styles.aiCardText}>
                  {problem.aiAnalysis.likelyCauses}
                </Text>
              </View>
            </View>

            <View style={styles.aiCard}>
              <Text style={styles.aiNumber}>03</Text>

              <View style={styles.aiCardContent}>
                <Text style={styles.aiCardTitle}>Recommended Next Steps</Text>

                <Text style={styles.aiCardText}>
                  {problem.aiAnalysis.recommendedNextSteps}
                </Text>
              </View>
            </View>

            <View style={styles.aiWarningCard}>
              <Text style={styles.aiWarningIcon}>⚠️</Text>

              <View style={styles.aiCardContent}>
                <Text style={styles.aiWarningTitle}>Warning Signs</Text>

                <Text style={styles.aiWarningText}>
                  {problem.aiAnalysis.warningSigns}
                </Text>
              </View>
            </View>

            <View style={styles.aiDisclaimerBox}>
              <Text style={styles.aiDisclaimer}>
                AI analysis is for support and guidance only. It does not
                replace professional agricultural diagnosis.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        {/* REPORTED BY */}
        <Text style={styles.sectionTitle}>Reported By</Text>

        <Pressable
          style={styles.reporterBox}
          onPress={() =>
            router.push({
              pathname: "/user-profile",
              params: {
                uid: problem.userId,
              },
            })
          }
        >
          <Text style={styles.reporterName}>
            {reporter?.name || "Unknown User"}
          </Text>

          {reporter?.username && (
            <Text style={styles.reporterUsername}>@{reporter.username}</Text>
          )}

          {reporter?.role && (
            <Text style={styles.reporterRole}>
              {reporter.role === "agriculturist" ? "Agriculturist" : "Farmer"}
            </Text>
          )}

          <Text style={styles.viewProfile}>View profile →</Text>
        </Pressable>

        {/* LOCATION */}
        {problem.location && (
          <>
            <Text style={styles.sectionTitle}>Location</Text>

            <View style={styles.locationBox}>
              <Text style={styles.locationText}>
                📍 Latitude: {problem.location.latitude.toFixed(6)}
              </Text>

              <Text style={styles.locationText}>
                📍 Longitude: {problem.location.longitude.toFixed(6)}
              </Text>

              <View style={styles.mapContainer}>
                <GoogleMap
                  latitude={problem.location.latitude}
                  longitude={problem.location.longitude}
                />
              </View>
            </View>
          </>
        )}

        {/* IMAGE */}
        {problem.imageUri && (
          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Attached Image</Text>

            <Pressable
              onPress={() => {
                setImageZoom(1);
                setImagePreviewVisible(true);
              }}
              style={styles.imagePressable}
            >
              <Image
                source={{ uri: problem.imageUri }}
                style={styles.problemImage}
                resizeMode="contain"
              />

              <View style={styles.imageOverlay}>
                <Text style={styles.imageOverlayText}>
                  🔍 Tap to view full image
                </Text>
              </View>
            </Pressable>

            <Text style={styles.imageInfoText}>
              Tap the image to view it in full screen.
            </Text>
          </View>
        )}

        {/* REACTIONS */}
        <View style={styles.reactionsSection}>
          <Text style={styles.reactionsTitle}>Farmer Reactions</Text>

          <View style={styles.reactionRow}>
            <Pressable
              style={[
                styles.reactionButton,
                myReactionType === "like" && styles.activeLikeButton,
                reactionLoading && styles.disabledButton,
              ]}
              onPress={() => handleReaction("like")}
              disabled={reactionLoading}
            >
              <Text
                style={[
                  styles.reactionText,
                  myReactionType === "like" && styles.activeReactionText,
                ]}
              >
                👍 Like {likeCount}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.reactionButton,
                myReactionType === "dislike" && styles.activeDislikeButton,
                reactionLoading && styles.disabledButton,
              ]}
              onPress={() => handleReaction("dislike")}
              disabled={reactionLoading}
            >
              <Text
                style={[
                  styles.reactionText,
                  myReactionType === "dislike" && styles.activeReactionText,
                ]}
              >
                👎 Dislike {dislikeCount}
              </Text>
            </Pressable>
          </View>

          {reactionError !== "" && (
            <Text style={styles.reactionError}>{reactionError}</Text>
          )}
        </View>

        {/* AGRICULTURIST ANSWERS */}
        <View style={styles.answersSection}>
          <Text style={styles.answersTitle}>
            Agriculturist Answers ({answers.length})
          </Text>

          {userRole === "agriculturist" && (
            <>
              <TextInput
                value={answerText}
                onChangeText={(text) => {
                  setAnswerText(text);
                  setAnswerError("");
                }}
                placeholder="Write an agricultural answer..."
                placeholderTextColor="#888888"
                multiline
                style={styles.answerInput}
              />

              {answerError !== "" && (
                <Text style={styles.answerError}>{answerError}</Text>
              )}

              <Pressable
                style={[
                  styles.answerButton,
                  answerSubmitting && styles.disabledButton,
                ]}
                onPress={handleAddAnswer}
                disabled={answerSubmitting}
              >
                <Text style={styles.answerButtonText}>
                  {answerSubmitting
                    ? "Posting..."
                    : "Post Agriculturist Answer"}
                </Text>
              </Pressable>
            </>
          )}

          {userRole !== "agriculturist" && answers.length === 0 && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Agriculturist answers will appear here.
              </Text>
            </View>
          )}

          {answersLoading ? (
            <View style={styles.answersLoading}>
              <ActivityIndicator size="small" />

              <Text style={styles.loadingText}>Loading answers...</Text>
            </View>
          ) : answers.length === 0 ? (
            <View style={styles.noAnswersBox}>
              <Text style={styles.noAnswersText}>
                No agriculturist answers yet.
              </Text>
            </View>
          ) : (
            answers.map((answer) => {
              const answerDate = formatDateTime(answer.createdAt);

              const answerUpdatedDate = formatDateTime(answer.updatedAt);

              const isAnswerOwner = currentUserId === answer.userId;

              const isProblemOwner = currentUserId === problem.userId;

              const isEditingThisAnswer = editingAnswerId === answer.id;

              return (
                <View key={answer.id} style={styles.answerCard}>
                  <View style={styles.contentHeaderRow}>
                    <View style={styles.contentUserContainer}>
                      <Text style={styles.answerUser}>
                        👨‍🌾 @{answer.username || "Agriculturist"}
                      </Text>

                      {answerDate && (
                        <Text style={styles.contentDate}>🕒 {answerDate}</Text>
                      )}
                    </View>

                    <View style={styles.contentActions}>
                      {isAnswerOwner && !isEditingThisAnswer ? (
                        <Pressable
                          style={styles.smallEditButton}
                          onPress={() => handleStartEditAnswer(answer)}
                          disabled={answerActionLoading}
                        >
                          <Text style={styles.smallEditButtonText}>Edit</Text>
                        </Pressable>
                      ) : null}

                      {(isAnswerOwner || isProblemOwner) &&
                      !isEditingThisAnswer ? (
                        <Pressable
                          style={styles.smallDeleteButton}
                          onPress={() => handleDeleteAnswer(answer)}
                          disabled={answerActionLoading}
                        >
                          <Text style={styles.smallDeleteButtonText}>
                            Delete
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  {isEditingThisAnswer ? (
                    <>
                      <TextInput
                        value={editingAnswerText}
                        onChangeText={(text) => {
                          setEditingAnswerText(text);
                          setAnswerError("");
                        }}
                        multiline
                        style={styles.editContentInput}
                        placeholder="Edit your answer..."
                        placeholderTextColor="#888888"
                      />

                      <View style={styles.contentEditActions}>
                        <Pressable
                          style={styles.contentCancelButton}
                          onPress={handleCancelEditAnswer}
                          disabled={answerActionLoading}
                        >
                          <Text style={styles.contentCancelText}>Cancel</Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.contentSaveButton,
                            answerActionLoading && styles.disabledButton,
                          ]}
                          onPress={() => handleSaveAnswer(answer)}
                          disabled={answerActionLoading}
                        >
                          <Text style={styles.contentSaveText}>
                            {answerActionLoading ? "Saving..." : "Save"}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.answerText}>{answer.text}</Text>

                      {answerUpdatedDate && (
                        <Text style={styles.editedText}>
                          Edited: {answerUpdatedDate}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })
          )}

          {answerError !== "" && userRole !== "agriculturist" && (
            <Text style={styles.answerError}>{answerError}</Text>
          )}
        </View>

        {/* COMMENTS */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>

          <TextInput
            value={commentText}
            onChangeText={(text) => {
              setCommentText(text);
              setCommentError("");
            }}
            placeholder="Write a comment..."
            placeholderTextColor="#888888"
            multiline
            style={styles.commentInput}
          />

          {commentError !== "" && (
            <Text style={styles.commentError}>{commentError}</Text>
          )}

          <Pressable
            style={[
              styles.commentButton,
              commentSubmitting && styles.disabledButton,
            ]}
            onPress={handleAddComment}
            disabled={commentSubmitting}
          >
            <Text style={styles.commentButtonText}>
              {commentSubmitting ? "Posting..." : "Post Comment"}
            </Text>
          </Pressable>

          {commentsLoading ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" />

              <Text style={styles.loadingText}>Loading comments...</Text>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.noCommentsBox}>
              <Text style={styles.noCommentsText}>
                No comments yet. Be the first to comment.
              </Text>
            </View>
          ) : (
            comments.map((comment) => {
              const commentDate = formatDateTime(comment.createdAt);

              const commentUpdatedDate = formatDateTime(comment.updatedAt);

              const isCommentOwner = currentUserId === comment.userId;

              const isProblemOwner = currentUserId === problem.userId;

              const isEditingThisComment = editingCommentId === comment.id;

              return (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.contentHeaderRow}>
                    <View style={styles.contentUserContainer}>
                      <Text style={styles.commentUser}>
                        @{comment.username || "User"}
                      </Text>

                      {commentDate && (
                        <Text style={styles.contentDate}>🕒 {commentDate}</Text>
                      )}
                    </View>

                    <View style={styles.contentActions}>
                      {isCommentOwner && !isEditingThisComment ? (
                        <Pressable
                          style={styles.smallEditButton}
                          onPress={() => handleStartEditComment(comment)}
                          disabled={commentActionLoading}
                        >
                          <Text style={styles.smallEditButtonText}>Edit</Text>
                        </Pressable>
                      ) : null}

                      {(isCommentOwner || isProblemOwner) &&
                      !isEditingThisComment ? (
                        <Pressable
                          style={styles.smallDeleteButton}
                          onPress={() => handleDeleteComment(comment)}
                          disabled={commentActionLoading}
                        >
                          <Text style={styles.smallDeleteButtonText}>
                            Delete
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  {isEditingThisComment ? (
                    <>
                      <TextInput
                        value={editingCommentText}
                        onChangeText={(text) => {
                          setEditingCommentText(text);
                          setCommentError("");
                        }}
                        multiline
                        style={styles.editContentInput}
                        placeholder="Edit your comment..."
                        placeholderTextColor="#888888"
                      />

                      <View style={styles.contentEditActions}>
                        <Pressable
                          style={styles.contentCancelButton}
                          onPress={handleCancelEditComment}
                          disabled={commentActionLoading}
                        >
                          <Text style={styles.contentCancelText}>Cancel</Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.contentSaveButton,
                            commentActionLoading && styles.disabledButton,
                          ]}
                          onPress={() => handleSaveComment(comment)}
                          disabled={commentActionLoading}
                        >
                          <Text style={styles.contentSaveText}>
                            {commentActionLoading ? "Saving..." : "Save"}
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.commentText}>{comment.text}</Text>

                      {commentUpdatedDate && (
                        <Text style={styles.editedText}>
                          Edited: {commentUpdatedDate}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FULL-SCREEN IMAGE PREVIEW + ZOOM */}
      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setImagePreviewVisible(false);
          setImageZoom(1);
        }}
      >
        <View style={styles.imageModalContainer}>
          <Pressable
            style={styles.imageModalCloseButton}
            onPress={() => {
              setImagePreviewVisible(false);
              setImageZoom(1);
            }}
          >
            <Text style={styles.imageModalCloseText}>✕</Text>
          </Pressable>

          {problem.imageUri && (
            <Image
              source={{ uri: problem.imageUri }}
              style={[
                styles.fullScreenImage,
                {
                  transform: [{ scale: imageZoom }],
                },
              ]}
              resizeMode="contain"
            />
          )}

          <View style={styles.zoomControls}>
            <Pressable
              style={[
                styles.zoomButton,
                imageZoom <= 1 && styles.zoomDisabledButton,
              ]}
              onPress={() =>
                setImageZoom((previous) => Math.max(1, previous - 0.25))
              }
              disabled={imageZoom <= 1}
            >
              <Text style={styles.zoomButtonText}>−</Text>
            </Pressable>

            <Text style={styles.zoomText}>{Math.round(imageZoom * 100)}%</Text>

            <Pressable
              style={[
                styles.zoomButton,
                imageZoom >= 3 && styles.zoomDisabledButton,
              ]}
              onPress={() =>
                setImageZoom((previous) => Math.min(3, previous + 0.25))
              }
              disabled={imageZoom >= 3}
            >
              <Text style={styles.zoomButtonText}>+</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.resetZoomButton}
            onPress={() => setImageZoom(1)}
          >
            <Text style={styles.resetZoomText}>Reset Zoom</Text>
          </Pressable>
        </View>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteSubmitting) {
            setDeleteConfirmVisible(false);
            setDeleteError("");
          }
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalBox}>
            <Text style={styles.deleteModalIcon}>🗑️</Text>

            <Text style={styles.deleteModalTitle}>Delete Problem?</Text>

            <Text style={styles.deleteModalMessage}>
              This will permanently delete this problem and its related
              comments, reactions, and agriculturist answers.
            </Text>

            {deleteError !== "" && (
              <View style={styles.deleteErrorBox}>
                <Text style={styles.deleteErrorText}>{deleteError}</Text>
              </View>
            )}

            <View style={styles.deleteModalActions}>
              <Pressable
                style={[
                  styles.deleteCancelButton,
                  deleteSubmitting && styles.disabledButton,
                ]}
                onPress={() => {
                  setDeleteConfirmVisible(false);
                  setDeleteError("");
                }}
                disabled={deleteSubmitting}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.deleteConfirmButton,
                  deleteSubmitting && styles.disabledButton,
                ]}
                onPress={confirmDeleteProblem}
                disabled={deleteSubmitting}
              >
                <Text style={styles.deleteConfirmText}>
                  {deleteSubmitting ? "Deleting..." : "Delete Problem"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  content: {
    padding: 24,
    paddingBottom: 50,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 10,
    color: "#666666",
  },

  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f5e9",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 20,
  },

  backButtonText: {
    color: "#2e7d32",
    fontWeight: "700",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },

  cropBadge: {
    backgroundColor: "#e8f5e9",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },

  cropBadgeText: {
    color: "#2e7d32",
    fontWeight: "700",
  },

  typeBadge: {
    backgroundColor: "#f3f3f3",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },

  typeBadgeText: {
    color: "#555555",
    fontWeight: "700",
  },

  aiBadge: {
    backgroundColor: "#e3f2fd",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },

  aiBadgeText: {
    color: "#1565c0",
    fontSize: 12,
    fontWeight: "700",
  },

  metadataBox: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },

  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#e8f5e9",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  statusText: {
    color: "#2e7d32",
    fontSize: 13,
    fontWeight: "800",
  },

  metadataDetails: {
    gap: 4,
  },

  metadataText: {
    color: "#666666",
    fontSize: 12,
    lineHeight: 18,
  },

  ownerActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  editButton: {
    flex: 1,
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#2e7d32",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },

  editButtonText: {
    color: "#2e7d32",
    fontWeight: "700",
  },

  deleteButton: {
    flex: 1,
    backgroundColor: "#d32f2f",
    borderWidth: 1,
    borderColor: "#b71c1c",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },

  deleteButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  pressedButton: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  pressedDeleteButton: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  editBox: {
    backgroundColor: "#f8fff8",
    borderWidth: 1,
    borderColor: "#2e7d32",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },

  editBoxTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#2e7d32",
    marginBottom: 10,
  },

  editLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333333",
    marginTop: 5,
    marginBottom: 6,
  },

  editInput: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    color: "#222222",
    fontSize: 15,
  },

  editDescriptionInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  editActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  cancelEditButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#999999",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },

  cancelEditText: {
    color: "#555555",
    fontWeight: "700",
  },

  saveEditButton: {
    flex: 1,
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },

  saveEditText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#222222",
    marginBottom: 25,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333333",
    marginBottom: 8,
    marginTop: 15,
  },

  description: {
    fontSize: 16,
    lineHeight: 25,
    color: "#555555",
  },

  aiContainer: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#c8e6c9",
    backgroundColor: "#f7fff7",
    padding: 16,
  },

  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  aiHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  aiHeaderIconText: {
    fontSize: 21,
  },

  aiHeaderTextContainer: {
    flex: 1,
  },

  aiTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1b5e20",
  },

  aiSubtitle: {
    fontSize: 12,
    color: "#777777",
    marginTop: 3,
  },

  aiDivider: {
    height: 1,
    backgroundColor: "#d8ead8",
    marginVertical: 16,
  },

  aiCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e1eee1",
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },

  aiNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: 9,
    marginRight: 11,
  },

  aiCardContent: {
    flex: 1,
  },

  aiCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2e7d32",
    marginBottom: 6,
  },

  aiCardText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#333333",
  },

  aiWarningCard: {
    flexDirection: "row",
    backgroundColor: "#fff8e1",
    borderWidth: 1,
    borderColor: "#ffe082",
    borderRadius: 12,
    padding: 13,
    marginTop: 2,
  },

  aiWarningIcon: {
    fontSize: 20,
    marginRight: 10,
  },

  aiWarningTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#9a6700",
    marginBottom: 6,
  },

  aiWarningText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#5f4b00",
  },

  aiDisclaimerBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#d8ead8",
  },

  aiDisclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666666",
  },

  divider: {
    height: 1,
    backgroundColor: "#eeeeee",
    marginVertical: 20,
  },

  reporterBox: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },

  reporterName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222222",
  },

  reporterUsername: {
    fontSize: 14,
    color: "#777777",
    marginTop: 3,
  },

  reporterRole: {
    fontSize: 13,
    color: "#2e7d32",
    fontWeight: "600",
    marginTop: 5,
  },

  viewProfile: {
    marginTop: 7,
    color: "#2e7d32",
    fontSize: 13,
    fontWeight: "700",
  },

  locationBox: {
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 10,
    padding: 12,
  },

  locationText: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 4,
  },

  mapContainer: {
    width: "100%",
    height: 300,
    marginTop: 12,
    borderRadius: 10,
    overflow: "hidden",
  },

  imageSection: {
    marginTop: 20,
  },

  imagePressable: {
    position: "relative",
    width: "100%",
  },

  problemImage: {
    width: "100%",
    height: 260,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dddddd",
  },

  imageOverlay: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },

  imageOverlayText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  imageInfoText: {
    marginTop: 8,
    color: "#777777",
    fontSize: 12,
    lineHeight: 18,
  },

  imageModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },

  fullScreenImage: {
    width: "100%",
    height: "85%",
  },

  imageModalCloseButton: {
    position: "absolute",
    top: 40,
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  imageModalCloseText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },

  zoomControls: {
    position: "absolute",
    bottom: 35,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderRadius: 12,
    padding: 6,
  },

  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    justifyContent: "center",
    alignItems: "center",
  },

  zoomDisabledButton: {
    opacity: 0.35,
  },

  zoomButtonText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 30,
  },

  zoomText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 60,
    textAlign: "center",
  },

  resetZoomButton: {
    position: "absolute",
    bottom: 35,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },

  resetZoomText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  reactionsSection: {
    marginTop: 30,
  },

  reactionsTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#222222",
    marginBottom: 14,
  },

  reactionRow: {
    flexDirection: "row",
    gap: 10,
  },

  reactionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },

  activeLikeButton: {
    backgroundColor: "#e8f5e9",
    borderColor: "#2e7d32",
  },

  activeDislikeButton: {
    backgroundColor: "#ffebee",
    borderColor: "#d32f2f",
  },

  reactionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#444444",
  },

  activeReactionText: {
    color: "#222222",
  },

  reactionError: {
    color: "#d32f2f",
    marginTop: 8,
  },

  answersSection: {
    marginTop: 30,
  },

  answersTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#222222",
    marginBottom: 15,
  },

  answerInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#222222",
    backgroundColor: "#ffffff",
    textAlignVertical: "top",
  },

  answerError: {
    color: "#d32f2f",
    marginTop: 8,
    marginBottom: 4,
  },

  answerButton: {
    marginTop: 10,
    backgroundColor: "#2e7d32",
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
  },

  answerButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },

  answersLoading: {
    alignItems: "center",
    paddingVertical: 25,
  },

  noAnswersBox: {
    marginTop: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 10,
  },

  noAnswersText: {
    color: "#777777",
    textAlign: "center",
  },

  answerCard: {
    marginTop: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#2e7d32",
    borderRadius: 10,
    backgroundColor: "#f7fff7",
  },

  answerUser: {
    fontSize: 13,
    color: "#2e7d32",
    fontWeight: "700",
    marginBottom: 3,
  },

  contentHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  contentUserContainer: {
    flex: 1,
  },

  contentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  smallEditButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#e8f5e9",
    borderWidth: 1,
    borderColor: "#81c784",
  },

  smallEditButtonText: {
    fontSize: 11,
    color: "#2e7d32",
    fontWeight: "700",
  },

  smallDeleteButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#ffebee",
    borderWidth: 1,
    borderColor: "#ef9a9a",
  },

  smallDeleteButtonText: {
    fontSize: 11,
    color: "#c62828",
    fontWeight: "700",
  },

  editContentInput: {
    marginTop: 10,
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#ffffff",
    color: "#222222",
    fontSize: 14,
    textAlignVertical: "top",
  },

  contentEditActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },

  contentCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#aaaaaa",
  },

  contentCancelText: {
    color: "#555555",
    fontSize: 12,
    fontWeight: "700",
  },

  contentSaveButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: "#2e7d32",
  },

  contentSaveText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  contentDate: {
    fontSize: 11,
    color: "#888888",
    marginBottom: 8,
  },

  editedText: {
    fontSize: 10,
    color: "#999999",
    marginTop: 7,
  },

  answerText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#333333",
  },

  infoBox: {
    marginBottom: 5,
  },

  infoText: {
    color: "#777777",
  },

  commentsSection: {
    marginTop: 30,
  },

  commentsTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#222222",
    marginBottom: 15,
  },

  commentInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#222222",
    backgroundColor: "#ffffff",
    textAlignVertical: "top",
  },

  commentError: {
    color: "#d32f2f",
    marginTop: 8,
    marginBottom: 4,
  },

  commentButton: {
    marginTop: 10,
    backgroundColor: "#2e7d32",
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: "center",
  },

  commentButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },

  commentsLoading: {
    alignItems: "center",
    paddingVertical: 25,
  },

  noCommentsBox: {
    marginTop: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 10,
  },

  noCommentsText: {
    color: "#777777",
    textAlign: "center",
  },

  commentCard: {
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },

  commentUser: {
    fontSize: 13,
    color: "#2e7d32",
    fontWeight: "700",
    marginBottom: 3,
  },

  commentText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#333333",
  },

  disabledButton: {
    opacity: 0.6,
  },

  errorText: {
    color: "#d32f2f",
    textAlign: "center",
    marginBottom: 15,
  },

  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  deleteModalBox: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
  },

  deleteModalIcon: {
    fontSize: 42,
    marginBottom: 8,
  },

  deleteModalTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#222222",
    marginBottom: 10,
  },

  deleteModalMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: "#666666",
    textAlign: "center",
    marginBottom: 18,
  },

  deleteErrorBox: {
    width: "100%",
    backgroundColor: "#ffebee",
    borderWidth: 1,
    borderColor: "#ef9a9a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },

  deleteErrorText: {
    color: "#c62828",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },

  deleteModalActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },

  deleteCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#999999",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteCancelText: {
    color: "#555555",
    fontWeight: "700",
  },

  deleteConfirmButton: {
    flex: 1,
    backgroundColor: "#d32f2f",
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteConfirmText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
