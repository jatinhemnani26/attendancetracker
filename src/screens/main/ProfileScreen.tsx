import { useState, useEffect } from "react";
import { 
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  canvas,
  text as textColors,
  accent,
  glass,
  border,
  shadow,
  palette,
} from "../../theme/colors";
import { fontFamily, fontSize, textStyle } from "../../theme/typography";
import { spacing, radius, layout } from "../../theme/spacing";
import { supabase } from "../../lib/supabase";
import { DatabaseService } from "../../services/DatabaseService";
import { LogbookService, LogEntry } from "../../services/LogbookService";
import {
  RecycleBinService,
  RecycleBinItem,
} from "../../services/RecycleBinService";

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Updates from "expo-updates";

export default function ProfileScreen({ isActive = true }: { isActive?: boolean }) {
  const { height } = useWindowDimensions();
  const [name, setName] = useState("Loading...");
  const [email, setEmail] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);

  // Core Modals
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState("");

  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Feature Modals
  const [adjustSemestersVisible, setAdjustSemestersVisible] = useState(false);
  const [logbookVisible, setLogbookVisible] = useState(false);
  const [recycleBinVisible, setRecycleBinVisible] = useState(false);

  // Data States
  const [semesters, setSemesters] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [recycleItems, setRecycleItems] = useState<RecycleBinItem[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingRecycle, setLoadingRecycle] = useState(false);

  // Editing Semester Sub-state
  const [editingSem, setEditingSem] = useState<any>(null);
  const [editSemName, setEditSemName] = useState("");
  const [editSemStart, setEditSemStart] = useState("");
  const [editSemEnd, setEditSemEnd] = useState("");

  const formatDateInput = (text: string, prevText: string) => {
    if (text.length < prevText.length) return text;
    const cleaned = text.replace(/\D/g, '');
    let year = cleaned.slice(0, 4);
    let month = cleaned.slice(4, 6);
    let day = cleaned.slice(6, 8);

    if (month.length === 2 && parseInt(month, 10) > 12) month = '12';
    if (day.length === 2 && parseInt(day, 10) > 31) day = '31';

    if (cleaned.length >= 7) {
      return `${year}/${month}/${day}`;
    } else if (cleaned.length >= 5) {
      return `${year}/${month}`;
    } else if (cleaned.length === 4 && text.length === 4) {
      return `${year}/`;
    } else if (cleaned.length === 6 && text.length === 7) {
      return `${year}/${month}/`;
    }
    return cleaned;
  };

  const handleEditSemStartChange = (text: string) => setEditSemStart(formatDateInput(text, editSemStart));
  const handleEditSemEndChange = (text: string) => setEditSemEnd(formatDateInput(text, editSemEnd));

  // Recycle Bin Search State
  const [recycleSearch, setRecycleSearch] = useState("");

  const loadPreferences = async () => {
    try {
      const notifs = await AsyncStorage.getItem("notificationsEnabled");
      const bio = await AsyncStorage.getItem("biometricsEnabled");
      if (notifs !== null) setNotificationsEnabled(notifs === "true");
      if (bio !== null) setBiometricsEnabled(bio === "true");
    } catch (e) {
      console.log("Error loading preferences", e);
    }
  };

  const savePreference = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, value ? "true" : "false");
    } catch (e) {
      console.log("Error saving preference", e);
    }
  };

  const fetchUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const userName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";
      setName(userName);
      setEmail(user.email || "");
    } else {
      setName("User");
    }
  };

  useEffect(() => {
    fetchUser();
    loadPreferences();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: newName.trim() },
      });
      if (error) throw error;
      setName(newName.trim());
      setEditNameVisible(false);
      setNewName("");
      await LogbookService.addLog("update", "auth", "Updated profile name");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      Alert.alert("Success", "Password updated successfully");
      setChangePasswordVisible(false);
      setNewPassword("");
      setConfirmPassword("");
      await LogbookService.addLog(
        "update",
        "auth",
        "Updated password settings",
      );
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // --- Real Account Deletion Purge Flow ---
  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm("Are you sure you want to permanently delete your account? This wipes all data from our database. THIS ACTION CANNOT BE UNDONE.");
      if (confirmDelete) {
        DatabaseService.deleteAccountData().then(() => supabase.auth.signOut()).catch((e: any) => {
          window.alert(`Error: ${e.message}`);
          supabase.auth.signOut();
        });
      }
    } else {
      Alert.alert(
        "Delete Account permanently?",
        "Are you sure you want to permanently delete your account? This wipes all attendance records, timetable slots, semesters, and profile data from our database. THIS ACTION CANNOT BE UNDONE.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm Purge",
            style: "destructive",
            onPress: async () => {
              try {
                await DatabaseService.deleteAccountData();
                await supabase.auth.signOut();
              } catch (e: any) {
                Alert.alert("Error during delete", e.message);
                await supabase.auth.signOut();
              }
            },
          },
        ],
      );
    }
  };

  // --- Export CSV Flow ---
  const handleExportCSV = async () => {
    try {
      const activeSem = await DatabaseService.fetchActiveSemester();
      if (!activeSem) {
        Alert.alert("Error", "No active semester to export.");
        return;
      }
      const subjects = await DatabaseService.fetchSubjects(activeSem.id);
      const records = await DatabaseService.fetchAttendanceRecords(
        activeSem.id,
      );

      let csvContent =
        "Subject,Short Name,Attended,Conducted,Percentage,Threshold,Period\n";

      subjects.forEach((s) => {
        const subRecords = records.filter((r) => r.subject_id === s.id);
        const conducted = subRecords.length;
        const attended = subRecords.filter(
          (r) => r.status === "present",
        ).length;
        const percentage =
          conducted === 0 ? 0 : Math.round((attended / conducted) * 100);
        csvContent += `"${s.name}","${s.short_name}",${attended},${conducted},${percentage}%,${s.target_threshold}%,"${activeSem.name}"\n`;
      });

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Attendance_Report_${activeSem.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const fileUri =
          (FileSystem as any).documentDirectory +
          `Attendance_Report_${activeSem.id}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: "Export Attendance Report",
          });
        } else {
          Alert.alert("Error", "Sharing is not available on this device");
        }
      }
    } catch (e: any) {
      Alert.alert("Failed to export CSV", e.message);
    }
  };

  // --- In-App OTA Update Checker ---
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState("");

  const handleCheckForUpdates = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Live Web Version",
        "You are using Attendance Tracker Web, which is always running the latest live build."
      );
      return;
    }

    if (__DEV__) {
      Alert.alert(
        "Development Mode",
        "Updates cannot be fetched in local development mode."
      );
      return;
    }

    try {
      setIsCheckingUpdate(true);
      setUpdateStatusText("Checking update server...");

      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        setUpdateStatusText("Downloading new update...");
        Alert.alert(
          "Update Available",
          "A new update was found! Downloading in the background now...",
          [{ text: "OK" }]
        );
        await Updates.fetchUpdateAsync();
        setUpdateStatusText("Update downloaded! Ready to reload.");
        Alert.alert(
          "Update Ready",
          "The new version has been downloaded. Reload the app to apply the updates now.",
          [
            {
              text: "Restart App Now",
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
            {
              text: "Later",
              style: "cancel",
            },
          ]
        );
      } else {
        setUpdateStatusText("App is up to date");
        Alert.alert(
          "No Updates Available",
          "You are already running the latest version (Runtime: 1.0.0)."
        );
      }
    } catch (error: any) {
      setUpdateStatusText("Check failed");
      Alert.alert(
        "Update Check Failed",
        `Could not check for updates: ${error?.message || error}\n\nPlease check your internet connection and try again.`
      );
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // --- Fetching Feature Data ---
  const loadSemestersData = async () => {
    try {
      setLoadingSemesters(true);
      const data = await DatabaseService.fetchSemesters();
      setSemesters(data || []);
    } catch (e) {
      console.warn("Failed to load semesters", e);
    } finally {
      setLoadingSemesters(false);
    }
  };

  const loadLogbookData = async () => {
    try {
      setLoadingLogs(true);
      const data = await LogbookService.fetchLogs();
      setLogs(data || []);
    } catch (e) {
      console.warn("Failed to load logs", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadRecycleBinData = async () => {
    try {
      setLoadingRecycle(true);
      const data = await RecycleBinService.getDeletedItems();
      setRecycleItems(data || []);
    } catch (e) {
      console.warn("Failed to load recycle bin", e);
    } finally {
      setLoadingRecycle(false);
    }
  };

  // --- Semester CRUD Actions ---
  const handleEditSemester = (sem: any) => {
    setEditingSem(sem);
    setEditSemName(sem.name);
    setEditSemStart(sem.start_date.replace(/-/g, '/'));
    setEditSemEnd(sem.end_date ? sem.end_date.replace(/-/g, '/') : "");
  };

  const handleSaveSemester = async () => {
    if (!editingSem || !editSemName.trim() || !editSemStart.trim()) {
      Alert.alert("Error", "Please fill in Name and Start Date");
      return;
    }
    try {
      if (editingSem.id === "new") {
        await DatabaseService.createSemester(
          editSemName.trim(),
          editSemStart.replace(/\//g, '-').trim(),
          editSemEnd.replace(/\//g, '-').trim() || undefined,
        );
      } else {
        await DatabaseService.updateSemester(editingSem.id, {
          name: editSemName.trim(),
          start_date: editSemStart.replace(/\//g, '-').trim(),
          end_date: editSemEnd.replace(/\//g, '-').trim() || null,
        });
      }
      setEditingSem(null);
      loadSemestersData();
    } catch (e: any) {
      Alert.alert("Error saving semester", e.message);
    }
  };

  const handleDeleteSemester = async (id: string, name: string) => {
    const confirmDelete =
      Platform.OS === "web"
        ? window.confirm(
            `Are you sure you want to permanently delete semester "${name}"? This deletes all associated subjects, timetable slots, and attendance records.`,
          )
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Delete Semester?",
              `Are you sure you want to delete semester "${name}" and all its subjects, schedule, and attendance data?`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => resolve(true),
                },
              ],
            );
          });

    if (confirmDelete) {
      try {
        await DatabaseService.deleteSemester(id);
        loadSemestersData();
      } catch (e: any) {
        Alert.alert("Error deleting semester", e.message);
      }
    }
  };

  // --- Recycle Bin Recovery Actions ---
  const handleRestoreItem = async (item: RecycleBinItem) => {
    try {
      await RecycleBinService.restoreItem(item);
      Alert.alert("Restored", `Successfully restored "${item.label}"`);
      loadRecycleBinData();
    } catch (e: any) {
      Alert.alert("Restoration Failed", e.message);
    }
  };

  const handlePermanentDelete = async (item: RecycleBinItem) => {
    const confirmDelete =
      Platform.OS === "web"
        ? window.confirm(`Delete "${item.label}" permanently from the bin?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Delete Permanently",
              `Are you sure you want to permanently purge "${item.label}"? It cannot be recovered anymore.`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => resolve(true),
                },
              ],
            );
          });

    if (confirmDelete) {
      await RecycleBinService.permanentlyDeleteItem(item.id);
      loadRecycleBinData();
    }
  };

  // --- Render Setting Option Helper ---
  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle: string,
    value: boolean,
    onValueChange: (val: boolean) => void,
    isFirst: boolean = false,
    isLast: boolean = false,
  ) => (
    <View
      style={[
        styles.settingItem,
        isFirst && styles.settingItemFirst,
        isLast && styles.settingItemLast,
      ]}
    >
      <View style={styles.settingIconContainer}>
        <Ionicons name={icon as any} size={20} color={textColors.primary} />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(val) => {
          onValueChange(val);
          if (title === "Push Notifications")
            savePreference("notificationsEnabled", val);
          if (title === "Biometric Lock")
            savePreference("biometricsEnabled", val);
        }}
        trackColor={{ false: glass.light, true: accent.primary }}
        thumbColor={
          Platform.OS === "ios" ? palette.white : value ? palette.white : textColors.tertiary
        }
        ios_backgroundColor={glass.light}
      />
    </View>
  );

  const filteredRecycleItems = recycleItems.filter((item) => {
    return (
      item.label.toLowerCase().includes(recycleSearch.toLowerCase()) ||
      item.type.toLowerCase().includes(recycleSearch.toLowerCase())
    );
  });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profile & Settings</Text>
          <Text style={styles.subtitle}>Manage your account preferences</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={[accent.primary + "20", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileEmail}>{name}</Text>
            {email ? <Text style={styles.profileBadge}>{email}</Text> : null}
          </View>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"             onPress={() => {
              setNewName(name);
              setEditNameVisible(true);
            }}
            style={styles.editProfileButton}
          >
            <Ionicons name="pencil" size={18} color={textColors.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          <View style={styles.settingsGroup}>
            {renderSettingItem(
              "notifications-outline",
              "Push Notifications",
              "Get reminded about upcoming classes",
              notificationsEnabled,
              setNotificationsEnabled,
              true,
            )}
            {renderSettingItem(
              "finger-print-outline",
              "Biometric Lock",
              "Require fingerprint to open app",
              biometricsEnabled,
              setBiometricsEnabled,
              false,
              false,
            )}
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"               style={[styles.actionRow, styles.settingItemLast]}
              activeOpacity={0.7}
              onPress={() => {
                loadLogbookData();
                setLogbookVisible(true);
              }}
            >
              <View style={styles.settingIconContainer}>
                <Ionicons
                  name="journal-outline"
                  size={20}
                  color={textColors.primary}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Activity Logbook</Text>
                <Text style={styles.settingSubtitle}>
                  Timeline of database mutations
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={textColors.tertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT & DATABASE</Text>
          <View style={styles.settingsGroup}>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"               style={[styles.actionRow, styles.settingItemFirst]}
              activeOpacity={0.7}
              onPress={() => setChangePasswordVisible(true)}
            >
              <View style={styles.settingIconContainer}>
                <Ionicons
                  name="key-outline"
                  size={20}
                  color={textColors.primary}
                />
              </View>
              <Text style={styles.actionText}>Change Password</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={textColors.tertiary}
              />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"               style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => {
                loadSemestersData();
                setAdjustSemestersVisible(true);
              }}
            >
              <View style={styles.settingIconContainer}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={textColors.primary}
                />
              </View>
              <Text style={styles.actionText}>Adjust Semester Dates</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={textColors.tertiary}
              />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"               style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => {
                loadRecycleBinData();
                setRecycleBinVisible(true);
              }}
            >
              <View style={styles.settingIconContainer}>
                <Ionicons
                  name="trash-bin-outline"
                  size={20}
                  color={textColors.primary}
                />
              </View>
              <Text style={styles.actionText}>
                Recently Deleted (Recycle Bin)
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={textColors.tertiary}
              />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"               style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleExportCSV}
            >
              <View style={styles.settingIconContainer}>
                <Ionicons
                  name="download-outline"
                  size={20}
                  color={textColors.primary}
                />
              </View>
              <Text style={styles.actionText}>Export Attendance (CSV)</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={textColors.tertiary}
              />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"               style={[styles.actionRow, styles.settingItemLast]}
              activeOpacity={0.7}
              onPress={handleDeleteAccount}
            >
              <View
                style={[
                  styles.settingIconContainer,
                  { backgroundColor: palette.red[500] + "20" },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={palette.red[500]}
                />
              </View>
              <Text style={[styles.actionText, { color: palette.red[500] }]}>
                Delete Account permanently
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={textColors.tertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* App & System Updates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP & SYSTEM</Text>
          <View style={styles.settingsGroup}>
            <TouchableOpacity
              style={[styles.actionRow, styles.settingItemLast]}
              activeOpacity={0.7}
              onPress={handleCheckForUpdates}
              disabled={isCheckingUpdate}
            >
              <View
                style={[
                  styles.settingIconContainer,
                  { backgroundColor: accent.primary + "20" },
                ]}
              >
                {isCheckingUpdate ? (
                  <ActivityIndicator size="small" color={accent.primary} />
                ) : (
                  <Ionicons
                    name="cloud-download-outline"
                    size={20}
                    color={accent.primary}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionText}>Check for Updates</Text>
                <Text
                  style={{
                    fontFamily: fontFamily.medium,
                    fontSize: 11,
                    color: updateStatusText.includes("fail")
                      ? palette.red[400]
                      : updateStatusText.includes("download")
                      ? accent.primary
                      : textColors.tertiary,
                    marginTop: 2,
                  }}
                >
                  {updateStatusText || "v1.0.0 • OTA Enabled"}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={textColors.tertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"           style={styles.logoutButton}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={palette.red[500]} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: layout.bottomNavHeight + spacing["2xl"] }} />
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={editNameVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"             style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setEditNameVisible(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Edit Profile Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Your Name"
              placeholderTextColor={textColors.disabled}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                 style={styles.modalCancel}
                onPress={() => setEditNameVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                 style={styles.modalSave}
                onPress={handleSaveName}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={changePasswordVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"             style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setChangePasswordVisible(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              placeholderTextColor={textColors.disabled}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { marginTop: spacing.md }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm New Password"
              placeholderTextColor={textColors.disabled}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                 style={styles.modalCancel}
                onPress={() => setChangePasswordVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                 style={styles.modalSave}
                onPress={handleChangePassword}
              >
                <Text style={styles.modalSaveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Adjust Semester Dates Modal */}
      <Modal visible={adjustSemestersVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"             style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setAdjustSemestersVisible(false)}
          />
          <View style={[styles.modalContent, styles.fullModalContent]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Adjust Semester Dates</Text>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                 onPress={() => setAdjustSemestersVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={textColors.secondary} />
              </TouchableOpacity>
            </View>

            {!editingSem && (
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                 style={styles.addSemesterBtn}
                onPress={() => {
                  setEditingSem({
                    id: "new",
                    name: "",
                    start_date: "",
                    end_date: "",
                  });
                  setEditSemName("Semester " + (semesters.length + 1));
                  setEditSemStart(
                    new Date().toLocaleDateString("en-CA", {
                      timeZone: "Asia/Kolkata",
                    }).replace(/-/g, '/')
                  );
                  setEditSemEnd("");
                }}
              >
                <Ionicons
                  name="add"
                  size={16}
                  color={palette.white}
                  style={{ marginRight: spacing.xs }}
                />
                <Text style={styles.addSemesterBtnText}>Add Semester</Text>
              </TouchableOpacity>
            )}

            {editingSem ? (
              <View style={styles.editSemesterForm}>
                <Text style={styles.label}>Semester Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSemName}
                  onChangeText={setEditSemName}
                />

                <View style={[styles.rowGroup, { marginTop: spacing.md }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Start Date</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editSemStart}
                      placeholder="YYYY/MM/DD"
                      placeholderTextColor={textColors.tertiary}
                      onChangeText={handleEditSemStartChange}
                      maxLength={10}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={styles.label}>End Date (Optional)</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={editSemEnd}
                      placeholder="YYYY/MM/DD"
                      placeholderTextColor={textColors.tertiary}
                      onChangeText={handleEditSemEndChange}
                      maxLength={10}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                     style={styles.modalCancel}
                    onPress={() => setEditingSem(null)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                     style={styles.modalSave}
                    onPress={handleSaveSemester}
                  >
                    <Text style={styles.modalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView
                style={[styles.semestersScrollList, { maxHeight: height * 0.45 }]}
                showsVerticalScrollIndicator={false}
              >
                {loadingSemesters ? (
                  <ActivityIndicator
                    color={accent.primary}
                    style={{ marginTop: spacing.xl }}
                  />
                ) : semesters.length > 0 ? (
                  semesters.map((sem) => (
                    <View key={sem.id} style={styles.semItemCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.semItemName}>{sem.name}</Text>
                        <Text style={styles.semItemDates}>
                          {sem.start_date} to {sem.end_date || "Ongoing"}
                        </Text>
                      </View>
                      <View style={styles.itemActionGroup}>
                        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                           onPress={() => handleEditSemester(sem)}
                          style={styles.subIconBtn}
                        >
                          <Ionicons
                            name="pencil"
                            size={16}
                            color={accent.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                           onPress={() => handleDeleteSemester(sem.id, sem.name)}
                          style={styles.subIconBtn}
                        >
                          <Ionicons name="trash" size={16} color={palette.red[600]} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    No semesters created yet.
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Logbook Modal */}
      <Modal visible={logbookVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"             style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setLogbookVisible(false)}
          />
          <View style={[styles.modalContent, styles.fullModalContent]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Activity Logbook</Text>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                 onPress={() => setLogbookVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={textColors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={[styles.logsScrollList, { maxHeight: height * 0.45 }]}
              showsVerticalScrollIndicator={false}
            >
              {loadingLogs ? (
                <ActivityIndicator
                  color={accent.primary}
                  style={{ marginTop: spacing.xl }}
                />
              ) : logs.length > 0 ? (
                logs.map((log) => {
                  const date = new Date(log.timestamp).toLocaleString();
                  const isDelete = log.actionType === "delete";
                  const isRestore = log.actionType === "restore";
                  const isCreate = log.actionType === "create";

                  return (
                    <View key={log.id} style={styles.logCard}>
                      <View style={styles.logHeaderRow}>
                        <View
                          style={[
                            styles.actionIndicator,
                            {
                              backgroundColor: isDelete
                                ? "#DC262620"
                                : isRestore
                                  ? "#10B98120"
                                  : isCreate
                                    ? "#3B82F620"
                                    : glass.light,
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              isDelete
                                ? "trash"
                                : isRestore
                                  ? "refresh"
                                  : isCreate
                                    ? "add-circle"
                                    : "create"
                            }
                            size={12}
                            color={
                              isDelete
                                ? palette.red[600]
                                : isRestore
                                  ? "#10B981"
                                  : isCreate
                                    ? "#3B82F6"
                                    : textColors.primary
                            }
                          />
                        </View>
                        <Text style={styles.logCategory}>
                          {log.category.toUpperCase()}
                        </Text>
                        <Text style={styles.logTime}>{date}</Text>
                      </View>
                      <Text style={styles.logDesc}>{log.description}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>No activity logged yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Recycle Bin Modal */}
      <Modal visible={recycleBinVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"             style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setRecycleBinVisible(false)}
          />
          <View style={[styles.modalContent, styles.fullModalContent]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Recently Deleted</Text>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                 onPress={() => setRecycleBinVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={textColors.secondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchBarInput}
              placeholder="Search deleted records..."
              placeholderTextColor={textColors.tertiary}
              value={recycleSearch}
              onChangeText={setRecycleSearch}
            />

            <ScrollView
              style={[styles.recycleScrollList, { maxHeight: height * 0.45 }]}
              showsVerticalScrollIndicator={false}
            >
              {loadingRecycle ? (
                <ActivityIndicator
                  color={accent.primary}
                  style={{ marginTop: spacing.xl }}
                />
              ) : filteredRecycleItems.length > 0 ? (
                filteredRecycleItems.map((item) => {
                  const delDate = new Date(item.deletedAt);
                  const expDate = new Date(delDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                  const daysLeft = Math.ceil(
                    (expDate.getTime() - Date.now()) / (1000 * 3600 * 24),
                  );

                  return (
                    <View key={item.id} style={styles.recycleCard}>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Text style={styles.recycleItemLabel}>
                            {item.label}
                          </Text>
                          <Text style={styles.recycleItemTableBadge}>
                            {item.type
                              .replace("_slots", "")
                              .replace("_records", "")}
                          </Text>
                        </View>
                        <Text style={styles.recycleExpText}>
                          Expires in {daysLeft}{" "}
                          {daysLeft === 1 ? "day" : "days"}
                        </Text>
                      </View>
                      <View style={styles.recycleActions}>
                        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                           onPress={() => handleRestoreItem(item)}
                          style={styles.restoreBtn}
                        >
                          <Ionicons
                            name="arrow-undo"
                            size={16}
                            color="#10B981"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"                           onPress={() => handlePermanentDelete(item)}
                          style={styles.restoreBtn}
                        >
                          <Ionicons
                            name="close-circle"
                            size={16}
                            color={palette.red[600]}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>Recycle Bin is empty.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: canvas.base,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: Platform.OS === "web" ? spacing["3xl"] : spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing["2xl"],
  },
  title: {
    ...textStyle.pageTitle,
    color: textColors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    color: textColors.secondary,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: glass.subtle,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing["2xl"],
    overflow: "hidden",
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  avatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize["2xl"],
    color: palette.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileEmail: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: textColors.primary,
    marginBottom: 4,
  },
  profileBadge: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: accent.primary,
  },
  editProfileButton: {
    padding: spacing.sm,
    backgroundColor: glass.light,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: border.default,
  },
  section: {
    marginBottom: spacing["2xl"],
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    color: textColors.tertiary,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
  },
  settingsGroup: {
    backgroundColor: glass.subtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: border.default,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: border.default,
  },
  settingItemFirst: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  settingItemLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: glass.light,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.base,
    color: textColors.primary,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
  },
  actionText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: textColors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: border.default,
    marginLeft: 40 + spacing.lg + spacing.md,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.red[500] + "15",
    borderWidth: 1,
    borderColor: palette.red[500] + "30",
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  logoutText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: palette.red[500],
  },

  // Modals Core styling
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(6, 9, 18, 0.85)",
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: canvas.elevated,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.strong,
    zIndex: 30,
  },
  fullModalContent: {
    maxWidth: 500,
    maxHeight: "80%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  closeBtn: {
    backgroundColor: glass.subtle,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: border.default,
  },
  modalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: textColors.primary,
  },
  modalInput: {
    backgroundColor: canvas.base,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: textColors.primary,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  modalCancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: "center",
  },
  modalCancelText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: textColors.secondary,
  },
  modalSave: {
    backgroundColor: accent.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  modalSaveText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: palette.white,
  },

  // Adjust Semester styles
  editSemesterForm: {
    gap: spacing.sm,
  },
  rowGroup: {
    flexDirection: "row",
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: textColors.tertiary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  semestersScrollList: {
  },
  semItemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: glass.light,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  semItemName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: textColors.primary,
  },
  semItemDates: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.secondary,
    marginTop: 2,
  },
  itemActionGroup: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  subIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: glass.light,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: border.default,
  },

  // Logbook Styles
  logsScrollList: {
  },
  logCard: {
    backgroundColor: glass.light,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  logHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  actionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  logCategory: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: textColors.secondary,
  },
  logTime: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: textColors.tertiary,
    marginLeft: "auto",
  },
  logDesc: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: textColors.primary,
    marginTop: 4,
  },

  // Recycle Bin styles
  searchBarInput: {
    backgroundColor: canvas.base,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: textColors.primary,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  recycleScrollList: {
  },
  recycleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: glass.light,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  recycleItemLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: textColors.primary,
  },
  recycleItemTableBadge: {
    fontSize: 8,
    fontFamily: fontFamily.bold,
    backgroundColor: glass.subtle,
    borderWidth: 1,
    borderColor: border.default,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    color: textColors.secondary,
    textTransform: "uppercase",
  },
  recycleExpText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: palette.red[400],
    marginTop: 2,
  },
  recycleActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  restoreBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: glass.light,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: border.default,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: textColors.tertiary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  addSemesterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: accent.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  addSemesterBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: palette.white,
  },
});
