/**
 * Attendance Tracker — Login Screen
 * 
 * Premium dark obsidian login with:
 * - Frosted glass card container
 * - Gradient accent button with glow
 * - Smooth micro-animations on focus/press
 * - Clean typography hierarchy
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { canvas, glass, border, text, accent, feedback, shadow } from '../../theme/colors';
import { textStyle, fontFamily, fontSize } from '../../theme/typography';
import { spacing, radius, layout } from '../../theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { APK_DOWNLOAD_URL } from '../../components/WebDownloadBanner';
import BYODBModal from '../../components/BYODBModal';
import { BYODBService } from '../../services/BYODBService';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
  onLoginSuccess: () => void;
}

export default function LoginScreen({
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onLoginSuccess,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showByodbModal, setShowByodbModal] = useState(false);
  const [isCustomDb, setIsCustomDb] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      BYODBService.getActiveConfig().then((cfg) => setIsCustomDb(cfg.isCustom));
    }
  }, []);

  // Animation values
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const showError = (message: string) => {
    setError(message);
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationRef.current = Animated.sequence([
      Animated.timing(errorOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(4000),
      Animated.timing(errorOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);
    animationRef.current.start(({ finished }) => {
      if (finished) {
        setError(null);
      }
    });
  };

  const handleLogin = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      showError('Please enter your email address.');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      showError('Please enter a valid email address (e.g., name@example.com).');
      return;
    }
    if (!password.trim()) {
      showError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      console.error("Login error details:", err);
      showError(err?.message || 'Unable to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* ─── Top Floating Header for Web ─── */}
      {Platform.OS === 'web' && (
        <View style={styles.webTopBar}>
          <View style={styles.webBrandRow}>
            <View style={styles.webBrandDot} />
            <Text style={styles.webBrandTitle}>Attendance Tracker</Text>
          </View>
          <View style={styles.webTopActions}>
            <TouchableOpacity
              style={styles.webPillBtn}
              onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-android" size={13} color="#10B981" />
              <Text style={styles.webPillText}>Download APK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.webPillBtn, isCustomDb && styles.webPillBtnActive]}
              onPress={() => setShowByodbModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="server-outline" size={12} color={isCustomDb ? "#10B981" : "#94A3B8"} />
              <Text style={styles.webPillText}>
                {isCustomDb ? "Custom DB Active" : "Custom DB"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── Subtle Ambient Background ─── */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[canvas.base, canvas.elevated]} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.glowOrb, styles.orb1, { transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) }] }]} />
        <Animated.View style={[styles.glowOrb, styles.orb2, { transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]} />
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, { backdropFilter: 'blur(80px)' } as any]} />
        ) : (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Header ─── */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY }] }]}>
            <View style={styles.logoContainer}>
              <Ionicons name="school-outline" size={24} color={accent.primary} />
            </View>
            <Text style={styles.title}>Attendance Tracker</Text>
            <Text style={styles.subtitle}>
              Sign in to manage your schedule and attendance
            </Text>
          </Animated.View>

          {/* ─── Error Banner ─── */}
          {error && (
            <Animated.View style={[styles.errorBanner, { opacity: errorOpacity }]}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* ─── Animated Form Card ─── */}
          <Animated.View style={[styles.formCard, { opacity: fadeAnim, transform: [{ translateY }] }]}>
            {/* Email Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'email' && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={text.disabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <TouchableOpacity
                  onPress={onNavigateToForgotPassword}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'password' && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={text.disabled}
                  secureTextEntry
                  autoComplete="password"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            {/* Sign In Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                onPress={handleLogin}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
                disabled={isLoading}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={
                    isLoading
                      ? [accent.primary + '80', accent.primaryHover + '80']
                      : [accent.primary, accent.primaryHover]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signInButton}
                >
                  {isLoading ? (
                    <ActivityIndicator color={text.primary} size="small" />
                  ) : (
                    <Text style={styles.signInButtonText}>Sign In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* ─── Register Link ─── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={onNavigateToRegister}>
              <Text style={styles.registerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BYODBModal
        visible={showByodbModal}
        onClose={() => setShowByodbModal(false)}
        onConfigApplied={() => {
          BYODBService.getActiveConfig().then((cfg) => setIsCustomDb(cfg.isCustom));
        }}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: canvas.base,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing['4xl'],
  },

  // ── Ambient Background
  glowOrb: {
    position: 'absolute',
    width: Dimensions.get('window').width * 0.4,
    height: Dimensions.get('window').width * 0.4,
    borderRadius: Dimensions.get('window').width,
    opacity: 0.04,
  },
  orb1: {
    top: -80,
    left: -80,
    backgroundColor: accent.primary,
  },
  orb2: {
    bottom: -80,
    right: -80,
    backgroundColor: accent.secondary,
  },

  // ── Top Navigation Bar (Web)
  webTopBar: {
    position: 'absolute',
    top: 20,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 9999,
  },
  webBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webBrandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent.primary,
  },
  webBrandTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
    letterSpacing: 0.5,
  },
  webTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  webPillBtnActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  webPillText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontFamily: fontFamily.medium,
  },

  // ── Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.md,
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: '#F8FAFC',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // ── Error Banner
  errorBanner: {
    backgroundColor: feedback.error + '18',
    borderWidth: 1,
    borderColor: feedback.error + '30',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: feedback.error,
    textAlign: 'center',
  },

  // ── Card Form
  formCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },

  // ── Form Fields
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#94A3B8',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputContainer: {
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: accent.primary,
  },
  input: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  forgotLink: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: accent.primary,
  },

  // ── Button
  buttonWrapper: {
    marginTop: 4,
    width: '100%',
  },
  signInButton: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  signInButtonText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: '#94A3B8',
  },
  registerLink: {
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
    color: accent.primary,
  },
});
