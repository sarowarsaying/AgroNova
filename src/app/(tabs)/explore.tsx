import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function ExploreScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Explore</ThemedText>

      <ThemedText style={styles.description}>
        Explore agricultural information, crop problems, resources, and nearby
        agricultural services.
      </ThemedText>

      <Pressable
        onPress={() => router.push("/ai-assistant")}
        style={styles.aiCard}
      >
        <ThemedText type="subtitle">🤖 AI Agricultural Assistant</ThemedText>

        <ThemedText>
          Ask questions about crop problems, diseases, cultivation, soil, and
          other agricultural topics.
        </ThemedText>

        <ThemedText style={styles.openText}>Open AI Assistant →</ThemedText>
      </Pressable>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">🌾 Crop Information</ThemedText>

        <ThemedText>
          Learn about different crops and their basic information.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">🦠 Crop Problems</ThemedText>

        <ThemedText>
          Explore common crop diseases and agricultural problems.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">📚 Agricultural Resources</ThemedText>

        <ThemedText>
          Find useful agricultural learning materials and resources.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">📍 Nearby Services</ThemedText>

        <ThemedText>
          Find nearby agricultural service centers and support.
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },

  description: {
    marginBottom: 8,
  },

  aiCard: {
    padding: 18,
    borderRadius: 12,
    gap: 8,
  },

  openText: {
    marginTop: 4,
    fontWeight: "700",
  },

  card: {
    padding: 18,
    borderRadius: 12,
    gap: 8,
  },
});
