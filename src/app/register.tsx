import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/firebase";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [role, setRole] = useState<"farmer" | "agriculturist">("farmer");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");

  const showMessage = (text: string, type: "error" | "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const handleRegister = async () => {
    setMessage("");
    setMessageType("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      showMessage("Please fill in all fields.", "error");
      return;
    }

    if (cleanName.length < 2) {
      showMessage("Please enter a valid name.", "error");
      return;
    }

    if (!cleanEmail.includes("@")) {
      showMessage("Please enter a valid email address.", "error");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.", "error");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        name: cleanName,
        email: user.email,
        role: role,
        createdAt: serverTimestamp(),
      });

      showMessage(
        "Account created successfully! You can now use AgroNova.",
        "success",
      );

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("farmer");
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (error: any) {
      console.log("REGISTRATION ERROR:", error);

      if (error.code === "auth/email-already-in-use") {
        showMessage(
          "This email is already registered. Please login instead.",
          "error",
        );
      } else if (error.code === "auth/invalid-email") {
        showMessage("Please enter a valid email address.", "error");
      } else if (error.code === "auth/weak-password") {
        showMessage(
          "Password is too weak. Use at least 6 characters.",
          "error",
        );
      } else if (error.code === "permission-denied") {
        showMessage(
          "Permission denied. Please check Firestore Rules.",
          "error",
        );
      } else if (error.code === "auth/network-request-failed") {
        showMessage(
          "Network error. Please check your internet connection.",
          "error",
        );
      } else {
        showMessage(
          error.message || "Something went wrong. Please try again.",
          "error",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <Text style={styles.subtitle}>
        Join AgroNova and connect with the agricultural community.
      </Text>

      {message !== "" && (
        <Text
          style={[
            styles.message,
            messageType === "error"
              ? styles.errorMessage
              : styles.successMessage,
          ]}
        >
          {message}
        </Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor="#777777"
        value={name}
        onChangeText={setName}
        editable={!loading}
      />

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

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Confirm Password"
          placeholderTextColor="#777777"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
          editable={!loading}
        />

        <TouchableOpacity
          style={styles.showButton}
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          disabled={loading}
        >
          <Text style={styles.showButtonText}>
            {showConfirmPassword ? "Hide" : "Show"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.roleTitle}>I am a:</Text>

      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === "farmer" && styles.selectedRole]}
          onPress={() => setRole("farmer")}
          disabled={loading}
        >
          <Text
            style={[
              styles.roleText,
              role === "farmer" && styles.selectedRoleText,
            ]}
          >
            Farmer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleButton,
            role === "agriculturist" && styles.selectedRole,
          ]}
          onPress={() => setRole("agriculturist")}
          disabled={loading}
        >
          <Text
            style={[
              styles.roleText,
              role === "agriculturist" && styles.selectedRoleText,
            ]}
          >
            Agriculturist
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.disabledButton]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating Account..." : "Create Account"}
        </Text>
      </TouchableOpacity>

      <View style={styles.loginRow}>
        <Text style={styles.loginText}>Already have an account?</Text>

        <TouchableOpacity
          onPress={() => router.push("/login")}
          disabled={loading}
        >
          <Text style={styles.loginLink}> Login</Text>
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
    marginBottom: 22,
  },

  message: {
    textAlign: "center",
    marginBottom: 15,
    fontSize: 15,
    fontWeight: "600",
  },

  errorMessage: {
    color: "#d32f2f",
  },

  successMessage: {
    color: "#2e7d32",
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
    marginBottom: 15,
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

  roleTitle: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 10,
  },

  roleContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },

  selectedRole: {
    backgroundColor: "#2e7d32",
    borderColor: "#2e7d32",
  },

  roleText: {
    color: "#111111",
    fontSize: 16,
  },

  selectedRoleText: {
    color: "#ffffff",
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

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },

  loginText: {
    color: "#666666",
    fontSize: 15,
  },

  loginLink: {
    color: "#2e7d32",
    fontSize: 15,
    fontWeight: "bold",
  },
});
