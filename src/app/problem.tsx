import { router } from "expo-router";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { auth, db } from "@/firebase";

type Problem = {
  id: string;
  category?: string;
  type?: string;
  cropName?: string;
  title: string;
  description: string;
  username?: string;
  userId?: string;
  imageUri?: string | null;
  aiAnalysis?: {
    possibleProblem: string;
    likelyCauses: string;
    recommendedNextSteps: string;
    warningSigns: string;
  } | null;
  createdAt?: any;
};

type Category =
  | "all"
  | "crops"
  | "cattle"
  | "goat_sheep"
  | "poultry"
  | "fish"
  | "pet"
  | "beekeeping";

type ProblemView = "all" | "mine";
type SortOrder = "newest" | "oldest";

type ProblemStats = {
  likes: number;
  dislikes: number;
  comments: number;
  answers: number;
};

const PAGE_SIZE = 10;

export default function ProblemScreen() {
  const [problems, setProblems] = useState<Problem[]>([]);

  const [problemStats, setProblemStats] = useState<
    Record<string, ProblemStats>
  >({});

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");

  const [problemView, setProblemView] = useState<ProblemView>("all");

  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [lastDocument, setLastDocument] = useState<any>(null);

  /*
   * REAL-TIME FIRST PAGE
   */
  useEffect(() => {
    setLoading(true);
    setErrorMessage("");
    setHasMore(true);
    setLastDocument(null);

    const problemsQuery = query(
      collection(db, "problems"),
      orderBy("createdAt", sortOrder === "newest" ? "desc" : "asc"),
      limit(PAGE_SIZE),
    );

    const unsubscribe = onSnapshot(
      problemsQuery,
      (snapshot) => {
        const problemList: Problem[] = snapshot.docs.map((problemDoc) => ({
          id: problemDoc.id,
          ...(problemDoc.data() as Omit<Problem, "id">),
        }));

        setProblems(problemList);

        if (snapshot.docs.length > 0) {
          setLastDocument(snapshot.docs[snapshot.docs.length - 1]);
        } else {
          setLastDocument(null);
        }

        setHasMore(snapshot.docs.length === PAGE_SIZE);
        setLoading(false);
        setErrorMessage("");
      },
      (error) => {
        console.log("PROBLEMS LOAD ERROR:", error);

        setErrorMessage("Failed to load problems.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [sortOrder]);

  /*
   * LOAD MORE PROBLEMS
   */
  async function handleLoadMore() {
    if (loadingMore || !hasMore || !lastDocument) {
      return;
    }

    try {
      setLoadingMore(true);
      setErrorMessage("");

      const moreProblemsQuery = query(
        collection(db, "problems"),
        orderBy("createdAt", sortOrder === "newest" ? "desc" : "asc"),
        startAfter(lastDocument),
        limit(PAGE_SIZE),
      );

      const snapshot = await getDocs(moreProblemsQuery);

      const moreProblems: Problem[] = snapshot.docs.map((problemDoc) => ({
        id: problemDoc.id,
        ...(problemDoc.data() as Omit<Problem, "id">),
      }));

      setProblems((previousProblems) => {
        const existingIds = new Set(
          previousProblems.map((problem) => problem.id),
        );

        const newProblems = moreProblems.filter(
          (problem) => !existingIds.has(problem.id),
        );

        return [...previousProblems, ...newProblems];
      });

      if (snapshot.docs.length > 0) {
        setLastDocument(snapshot.docs[snapshot.docs.length - 1]);
      }

      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.log("LOAD MORE PROBLEMS ERROR:", error);

      setErrorMessage("Failed to load more problems.");
    } finally {
      setLoadingMore(false);
    }
  }

  /*
   * REAL-TIME REACTIONS
   */
  useEffect(() => {
    const reactionsQuery = query(collection(db, "reactions"));

    const unsubscribe = onSnapshot(
      reactionsQuery,
      (snapshot) => {
        const reactionStats: Record<
          string,
          {
            likes: number;
            dislikes: number;
          }
        > = {};

        snapshot.docs.forEach((reactionDoc) => {
          const reaction = reactionDoc.data();

          const problemId = reaction.problemId;

          if (!problemId) {
            return;
          }

          if (!reactionStats[problemId]) {
            reactionStats[problemId] = {
              likes: 0,
              dislikes: 0,
            };
          }

          if (reaction.type === "like") {
            reactionStats[problemId].likes++;
          }

          if (reaction.type === "dislike") {
            reactionStats[problemId].dislikes++;
          }
        });

        setProblemStats((previousStats) => {
          const mergedStats = {
            ...previousStats,
          };

          Object.keys(mergedStats).forEach((problemId) => {
            mergedStats[problemId] = {
              ...mergedStats[problemId],
              likes: reactionStats[problemId]?.likes || 0,
              dislikes: reactionStats[problemId]?.dislikes || 0,
            };
          });

          Object.keys(reactionStats).forEach((problemId) => {
            if (!mergedStats[problemId]) {
              mergedStats[problemId] = {
                likes: 0,
                dislikes: 0,
                comments: 0,
                answers: 0,
              };
            }

            mergedStats[problemId] = {
              ...mergedStats[problemId],
              likes: reactionStats[problemId].likes,
              dislikes: reactionStats[problemId].dislikes,
            };
          });

          return mergedStats;
        });
      },
      (error) => {
        console.log("REACTIONS LOAD ERROR:", error);
      },
    );

    return unsubscribe;
  }, []);

  /*
   * REAL-TIME COMMENTS
   */
  useEffect(() => {
    const commentsQuery = query(collection(db, "comments"));

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const commentCounts: Record<string, number> = {};

        snapshot.docs.forEach((commentDoc) => {
          const comment = commentDoc.data();

          const problemId = comment.problemId;

          if (!problemId) {
            return;
          }

          commentCounts[problemId] = (commentCounts[problemId] || 0) + 1;
        });

        setProblemStats((previousStats) => {
          const mergedStats = {
            ...previousStats,
          };

          Object.keys(mergedStats).forEach((problemId) => {
            mergedStats[problemId] = {
              ...mergedStats[problemId],
              comments: commentCounts[problemId] || 0,
            };
          });

          Object.keys(commentCounts).forEach((problemId) => {
            if (!mergedStats[problemId]) {
              mergedStats[problemId] = {
                likes: 0,
                dislikes: 0,
                comments: commentCounts[problemId],
                answers: 0,
              };
            }
          });

          return mergedStats;
        });
      },
      (error) => {
        console.log("COMMENTS LOAD ERROR:", error);
      },
    );

    return unsubscribe;
  }, []);

  /*
   * REAL-TIME AGRICULTURIST ANSWERS
   */
  useEffect(() => {
    const answersQuery = query(collection(db, "answers"));

    const unsubscribe = onSnapshot(
      answersQuery,
      (snapshot) => {
        const answerCounts: Record<string, number> = {};

        snapshot.docs.forEach((answerDoc) => {
          const answer = answerDoc.data();

          const problemId = answer.problemId;

          if (!problemId) {
            return;
          }

          answerCounts[problemId] = (answerCounts[problemId] || 0) + 1;
        });

        setProblemStats((previousStats) => {
          const mergedStats = {
            ...previousStats,
          };

          Object.keys(mergedStats).forEach((problemId) => {
            mergedStats[problemId] = {
              ...mergedStats[problemId],
              answers: answerCounts[problemId] || 0,
            };
          });

          Object.keys(answerCounts).forEach((problemId) => {
            if (!mergedStats[problemId]) {
              mergedStats[problemId] = {
                likes: 0,
                dislikes: 0,
                comments: 0,
                answers: answerCounts[problemId],
              };
            }
          });

          return mergedStats;
        });
      },
      (error) => {
        console.log("ANSWERS LOAD ERROR:", error);
      },
    );

    return unsubscribe;
  }, []);

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

  function matchesCategory(problem: Problem) {
    if (selectedCategory === "all") {
      return true;
    }

    if (selectedCategory === "crops") {
      return ![
        "cattle",
        "goat_sheep",
        "poultry",
        "fish",
        "pet",
        "beekeeping",
      ].includes(problem.category || "");
    }

    return problem.category === selectedCategory;
  }

  function matchesProblemView(problem: Problem) {
    if (problemView === "all") {
      return true;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      return false;
    }

    return problem.userId === currentUser.uid;
  }

  function getCreatedTime(createdAt: any) {
    if (!createdAt) {
      return 0;
    }

    if (typeof createdAt?.toMillis === "function") {
      return createdAt.toMillis();
    }

    if (createdAt instanceof Date) {
      return createdAt.getTime();
    }

    if (typeof createdAt === "number") {
      return createdAt;
    }

    return 0;
  }

  function getRelativeTime(createdAt: any) {
    const createdTime = getCreatedTime(createdAt);

    if (!createdTime) {
      return "";
    }

    const difference = Date.now() - createdTime;

    if (difference < 0) {
      return "Just now";
    }

    const seconds = Math.floor(difference / 1000);

    if (seconds < 60) {
      return "Just now";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `${days} ${days === 1 ? "day" : "days"} ago`;
    }

    const weeks = Math.floor(days / 7);

    if (weeks < 4) {
      return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
    }

    const months = Math.floor(days / 30);

    if (months < 12) {
      return `${months} ${months === 1 ? "month" : "months"} ago`;
    }

    const years = Math.floor(days / 365);

    return `${years} ${years === 1 ? "year" : "years"} ago`;
  }

  function getStats(problemId: string): ProblemStats {
    return (
      problemStats[problemId] || {
        likes: 0,
        dislikes: 0,
        comments: 0,
        answers: 0,
      }
    );
  }

  const filteredProblems = problems
    .filter((problem) => {
      const search = searchText.trim().toLowerCase();

      if (!matchesProblemView(problem)) {
        return false;
      }

      if (!matchesCategory(problem)) {
        return false;
      }

      if (search === "") {
        return true;
      }

      return (
        problem.title.toLowerCase().includes(search) ||
        problem.description.toLowerCase().includes(search) ||
        problem.category?.toLowerCase().includes(search) ||
        problem.type?.toLowerCase().includes(search) ||
        problem.cropName?.toLowerCase().includes(search) ||
        problem.username?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const timeA = getCreatedTime(a.createdAt);
      const timeB = getCreatedTime(b.createdAt);

      if (sortOrder === "newest") {
        return timeB - timeA;
      }

      return timeA - timeB;
    });

  const categories: {
    key: Category;
    label: string;
  }[] = [
    {
      key: "all",
      label: "All",
    },
    {
      key: "crops",
      label: "🌾 Crops",
    },
    {
      key: "cattle",
      label: "🐄 Cattle",
    },
    {
      key: "goat_sheep",
      label: "🐐 Goat & Sheep",
    },
    {
      key: "poultry",
      label: "🐔 Poultry",
    },
    {
      key: "fish",
      label: "🐟 Fish",
    },
    {
      key: "pet",
      label: "🐕 Pet",
    },
    {
      key: "beekeeping",
      label: "🐝 Beekeeping",
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.pageTitle}>Reported Problems</Text>

            <Text style={styles.subtitle}>
              Browse problems reported by AgroNova users
            </Text>
          </View>

          <Pressable
            style={styles.reportButton}
            onPress={() => router.push("/report-problem")}
          >
            <Text style={styles.reportButtonText}>+ Report</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search problems..."
          placeholderTextColor="#888888"
          value={searchText}
          onChangeText={setSearchText}
        />

        {/* ALL / MY PROBLEMS */}
        <View style={styles.viewFilterContainer}>
          <Pressable
            style={[
              styles.viewFilterButton,
              problemView === "all" && styles.activeViewFilterButton,
            ]}
            onPress={() => setProblemView("all")}
          >
            <Text
              style={[
                styles.viewFilterText,
                problemView === "all" && styles.activeViewFilterText,
              ]}
            >
              All Problems
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.viewFilterButton,
              problemView === "mine" && styles.activeViewFilterButton,
            ]}
            onPress={() => setProblemView("mine")}
          >
            <Text
              style={[
                styles.viewFilterText,
                problemView === "mine" && styles.activeViewFilterText,
              ]}
            >
              My Problems
            </Text>
          </Pressable>
        </View>

        {/* CATEGORY FILTER */}
        <Text style={styles.filterTitle}>Filter by Category</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterContainer}
        >
          {categories.map((category) => {
            const active = selectedCategory === category.key;

            return (
              <Pressable
                key={category.key}
                style={[
                  styles.filterButton,
                  active && styles.activeFilterButton,
                ]}
                onPress={() => setSelectedCategory(category.key)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    active && styles.activeFilterButtonText,
                  ]}
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* SORT */}
        <Text style={styles.filterTitle}>Sort By</Text>

        <View style={styles.sortContainer}>
          <Pressable
            style={[
              styles.sortButton,
              sortOrder === "newest" && styles.activeSortButton,
            ]}
            onPress={() => setSortOrder("newest")}
          >
            <Text
              style={[
                styles.sortButtonText,
                sortOrder === "newest" && styles.activeSortButtonText,
              ]}
            >
              Newest
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.sortButton,
              sortOrder === "oldest" && styles.activeSortButton,
            ]}
            onPress={() => setSortOrder("oldest")}
          >
            <Text
              style={[
                styles.sortButtonText,
                sortOrder === "oldest" && styles.activeSortButtonText,
              ]}
            >
              Oldest
            </Text>
          </Pressable>
        </View>

        <Text style={styles.resultCount}>
          {filteredProblems.length}{" "}
          {filteredProblems.length === 1 ? "problem" : "problems"} loaded
        </Text>

        {/* LOADING */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />

            <Text style={styles.message}>Loading problems...</Text>
          </View>
        ) : errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : filteredProblems.length === 0 ? (
          <Text style={styles.message}>
            {problemView === "mine"
              ? "You have not reported any problems yet."
              : searchText.trim() || selectedCategory !== "all"
                ? "No matching problems"
                : "No problems yet"}
          </Text>
        ) : (
          <>
            {filteredProblems.map((problem) => {
              const stats = getStats(problem.id);

              const isAnswered = stats.answers > 0;

              return (
                <Pressable
                  key={problem.id}
                  style={styles.card}
                  onPress={() =>
                    router.push({
                      pathname: "/problem-details",
                      params: {
                        id: problem.id,
                      },
                    })
                  }
                >
                  {/* CARD TOP */}
                  <View style={styles.cardTopRow}>
                    <Text style={styles.category}>
                      {getCategoryLabel(problem.category)}
                    </Text>

                    <View style={styles.badgeRow}>
                      <Text
                        style={[
                          styles.statusBadge,
                          isAnswered ? styles.answeredBadge : styles.openBadge,
                        ]}
                      >
                        {isAnswered ? "🔵 Answered" : "🟢 Open"}
                      </Text>

                      {problem.aiAnalysis ? (
                        <Text style={styles.aiBadge}>🤖 AI</Text>
                      ) : null}

                      {problem.imageUri ? (
                        <Text style={styles.imageBadge}>🖼️</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* TYPE */}
                  <Text style={styles.type}>
                    {problem.cropName || problem.type || "General Problem"}
                  </Text>

                  {/* TITLE */}
                  <Text style={styles.title}>{problem.title}</Text>

                  {/* DESCRIPTION */}
                  <Text style={styles.description} numberOfLines={3}>
                    {problem.description}
                  </Text>

                  {/* REPORTER */}
                  <View style={styles.reporterRow}>
                    <View style={styles.reporterInfo}>
                      <Text style={styles.reporter}>
                        👤 {problem.username || "User"}
                      </Text>

                      {getRelativeTime(problem.createdAt) ? (
                        <Text style={styles.timestamp}>
                          🕒 {getRelativeTime(problem.createdAt)}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.details}>View Details →</Text>
                  </View>

                  {/* STATS */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statText}>👍 {stats.likes}</Text>
                    </View>

                    <View style={styles.statItem}>
                      <Text style={styles.statText}>👎 {stats.dislikes}</Text>
                    </View>

                    <View style={styles.statItem}>
                      <Text style={styles.statText}>💬 {stats.comments}</Text>
                    </View>

                    <View style={styles.statItem}>
                      <Text style={styles.statText}>👨‍🌾 {stats.answers}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {/* BRICK 25: LOAD MORE */}
            {hasMore ? (
              <Pressable
                style={styles.loadMoreButton}
                onPress={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <ActivityIndicator size="small" />

                    <Text style={styles.loadMoreText}>Loading...</Text>
                  </>
                ) : (
                  <Text style={styles.loadMoreText}>Load More Problems</Text>
                )}
              </Pressable>
            ) : (
              <Text style={styles.endMessage}>✓ All problems loaded</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9f7",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 12,
  },

  headerTextContainer: {
    flex: 1,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1b5e20",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: "#666666",
  },

  reportButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 2,
  },

  reportButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  searchInput: {
    height: 46,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    fontSize: 15,
    marginBottom: 14,
  },

  viewFilterContainer: {
    flexDirection: "row",
    backgroundColor: "#e8eee8",
    borderRadius: 10,
    padding: 4,
    marginBottom: 18,
  },

  viewFilterButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },

  activeViewFilterButton: {
    backgroundColor: "#2e7d32",
  },

  viewFilterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555555",
  },

  activeViewFilterText: {
    color: "#ffffff",
  },

  filterTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333333",
    marginBottom: 10,
  },

  categoryFilterContainer: {
    gap: 8,
    paddingBottom: 12,
  },

  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#e8eee8",
  },

  activeFilterButton: {
    backgroundColor: "#2e7d32",
  },

  filterButtonText: {
    fontSize: 13,
    color: "#333333",
    fontWeight: "600",
  },

  activeFilterButtonText: {
    color: "#ffffff",
  },

  sortContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  sortButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#e8eee8",
  },

  activeSortButton: {
    backgroundColor: "#2e7d32",
  },

  sortButtonText: {
    fontSize: 13,
    color: "#333333",
    fontWeight: "600",
  },

  activeSortButtonText: {
    color: "#ffffff",
  },

  resultCount: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 12,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  category: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2e7d32",
    flex: 1,
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  statusBadge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  openBadge: {
    color: "#2e7d32",
    backgroundColor: "#e8f5e9",
  },

  answeredBadge: {
    color: "#1565c0",
    backgroundColor: "#e3f2fd",
  },

  aiBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1565c0",
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  imageBadge: {
    fontSize: 12,
    backgroundColor: "#f3f3f3",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
  },

  type: {
    fontSize: 12,
    color: "#777777",
    marginBottom: 6,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222222",
    marginBottom: 7,
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
    color: "#555555",
    marginBottom: 12,
  },

  reporterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },

  reporterInfo: {
    flex: 1,
  },

  reporter: {
    fontSize: 12,
    color: "#666666",
  },

  timestamp: {
    fontSize: 11,
    color: "#999999",
    marginTop: 4,
  },

  details: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2e7d32",
    marginLeft: 10,
  },

  statsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    paddingTop: 10,
    gap: 16,
    flexWrap: "wrap",
  },

  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  statText: {
    fontSize: 13,
    color: "#555555",
    fontWeight: "600",
  },

  loadMoreButton: {
    minHeight: 48,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#2e7d32",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },

  loadMoreText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  endMessage: {
    textAlign: "center",
    color: "#888888",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },

  loadingContainer: {
    alignItems: "center",
    marginTop: 30,
  },

  message: {
    textAlign: "center",
    color: "#777777",
    marginTop: 12,
  },

  error: {
    textAlign: "center",
    color: "#d32f2f",
    marginTop: 30,
  },
});
