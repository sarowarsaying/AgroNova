import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  RefreshControl,
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
  title?: string;
  description?: string;
  userId?: string;
  username?: string;
  imageUri?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  createdAt?: {
    seconds?: number;
    nanoseconds?: number;
  };
  aiAnalysis?: {
    possibleProblem?: string;
    likelyCauses?: string;
    recommendedNextSteps?: string;
    warningSigns?: string;
  };
};

type Reporter = {
  name?: string;
  username?: string;
  role?: string;
};

/* ========================================================= */
/* AGRICULTURE CATEGORY DATA */
/* ========================================================= */

const agricultureCategories = [
  {
    id: "crop",
    title: "Crops",
    image: require("../../../assets/agriculture/crop-category.jpg"),
  },
  {
    id: "cattle",
    title: "Cattle",
    image: require("../../../assets/agriculture/cattle-category.jpg"),
  },
  {
    id: "goat_sheep",
    title: "Goat & Sheep",
    image: require("../../../assets/agriculture/goat-sheep-category.jpg"),
  },
  {
    id: "poultry",
    title: "Poultry",
    image: require("../../../assets/agriculture/poultry-category.jpg"),
  },
  {
    id: "fish",
    title: "Fish Farming",
    image: require("../../../assets/agriculture/fish-category.jpg"),
  },
  {
    id: "pet",
    title: "Pet Animals",
    image: require("../../../assets/agriculture/pet-category.jpg"),
  },
  {
    id: "beekeeping",
    title: "Beekeeping",
    image: require("../../../assets/agriculture/beekeeping-category.jpg"),
  },
];

const categoryTypeOptions: Record<string, string[]> = {
  crop: [
    "Rice",
    "Wheat",
    "Potato",
    "Tomato",
    "Maize",
    "Jute",
    "Vegetables",
    "Other",
  ],
  cattle: ["Cow", "Bull", "Calf", "Other"],
  goat_sheep: ["Goat", "Sheep", "Other"],
  poultry: ["Chicken", "Duck", "Other"],
  fish: ["Tilapia", "Rui", "Catla", "Mrigal", "Pangasius", "Other"],
  pet: ["Dog", "Cat", "Bird", "Other"],
  beekeeping: ["Honey Bee", "Hive", "Other"],
};

/* ========================================================= */
/* HERO IMAGES */
/* ========================================================= */

const agricultureHeroImages = [
  require("../../../assets/agriculture/rice.jpg"),
  require("../../../assets/agriculture/cattle.jpg"),
  require("../../../assets/agriculture/poultry.jpg"),
  require("../../../assets/agriculture/fish.jpg"),
  require("../../../assets/agriculture/vegetables.jpg"),
];

/* ========================================================= */
/* HELPERS */
/* ========================================================= */

function formatRelativeTime(createdAt?: Problem["createdAt"]) {
  if (!createdAt?.seconds) {
    return "Recently";
  }

  const createdTime = createdAt.seconds * 1000;
  const difference = Math.max(0, Date.now() - createdTime);

  const minutes = Math.floor(difference / (1000 * 60));

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  return new Date(createdTime).toLocaleDateString();
}

/* ========================================================= */
/* SEQUENTIAL AGRICULTURE HERO */
/* ========================================================= */

function AgricultureHero() {
  const [index, setIndex] = useState(0);
  const [imageReady, setImageReady] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.035)).current;

  /*
   * Preload all local hero images.
   *
   * This helps prevent the first rice image from appearing late
   * when the carousel starts.
   */
  useEffect(() => {
    agricultureHeroImages.forEach((source) => {
      try {
        const resolved = Image.resolveAssetSource(source);

        if (resolved?.uri) {
          Image.prefetch(resolved.uri).catch(() => {});
        }
      } catch (error) {
        console.log("HERO IMAGE PRELOAD ERROR:", error);
      }
    });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    setImageReady(false);

    opacity.setValue(0);
    scale.setValue(1.035);

    /*
     * Give the image a little time to mount before starting
     * the fade animation.
     */
    const startAnimation = setTimeout(() => {
      if (cancelled) {
        return;
      }

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || cancelled) {
          return;
        }

        timer = setTimeout(() => {
          if (cancelled) {
            return;
          }

          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 0,
              duration: 650,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1.035,
              duration: 650,
              useNativeDriver: true,
            }),
          ]).start(({ finished: fadeFinished }) => {
            if (!fadeFinished || cancelled) {
              return;
            }

            setIndex(
              (currentIndex) =>
                (currentIndex + 1) % agricultureHeroImages.length,
            );
          });
        }, 1800);
      });
    }, 80);

    return () => {
      cancelled = true;

      clearTimeout(startAnimation);

      if (timer) {
        clearTimeout(timer);
      }

      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [index, opacity, scale]);

  function handleHeroImageError() {
    console.log(
      "HERO IMAGE FAILED TO LOAD:",
      index,
      agricultureHeroImages[index],
    );

    /*
     * If one image fails, immediately move to the next image.
     * This prevents a blank hero.
     */
    setImageReady(false);

    setIndex(
      (currentIndex) => (currentIndex + 1) % agricultureHeroImages.length,
    );
  }

  return (
    <View style={styles.welcomeBanner}>
      <Animated.View
        style={[
          styles.heroImageFrame,
          {
            opacity: imageReady ? opacity : 0,
            transform: [{ scale }],
          },
        ]}
      >
        <Image
          source={agricultureHeroImages[index]}
          style={styles.heroImage}
          resizeMode="cover"
          onLoad={() => {
            setImageReady(true);
          }}
          onError={handleHeroImageError}
        />
      </Animated.View>

      {!imageReady ? (
        <View style={styles.heroLoading}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.heroLoadingText}>Loading...</Text>
        </View>
      ) : null}

      <View style={styles.heroImageShade} />

      <View style={styles.heroText}>
        <Text style={styles.heroBrand}>AgroNova</Text>

        <Text style={styles.heroTagline}>Smart agriculture support</Text>
      </View>
    </View>
  );
}

/* ========================================================= */
/* HOME SCREEN */
/* ========================================================= */

export default function HomeScreen() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [reporters, setReporters] = useState<Record<string, Reporter>>({});

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const currentUser = auth.currentUser;

  async function loadProblems(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true);
      }

      setError("");

      const problemsQuery = query(
        collection(db, "problems"),
        orderBy("createdAt", "desc"),
      );

      const snapshot = await getDocs(problemsQuery);

      const loadedProblems: Problem[] = snapshot.docs.map((problemDoc) => ({
        id: problemDoc.id,
        ...problemDoc.data(),
      })) as Problem[];

      setProblems(loadedProblems);

      const uniqueUserIds = Array.from(
        new Set(
          loadedProblems.map((problem) => problem.userId).filter(Boolean),
        ),
      ) as string[];

      const reporterEntries = await Promise.all(
        uniqueUserIds.map(async (userId) => {
          try {
            const userSnapshot = await getDoc(doc(db, "users", userId));

            if (userSnapshot.exists()) {
              return [userId, userSnapshot.data() as Reporter] as const;
            }
          } catch (userError) {
            console.log("LOAD REPORTER ERROR:", userError);
          }

          return [
            userId,
            {
              name: "AgroNova User",
              username: "user",
              role: "farmer",
            },
          ] as const;
        }),
      );

      setReporters(Object.fromEntries(reporterEntries));
    } catch (loadError) {
      console.log("LOAD HOME PROBLEMS ERROR:", loadError);
      setError("Unable to load problems right now. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadProblems();
  }, []);

  const filteredProblems = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return problems.filter((problem) => {
      const matchesCategory =
        !selectedCategory || problem.category === selectedCategory;

      const matchesType = !selectedType || problem.type === selectedType;

      if (!normalizedSearch) {
        return matchesCategory && matchesType;
      }

      const searchableText = [
        problem.title,
        problem.description,
        problem.category,
        problem.type,
        problem.cropName,
        problem.username,
        problem.userId ? reporters[problem.userId]?.name : "",
        problem.userId ? reporters[problem.userId]?.username : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesCategory &&
        matchesType &&
        searchableText.includes(normalizedSearch)
      );
    });
  }, [problems, reporters, searchText, selectedCategory, selectedType]);

  const selectedCategoryInfo = agricultureCategories.find(
    (category) => category.id === selectedCategory,
  );

  const availableTypes = selectedCategory
    ? categoryTypeOptions[selectedCategory] || []
    : [];

  function handleCategoryPress(categoryId: string) {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
      setSelectedType(null);
      return;
    }

    setSelectedCategory(categoryId);
    setSelectedType(null);
  }

  function handleRefresh() {
    setRefreshing(true);
    loadProblems(false);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* ===================================================== */}
        {/* HEADER */}
        {/* ===================================================== */}

        <View style={styles.header}>
          <View style={styles.brandArea}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🌱</Text>
            </View>

            <View style={styles.brandText}>
              <Text style={styles.brandName}>AgroNova</Text>

              <Text style={styles.brandTagline}>
                Smarter farming. Better solutions.
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.notificationButton}
            onPress={() => router.push("/notifications")}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
          </Pressable>
        </View>

        {/* ===================================================== */}
        {/* AGRICULTURE HERO */}
        {/* ===================================================== */}

        <AgricultureHero />

        {/* ===================================================== */}
        {/* AGRO NOVA AI */}
        {/* ===================================================== */}

        <Pressable
          style={styles.aiCard}
          onPress={() => router.push("/ai-assistant")}
        >
          <View style={styles.aiLeft}>
            <View style={styles.aiIconCircle}>
              <Text style={styles.aiIcon}>🤖</Text>
            </View>
          </View>

          <View style={styles.aiContent}>
            <View style={styles.aiTitleRow}>
              <Text style={styles.aiTitle}>AgroNova AI</Text>

              <View style={styles.aiLiveBadge}>
                <Text style={styles.aiLiveText}>AI</Text>
              </View>
            </View>

            <Text style={styles.aiDescription}>
              Ask about crop problems, symptoms, farming practices and more.
            </Text>

            <Text style={styles.aiLink}>Ask AgroNova AI →</Text>
          </View>
        </Pressable>

        {/* ===================================================== */}
        {/* AGRICULTURE CATEGORIES */}
        {/* ===================================================== */}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Explore Agriculture</Text>

              <Text style={styles.sectionSubtitle}>
                Choose an area to explore problems
              </Text>
            </View>

            {selectedCategory ? (
              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  setSelectedCategory(null);
                  setSelectedType(null);
                }}
              >
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {agricultureCategories.map((category) => {
              const isSelected = selectedCategory === category.id;

              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                  ]}
                  onPress={() => handleCategoryPress(category.id)}
                >
                  <Image
                    source={category.image}
                    style={styles.categoryImage}
                    resizeMode="cover"
                  />

                  <View style={styles.categoryImageOverlay} />

                  <View style={styles.categoryCardBottom}>
                    <Text
                      style={[
                        styles.categoryTitle,
                        isSelected && styles.categoryTitleSelected,
                      ]}
                    >
                      {category.title}
                    </Text>
                  </View>

                  {isSelected ? (
                    <View style={styles.selectedDot}>
                      <Text style={styles.selectedDotText}>✓</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* =================================================== */}
          {/* SELECTED CATEGORY + TYPE */}
          {/* =================================================== */}

          {selectedCategory ? (
            <View style={styles.selectedCategoryBox}>
              <View style={styles.selectedCategoryHeader}>
                <Image
                  source={selectedCategoryInfo?.image}
                  style={styles.selectedCategoryImage}
                  resizeMode="cover"
                />

                <View style={styles.selectedCategoryText}>
                  <Text style={styles.selectedCategoryTitle}>
                    {selectedCategoryInfo?.title}
                  </Text>

                  <Text style={styles.selectedCategoryDescription}>
                    Select a type to narrow down the problems.
                  </Text>
                </View>
              </View>

              {availableTypes.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typeList}
                >
                  {availableTypes.map((type) => {
                    const isSelected = selectedType === type;

                    return (
                      <Pressable
                        key={type}
                        style={[
                          styles.typeChip,
                          isSelected && styles.typeChipSelected,
                        ]}
                        onPress={() =>
                          setSelectedType(isSelected ? null : type)
                        }
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            isSelected && styles.typeChipTextSelected,
                          ]}
                        >
                          {type}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* ===================================================== */}
        {/* RECENT PROBLEMS */}
        {/* ===================================================== */}

        <View style={styles.feedSection}>
          <View style={styles.feedHeader}>
            <View style={styles.feedHeaderText}>
              <Text style={styles.sectionTitle}>Recent Problems</Text>

              <Text style={styles.sectionSubtitle}>
                See what the AgroNova community is asking
              </Text>
            </View>

            <Pressable style={styles.refreshButton} onPress={handleRefresh}>
              <Text style={styles.refreshIcon}>↻</Text>

              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          {/* SEARCH */}

          <View style={styles.searchContainer}>
            <View style={styles.searchIconCircle}>
              <Text style={styles.searchIcon}>⌕</Text>
            </View>

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search crop problems..."
              placeholderTextColor="#89938b"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {searchText.length > 0 ? (
              <Pressable
                style={styles.clearSearchButton}
                onPress={() => setSearchText("")}
              >
                <Text style={styles.clearSearch}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          {/* ACTIVE FILTERS */}

          {selectedCategory || selectedType ? (
            <View style={styles.activeFilters}>
              <Text style={styles.activeFilterLabel}>Filtering by:</Text>

              {selectedCategory ? (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterText}>
                    {selectedCategoryInfo?.title}
                  </Text>
                </View>
              ) : null}

              {selectedType ? (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterText}>{selectedType}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {!loading && !error ? (
            <Text style={styles.resultCount}>
              {filteredProblems.length} problem
              {filteredProblems.length !== 1 ? "s" : ""} found
            </Text>
          ) : null}

          {/* LOADING */}

          {loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color="#24843a" />

              <Text style={styles.stateText}>
                Loading agricultural problems...
              </Text>
            </View>
          ) : null}

          {/* ERROR */}

          {!loading && error ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateIcon}>⚠️</Text>

              <Text style={styles.errorText}>{error}</Text>

              <Pressable
                style={styles.retryButton}
                onPress={() => loadProblems()}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : null}

          {/* EMPTY */}

          {!loading && !error && filteredProblems.length === 0 ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateIcon}>🌱</Text>

              <Text style={styles.emptyTitle}>No problems found</Text>

              <Text style={styles.emptyDescription}>
                {searchText
                  ? "Try a different search term."
                  : "No agricultural problems match the selected filters."}
              </Text>

              {searchText || selectedCategory || selectedType ? (
                <Pressable
                  style={styles.retryButton}
                  onPress={() => {
                    setSearchText("");
                    setSelectedCategory(null);
                    setSelectedType(null);
                  }}
                >
                  <Text style={styles.retryButtonText}>Clear Filters</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* PROBLEMS */}

          {!loading && !error && filteredProblems.length > 0
            ? filteredProblems.map((problem) => {
                const reporter = problem.userId
                  ? reporters[problem.userId]
                  : undefined;

                const reporterName =
                  reporter?.name || problem.username || "AgroNova User";

                const reporterUsername = reporter?.username || problem.username;

                const categoryInfo = agricultureCategories.find(
                  (category) => category.id === problem.category,
                );

                const categoryTitle =
                  categoryInfo?.title || problem.category || "Agriculture";

                const hasLocation =
                  problem.location?.latitude != null &&
                  problem.location?.longitude != null;

                return (
                  <View key={problem.id} style={styles.problemCard}>
                    {/* TOP ROW */}

                    <View style={styles.problemTopRow}>
                      <View style={styles.problemCategory}>
                        <View style={styles.problemCategoryIconBox}>
                          {categoryInfo ? (
                            <Image
                              source={categoryInfo.image}
                              style={styles.problemCategoryImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={styles.problemCategoryIcon}>🌱</Text>
                          )}
                        </View>

                        <Text style={styles.problemCategoryText}>
                          {categoryTitle}
                        </Text>
                      </View>

                      <Text style={styles.problemTime}>
                        {formatRelativeTime(problem.createdAt)}
                      </Text>
                    </View>

                    {/* BADGES */}

                    {problem.aiAnalysis || problem.imageUri ? (
                      <View style={styles.badgesRow}>
                        {problem.aiAnalysis ? (
                          <View style={styles.aiBadge}>
                            <Text style={styles.aiBadgeText}>
                              🤖 AI Analyzed
                            </Text>
                          </View>
                        ) : null}

                        {problem.imageUri ? (
                          <View style={styles.imageBadge}>
                            <Text style={styles.imageBadgeText}>📷 Image</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* TYPE */}

                    {problem.type || problem.cropName ? (
                      <Text style={styles.problemType}>
                        {problem.cropName || problem.type}
                      </Text>
                    ) : null}

                    {/* TITLE */}

                    <Text style={styles.problemTitle}>
                      {problem.title || "Agricultural Problem"}
                    </Text>

                    {/* DESCRIPTION */}

                    {problem.description ? (
                      <Text style={styles.problemDescription}>
                        {problem.description}
                      </Text>
                    ) : null}

                    {/* REPORTER */}

                    <View style={styles.reporterSection}>
                      <Text style={styles.reportedByLabel}>Reported by</Text>

                      <View style={styles.reporterMainRow}>
                        <View style={styles.reporterAvatar}>
                          <Text style={styles.reporterAvatarText}>
                            {reporterName.charAt(0).toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.reporterInfo}>
                          <Text style={styles.reporterName}>
                            {reporterName}
                          </Text>

                          <Text style={styles.reporterUsername}>
                            {reporterUsername
                              ? `@${reporterUsername}`
                              : "Community member"}
                          </Text>
                        </View>

                        {reporter?.role ? (
                          <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>
                              {reporter.role === "agriculturist"
                                ? "Agriculturist"
                                : "Farmer"}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {problem.userId ? (
                        <Pressable
                          style={styles.profileLink}
                          onPress={() =>
                            router.push({
                              pathname: "/user-profile",
                              params: {
                                uid: problem.userId,
                              },
                            })
                          }
                        >
                          <Text style={styles.profileLinkText}>
                            View profile →
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {/* LOCATION */}

                    {hasLocation ? (
                      <View style={styles.locationRow}>
                        <Text style={styles.locationIcon}>📍</Text>

                        <Text style={styles.locationText}>
                          {problem.location!.latitude!.toFixed(4)},{" "}
                          {problem.location!.longitude!.toFixed(4)}
                        </Text>
                      </View>
                    ) : null}

                    {/* DETAILS */}

                    <Pressable
                      style={styles.detailsRow}
                      onPress={() =>
                        router.push({
                          pathname: "/problem-details",
                          params: {
                            id: problem.id,
                          },
                        })
                      }
                    >
                      <Text style={styles.viewDetailsText}>
                        Tap to view details →
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            : null}
        </View>
      </ScrollView>
    </View>
  );
}

/* ========================================================= */
/* STYLES */
/* ========================================================= */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f7f2",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 45,
  },

  /* ========================================================= */
  /* HEADER */
  /* ========================================================= */

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  brandArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#1f7a35",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    elevation: 4,
  },

  logoIcon: {
    fontSize: 27,
  },

  brandText: {
    flex: 1,
  },

  brandName: {
    fontSize: 25,
    fontWeight: "900",
    color: "#164c25",
    letterSpacing: -0.5,
  },

  brandTagline: {
    fontSize: 11,
    color: "#657369",
    marginTop: 2,
    fontWeight: "600",
  },

  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dce6dc",
    elevation: 3,
  },

  notificationIcon: {
    fontSize: 22,
  },

  /* ========================================================= */
  /* HERO */
  /* ========================================================= */

  welcomeBanner: {
    height: 300,
    borderRadius: 26,
    backgroundColor: "#145c28",
    overflow: "hidden",
    marginBottom: 25,
    position: "relative",
    elevation: 7,
  },

  heroImageFrame: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 8,
    bottom: 8,
    borderRadius: 21,
    overflow: "hidden",
    backgroundColor: "#145c28",
    zIndex: 2,
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  heroLoading: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },

  heroLoadingText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
  },

  heroImageShade: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 8,
    bottom: 8,
    borderRadius: 21,
    backgroundColor: "rgba(7, 38, 14, 0.14)",
    zIndex: 3,
  },

  heroText: {
    position: "absolute",
    left: 19,
    bottom: 19,
    zIndex: 5,
    backgroundColor: "rgba(7, 42, 15, 0.72)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },

  heroBrand: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  heroTagline: {
    color: "#d8f0da",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 1,
  },

  /* ========================================================= */
  /* SECTIONS */
  /* ========================================================= */

  section: {
    marginBottom: 27,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#182b1d",
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: "#69766d",
    marginTop: 3,
  },

  clearButton: {
    backgroundColor: "#e4f3e5",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },

  clearText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#247234",
  },

  /* ========================================================= */
  /* AGRICULTURE CATEGORY CARDS */
  /* ========================================================= */

  categoryScroll: {
    paddingRight: 8,
    gap: 12,
  },

  categoryCard: {
    width: 155,
    height: 138,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe7df",
    overflow: "hidden",
    position: "relative",
    elevation: 3,
  },

  categoryCardSelected: {
    borderColor: "#2f803d",
    borderWidth: 2,
    elevation: 5,
  },

  categoryImage: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },

  categoryImageOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 65,
    backgroundColor: "rgba(5, 30, 12, 0.56)",
  },

  categoryCardBottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 11,
  },

  categoryTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 3,
  },

  categoryTitleSelected: {
    color: "#f4fff4",
  },

  selectedDot: {
    position: "absolute",
    right: 9,
    top: 9,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#2d803b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },

  selectedDotText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },

  selectedCategoryBox: {
    marginTop: 13,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dce7dc",
  },

  selectedCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  selectedCategoryImage: {
    width: 58,
    height: 58,
    borderRadius: 16,
    marginRight: 11,
  },

  selectedCategoryText: {
    flex: 1,
  },

  selectedCategoryTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#205d2a",
  },

  selectedCategoryDescription: {
    fontSize: 11,
    color: "#738078",
    marginTop: 2,
  },

  typeList: {
    gap: 8,
  },

  typeChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f2f5f2",
    borderWidth: 1,
    borderColor: "#e0e7e0",
  },

  typeChipSelected: {
    backgroundColor: "#277b36",
    borderColor: "#277b36",
  },

  typeChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#536057",
  },

  typeChipTextSelected: {
    color: "#ffffff",
  },

  /* ========================================================= */
  /* AI */
  /* ========================================================= */

  aiCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 21,
    padding: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#dbe8dc",
    elevation: 3,
  },

  aiLeft: {
    marginRight: 13,
  },

  aiIconCircle: {
    width: 57,
    height: 57,
    borderRadius: 19,
    backgroundColor: "#e6f5e8",
    alignItems: "center",
    justifyContent: "center",
  },

  aiIcon: {
    fontSize: 30,
  },

  aiContent: {
    flex: 1,
  },

  aiTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  aiTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#183c20",
  },

  aiLiveBadge: {
    marginLeft: 7,
    backgroundColor: "#dff2e2",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },

  aiLiveText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#277237",
  },

  aiDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#657168",
    marginBottom: 7,
  },

  aiLink: {
    fontSize: 12,
    fontWeight: "900",
    color: "#238038",
  },

  /* ========================================================= */
  /* FEED */
  /* ========================================================= */

  feedSection: {
    marginTop: 0,
  },

  feedHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  feedHeaderText: {
    flex: 1,
    paddingRight: 10,
  },

  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#dbe4db",
  },

  refreshIcon: {
    fontSize: 16,
    color: "#277638",
    marginRight: 4,
  },

  refreshText: {
    color: "#277638",
    fontSize: 11,
    fontWeight: "800",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d9e2d9",
    paddingHorizontal: 9,
    height: 52,
    marginBottom: 11,
    elevation: 1,
  },

  searchIconCircle: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#eaf4eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  searchIcon: {
    fontSize: 22,
    fontWeight: "700",
    color: "#287638",
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#26352a",
    paddingVertical: 0,
    fontWeight: "500",
  },

  clearSearchButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#f0f3f0",
    alignItems: "center",
    justifyContent: "center",
  },

  clearSearch: {
    fontSize: 13,
    color: "#6d786f",
    fontWeight: "700",
  },

  activeFilters: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 9,
  },

  activeFilterLabel: {
    fontSize: 11,
    color: "#647168",
    fontWeight: "700",
  },

  activeFilterChip: {
    backgroundColor: "#e3f3e5",
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  activeFilterText: {
    fontSize: 10,
    color: "#286c34",
    fontWeight: "800",
  },

  resultCount: {
    fontSize: 11,
    color: "#69766d",
    marginBottom: 11,
    fontWeight: "600",
  },

  /* ========================================================= */
  /* STATES */
  /* ========================================================= */

  stateContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 19,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dfe7df",
    marginBottom: 12,
  },

  stateText: {
    fontSize: 13,
    color: "#626f66",
    marginTop: 10,
    textAlign: "center",
  },

  stateIcon: {
    fontSize: 32,
    marginBottom: 8,
  },

  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#7b4a4a",
    textAlign: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#344239",
    marginBottom: 5,
  },

  emptyDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#717c74",
    textAlign: "center",
    marginBottom: 14,
  },

  retryButton: {
    backgroundColor: "#277b36",
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderRadius: 11,
  },

  retryButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  /* ========================================================= */
  /* PROBLEM CARD */
  /* ========================================================= */

  problemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 21,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#dce5dc",
    elevation: 2,
  },

  problemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },

  problemCategory: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  problemCategoryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#e9f5ea",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    overflow: "hidden",
  },

  problemCategoryImage: {
    width: "100%",
    height: "100%",
  },

  problemCategoryIcon: {
    fontSize: 17,
  },

  problemCategoryText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#286b34",
  },

  problemTime: {
    fontSize: 10,
    color: "#78847b",
    fontWeight: "700",
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },

  aiBadge: {
    backgroundColor: "#e6f5e8",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },

  aiBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#276d32",
  },

  imageBadge: {
    backgroundColor: "#f1f4f1",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },

  imageBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#59645d",
  },

  problemType: {
    fontSize: 12,
    fontWeight: "900",
    color: "#55705b",
    marginBottom: 6,
  },

  problemTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
    color: "#17231a",
    marginBottom: 9,
  },

  problemDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: "#3f4d43",
    marginBottom: 17,
  },

  reporterSection: {
    borderTopWidth: 1,
    borderTopColor: "#e4eae4",
    paddingTop: 14,
  },

  reportedByLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#69756d",
    marginBottom: 9,
  },

  reporterMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  reporterAvatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "#dff0e1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  reporterAvatarText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#286632",
  },

  reporterInfo: {
    flex: 1,
  },

  reporterName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#26342b",
  },

  reporterUsername: {
    fontSize: 12,
    color: "#69766d",
    marginTop: 3,
  },

  roleBadge: {
    backgroundColor: "#eef5ef",
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  roleBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#4e6754",
  },

  profileLink: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 2,
  },

  profileLinkText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#287638",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#edf0ed",
  },

  locationIcon: {
    fontSize: 16,
    marginRight: 6,
  },

  locationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#445148",
  },

  detailsRow: {
    marginTop: 12,
    alignItems: "flex-start",
  },

  viewDetailsText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#247334",
  },
});
