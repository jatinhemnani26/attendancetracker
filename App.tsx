
import { useCallback, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  AppState,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { canvas, accent, text as textColors } from "./src/theme/colors";

// Auth Screens
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/auth/ForgotPasswordScreen";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Main App (Post-authentication)
import MainAppShell from "./src/screens/main/MainAppShell";
import LockScreen from "./src/screens/auth/LockScreen";
import { SyncService } from "./src/services/SyncService";
import { supabase } from "./src/lib/supabase";
import { NotificationService } from "./src/services/NotificationService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ErrorBoundary } from "./src/ErrorBoundary";
import WebDownloadBanner from "./src/components/WebDownloadBanner";

// Keep the splash screen visible while we load fonts
SplashScreen.preventAutoHideAsync().catch(() => {});

type AuthScreen = "login" | "register" | "forgotPassword";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    "PlusJakartaSans-Regular": PlusJakartaSans_400Regular,
    "PlusJakartaSans-Medium": PlusJakartaSans_500Medium,
    "PlusJakartaSans-SemiBold": PlusJakartaSans_600SemiBold,
    "PlusJakartaSans-Bold": PlusJakartaSans_700Bold,
    "PlusJakartaSans-ExtraBold": PlusJakartaSans_800ExtraBold,
  });

  // Auth navigation state
  const [currentScreen, setCurrentScreen] = useState<AuthScreen>("login");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [appReady, setAppReady] = useState(false);
  // Web is always unlocked (no mobile fingerprint on web). Mobile starts locked on cold app open if already authenticated.
  const [isUnlocked, setIsUnlocked] = useState<boolean>(Platform.OS === "web");

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  // Hide native splash as soon as fonts are loaded (regardless of auth state)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    let isMounted = true;

    const initApp = async () => {
      try {
        // Timeout fallback: if auth status takes too long, default to unauthenticated
        const timer = setTimeout(() => {
          if (isMounted && isAuthenticated === null) {
            console.warn("Auth check timed out. Defaulting to unauthenticated.");
            setIsAuthenticated(false);
            setAppReady(true);
          }
        }, 4000);

        // Initial session check
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (isMounted) {
            setIsAuthenticated(!!session);
            setAppReady(true);
            
            // Check if biometric lock is disabled — if so, auto-unlock
            if (session && Platform.OS !== 'web') {
              try {
                const bioSetting = await AsyncStorage.getItem("biometricsEnabled");
                if (bioSetting === "false") {
                  setIsUnlocked(true);
                }
              } catch (e) {
                // If we can't read the setting, keep locked as default
              }
            }
          }
        } catch (err) {
          console.warn("Failed to check auth session", err);
          if (isMounted) {
            setIsAuthenticated(false);
            setAppReady(true);
          }
        }

        clearTimeout(timer);
      } catch (e) {
        console.warn("App init error", e);
        if (isMounted) {
          setIsAuthenticated(false);
          setAppReady(true);
        }
      }
    };

    initApp();

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(!!session);
      setAppReady(true);
      if (event === "SIGNED_IN") {
        // Just logged in or registered — auto-unlock directly to Dashboard!
        setIsUnlocked(true);
      } else if (event === "SIGNED_OUT") {
        setIsUnlocked(Platform.OS === "web");
      }
    });

    // Setup Notifications — fully wrapped in try-catch to prevent crash
    (async () => {
      try {
        const granted = await NotificationService.requestPermissions();
        if (granted) {
          await NotificationService.scheduleDailyLogReminder();
        }
      } catch (err) {
        console.warn("Failed to setup notifications", err);
      }
    })();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Handle app state changes for offline sync
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        // App has come to the foreground!
        console.log("App active - flushing sync queue");
        SyncService.flushQueue().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Show sleek dark branded splash screen while fonts load or auth initializes
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.logoBadge, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="calendar-outline" size={40} color={accent.primary} />
        </Animated.View>
        <Text style={styles.loadingTitle}>ATTENDANCE TRACKER</Text>
        <Text style={styles.loadingSubtitle}>SYNCING DATA SYSTEM...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  // Render the appropriate screen
  const renderContent = () => {
    // Authenticated — handle lock screen or main app
    if (isAuthenticated) {
      if (!isUnlocked) {
        return (
          <LockScreen
            onUnlock={() => setIsUnlocked(true)}
            onLogout={() => supabase.auth.signOut()}
          />
        );
      }
      return <MainAppShell />;
    }

    // Not authenticated — show auth screens
    switch (currentScreen) {
      case "login":
        return (
          <LoginScreen
            onNavigateToRegister={() => setCurrentScreen("register")}
            onNavigateToForgotPassword={() =>
              setCurrentScreen("forgotPassword")
            }
            onLoginSuccess={() => setIsAuthenticated(true)}
          />
        );
      case "register":
        return (
          <RegisterScreen
            onNavigateToLogin={() => setCurrentScreen("login")}
            onRegisterSuccess={() => setCurrentScreen("login")}
          />
        );
      case "forgotPassword":
        return (
          <ForgotPasswordScreen
            onNavigateToLogin={() => setCurrentScreen("login")}
          />
        );
      default:
        return null;
    }
  };


    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <BottomSheetModalProvider>
              <View style={styles.container}>
                <WebDownloadBanner />
                {renderContent()}
                <StatusBar style="light" />
              </View>
            </BottomSheetModalProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#060912",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    marginBottom: 8,
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  loadingTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    letterSpacing: 4,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans-Bold",
  },
  loadingSubtitle: {
    color: "rgba(248, 250, 252, 0.4)",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans-Medium",
    marginTop: 4,
  },
  container: {
    flex: 1,
    backgroundColor: canvas.base,
  },
});
