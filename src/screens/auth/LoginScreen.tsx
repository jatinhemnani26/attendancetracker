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
      {/* ─── Premium Ambient Background ─── */}
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
          {/* ─── Animated Header ─── */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY }] }]}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[accent.primary, accent.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Ionicons name="finger-print" size={32} color={text.primary} />
              </LinearGradient>
            </View>
            <Text style={styles.title}>Attendance</Text>
            <Text style={styles.subtitle}>
              Log in to manage your academic journey
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

          {/* ─── Web APK Download Link ─── */}
          {Platform.OS === 'web' && (
            <View style={styles.webDownloadSection}>
              <View style={styles.webDivider}>
                <View style={styles.webDividerLine} />
                <Text style={styles.webDividerText}>OR MOBILE APP</Text>
                <View style={styles.webDividerLine} />
              </View>
              <TouchableOpacity
                style={styles.webApkButton}
                onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-android" size={18} color="#10B981" />
                <Text style={styles.webApkButtonText}>Download Android App (.APK)</Text>
                <Ionicons name="download-outline" size={15} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    width: Dimensions.get('window').width * 0.8,
    height: Dimensions.get('window').width * 0.8,
    borderRadius: Dimensions.get('window').width,
    opacity: 0.15,
  },
  orb1: {
    top: -100,
    left: -100,
    backgroundColor: accent.primary,
  },
  orb2: {
    bottom: -100,
    right: -100,
    backgroundColor: accent.secondary,
  },

  // ── Header
  header: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  logoContainer: {
    marginBottom: spacing.xl,
    padding: 2,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...shadow.strong,
  },
  logoGradient: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    ...textStyle.pageTitle,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...textStyle.body,
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
    marginBottom: spacing.xl,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: feedback.error,
    textAlign: 'center',
  },

  // ── Glass Card Form
  formCard: {
    backgroundColor: glass.medium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    paddingTop: spacing['3xl'],
    gap: spacing.xl,
    ...shadow.strong,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  // ── Form Fields
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...textStyle.label,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: accent.primary + '60',
  },
  input: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: text.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  forgotLink: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: accent.secondary,
  },

  // ── Button
  buttonWrapper: {
    marginTop: spacing.sm,
    width: '100%',
  },
  signInButton: {
    width: '100%',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...shadow.glow(accent.primary),
  },
  signInButtonText: {
    ...textStyle.button,
    color: text.primary,
  },

  // ── Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  footerText: {
    ...textStyle.body,
  },
  registerLink: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
    color: accent.primary,
  },
  webDownloadSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  webDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  webDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  webDividerText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: text.disabled,
    paddingHorizontal: 12,
  },
  webApkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
  },
  webApkButtonText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: text.primary,
  },
});
