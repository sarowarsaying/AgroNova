import { router } from "expo-router";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { auth, db } from "@/firebase";

type Notification = {
  id: string;
  recipientId: string;
  actorId: string;
  actorUsername?: string;
  type: "comment" | "answer" | "reaction";
  problemId: string;
  problemTitle?: string;
  message: string;
  read?: boolean;
  createdAt?: any;
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setErrorMessage("You must be logged in to view notifications.");
      setLoading(false);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("recipientId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationList: Notification[] = snapshot.docs.map(
          (notificationDoc) => ({
            id: notificationDoc.id,
            ...(notificationDoc.data() as Omit<Notification, "id">),
          }),
        );

        setNotifications(notificationList);
        setLoading(false);
        setErrorMessage("");
      },
      (error) => {
        console.log("NOTIFICATIONS LISTENER ERROR:", error);

        setErrorMessage(error.message || "Failed to load notifications.");

        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  function getNotificationIcon(type: Notification["type"]) {
    switch (type) {
      case "comment":
        return "💬";

      case "answer":
        return "👨‍🌾";

      case "reaction":
        return "👍";

      default:
        return "🔔";
    }
  }

  function getRelativeTime(createdAt: any) {
    if (!createdAt) {
      return "";
    }

    const createdTime =
      typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : 0;

    if (!createdTime) {
      return "";
    }

    const difference = Date.now() - createdTime;

    const seconds = Math.floor(difference / 1000);

    if (seconds < 60) {
      return "Just now";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    return `${days}d ago`;
  }

  async function handleNotificationPress(notification: Notification) {
    try {
      if (!notification.read) {
        await updateDoc(doc(db, "notifications", notification.id), {
          read: true,
        });
      }
    } catch (error) {
      console.log("MARK NOTIFICATION READ ERROR:", error);
    }

    router.push({
      pathname: "/problem-details",
      params: {
        id: notification.problemId,
      },
    });
  }

  async function markAllAsRead() {
    const unreadNotifications = notifications.filter(
      (notification) => !notification.read,
    );

    try {
      await Promise.all(
        unreadNotifications.map((notification) =>
          updateDoc(doc(db, "notifications", notification.id), {
            read: true,
          }),
        ),
      );
    } catch (error) {
      console.log("MARK ALL NOTIFICATIONS ERROR:", error);
    }
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Notifications</Text>

            <Text style={styles.subtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${
                    unreadCount === 1 ? "" : "s"
                  }`
                : "You're all caught up"}
            </Text>
          </View>

          {unreadCount > 0 && (
            <Pressable style={styles.markAllButton} onPress={markAllAsRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        {notifications.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🔔</Text>

            <Text style={styles.emptyTitle}>No notifications yet</Text>

            <Text style={styles.emptyText}>
              Notifications about comments, agriculturist answers, and reactions
              will appear here.
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <Pressable
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.unreadCard,
              ]}
              onPress={() => handleNotificationPress(notification)}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>
                  {getNotificationIcon(notification.type)}
                </Text>
              </View>

              <View style={styles.notificationContent}>
                <Text style={styles.message}>{notification.message}</Text>

                {notification.problemTitle ? (
                  <Text style={styles.problemTitle} numberOfLines={1}>
                    {notification.problemTitle}
                  </Text>
                ) : null}

                <Text style={styles.time}>
                  {getRelativeTime(notification.createdAt)}
                </Text>
              </View>

              {!notification.read && <View style={styles.unreadDot} />}
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9f7",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 10,
    color: "#666666",
  },

  errorText: {
    color: "#d32f2f",
    textAlign: "center",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1b5e20",
  },

  subtitle: {
    marginTop: 5,
    fontSize: 13,
    color: "#777777",
  },

  markAllButton: {
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },

  markAllText: {
    color: "#2e7d32",
    fontSize: 12,
    fontWeight: "700",
  },

  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  unreadCard: {
    borderColor: "#a5d6a7",
    backgroundColor: "#f5fff5",
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e8f5e9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  icon: {
    fontSize: 19,
  },

  notificationContent: {
    flex: 1,
  },

  message: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333333",
    fontWeight: "600",
  },

  problemTitle: {
    fontSize: 12,
    color: "#2e7d32",
    marginTop: 4,
  },

  time: {
    fontSize: 11,
    color: "#999999",
    marginTop: 5,
  },

  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#2e7d32",
    marginLeft: 8,
  },

  emptyBox: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 12,
    padding: 25,
    alignItems: "center",
    marginTop: 10,
  },

  emptyIcon: {
    fontSize: 38,
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333333",
    marginBottom: 7,
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#777777",
    textAlign: "center",
  },
});
