import { useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../firebase";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"farmer" | "agriculturist">("farmer");
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

    if (!name || !email || !password || !confirmPassword) {
      showMessage("Please fill in all fields.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.", "error");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.", "error");
      return;
    }

    try {
      setLoading(true);

      // Create Firebase Authentication account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const user = userCredential.user;

      // Create Firestore user document
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: user.email,
        role: role,
        createdAt: serverTimestamp(),
      });

      showMessage("Account created successfully!", "success");

      // Clear form
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("farmer");
    } catch (error: any) {
      console.log("REGISTRATION ERROR:", error);

      if (error.code === "auth/email-already-in-use") {
        showMessage("This email is already registered.", "error");
      } else if (error.code === "auth/invalid-email") {
        showMessage("Please enter a valid email address.", "error");
      } else if (error.code === "auth/weak-password") {
        showMessage("Password is too weak.", "error");
      } else if (error.code === "permission-denied") {
        showMessage(
          "Permission denied. Please check Firestore Rules.",
          "error",
        );
      } else {
        showMessage(error.message || "Something went wrong.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

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
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#777777"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#777777"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#777777"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <Text style={styles.roleTitle}>I am a:</Text>

      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === "farmer" && styles.selectedRole]}
          onPress={() => setRole("farmer")}
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
    marginBottom: 20,
    textAlign: "center",
  },

  message: {
    textAlign: "center",
    marginBottom: 15,
    fontSize: 16,
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

  roleTitle: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "600",
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
});
