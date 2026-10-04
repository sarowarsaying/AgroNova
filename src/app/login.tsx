import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "@/firebase";

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{
    redirect?: string;
  }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async () => {
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(auth, cleanEmail, password);

      if (redirect === "/profile") {
        router.replace("/profile");
      } else {
        router.replace("/");
      }
    } catch (error: any) {
      console.log("LOGIN ERROR:", error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        setErrorMessage("Invalid email or password.");
      } else if (error.code === "auth/invalid-email") {
        setErrorMessage("Please enter a valid email address.");
      } else if (error.code === "auth/too-many-requests") {
        setErrorMessage("Too many failed attempts. Please try again later.");
      } else if (error.code === "auth/network-request-failed") {
        setErrorMessage(
          "Network error. Please check your internet connection.",
        );
      } else {
        setErrorMessage(
          error.message || "Something went wrong. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login to AgroNova</Text>

      <Text style={styles.subtitle}>
        Welcome back! Please login to continue.
      </Text>

      {errorMessage !== "" && (
        <Text style={styles.errorMessage}>{errorMessage}</Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#777777"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          placeholderTextColor="#777777"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!loading}
        />

        <TouchableOpacity
          style={styles.showButton}
          onPress={() => setShowPassword(!showPassword)}
          disabled={loading}
        >
          <Text style={styles.showButtonText}>
            {showPassword ? "Hide" : "Show"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "Login"}
        </Text>
      </TouchableOpacity>

      <View style={styles.registerRow}>
        <Text style={styles.registerText}>Don't have an account?</Text>

        <TouchableOpacity
          onPress={() => router.push("/register")}
          disabled={loading}
        >
          <Text style={styles.registerLink}> Create Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    padding: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111111",
    marginBottom: 8,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 15,
    color: "#666666",
    textAlign: "center",
    marginBottom: 24,
  },

  errorMessage: {
    color: "#d32f2f",
    textAlign: "center",
    marginBottom: 15,
    fontSize: 15,
    fontWeight: "600",
  },

  input: {
    backgroundColor: "#ffffff",
    color: "#111111",
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: "#ffffff",
  },

  passwordInput: {
    flex: 1,
    color: "#111111",
    padding: 12,
    fontSize: 16,
  },

  showButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  showButtonText: {
    color: "#2e7d32",
    fontWeight: "bold",
  },

  button: {
    backgroundColor: "#2e7d32",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },

  registerText: {
    color: "#666666",
    fontSize: 15,
  },

  registerLink: {
    color: "#2e7d32",
    fontSize: 15,
    fontWeight: "bold",
  },
});
