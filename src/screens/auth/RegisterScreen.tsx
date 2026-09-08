/**
 * Attendance Tracker — Registration Screen
 * 
 * New account creation with:
 * - Name, Email, Password, Confirm Password fields
 * - Real-time password match validation
 * - Gradient accent button with glow
 * - PRD 3.5 compliant: optional name, required email + password
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
  Image,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { canvas, glass, border, text, accent, feedback, shadow } from '../../theme/colors';
import { textStyle, fontFamily, fontSize } from '../../theme/typography';
import { spacing, radius, layout } from '../../theme/spacing';
import { supabase } from '../../lib/supabase';
import { DatabaseService } from '../../services/DatabaseService';
import BYODBModal from '../../components/BYODBModal';
import { BYODBService } from '../../services/BYODBService';
import { GuestModeService } from '../../services/GuestModeService';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
  onLaunchGuestMode?: () => void;
}

export default function RegisterScreen({
  onNavigateToLogin,
  onRegisterSuccess,
  onLaunchGuestMode,
}: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isCustomDb, setIsCustomDb] = useState(false);
  const [showByodbModal, setShowByodbModal] = useState(false);

  useEffect(() => {
    BYODBService.getActiveConfig().then((cfg) => setIsCustomDb(cfg.isCustom));
  }, []);

  const handleLaunchGuestMode = () => {
    GuestModeService.enable();
    if (onLaunchGuestMode) {
      onLaunchGuestMode();
    } else {
      onRegisterSuccess();
    }
  };

  // Animation values
  const buttonScale = useRef(new Animated.Value(1)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

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

  const showMessage = (msg: string, type: 'error' | 'success' = 'error') => {
    setMessage(msg);
    setMessageType(type);
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationRef.current = Animated.sequence([
      Animated.timing(messageOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(type === 'success' ? 7000 : 4000),
      Animated.timing(messageOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);
    animationRef.current.start(({ finished }) => {
      if (finished) {
        setMessage(null);
      }
    });
  };

  const handleRegister = async () => {
    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      showMessage('Please enter your email address.', 'error');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      showMessage('Please enter a valid email address (e.g., name@example.com).', 'error');
      return;
    }
    if (!password.trim()) {
      showMessage('Please create a password.', 'error');
      return;
    }
    if (password.length < 8) {
      showMessage('Password must be at least 8 characters.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showMessage('Passwords do not match.', 'error');
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (authError) throw authError;

      if (data.session) {
        // Email confirmation is disabled, user is immediately logged in
        await DatabaseService.initializeNewUser();
        if (onRegisterSuccess) onRegisterSuccess();
      } else {
        // Email confirmation is enabled, user needs to verify first
        showMessage(
          'Verification email sent! Please check your inbox and verify your email, then return here to sign in.',
          'success'
        );
        setTimeout(() => {
          onNavigateToLogin();
        }, 7000);
      }
    } catch (err: any) {
      console.error("Signup error details:", err);
      showMessage(err?.message || 'Unable to create account. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  // ─── If Public User on Default DB: Restrict Registration ───
  if (!isCustomDb) {
    return (
      <View style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.restrictedCard}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../../assets/icon.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>

              <View style={styles.capacityBadge}>
                <Ionicons name="shield-outline" size={12} color="#94A3B8" />
                <Text style={styles.capacityBadgeText}>PRIVATE BETA • CAPACITY PAUSED</Text>
              </View>

              <Text style={styles.restrictedTitle}>Public Registration Paused</Text>
              <Text style={styles.restrictedSubtitle}>
                Attendance Tracker is currently in private testing for enrolled campus cohorts. To guarantee reliable real-time sync and isolated resources for verified testers, direct sign-ups on our shared community cluster are paused.
              </Text>

              {/* Option 1: Guest Mode */}
              <View style={styles.optionBox}>
                <View style={styles.optionHeader}>
                  <View style={[styles.optionIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                    <Ionicons name="sparkles" size={17} color="#818CF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Explore in Guest Mode</Text>
                    <Text style={styles.optionDesc}>
                      Test the complete app with realistic demo schedules, attendance calculations, safe bunk simulators, and interactive campus map. Stored strictly in your browser session and automatically cleared when you close the tab.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.guestActionBtn}
                  onPress={handleLaunchGuestMode}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.guestActionBtnText}>Launch Guest Mode</Text>
                </TouchableOpacity>
              </View>

              {/* Option 2: BYODB */}
              <View style={styles.optionBox}>
                <View style={styles.optionHeader}>
                  <View style={[styles.optionIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Ionicons name="server-outline" size={17} color="#34D399" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Bring Your Own Database (BYODB)</Text>
                    <Text style={styles.optionDesc}>
                      Prefer persistent cloud storage? Connect your own free Supabase project. You get 100% private data isolation, unlimited accounts, and full control over your database.
                    </Text>
                  </View>
                </View>
                <View style={styles.byodbRow}>
                  <TouchableOpacity
                    style={styles.byodbActionBtn}
                    onPress={() => setShowByodbModal(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="key-outline" size={14} color="#E2E8F0" />
                    <Text style={styles.byodbActionBtnText}>Connect Database</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.guideActionBtn}
                    onPress={() => Linking.openURL('https://github.com/jatinhemnani26/attendancetracker#bring-your-own-database-byodb-setup-guide')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="book-outline" size={14} color="#94A3B8" />
                    <Text style={styles.guideActionBtnText}>Setup Guide</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Back to Sign In button */}
              <TouchableOpacity
                style={styles.backToLoginBtn}
                onPress={onNavigateToLogin}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-back" size={15} color="#94A3B8" />
                <Text style={styles.backToLoginText}>Return to Sign In</Text>
              </TouchableOpacity>
              <Text style={styles.footerNoteText}>
                Existing beta testers can sign in directly with their approved credentials.
              </Text>
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

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Header ─── */}
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Start tracking your academic attendance
            </Text>
          </View>

          {/* ─── Status Banner ─── */}
          {message && (
            <Animated.View
              style={[
                styles.messageBanner,
                messageType === 'success' ? styles.successBanner : styles.errorBanner,
                { opacity: messageOpacity }
              ]}
            >
              <Text style={[styles.messageText, messageType === 'success' ? styles.successText : styles.errorText]}>
                {message}
              </Text>
            </Animated.View>
          )}

          {/* ─── Glass Card Form ─── */}
          <View style={styles.formCard}>
            {/* Custom DB Notice */}
            <View style={styles.customDbNotice}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={styles.customDbNoticeText}>
                Connected to Custom Database — Account will be saved directly to your private server.
              </Text>
            </View>

            {/* Name Field (Optional per PRD 3.5) */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>NAME</Text>
                <Text style={styles.optionalBadge}>OPTIONAL</Text>
              </View>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'name' && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={text.disabled}
                  autoCapitalize="words"
                  autoComplete="name"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
              </View>
            </View>

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
              <Text style={styles.fieldLabel}>PASSWORD</Text>
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
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={text.disabled}
                  secureTextEntry
                  autoComplete="new-password"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Confirm Password Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'confirm' && styles.inputFocused,
                  passwordsMatch && styles.inputSuccess,
                  passwordsMismatch && styles.inputError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  placeholderTextColor={text.disabled}
                  secureTextEntry
                  autoComplete="new-password"
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading}
                  onSubmitEditing={handleRegister}
                />
              </View>
              {passwordsMismatch && (
                <Text style={styles.fieldError}>Passwords do not match</Text>
              )}
              {passwordsMatch && (
                <Text style={styles.fieldSuccess}>Passwords match ✓</Text>
              )}
            </View>

            {/* Create Account Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                onPress={handleRegister}
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
                  style={styles.createButton}
                >
                  {isLoading ? (
                    <ActivityIndicator color={text.primary} size="small" />
                  ) : (
                    <Text style={styles.createButtonText}>Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* ─── Login Link ─── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={onNavigateToLogin}>
              <Text style={styles.loginLink}>Sign in</Text>
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

  // ── Header
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
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

  // ── Message Banner
  messageBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  errorBanner: {
    backgroundColor: feedback.error + '18',
    borderColor: feedback.error + '30',
  },
  successBanner: {
    backgroundColor: feedback.success + '18',
    borderColor: feedback.success + '30',
  },
  messageText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  errorText: {
    color: feedback.error,
  },
  successText: {
    color: feedback.success,
  },

  // ── Glass Card Form
  formCard: {
    backgroundColor: glass.medium,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    gap: spacing.lg,
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
  optionalBadge: {
    fontFamily: fontFamily.medium,
    fontSize: 9,
    letterSpacing: 1,
    color: text.tertiary,
    backgroundColor: glass.light,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  inputContainer: {
    backgroundColor: canvas.elevated,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: accent.primary + '60',
  },
  inputSuccess: {
    borderColor: feedback.success + '60',
  },
  inputError: {
    borderColor: feedback.error + '60',
  },
  input: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    color: text.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  fieldError: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: feedback.error,
    marginTop: 2,
  },
  fieldSuccess: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: feedback.success,
    marginTop: 2,
  },

  // ── Button
  buttonWrapper: {
    marginTop: spacing.sm,
    width: '100%',
  },
  createButton: {
    width: '100%',
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...shadow.glow(accent.primary),
  },
  createButtonText: {
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
  loginLink: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
    color: accent.primary,
  },

  // ── Restricted Registration Card
  restrictedCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: spacing['2xl'],
    gap: spacing.lg,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: spacing.xs,
    width: 56,
    height: 56,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: 56,
    height: 56,
    borderRadius: 15,
  },
  capacityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  capacityBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0.6,
  },
  restrictedTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  restrictedSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 20,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 440,
  },
  optionBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.md,
  },
  optionHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  optionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    color: '#F1F5F9',
    marginBottom: 4,
  },
  optionDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: '#94A3B8',
  },
  guestActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  guestActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0.2,
  },
  byodbRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  byodbActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  byodbActionBtnText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontFamily: fontFamily.medium,
  },
  guideActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  guideActionBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: fontFamily.medium,
  },
  backToLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  backToLoginText: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: fontFamily.medium,
  },
  footerNoteText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginTop: -4,
  },
  customDbNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: spacing.xs,
  },
  customDbNoticeText: {
    color: '#10B981',
    fontSize: 12,
    fontFamily: fontFamily.medium,
    flex: 1,
  },
});
