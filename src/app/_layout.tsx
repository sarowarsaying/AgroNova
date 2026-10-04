import { Stack, router, usePathname } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

import { auth } from "@/firebase";

export default function RootLayout() {
  const pathname = usePathname();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (checkingAuth) {
      return;
    }

    // If user is NOT logged in, protect private pages.
    if (!user && pathname !== "/login" && pathname !== "/register") {
      router.replace({
        pathname: "/login",
        params: {
          redirect: pathname,
        },
      });

      return;
    }

    // IMPORTANT:
    // Do NOT redirect logged-in users away from /login here.
    // login.tsx will handle the correct destination.
  }, [user, checkingAuth, pathname]);

  if (checkingAuth) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="login"
        options={{
          title: "Login",
        }}
      />

      <Stack.Screen
        name="register"
        options={{
          title: "Create Account",
        }}
      />

      <Stack.Screen
        name="profile"
        options={{
          title: "My Profile",
        }}
      />
      <Stack.Screen
        name="problems"
        options={{
          title: "Crop Problems",
        }}
      />
    </Stack>
  );
}
