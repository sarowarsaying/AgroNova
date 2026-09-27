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

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const cropOptions = [
  "Rice",
  "Wheat",
  "Potato",
  "Tomato",
  "Maize",
  "Jute",
  "Vegetables",
  "Other",
];

export default function ReportProblemScreen() {
  const [cropName, setCropName] = useState<string>("");
  const [problemTitle, setProblemTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [showCropOptions, setShowCropOptions] = useState<boolean>(false);

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
    }
  }

  async function handleGetLocation() {
    setLocationLoading(true);
    setSubmitted(false);

    // 1. Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      alert("Permission to access location was denied");
      setLocationLoading(false);
      return;
    }

    // 2. Get current position
    try {
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    } catch (error) {
      alert("Could not fetch location. Make sure GPS is enabled.");
    } finally {
      setLocationLoading(false);
    }
  }

  function handleSubmit() {
    if (
      cropName.trim() === "" ||
      problemTitle.trim() === "" ||
      description.trim() === ""
    ) {
      setSubmitted(false);
      return;
    }

    setSubmitted(true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.title}>
            Report Crop Problem
          </ThemedText>

          <ThemedText style={styles.description}>
            Describe your crop problem so that agricultural experts and AI can
            help you.
          </ThemedText>

          {/* Crop Name */}
          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Crop Name *</ThemedText>

            <Pressable
              style={styles.dropdown}
              onPress={() => {
                setShowCropOptions(!showCropOptions);
                setSubmitted(false);
              }}
            >
              <Text
                style={cropName ? styles.dropdownText : styles.placeholderText}
              >
                {cropName || "Select a crop"}
              </Text>

              <Text style={styles.arrow}>{showCropOptions ? "▲" : "▼"}</Text>
            </Pressable>

            {showCropOptions && (
              <View style={styles.optionsContainer}>
                {cropOptions.map((crop) => (
                  <Pressable
                    key={crop}
                    style={styles.option}
                    onPress={() => {
                      setCropName(crop);
                      setShowCropOptions(false);
                      setSubmitted(false);
                    }}
                  >
                    <Text style={styles.optionText}>{crop}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Problem Title */}
          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Problem Title *</ThemedText>

            <TextInput
              value={problemTitle}
              onChangeText={(text) => {
                setProblemTitle(text);
                setSubmitted(false);
              }}
              placeholder="Example: Rice leaves are turning yellow"
              style={styles.input}
              placeholderTextColor="#888888"
            />
          </View>

          {/* Problem Description */}
          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Problem Description *</ThemedText>

            <TextInput
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setSubmitted(false);
              }}
              placeholder="Describe the problem in detail..."
              style={[styles.input, styles.textArea]}
              placeholderTextColor="#888888"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Image Upload */}
          <View style={styles.fieldContainer}>
            <ThemedText style={styles.label}>Crop Image</ThemedText>

            <Pressable style={styles.uploadButton} onPress={handleImagePick}>
              <ThemedText style={styles.uploadButtonText}>
                📷 {imageUri ? "Change Crop Image" : "Add Crop Image"}
              </ThemedText>
            </Pressable>

            {imageUri && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />

                <Pressable
                  style={styles.removeImageButton}
                  onPress={() => {
                    setImageUri(null);
                    setSubmitted(false);
                  }}
                >
                  <Text style={styles.removeImageText}>Remove Image</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Location */}
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

          {/* Submit */}
          <Pressable style={styles.submitButton} onPress={handleSubmit}>
            <ThemedText style={styles.submitButtonText}>
              Submit Crop Problem
            </ThemedText>
          </Pressable>

          {/* Success Message */}
          {submitted && (
            <View style={styles.successBox}>
              <ThemedText style={styles.successTitle}>
                ✓ Report Submitted
              </ThemedText>

              <ThemedText style={styles.successText}>
                Your crop problem has been recorded successfully.
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

  submitButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#2E7D32",
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
