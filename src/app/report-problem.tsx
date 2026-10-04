import GoogleMap from "@/components/google-map.web";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { auth, db } from "@/firebase";

const categoryOptions = [
  {
    id: "crop",
    name: "Crops",
    icon: "🌾",
    types: [
      "Rice",
      "Wheat",
      "Potato",
      "Tomato",
      "Maize",
      "Jute",
      "Vegetables",
      "Other",
    ],
  },
  {
    id: "cattle",
    name: "Cattle",
    icon: "🐄",
    types: ["Cow", "Bull", "Calf", "Other"],
  },
  {
    id: "goat_sheep",
    name: "Goat & Sheep",
    icon: "🐐",
    types: ["Goat", "Sheep", "Other"],
  },
  {
    id: "poultry",
    name: "Poultry",
    icon: "🐔",
    types: ["Chicken", "Duck", "Other"],
  },
  {
    id: "fish",
    name: "Fish Farming",
    icon: "🐟",
    types: ["Tilapia", "Rui", "Catla", "Mrigal", "Pangasius", "Other"],
  },
  {
    id: "pet",
    name: "Pet Animals",
    icon: "🐕",
    types: ["Dog", "Cat", "Bird", "Other"],
  },
  {
    id: "beekeeping",
    name: "Beekeeping",
    icon: "🐝",
    types: ["Honey Bee", "Hive", "Other"],
  },
];

type AIAnalysis = {
  possibleProblem: string;
  likelyCauses: string;
  recommendedNextSteps: string;
  warningSigns: string;
};

export default function ReportProblemScreen() {
  const [category, setCategory] = useState("");
  const [problemType, setProblemType] = useState("");

  const [problemTitle, setProblemTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );

  const [locationLoading, setLocationLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [showTypeOptions, setShowTypeOptions] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);

  const selectedCategory = categoryOptions.find((item) => item.id === category);

  /*
   * Pick a problem image.
   */
  async function handleImagePick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setSubmitted(false);
      setErrorMessage("");
      setAiAnalysis(null);
    }
  }

  /*
   * Get current location.
   */
  async function handleGetLocation() {
    setLocationLoading(true);
    setSubmitted(false);
    setErrorMessage("");

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      alert("Permission to access location was denied");
      setLocationLoading(false);
      return;
    }

    try {
      const currentLocation = await Location.getCurrentPositionAsync({});

      setLocation(currentLocation);
    } catch (error) {
      alert("Could not fetch location. Make sure GPS is enabled.");
    } finally {
      setLocationLoading(false);
    }
  }

  /*
   * Convert the selected image into Base64.
   *
   * This allows the image to be sent to the
   * AgroNova AI backend without using Firebase Storage.
   */
  async function convertImageToBase64(uri: string) {
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise<{
      base64: string;
      mimeType: string;
    }>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = reader.result;

        if (typeof result !== "string") {
          reject(new Error("Could not read image."));
          return;
        }

        const commaIndex = result.indexOf(",");

        if (commaIndex === -1) {
          reject(new Error("Invalid image data."));
          return;
        }

        resolve({
          base64: result.substring(commaIndex + 1),
          mimeType: blob.type || "image/jpeg",
        });
      };

      reader.onerror = () => {
        reject(new Error("Could not convert image."));
      };

      reader.readAsDataURL(blob);
    });
  }

  /*
   * Analyze the agricultural problem with Gemini AI.
   *
   * Both text information and the selected image
   * are sent to the backend.
   */
  async function handleAnalyzeAI() {
    setErrorMessage("");
    setAiAnalysis(null);

    if (
      category.trim() === "" ||
      problemType.trim() === "" ||
      problemTitle.trim() === "" ||
      description.trim() === ""
    ) {
      setErrorMessage("Please fill in all required fields before AI analysis.");
      return;
    }

    try {
      setAiAnalyzing(true);

      let imageBase64 = "";
      let imageMimeType = "";

      /*
       * If an image exists, convert it to Base64.
       */
      if (imageUri) {
        const imageData = await convertImageToBase64(imageUri);

        imageBase64 = imageData.base64;
        imageMimeType = imageData.mimeType;

        console.log("IMAGE ATTACHED TO AI ANALYSIS");

        console.log("IMAGE MIME TYPE:", imageMimeType);

        console.log("IMAGE BASE64 LENGTH:", imageBase64.length);
      }

      const response = await fetch("http://localhost:3000/api/ai/analyze", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          category: category.trim(),
          type: problemType.trim(),
          title: problemTitle.trim(),
          description: description.trim(),

          imageBase64: imageBase64 || null,
          imageMimeType: imageMimeType || null,
        }),
      });

      const data = await response.json();

      console.log("AI RESPONSE:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI analysis failed.");
      }

      if (
        !data.analysis ||
        typeof data.analysis !== "object" ||
        typeof data.analysis.possibleProblem !== "string" ||
        typeof data.analysis.likelyCauses !== "string" ||
        typeof data.analysis.recommendedNextSteps !== "string" ||
        typeof data.analysis.warningSigns !== "string"
      ) {
        throw new Error("AI returned an invalid analysis format.");
      }

      setAiAnalysis({
        possibleProblem: data.analysis.possibleProblem,

        likelyCauses: data.analysis.likelyCauses,

        recommendedNextSteps: data.analysis.recommendedNextSteps,

        warningSigns: data.analysis.warningSigns,
      });
    } catch (error: any) {
      console.log("AI ANALYSIS ERROR:", error);

      setErrorMessage(
        error.message || "Could not connect to AgroNova AI server.",
      );
    } finally {
      setAiAnalyzing(false);
    }
  }

  /*
   * Submit the problem to Firestore.
   */
  async function handleSubmit() {
    setSubmitted(false);
    setErrorMessage("");

    const user = auth.currentUser;

    if (!user) {
      setErrorMessage("You must be logged in to submit a problem.");
      return;
    }

    if (
      category.trim() === "" ||
      problemType.trim() === "" ||
      problemTitle.trim() === "" ||
      description.trim() === ""
    ) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);

      /*
       * Load current user's Firestore profile.
       */
      const userRef = doc(db, "users", user.uid);

      const userSnapshot = await getDoc(userRef);

      let username = "";
      let fullName = "";

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();

        /*
         * Correct field:
         * name, NOT fullName.
         */
        if (typeof userData.name === "string" && userData.name.trim() !== "") {
          fullName = userData.name.trim();
        }

        if (
          typeof userData.username === "string" &&
          userData.username.trim() !== ""
        ) {
          username = userData.username.trim();
        }
      }

      /*
       * Human-readable reporter name.
       */
      const reporterName = username || fullName || user.email || "User";

      /*
       * Create problem document.
       */
      const problemRef = await addDoc(collection(db, "problems"), {
        // Problem information
        category: category.trim(),

        type: problemType.trim(),

        cropName: category === "crop" ? problemType.trim() : "",

        title: problemTitle.trim(),

        description: description.trim(),

        // AI analysis
        aiAnalysis: aiAnalysis
          ? {
              possibleProblem: aiAnalysis.possibleProblem,

              likelyCauses: aiAnalysis.likelyCauses,

              recommendedNextSteps: aiAnalysis.recommendedNextSteps,

              warningSigns: aiAnalysis.warningSigns,
            }
          : null,

        /*
         * Firebase Auth UID.
         */
        userId: user.uid,

        /*
         * Human-readable reporter information.
         */
        username: reporterName,

        submittedBy: fullName || reporterName,

        reporterName: fullName || reporterName,

        // Media
        imageUri: imageUri || null,

        // Location
        location: location
          ? {
              latitude: location.coords.latitude,

              longitude: location.coords.longitude,
            }
          : null,

        // Time
        createdAt: serverTimestamp(),
      });

      console.log("PROBLEM CREATED:", problemRef.id);

      console.log("REPORTER UID:", user.uid);

      console.log("REPORTER NAME:", reporterName);

      setSubmitted(true);

      /*
       * Clear form after successful submission.
       */
      setCategory("");
      setProblemType("");
      setProblemTitle("");
      setDescription("");
      setImageUri(null);
      setLocation(null);
      setAiAnalysis(null);
      setErrorMessage("");
    } catch (error: any) {
      console.log("REPORT PROBLEM ERROR:", error);

      setErrorMessage(
        error.message || "Failed to submit agricultural problem.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.title}>
            Report a Problem
          </ThemedText>

          <ThemedText style={styles.description}>
            Describe your agricultural problem so that agricultural experts and
            AI can help you.
          </ThemedText>

          {/* CATEGORY */}

          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Agriculture Category *</ThemedText>

            <Pressable
              style={styles.dropdown}
              onPress={() => {
                setShowCategoryOptions(!showCategoryOptions);

                setShowTypeOptions(false);
                setSubmitted(false);
              }}
            >
              <Text
                style={category ? styles.dropdownText : styles.placeholderText}
              >
                {selectedCategory
                  ? `${selectedCategory.icon} ${selectedCategory.name}`
                  : "Select a category"}
              </Text>

              <Text style={styles.arrow}>
                {showCategoryOptions ? "▲" : "▼"}
              </Text>
            </Pressable>

            {showCategoryOptions && (
              <View style={styles.optionsContainer}>
                {categoryOptions.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.option}
                    onPress={() => {
                      setCategory(item.id);

                      setProblemType("");

                      setShowCategoryOptions(false);

                      setShowTypeOptions(false);

                      setSubmitted(false);
                      setAiAnalysis(null);
                    }}
                  >
                    <Text style={styles.optionText}>
                      {item.icon} {item.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* TYPE */}

          {selectedCategory && (
            <View style={styles.fieldContainer}>
              <ThemedText style={styles.label}>
                {selectedCategory.name} Type *
              </ThemedText>

              <Pressable
                style={styles.dropdown}
                onPress={() => {
                  setShowTypeOptions(!showTypeOptions);

                  setShowCategoryOptions(false);

                  setSubmitted(false);
                }}
              >
                <Text
                  style={
                    problemType ? styles.dropdownText : styles.placeholderText
                  }
                >
                  {problemType ||
                    `Select ${selectedCategory.name.toLowerCase()} type`}
                </Text>

                <Text style={styles.arrow}>{showTypeOptions ? "▲" : "▼"}</Text>
              </Pressable>

              {showTypeOptions && (
                <View style={styles.optionsContainer}>
                  {selectedCategory.types.map((type) => (
                    <Pressable
                      key={type}
                      style={styles.option}
                      onPress={() => {
                        setProblemType(type);

                        setShowTypeOptions(false);

                        setSubmitted(false);
                        setAiAnalysis(null);
                      }}
                    >
                      <Text style={styles.optionText}>{type}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TITLE */}

          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Problem Title *</ThemedText>

            <TextInput
              value={problemTitle}
              onChangeText={(text) => {
                setProblemTitle(text);
                setSubmitted(false);
                setAiAnalysis(null);
              }}
              placeholder={
                category === "crop"
                  ? "Example: Rice leaves are turning yellow"
                  : "Example: Animal is not eating properly"
              }
              style={styles.input}
              placeholderTextColor="#888888"
            />
          </View>

          {/* DESCRIPTION */}

          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Problem Description *</ThemedText>

            <TextInput
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setSubmitted(false);
                setAiAnalysis(null);
              }}
              placeholder="Describe the problem in detail..."
              style={[styles.input, styles.textArea]}
              placeholderTextColor="#888888"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* IMAGE */}

          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Problem Image</ThemedText>

            <Pressable style={styles.uploadButton} onPress={handleImagePick}>
              <ThemedText style={styles.uploadButtonText}>
                📷 {imageUri ? "Change Image" : "Add Problem Image"}
              </ThemedText>
            </Pressable>

            {imageUri && (
              <View style={styles.imageContainer}>
                <Image
                  source={{
                    uri: imageUri,
                  }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />

                <Pressable
                  style={styles.removeImageButton}
                  onPress={() => {
                    setImageUri(null);
                    setSubmitted(false);
                    setAiAnalysis(null);
                  }}
                >
                  <Text style={styles.removeImageText}>Remove Image</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* LOCATION */}

          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Location</ThemedText>

            <Pressable
              style={styles.locationButton}
              onPress={handleGetLocation}
            >
              <ThemedText style={styles.locationButtonText}>
                📍{" "}
                {locationLoading
                  ? "Fetching Location..."
                  : location
                    ? "Location Added ✓"
                    : "Add Location"}
              </ThemedText>
            </Pressable>

            {location && (
              <>
                <ThemedText style={styles.locationCoordsText}>
                  Lat: {location.coords.latitude.toFixed(4)}, Lon:{" "}
                  {location.coords.longitude.toFixed(4)}
                </ThemedText>

                <GoogleMap
                  latitude={location.coords.latitude}
                  longitude={location.coords.longitude}
                />
              </>
            )}
          </View>

          {/* ERROR */}

          {errorMessage !== "" && (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          )}

          {/* AI BUTTON */}

          <Pressable
            style={[styles.aiButton, aiAnalyzing && styles.disabledButton]}
            onPress={handleAnalyzeAI}
            disabled={aiAnalyzing}
          >
            <ThemedText style={styles.aiButtonText}>
              {aiAnalyzing
                ? "Analyzing with AI..."
                : imageUri
                  ? "🤖 Analyze Text + Image with AI"
                  : "🤖 Analyze with AI"}
            </ThemedText>
          </Pressable>

          {/* AI RESULT */}

          {aiAnalysis && (
            <View style={styles.aiResultBox}>
              <ThemedText style={styles.aiResultTitle}>
                🤖 AgroNova AI Analysis
              </ThemedText>

              <View style={styles.aiSection}>
                <ThemedText style={styles.aiSectionTitle}>
                  1. Possible Problem or Disease
                </ThemedText>

                <ThemedText style={styles.aiResultText}>
                  {aiAnalysis.possibleProblem}
                </ThemedText>
              </View>

              <View style={styles.aiSection}>
                <ThemedText style={styles.aiSectionTitle}>
                  2. Likely Causes
                </ThemedText>

                <ThemedText style={styles.aiResultText}>
                  {aiAnalysis.likelyCauses}
                </ThemedText>
              </View>

              <View style={styles.aiSection}>
                <ThemedText style={styles.aiSectionTitle}>
                  3. Recommended Next Steps
                </ThemedText>

                <ThemedText style={styles.aiResultText}>
                  {aiAnalysis.recommendedNextSteps}
                </ThemedText>
              </View>

              <View style={styles.aiSection}>
                <ThemedText style={styles.aiSectionTitle}>
                  4. Warning Signs
                </ThemedText>

                <ThemedText style={styles.aiResultText}>
                  {aiAnalysis.warningSigns}
                </ThemedText>
              </View>

              <ThemedText style={styles.aiDisclaimer}>
                AI analysis is for support and guidance only. It does not
                replace professional agricultural diagnosis.
              </ThemedText>
            </View>
          )}

          {/* SUBMIT */}

          <Pressable
            style={[styles.submitButton, saving && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={saving}
          >
            <ThemedText style={styles.submitButtonText}>
              {saving ? "Submitting..." : "Submit Problem"}
            </ThemedText>
          </Pressable>

          {/* SUCCESS */}

          {submitted && (
            <View style={styles.successBox}>
              <ThemedText style={styles.successTitle}>
                ✓ Report Submitted
              </ThemedText>

              <ThemedText style={styles.successText}>
                Your agricultural problem has been recorded successfully.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
  },

  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },

  title: {
    textAlign: "center",
    marginBottom: 4,
  },

  description: {
    textAlign: "center",
    marginBottom: 12,
  },

  fieldContainer: {
    gap: 8,
  },

  label: {
    fontSize: 16,
    fontWeight: "600",
  },

  dropdown: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },

  dropdownText: {
    color: "#222222",
    fontSize: 16,
  },

  placeholderText: {
    color: "#888888",
    fontSize: 16,
  },

  arrow: {
    color: "#222222",
    fontSize: 12,
  },

  optionsContainer: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },

  option: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  optionText: {
    color: "#222222",
    fontSize: 16,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
    color: "#222222",
  },

  textArea: {
    minHeight: 130,
    paddingTop: 12,
  },

  uploadButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2E7D32",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
  },

  uploadButtonText: {
    color: "#2E7D32",
    fontWeight: "600",
  },

  imageContainer: {
    gap: 10,
  },

  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 10,
  },

  removeImageButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#EEEEEE",
  },

  removeImageText: {
    color: "#333333",
    fontWeight: "600",
  },

  locationButton: {
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
  },

  locationButtonText: {
    fontWeight: "600",
  },

  locationCoordsText: {
    fontSize: 14,
    color: "#666666",
    marginTop: 2,
  },

  errorMessage: {
    color: "#D32F2F",
    fontWeight: "600",
    textAlign: "center",
  },

  aiButton: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2E7D32",
  },

  aiButtonText: {
    color: "#2E7D32",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  aiResultBox: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2E7D32",
    backgroundColor: "#F7FFF7",
    gap: 16,
  },

  aiResultTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222222",
  },

  aiSection: {
    gap: 6,
  },

  aiSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E7D32",
  },

  aiResultText: {
    lineHeight: 23,
    color: "#222222",
    fontSize: 15,
    width: "100%",
    flexShrink: 1,
  },

  aiDisclaimer: {
    fontSize: 13,
    lineHeight: 19,
    color: "#666666",
  },

  submitButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#2E7D32",
  },

  disabledButton: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  successBox: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2E7D32",
    gap: 6,
  },

  successTitle: {
    fontSize: 17,
    fontWeight: "700",
  },

  successText: {
    lineHeight: 22,
  },
});
