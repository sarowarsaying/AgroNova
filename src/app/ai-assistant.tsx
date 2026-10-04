import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  text: "Hello! I’m AgroNova AI Assistant 🌾\n\nAsk me about crop problems, plant symptoms, diseases, cultivation, soil, or general agricultural questions.",
};

export default function AIAssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    const message = input.trim();

    if (!message || loading) {
      return;
    }

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      text: message,
    };

    const messagesBeforeUserMessage = messages.filter(
      (item) => item.id !== "welcome",
    );

    const history = messagesBeforeUserMessage.map((item) => ({
      role: item.role,
      text: item.text,
    }));

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI assistant failed to respond.");
      }

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: data.response,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      console.error("AI ASSISTANT ERROR:", error);

      const errorMessage: Message = {
        id: `${Date.now()}-error`,
        role: "assistant",
        text: "Sorry, I could not connect to AgroNova AI. Please make sure the AI server is running.",
      };

      setMessages((current) => [...current, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    setInput("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* HEADER */}

        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </Pressable>

          <View style={styles.headerTextBox}>
            <Text style={styles.headerTitle}>AI Agricultural Assistant</Text>

            <Text style={styles.headerSubtitle}>AgroNova AI Support</Text>
          </View>

          <Pressable style={styles.clearButton} onPress={clearChat}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>

        {/* CHAT AREA */}

        <View style={styles.chatArea}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => {
              const isUser = item.role === "user";

              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.userRow : styles.assistantRow,
                  ]}
                >
                  {!isUser && (
                    <View style={styles.aiAvatar}>
                      <Text style={styles.aiAvatarText}>🤖</Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isUser
                          ? styles.userMessageText
                          : styles.assistantMessageText,
                      ]}
                    >
                      {item.text}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />

              <Text style={styles.loadingText}>AgroNova AI is thinking...</Text>
            </View>
          )}
        </View>

        {/* INPUT */}

        <View style={styles.inputContainer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask an agricultural question..."
            placeholderTextColor="#777777"
            multiline
            maxLength={1000}
            editable={!loading}
            style={styles.input}
          />

          <Pressable
            onPress={sendMessage}
            disabled={!input.trim() || loading}
            style={[
              styles.sendButton,
              (!input.trim() || loading) && styles.disabledSendButton,
            ]}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          AI provides general agricultural guidance. Consult a qualified
          agriculturist for serious problems.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#ffffff",
  },

  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  backText: {
    fontSize: 28,
    color: "#222222",
  },

  headerTextBox: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222222",
  },

  headerSubtitle: {
    fontSize: 12,
    color: "#777777",
    marginTop: 2,
  },

  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  clearText: {
    color: "#2e7d32",
    fontSize: 14,
    fontWeight: "700",
  },

  chatArea: {
    flex: 1,
    backgroundColor: "#f8faf8",
  },

  messageList: {
    padding: 16,
    paddingBottom: 20,
    gap: 12,
  },

  messageRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
  },

  userRow: {
    justifyContent: "flex-end",
  },

  assistantRow: {
    justifyContent: "flex-start",
  },

  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },

  aiAvatarText: {
    fontSize: 17,
  },

  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
  },

  userBubble: {
    backgroundColor: "#2e7d32",
    borderBottomRightRadius: 4,
  },

  assistantBubble: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e5d9",
    borderBottomLeftRadius: 4,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },

  userMessageText: {
    color: "#ffffff",
  },

  assistantMessageText: {
    color: "#222222",
  },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 8,
  },

  loadingText: {
    fontSize: 13,
    color: "#666666",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#ffffff",
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#222222",
    backgroundColor: "#ffffff",
  },

  sendButton: {
    minHeight: 48,
    paddingHorizontal: 17,
    borderRadius: 14,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    justifyContent: "center",
  },

  disabledSendButton: {
    backgroundColor: "#a5c8a7",
  },

  sendButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  disclaimer: {
    fontSize: 10,
    lineHeight: 14,
    color: "#888888",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 7,
    backgroundColor: "#ffffff",
  },
});
