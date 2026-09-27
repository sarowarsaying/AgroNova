import { Link } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="title" style={styles.title}>
            Welcome To AgroNova 🌾
          </ThemedText>

          <ThemedText style={styles.description}>
            AI-powered agricultural support and crop problem assistance system
          </ThemedText>

          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">
              🌱 Need help with your crop?
            </ThemedText>

            <ThemedText>
              Report a crop problem and get support from AI and agricultural
              experts.
            </ThemedText>

            <Link href="/report-problem" asChild>
              <Pressable style={styles.button}>
                <ThemedText style={styles.buttonText}>
                  Report Crop Problem
                </ThemedText>
              </Pressable>
            </Link>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">
              🤖 AI Agricultural Assistant
            </ThemedText>

            <ThemedText>
              Get AI-powered assistance for your agricultural questions.
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },

  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },

  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },

  title: {
    textAlign: "center",
  },

  description: {
    textAlign: "center",
  },

  card: {
    alignSelf: "stretch",
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },

  button: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: "center",
    backgroundColor: "#2E7D32",
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
