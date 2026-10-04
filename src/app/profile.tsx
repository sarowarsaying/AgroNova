import { router, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { auth, db } from "@/firebase";

type UserProfile = {
  name?: string;
  username?: string;
  role?: string;
  email?: string;
  createdAt?: any;
};

type Problem = {
  id: string;
  title: string;
  description: string;
  category?: string;
  type?: string;
  cropName?: string;
  createdAt?: any;
  aiAnalysis?: any;
};

type ProfileStats = {
  problems: number;
  aiAnalyzed: number;
  commentsReceived: number;
  answeredProblems: number;
};

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{
    uid?: string;
    userId?: string;
  }>();

  const [authUserId, setAuthUserId] = useState<string | undefined>(
    auth.currentUser?.uid,
  );

  const [authReady, setAuthReady] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);

  const [profileStats, setProfileStats] = useState<ProfileStats>({
    problems: 0,
    aiAnalyzed: 0,
    commentsReceived: 0,
    answeredProblems: 0,
  });

  const [loading, setLoading] = useState(true);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [editing, setEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);

  /*
   * WAIT FOR FIREBASE AUTH
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUserId(user?.uid);
      setAuthReady(true);

      console.log("PROFILE AUTH USER:", user?.uid);
      console.log("PROFILE AUTH EMAIL:", user?.email);
    });

    return unsubscribe;
  }, []);

  /*
   * PROFILE UID
   *
   * If another user's profile is opened using:
   * /profile?uid=...
   *
   * use that UID.
   *
   * Otherwise use the currently logged-in user.
   */
  const uid =
    typeof params.uid === "string"
      ? params.uid
      : typeof params.userId === "string"
        ? params.userId
        : authUserId;

  console.log("PROFILE PARAMS:", params);
  console.log("PROFILE UID:", uid);

  const currentUserId = authUserId;
  const isCurrentUser = currentUserId === uid;

  const email =
    isCurrentUser && auth.currentUser ? auth.currentUser.email : null;

  /*
   * LOAD PROFILE
   */
  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!uid) {
      setErrorMessage("No logged-in user found.");
      setLoading(false);
      return;
    }

    loadProfile();
  }, [uid, authReady]);

  /*
   * LOAD / CREATE PROFILE
   */
  async function loadProfile() {
    if (!uid) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const currentAuthUser = auth.currentUser;

      if (!currentAuthUser) {
        setErrorMessage("No logged-in user found.");
        return;
      }

      /*
       * Current Firebase Auth UID.
       */
      const currentUid = currentAuthUser.uid;

      const userRef = doc(db, "users", currentUid);

      /*
       * STEP 1:
       * Check whether the profile already exists.
       */
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;

        setProfile(data);
        setUsernameInput(data.username || "");

        console.log("PROFILE FOUND:", currentUid);

        return;
      }

      /*
       * STEP 2:
       * Auth account exists but Firestore profile
       * does not exist.
       *
       * Create a profile using the SAME Firebase Auth UID.
       */
      const newProfile: UserProfile = {
        name: currentAuthUser.displayName || "User",
        email: currentAuthUser.email || "",
        role: "farmer",
      };

      await setDoc(userRef, newProfile);

      console.log("NEW PROFILE CREATED");
      console.log("UID:", currentUid);
      console.log("EMAIL:", currentAuthUser.email);

      setProfile(newProfile);
      setUsernameInput("");
    } catch (error: any) {
      console.log("LOAD PROFILE ERROR:", error);

      setErrorMessage(error?.message || "Failed to load user profile.");
    } finally {
      setLoading(false);
    }
  }

  /*
   * REAL-TIME PROBLEMS
   */
  useEffect(() => {
    if (!authReady || !uid) {
      return;
    }

    setProblemsLoading(true);

    const problemsQuery = query(
      collection(db, "problems"),
      where("userId", "==", uid),
    );

    const unsubscribe = onSnapshot(
      problemsQuery,
      (snapshot) => {
        const problemList: Problem[] = snapshot.docs.map((problemDoc) => ({
          id: problemDoc.id,
          ...(problemDoc.data() as Omit<Problem, "id">),
        }));

        problemList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;

          return timeB - timeA;
        });

        setProblems(problemList);

        const aiAnalyzed = problemList.filter(
          (problem) => !!problem.aiAnalysis,
        ).length;

        setProfileStats((previous) => ({
          ...previous,
          problems: problemList.length,
          aiAnalyzed,
        }));

        setProblemsLoading(false);
      },
      (error) => {
        console.log("PROFILE PROBLEMS ERROR:", error);
        setProblemsLoading(false);
      },
    );

    return unsubscribe;
  }, [uid, authReady]);

  /*
   * REAL-TIME COMMENTS + ANSWERS
   */
  useEffect(() => {
    if (!authReady || !uid || problemsLoading) {
      return;
    }

    setStatsLoading(true);

    const userProblemIds = new Set(problems.map((problem) => problem.id));

    const unsubscribeComments = onSnapshot(
      collection(db, "comments"),
      (snapshot) => {
        let commentsReceived = 0;

        snapshot.docs.forEach((commentDoc) => {
          const comment = commentDoc.data();

          if (comment.problemId && userProblemIds.has(comment.problemId)) {
            commentsReceived++;
          }
        });

        setProfileStats((previous) => ({
          ...previous,
          commentsReceived,
        }));
      },
      (error) => {
        console.log("PROFILE COMMENTS ERROR:", error);
      },
    );

    const unsubscribeAnswers = onSnapshot(
      collection(db, "answers"),
      (snapshot) => {
        const answeredProblemIds = new Set<string>();

        snapshot.docs.forEach((answerDoc) => {
          const answer = answerDoc.data();

          if (answer.problemId && userProblemIds.has(answer.problemId)) {
            answeredProblemIds.add(answer.problemId);
          }
        });

        setProfileStats((previous) => ({
          ...previous,
          answeredProblems: answeredProblemIds.size,
        }));

        setStatsLoading(false);
      },
      (error) => {
        console.log("PROFILE ANSWERS ERROR:", error);
        setStatsLoading(false);
      },
    );

    return () => {
      unsubscribeComments();
      unsubscribeAnswers();
    };
  }, [uid, authReady, problems, problemsLoading]);

  /*
   * UNIQUE USERNAME VERIFICATION
   */
  async function handleSaveProfile() {
    if (!uid || !profile) {
      return;
    }

    const trimmedUsername = usernameInput.trim();

    if (!trimmedUsername) {
      Alert.alert("Invalid Username", "Please enter your username.");
      return;
    }

    if (trimmedUsername.includes(" ")) {
      Alert.alert("Invalid Username", "Username cannot contain spaces.");
      return;
    }

    try {
      setSaving(true);

      const normalizedUsername = trimmedUsername.toLowerCase();

      const usersSnapshot = await getDocs(collection(db, "users"));

      const usernameTaken = usersSnapshot.docs.some((userDoc) => {
        if (userDoc.id === uid) {
          return false;
        }

        const otherUser = userDoc.data() as UserProfile;

        const otherUsername = otherUser.username?.trim().toLowerCase();

        return otherUsername === normalizedUsername;
      });

      if (usernameTaken) {
        Alert.alert(
          "Username Already Taken",
          "This username is already being used by another user. Please choose a different username.",
        );
        return;
      }

      await updateDoc(doc(db, "users", uid), {
        username: trimmedUsername,
      });

      setProfile((previous) => ({
        ...previous,
        username: trimmedUsername,
      }));

      setEditing(false);

      Alert.alert(
        "Profile Updated",
        "Your username has been updated successfully.",
      );
    } catch (error: any) {
      console.log("UPDATE PROFILE ERROR:", error);

      Alert.alert(
        "Update Failed",
        error?.message || "Failed to update username.",
      );
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setUsernameInput(profile?.username || "");
    setEditing(false);
  }

  function formatDate(timestamp: any) {
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

      return date.toLocaleDateString();
    } catch {
      return null;
    }
  }

  function getRoleLabel(role?: string) {
    if (role === "agriculturist") {
      return "👨‍🌾 Agriculturist";
    }

    return "🌾 Farmer";
  }

  function getCategoryLabel(category?: string) {
    switch (category) {
      case "cattle":
        return "🐄 Cattle";

      case "goat_sheep":
        return "🐐 Goat & Sheep";

      case "poultry":
        return "🐔 Poultry";

      case "fish":
        return "🐟 Fish Farming";

      case "pet":
        return "🐕 Pet Animals";

      case "beekeeping":
        return "🐝 Beekeeping";

      default:
        return "🌾 Crops";
    }
  }

  /*
   * WAIT FOR AUTH
   */
  if (!authReady) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>Checking your account...</Text>
      </View>
    );
  }

  /*
   * LOADING
   */
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  /*
   * ERROR
   */
  if (errorMessage || !profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {errorMessage || "Profile not found."}
        </Text>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      {/* PROFILE HEADER */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.name || profile.username || "U").charAt(0).toUpperCase()}
          </Text>
        </View>

        {!editing ? (
          <>
            <Text style={styles.name}>{profile.name || "Unknown User"}</Text>

            {profile.username && (
              <Text style={styles.username}>@{profile.username}</Text>
            )}
          </>
        ) : (
          <View style={styles.usernameEditBox}>
            <Text style={styles.inputLabel}>Username</Text>

            <TextInput
              value={usernameInput}
              onChangeText={setUsernameInput}
              placeholder="Enter username"
              style={styles.input}
              autoCapitalize="none"
              editable={!saving}
            />
          </View>
        )}

        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleLabel(profile.role)}</Text>
        </View>

        {isCurrentUser && (
          <View style={styles.youBadge}>
            <Text style={styles.youBadgeText}>This is you</Text>
          </View>
        )}

        {isCurrentUser && !editing && (
          <Pressable
            style={styles.editButton}
            onPress={() => {
              setUsernameInput(profile.username || "");
              setEditing(true);
            }}
          >
            <Text style={styles.editButtonText}>✏️ Edit Username</Text>
          </Pressable>
        )}

        {isCurrentUser && editing && (
          <View style={styles.editActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={cancelEditing}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.saveButton, saving && styles.disabledButton]}
              onPress={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* PROFILE INFORMATION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Information</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>

            <Text style={styles.infoValue}>
              {profile.name || "Not provided"}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>

            <Text style={styles.infoValue}>
              {profile.username ? `@${profile.username}` : "Not provided"}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>

            <Text style={styles.infoValue} numberOfLines={2}>
              {email || profile.email || "Not available"}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>

            <Text style={styles.infoValue}>
              {profile.role === "agriculturist" ? "Agriculturist" : "Farmer"}
            </Text>
          </View>
        </View>
      </View>

      {/* ACTIVITY STATISTICS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Statistics</Text>

        {statsLoading ? (
          <View style={styles.statsLoading}>
            <ActivityIndicator size="small" />

            <Text style={styles.statsLoadingText}>Loading statistics...</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>📋</Text>

              <Text style={styles.statNumber}>{profileStats.problems}</Text>

              <Text style={styles.statLabel}>Problems Reported</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>🤖</Text>

              <Text style={styles.statNumber}>{profileStats.aiAnalyzed}</Text>

              <Text style={styles.statLabel}>AI Analyzed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>💬</Text>

              <Text style={styles.statNumber}>
                {profileStats.commentsReceived}
              </Text>

              <Text style={styles.statLabel}>Comments Received</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>🔵</Text>

              <Text style={styles.statNumber}>
                {profileStats.answeredProblems}
              </Text>

              <Text style={styles.statLabel}>Problems Answered</Text>
            </View>
          </View>
        )}
      </View>

      {/* REPORTED PROBLEMS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reported Problems</Text>

        {problemsLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" />

            <Text style={styles.loadingText}>Loading problems...</Text>
          </View>
        ) : problems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🌱</Text>

            <Text style={styles.emptyTitle}>No problems reported yet</Text>

            <Text style={styles.emptyText}>
              This user has not reported any agricultural problems.
            </Text>
          </View>
        ) : (
          problems.map((problem) => {
            const createdDate = formatDate(problem.createdAt);

            return (
              <Pressable
                key={problem.id}
                style={styles.problemCard}
                onPress={() =>
                  router.push({
                    pathname: "/problem-details",
                    params: {
                      id: problem.id,
                    },
                  })
                }
              >
                <View style={styles.badgeRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>
                      {getCategoryLabel(problem.category)}
                    </Text>
                  </View>

                  {problem.aiAnalysis && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>🤖 AI</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.problemTitle} numberOfLines={2}>
                  {problem.title}
                </Text>

                <Text style={styles.problemDescription} numberOfLines={3}>
                  {problem.description}
                </Text>

                <Text style={styles.problemType}>
                  {problem.type || problem.cropName || "General"}
                </Text>

                <View style={styles.problemFooter}>
                  <Text style={styles.problemDate}>
                    {createdDate ? `Reported ${createdDate}` : "Reported"}
                  </Text>

                  <Text style={styles.viewDetails}>View Details →</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
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

  errorText: {
    color: "#d32f2f",
    textAlign: "center",
    marginBottom: 15,
    lineHeight: 22,
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

  profileCard: {
    alignItems: "center",
    backgroundColor: "#f7fff7",
    borderWidth: 1,
    borderColor: "#c8e6c9",
    borderRadius: 16,
    padding: 24,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
  },

  name: {
    fontSize: 24,
    fontWeight: "800",
    color: "#222222",
    textAlign: "center",
  },

  username: {
    marginTop: 4,
    fontSize: 15,
    color: "#777777",
  },

  usernameEditBox: {
    width: "100%",
  },

  inputLabel: {
    alignSelf: "flex-start",
    color: "#555555",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },

  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#ffffff",
    fontSize: 15,
  },

  roleBadge: {
    marginTop: 12,
    backgroundColor: "#e8f5e9",
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },

  roleText: {
    color: "#2e7d32",
    fontSize: 13,
    fontWeight: "800",
  },

  youBadge: {
    marginTop: 8,
    backgroundColor: "#e3f2fd",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },

  youBadgeText: {
    color: "#1565c0",
    fontSize: 12,
    fontWeight: "700",
  },

  editButton: {
    marginTop: 15,
    backgroundColor: "#2e7d32",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9,
  },

  editButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },

  cancelButton: {
    backgroundColor: "#eeeeee",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9,
  },

  cancelButtonText: {
    color: "#555555",
    fontWeight: "700",
  },

  saveButton: {
    backgroundColor: "#2e7d32",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9,
    minWidth: 90,
    alignItems: "center",
  },

  saveButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.6,
  },

  section: {
    marginTop: 28,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#222222",
    marginBottom: 12,
  },

  infoCard: {
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    paddingHorizontal: 15,
  },

  infoRow: {
    paddingVertical: 14,
  },

  infoLabel: {
    fontSize: 12,
    color: "#777777",
    marginBottom: 4,
  },

  infoValue: {
    fontSize: 15,
    color: "#222222",
    fontWeight: "600",
  },

  infoDivider: {
    height: 1,
    backgroundColor: "#eeeeee",
  },

  statsLoading: {
    alignItems: "center",
    paddingVertical: 25,
  },

  statsLoadingText: {
    marginTop: 8,
    color: "#777777",
    fontSize: 13,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  statCard: {
    width: "48%",
    minHeight: 125,
    borderWidth: 1,
    borderColor: "#dfe7df",
    borderRadius: 12,
    backgroundColor: "#f8fcf8",
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  statIcon: {
    fontSize: 24,
    marginBottom: 5,
  },

  statNumber: {
    fontSize: 25,
    fontWeight: "800",
    color: "#2e7d32",
  },

  statLabel: {
    marginTop: 3,
    color: "#666666",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  loadingBox: {
    alignItems: "center",
    paddingVertical: 30,
  },

  emptyBox: {
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 12,
    padding: 25,
    alignItems: "center",
  },

  emptyIcon: {
    fontSize: 34,
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333333",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 6,
    color: "#777777",
    textAlign: "center",
    lineHeight: 20,
  },

  problemCard: {
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  categoryBadge: {
    backgroundColor: "#e8f5e9",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },

  categoryBadgeText: {
    color: "#2e7d32",
    fontSize: 12,
    fontWeight: "700",
  },

  aiBadge: {
    backgroundColor: "#e3f2fd",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },

  aiBadgeText: {
    color: "#1565c0",
    fontSize: 12,
    fontWeight: "700",
  },

  problemTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#222222",
    lineHeight: 24,
  },

  problemDescription: {
    marginTop: 7,
    fontSize: 14,
    color: "#666666",
    lineHeight: 21,
  },

  problemType: {
    marginTop: 10,
    color: "#2e7d32",
    fontSize: 13,
    fontWeight: "700",
  },

  problemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },

  problemDate: {
    color: "#888888",
    fontSize: 12,
  },

  viewDetails: {
    color: "#2e7d32",
    fontSize: 12,
    fontWeight: "800",
  },
});
