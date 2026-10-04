import { Slot, router } from "expo-router";
import { signOut } from "firebase/auth";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { auth } from "@/firebase";

export default function TabsLayout() {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.log("LOGOUT ERROR:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View style={styles.navbar}>
        <Pressable style={styles.navItem} onPress={() => router.replace("/")}>
          <Text style={styles.icon}>⌂</Text>
          <Text style={styles.label}>Home</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/problem")}
        >
          <Text style={styles.icon}>📋</Text>
          <Text style={styles.label}>Problems</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/report-problem")}
        >
          <Text style={styles.icon}>＋</Text>
          <Text style={styles.label}>Report</Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/profile")}
        >
          <Text style={styles.icon}>◯</Text>
          <Text style={styles.label}>Profile</Text>
        </Pressable>

        <Pressable style={styles.navItem} onPress={handleLogout}>
          <Text style={styles.icon}>↪</Text>
          <Text style={styles.label}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  content: {
    flex: 1,
  },

  navbar: {
    height: 70,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 10,
  },

  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    fontSize: 22,
    color: "#2e7d32",
    marginBottom: 3,
  },

  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333333",
  },
});
