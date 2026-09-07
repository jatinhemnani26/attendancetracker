/**
 * Attendance Tracker — Dashboard Screen
 *
 * The central hub of the application (PRD Chapter 9/14).
 * Displays:
 * - Hero attendance gauge with overall percentage
 * - Quick stats bar (Attended, Conducted, Missed, Cancelled)
 * - Today's schedule with timeline
 * - All subjects with attendance cards
 *
 * All values are dynamically calculated from raw data (PRD Single Source of Truth).
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity,
  DeviceEventEmitter,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AttendanceGauge from "../../components/AttendanceGauge";
import SubjectCard from "../../components/SubjectCard";
import QuickStatsBar from "../../components/QuickStatsBar";
import StopwatchTimerBanner from "../../components/StopwatchTimerBanner";
import TimerConfirmationSheet from "../../components/TimerConfirmationSheet";
import SemesterSwitchSheet from "../../components/SemesterSwitchSheet";
import ExpandedAttendanceSheet from "../../components/ExpandedAttendanceSheet";
import DatePickerSheet from "../../components/DatePickerSheet";
import { TimerService, TimerState } from "../../services/TimerService";
import {
  canvas,
  glass,
  border,
  text as textColors,
  accent,
  gauge as gaugeColors,
  shadow,
  attendance,
} from "../../theme/colors";
import { fontFamily, fontSize, textStyle } from "../../theme/typography";
import { spacing, radius, layout } from "../../theme/spacing";
import { DatabaseService } from "../../services/DatabaseService";
import { SyncService } from "../../services/SyncService";
import { Database } from "../../lib/database.types";
import { supabase } from "../../lib/supabase";

type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
type RecordRow = Database["public"]["Tables"]["attendance_records"]["Row"];
type TimetableSlot = Database["public"]["Tables"]["timetable_slots"]["Row"];

const calculatePercentage = (attended: number, conducted: number) => {
  if (conducted === 0) return -1;
  return Math.round((attended / conducted) * 100);
};

const getAttendanceStatus = (percentage: number, threshold: number) => {
  if (percentage >= threshold + 10) return "safe";
  if (percentage >= threshold) return "warning";
  return "danger";
};

const lecturesCanMiss = (
  attended: number,
  conducted: number,
  threshold: number,
) => {
  if (conducted === 0) return -1;
  let currentPercentage = (attended / conducted) * 100;
  let canMiss = 0;
  let virtualConducted = conducted;

  while (currentPercentage >= threshold) {
    virtualConducted++;
    currentPercentage = (attended / virtualConducted) * 100;
    if (currentPercentage >= threshold) {
      canMiss++;
    }
  }
  return canMiss;
};

export default function DashboardScreen({ isActive = true }: { isActive?: boolean }) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeTimer, setActiveTimer] = useState<TimerState | null>(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [semesterSheetVisible, setSemesterSheetVisible] = useState(false);
  const [expandedAttendanceVisible, setExpandedAttendanceVisible] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => 
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const newDate = new Date(y, m - 1, d);
    newDate.setDate(newDate.getDate() + days);
    
    // Respect semester start date as minimum
    if (activeSemester?.start_date) {
      const minDate = new Date(activeSemester.start_date);
      if (newDate < minDate) return;
    }
    
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, "0");
    const dd = String(newDate.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Data States
  const [activeSemester, setActiveSemester] = useState<any>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [schedule, setSchedule] = useState<TimetableSlot[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [markingIds, setMarkingIds] = useState<Record<string, boolean>>({});
  
  const [pendingStatus, setPendingStatus] = useState<"present" | "absent" | "cancelled" | "proxy" | null>(null);
  const [pendingItem, setPendingItem] = useState<any>(null);

  const loadData = React.useCallback(async () => {
    try {
      const activeSem = await DatabaseService.fetchActiveSemester();
      setActiveSemester(activeSem);
      if (!activeSem) return; // No active semester yet

      const [fetchedSubjects, fetchedRecords, fetchedSchedule, fetchedHolidays] =
        await Promise.all([
          DatabaseService.fetchSubjects(activeSem.id),
          DatabaseService.fetchAttendanceRecords(activeSem.id),
          DatabaseService.fetchTimetable(activeSem.id, selectedDate),
          DatabaseService.fetchHolidays(activeSem.id),
        ]);
      setSubjects(fetchedSubjects);
      setRecords(fetchedRecords);
      setSchedule(fetchedSchedule);
      setHolidays(fetchedHolidays);
    } catch (error) {
      console.warn("Failed to load dashboard data from Supabase", error);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!isActive) return;
    // Load active timer and data on mount
    TimerService.getActiveTimer().then(setActiveTimer);
    loadData();

    // Setup Realtime Sync Subscription for attendance records
    const attendanceSubscription = supabase
      .channel("public:attendance_records")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        (_payload) => {
          console.log("Realtime update received!", _payload);
          loadData(); // Re-fetch on change
        },
      )
      .subscribe();

    const subjectsSubscription = supabase
      .channel("public:dashboard_subjects_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subjects" },
        (_payload) => {
          loadData();
        },
      )
      .subscribe();

    const semestersSubscription = supabase
      .channel("public:dashboard_semesters_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "academic_semesters" },
        (_payload) => {
          loadData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceSubscription);
      supabase.removeChannel(subjectsSubscription);
      supabase.removeChannel(semestersSubscription);
    };
  }, [isActive]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("semesterChanged", () => {
      loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const handleSignOut = React.useCallback(async () => {
    try {
      await SyncService.clearQueue();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out", error);
    }
  }, []);

  const handleStartTimer = React.useCallback(async (subject: any) => {
    // Check collision logic here (simplified for mock phase)
    const newTimer = await TimerService.startTimer(
      subject.id,
      subject.name,
      subject.short_name,
      subject.color,
    );
    setActiveTimer(newTimer);

    // Scroll to top so timer banner is visible
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
    }
  }, []);

  const handleStopTimer = React.useCallback(() => {
    setShowConfirmSheet(true);
  }, []);

  const handleConfirmTimer = React.useCallback(async (
    start: Date, 
    end: Date,
    classType: 'theory' | 'lab' | 'tutorial',
    teacherName: string | null,
      rating: number,
      proxySubjectId?: string
    ) => {
    // In a real app, check collision here with actual IST Date parsing
    // Mock collision logic: if end time is before start time (just basic validation)
    if (end.getTime() <= start.getTime()) {
      Alert.alert("Time Error", "End time cannot be before start time.");
      return;
    }

    console.log(
      `Saved session for ${activeTimer?.subjectShortName} from ${start.toISOString()} to ${end.toISOString()} as PRESENT`,
    );

    // Log to Supabase
    if (activeTimer) {
      try {
        const insertStatus = (pendingStatus === "proxy" ? "present" : pendingStatus) || "present";
        const insertDate = pendingItem ? selectedDate : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        const payload = {
          subject_id: (pendingStatus === "proxy" && proxySubjectId) ? proxySubjectId : activeTimer.subjectId,
          date: insertDate,
          status: insertStatus,
          ist_start_time: start.toLocaleTimeString("en-US", {
            hour12: false,
            timeZone: "Asia/Kolkata",
          }),
          ist_end_time: end.toLocaleTimeString("en-US", {
            hour12: false,
            timeZone: "Asia/Kolkata",
          }),
          duration_minutes: Math.round(
            (end.getTime() - start.getTime()) / 60000,
          ),
          class_type: classType,
          teacher_name: teacherName,
          rating: rating > 0 ? rating : null,
          notes: pendingItem ? "Manual Entry" : "Recorded via Stopwatch Timer",
        };
        if (pendingItem?.recordId) {
            await (supabase as any).from("attendance_records").update(payload).eq("id", pendingItem.recordId);
        } else {
            await DatabaseService.logAttendanceSession(payload);
        }
        loadData(); // Refresh stats
      } catch (e) {
        console.error("Failed to log session", e);
      }
    }

    await TimerService.clearTimer();
    setActiveTimer(null);
    setPendingStatus(null);
    setPendingItem(null);
    setShowConfirmSheet(false);
  }, [activeTimer, loadData, selectedDate, pendingStatus, pendingItem]);

  const handleDiscardTimer = React.useCallback(async () => {
    await TimerService.clearTimer();
    setActiveTimer(null);
    setPendingStatus(null);
    setPendingItem(null);
    setShowConfirmSheet(false);
  }, []);

  const handleCancelTimer = React.useCallback(() => {
    setShowConfirmSheet(false);
  }, []);

  const handleMarkAttendance = React.useCallback(async (
    item: any,
    status: "present" | "absent" | "cancelled" | "proxy",
  ) => {
    if (markingIds[item.id]) return;

    // Helper for direct status update/insert
    const upsertStatus = async (targetStatus: string) => {
      setMarkingIds((prev) => ({ ...prev, [item.id]: true }));
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not logged in");

        const [sh, sm] = item.startTime.split(":").map(Number);
        const [eh, em] = item.endTime.split(":").map(Number);
        const durationMins = eh * 60 + em - (sh * 60 + sm);

        const payload = {
          user_id: user.id,
          subject_id: item.subjectId,
          date: selectedDate,
          status: targetStatus,
          ist_start_time: item.startTime + (item.startTime.length === 5 ? ":00" : ""),
          ist_end_time: item.endTime + (item.endTime.length === 5 ? ":00" : ""),
          duration_minutes: durationMins > 0 ? durationMins : 60,
          class_type: item.classType || "theory",
          teacher_name: item.teacher || null,
        };

        if (item.recordId) {
          const { error } = await (supabase as any).from("attendance_records").update({ status: targetStatus }).eq("id", item.recordId);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("attendance_records").insert([payload]);
          if (error) throw error;
        }
        loadData();
      } catch (e: any) {
        alert("Error marking attendance: " + e.message);
      } finally {
        setMarkingIds((prev) => {
          const copy = { ...prev };
          delete copy[item.id];
          return copy;
        });
      }
    };

    if (status === "cancelled") {
       await upsertStatus("cancelled");
       return;
    }

    if (status === "absent") {
       await upsertStatus("absent");
       return;
    }

    // For present / proxy, show confirmation sheet
    const mockStart = new Date(`${selectedDate}T${item.startTime.length === 5 ? item.startTime + ':00' : item.startTime}`);
    const mockEnd = new Date(`${selectedDate}T${item.endTime.length === 5 ? item.endTime + ':00' : item.endTime}`);
    
    const mockTimer: TimerState = {
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      subjectShortName: item.subjectShortName,
      color: item.color,
      startTimeIso: mockStart.toISOString(),
    };
    
    setPendingStatus(status);
    setPendingItem({ ...item, mockEndTimeIso: mockEnd.toISOString() });
    setActiveTimer(mockTimer);
    setShowConfirmSheet(true);

  }, [markingIds, loadData, selectedDate]);

  const handleResetAttendance = React.useCallback(async (recordId: string) => {
    const confirmReset =
      Platform.OS === "web"
        ? window.confirm("Are you sure you want to delete this attendance log?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Delete Log?",
              "Are you sure you want to remove this attendance record?",
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

    if (confirmReset) {
      try {
        await DatabaseService.deleteAttendanceRecord(recordId);
        loadData();
      } catch (e: any) {
        Alert.alert("Error", "Error resetting attendance: " + e.message);
      }
    }
  }, [loadData]);

  // --- Calculate Stats ---
  const defaultThreshold = 75; // Or avg of subjects
  let totalConducted = records.filter((r) => r.status !== "cancelled").length;
  let totalAttended = records.filter((r) => r.status === "present").length;
  let totalMissed = records.filter((r) => r.status === "absent").length;
  let totalCancelled = records.filter((r) => r.status === "cancelled").length;

  const stats = {
    overallPercentage: calculatePercentage(totalAttended, totalConducted),
    totalAttended,
    totalConducted,
    totalMissed,
    totalCancelled,
    totalSubjects: subjects.length,
    defaultThreshold,
  };

  const overallStatus = getAttendanceStatus(
    stats.overallPercentage,
    stats.defaultThreshold,
  );
  const _overallCanMiss = lecturesCanMiss(
    stats.totalAttended,
    stats.totalConducted,
    stats.defaultThreshold,
  );

  // Get greeting based on time of day
  const hour = new Date().getHours();
  let greeting = "Good morning";
  if (hour >= 0 && hour < 5) greeting = "Good night";
  else if (hour >= 5 && hour < 12) greeting = "Good morning";
  else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  else if (hour >= 17) greeting = "Good evening";

  // ─── Today's Schedule Mapping ───
  const selectedDayOfWeek = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }, [selectedDate]);

  const holidayData = useMemo(() => {
    return holidays.find(h => h.date === selectedDate);
  }, [holidays, selectedDate]);
  
  const isHoliday = selectedDayOfWeek === 0 || !!holidayData;

  const todayScheduleItems = useMemo(() => {
    const todaySlots = schedule.filter(
      (slot) => slot.day_of_week === selectedDayOfWeek,
    );
    const items = todaySlots
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((slot) => {
        const subject = subjects.find((s) => s.id === slot.subject_id);
        const record = records.find((r) => {
          if (r.date !== selectedDate) return false;
          if (r.ist_start_time) {
            return (
              r.ist_start_time === slot.start_time ||
              r.ist_start_time.startsWith(slot.start_time.substring(0, 5))
            );
          }
          return r.subject_id === slot.subject_id;
        });
        
        const displaySubjectId = record ? record.subject_id : slot.subject_id;
        const displaySubject = subjects.find(s => s.id === displaySubjectId);

        let teacherStr = "";
        if (record?.teacher_name) {
          teacherStr = record.teacher_name;
          try {
            if (teacherStr.startsWith('{')) {
              const obj = JSON.parse(teacherStr);
              teacherStr = obj.s || obj.n;
            }
          } catch(e) {}
        } else if (slot.default_teacher) {
          teacherStr = slot.default_teacher;
          try {
            if (teacherStr.startsWith('{')) {
              const obj = JSON.parse(teacherStr);
              teacherStr = obj.s || obj.n;
            }
          } catch(e) {}
        }

        return {
          id: slot.id,
          subjectId: slot.subject_id,
          subjectName: displaySubject?.name || subject?.name || "Unknown Subject",
          subjectShortName: displaySubject?.short_name || subject?.short_name || "UNK",
          color: displaySubject?.color || subject?.color || "#94A3B8",
          startTime: slot.start_time,
          endTime: slot.end_time,
          roomNumber: slot.room_number || "TBA",
          recordStatus: record?.status as
            | "present"
            | "absent"
            | "cancelled"
            | "proxy"
            | undefined,
          recordId: record?.id,
          teacher: teacherStr,
          classType: slot.class_type || record?.class_type,
        };
      });

    const extraRecords = records.filter(r => r.date === selectedDate && !items.find(i => i.recordId === r.id));
    extraRecords.forEach(r => {
      const subject = subjects.find((s) => s.id === r.subject_id);
      
      let teacherStr = "";
      if (r.teacher_name) {
        teacherStr = r.teacher_name;
        try {
          if (teacherStr.startsWith('{')) {
            const obj = JSON.parse(teacherStr);
            teacherStr = obj.s || obj.n;
          }
        } catch(e) {}
      }
      
      items.push({
        id: `extra_${r.id}`,
        subjectId: r.subject_id || "",
        subjectName: subject?.name || "Unknown Subject",
        subjectShortName: subject?.short_name || "UNK",
        color: subject?.color || "#94A3B8",
        startTime: r.ist_start_time ? r.ist_start_time.substring(0, 5) : "--:--",
        endTime: "--:--",
        roomNumber: "Extra",
        recordStatus: r.status as "present" | "absent" | "cancelled" | "proxy",
        recordId: r.id,
        teacher: teacherStr,
        classType: r.class_type,
      });
    });

    return items;
  }, [schedule, subjects, records, selectedDayOfWeek, selectedDate]);

  const todayTotal = todayScheduleItems.length;
  const todayCompleted = todayScheduleItems.filter(
    (item) => item.recordStatus !== undefined,
  ).length;

  const ongoingLecture = useMemo(() => {
    const nowTimeStr = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      todayScheduleItems.find(
        (item) =>
          item.startTime <= nowTimeStr &&
          item.endTime >= nowTimeStr &&
          item.recordStatus === undefined,
      ) || null
    );
  }, [todayScheduleItems]);

  return (
    <>
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <View style={styles.dateNavigator}>
              <TouchableOpacity 
                  onPress={() => changeDate(-1)} 
                  style={[styles.dateNavButton, (!activeSemester?.start_date || new Date(selectedDate) <= new Date(activeSemester.start_date)) && { opacity: 0.3 }]}
                  disabled={!activeSemester?.start_date || new Date(selectedDate) <= new Date(activeSemester.start_date)}
                >
                  <Ionicons name="chevron-back" size={20} color={textColors.primary} />
                  <Text style={styles.dateNavText}>Prev</Text>
                </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateNavCurrent}>
                  {(() => {
                    const [y, m, d] = selectedDate.split("-").map(Number);
                    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                  })()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateNavButton}>
                <Text style={styles.dateNavText}>Next</Text>
                <Ionicons name="chevron-forward" size={20} color={textColors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons
              name="log-out-outline"
              size={24}
              color={textColors.secondary}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.semesterBanner}
          activeOpacity={0.7}
          onPress={() => setSemesterSheetVisible(true)}
        >
          <Ionicons name="school" size={16} color={accent.primary} />
          <Text style={styles.semesterText}>
            {activeSemester ? activeSemester.name : "Loading Semester..."}
          </Text>
          <View style={styles.semesterEditButton}>
            <Ionicons
              name="chevron-down"
              size={14}
              color={textColors.tertiary}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* ─── Stopwatch Timer Banner ─── */}
      {activeTimer ? (
        <StopwatchTimerBanner timer={activeTimer} onStop={handleStopTimer} />
      ) : ongoingLecture ? (
        <View
          style={{
            paddingHorizontal: layout.screenPaddingH,
            marginBottom: spacing.lg,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamily.semiBold,
              color: textColors.secondary,
              marginBottom: spacing.md,
            }}
          >
            Next Up:
          </Text>
          <Text
            style={{
              color: ongoingLecture.color,
              fontFamily: fontFamily.bold,
              fontSize: fontSize.lg,
            }}
          >
            {ongoingLecture.subjectName} at {ongoingLecture.startTime}
          </Text>
        </View>
      ) : null}

      <TimerConfirmationSheet
        visible={showConfirmSheet}
        timer={activeTimer}
        subject={subjects.find(s => s.id === activeTimer?.subjectId)}
        records={records}
        allSubjects={subjects}
        isProxy={pendingStatus === "proxy"}
        initialData={pendingItem}
        selectedDate={selectedDate}
        mockEndTimeIso={pendingItem?.mockEndTimeIso}
        onConfirm={handleConfirmTimer}
        onDiscard={handleDiscardTimer}
        onCancel={handleCancelTimer}
      />

      <SemesterSwitchSheet
        visible={semesterSheetVisible}
        onClose={() => setSemesterSheetVisible(false)}
        onSwitch={loadData}
      />

      <ExpandedAttendanceSheet
        visible={expandedAttendanceVisible}
        onClose={() => setExpandedAttendanceVisible(false)}
        subjects={subjects}
        records={records}
      />

      {/* ─── Hero Gauge Section ─── */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={["rgba(99, 102, 241, 0.08)", "rgba(12, 17, 28, 0.8)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroContent}>
            {/* Main Gauge */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setExpandedAttendanceVisible(true)} style={{ alignItems: 'center' }}>
              <AttendanceGauge
                percentage={stats.overallPercentage}
                threshold={stats.defaultThreshold}
                size={180}
                strokeWidth={14}
                animated={true}
                animationDuration={1500}
                label="OVERALL"
              />
            </TouchableOpacity>

            {/* Status text below gauge */}
            <View style={styles.heroStatus}>
              <View
                style={[
                  styles.heroStatusBadge,
                  {
                    backgroundColor:
                      overallStatus === "safe"
                        ? gaugeColors.safe + "18"
                        : overallStatus === "warning"
                          ? gaugeColors.warning + "18"
                          : gaugeColors.danger + "18",
                  },
                ]}
              >
                <View
                  style={[
                    styles.heroStatusDot,
                    {
                      backgroundColor:
                        overallStatus === "safe"
                          ? gaugeColors.safe
                          : overallStatus === "warning"
                            ? gaugeColors.warning
                            : gaugeColors.danger,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.heroStatusText,
                    {
                      color:
                        overallStatus === "safe"
                          ? gaugeColors.safe
                          : overallStatus === "warning"
                            ? gaugeColors.warning
                            : gaugeColors.danger,
                    },
                  ]}
                >
                  {overallStatus === "safe"
                    ? `On Track — Keep it up!`
                    : overallStatus === "warning"
                      ? "Borderline — Be careful"
                      : "Below Target — Attend more classes"}
                </Text>
              </View>
            </View>
          </View>

          {/* Threshold line */}
          <View style={styles.thresholdRow}>
            <View style={styles.thresholdLine} />
            <Text style={styles.thresholdText}>
              Target: {stats.defaultThreshold}%
            </Text>
            <View style={styles.thresholdLine} />
          </View>
        </LinearGradient>
      </View>

      {/* ─── Quick Stats ─── */}
      <View style={styles.section}>
        <QuickStatsBar stats={stats} />
      </View>

      {/* ─── Today's Schedule ─── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedDate === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) 
              ? "Today's Schedule" 
              : "Schedule"}
          </Text>
          {!isHoliday && (
            <Text style={styles.sectionBadge}>
              {todayCompleted}/{todayTotal}
            </Text>
          )}
        </View>

        {isHoliday ? (
          <View style={{ backgroundColor: '#f0fdf4', padding: 24, borderRadius: 16, alignItems: 'center', borderColor: '#bbf7d0', borderWidth: 1, marginTop: 8 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: '#166534', marginBottom: 8, textAlign: 'center' }}>
              {holidayData ? holidayData.title : "It's Sunday!"}
            </Text>
            <Text style={{ fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: '#15803d', textAlign: 'center', lineHeight: 20 }}>
              Enjoy your day off! No classes scheduled for today. Kick back, relax, and have a great time!
            </Text>
          </View>
        ) : (
          <View style={styles.scheduleList}>
            {todayScheduleItems.length === 0 ? (
              <Text style={{ color: textColors.tertiary, fontFamily: fontFamily.regular, fontStyle: 'italic', paddingVertical: spacing.md }}>
                No classes scheduled for today.
              </Text>
            ) : todayScheduleItems.map((item) => (
            <View
              key={item.id}
              style={[styles.scheduleCard, { borderLeftColor: item.color }]}
            >
              <View style={styles.scheduleCardHeader}>
                <View style={styles.scheduleSubjectInfo}>
                  <Text style={styles.scheduleSubjectShort}>
                    {item.subjectShortName}
                  </Text>
                  <Text style={styles.scheduleTimeText}>
                    {item.startTime} - {item.endTime}
                  </Text>
                </View>
                {item.roomNumber ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.scheduleRoomText}>
                      Room {item.roomNumber}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        DeviceEventEmitter.emit('navigate_tab', 'campus_map');
                        DeviceEventEmitter.emit('NAVIGATE_TO_MAP', { roomNumber: item.roomNumber });
                      }}
                      style={{ padding: 4, borderRadius: 12, backgroundColor: accent.primarySurface }}
                    >
                      <Ionicons name="map-outline" size={14} color={accent.primary} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              <View style={styles.actionsRow}>
                  <TouchableOpacity
                    disabled={!!markingIds[item.id]}
                    onPress={() => handleMarkAttendance(item, "present")}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: item.recordStatus === "present" ? attendance.present.base : attendance.present.surface, borderColor: attendance.present.base },
                      markingIds[item.id] && { opacity: 0.5 },
                    ]}
                  >
                    <Text
                      style={{
                        color: item.recordStatus === "present" ? "#fff" : attendance.present.base,
                        fontFamily: fontFamily.bold,
                        fontSize: 12,
                      }}
                    >
                      Present
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={!!markingIds[item.id]}
                    onPress={() => handleMarkAttendance(item, "absent")}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: item.recordStatus === "absent" ? attendance.absent.base : attendance.absent.surface, borderColor: attendance.absent.base },
                      markingIds[item.id] && { opacity: 0.5 },
                    ]}
                  >
                    <Text
                      style={{
                        color: item.recordStatus === "absent" ? "#fff" : attendance.absent.base,
                        fontFamily: fontFamily.bold,
                        fontSize: 12,
                      }}
                    >
                      Absent
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={!!markingIds[item.id]}
                    onPress={() => handleMarkAttendance(item, "proxy")}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: item.recordStatus === "proxy" ? "#3b82f6" : "rgba(59, 130, 246, 0.12)", borderColor: "#3b82f6" },
                      markingIds[item.id] && { opacity: 0.5 },
                    ]}
                  >
                    <Text
                      style={{
                        color: item.recordStatus === "proxy" ? "#fff" : "#3b82f6",
                        fontFamily: fontFamily.bold,
                        fontSize: 12,
                      }}
                    >
                      Proxy
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={!!markingIds[item.id]}
                    onPress={() => handleMarkAttendance(item, "cancelled")}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: item.recordStatus === "cancelled" ? attendance.cancelled.base : attendance.cancelled.surface, borderColor: attendance.cancelled.base },
                      markingIds[item.id] && { opacity: 0.5 },
                    ]}
                  >
                    <Text
                      style={{
                        color: item.recordStatus === "cancelled" ? "#fff" : attendance.cancelled.base,
                        fontFamily: fontFamily.bold,
                        fontSize: 12,
                      }}
                    >
                      Cancelled
                    </Text>
                  </TouchableOpacity>
                </View>
                {item.recordStatus && (
                  <View style={{flexDirection: "row", justifyContent: "flex-end", marginTop: 8}}>
                    <TouchableOpacity
                      onPress={() => handleResetAttendance(item.recordId!)}
                      style={styles.resetBtn}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={14}
                        color={textColors.tertiary}
                      />
                      <Text style={{ fontSize: 12, color: textColors.tertiary, marginLeft: 4 }}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
            </View>
          ))}

          {todayScheduleItems.length === 0 && (
            <Text
              style={{
                color: textColors.tertiary,
                padding: spacing.md,
                fontFamily: fontFamily.regular,
              }}
            >
              No schedule for today.
            </Text>
            )}
          </View>
        )}
        </View>

      {/* 📘 All Subjects 📘 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Subjects</Text>
          <Text style={styles.sectionMeta}>{subjects.length} total</Text>
        </View>

        <View style={styles.subjectsList}>
          {(() => {
            const todaySubjectIds = new Set(todayScheduleItems.map(i => i.subjectId));
            
            if (subjects.length === 0) {
              return (
                <Text style={{ color: textColors.tertiary, padding: spacing.md, fontFamily: fontFamily.regular }}>
                  No subjects added yet.
                </Text>
              );
            }
            
            return subjects
            .sort((a, b) => {
              const aRecords = records.filter((r) => r.subject_id === a.id);
              const bRecords = records.filter((r) => r.subject_id === b.id);
              const pA = calculatePercentage(
                aRecords.filter((r) => r.status === "present").length,
                aRecords.filter((r) => r.status !== "cancelled").length,
              );
              const pB = calculatePercentage(
                bRecords.filter((r) => r.status === "present").length,
                bRecords.filter((r) => r.status !== "cancelled").length,
              );
              return pA - pB;
            })
            .map((subject) => {
              const subjectRecords = records.filter(
                (r) => r.subject_id === subject.id,
              );
              
              const mappedSubject = {
                id: subject.id,
                name: subject.name,
                shortName: subject.short_name,
                color: subject.color,
                threshold: subject.target_threshold,
                totalAttended: subjectRecords.filter(
                  (r) => r.status === "present",
                ).length,
                totalConducted: subjectRecords.filter(
                  (r) => r.status !== "cancelled",
                ).length,
                totalMissed: subjectRecords.filter(
                  (r) => r.status === "absent",
                ).length,
                totalCancelled: subjectRecords.filter(
                  (r) => r.status === "cancelled",
                ).length,
              };

              // Only show start timer if this subject is scheduled today
              const isScheduledToday = todaySubjectIds.has(subject.id);

              return (
                <SubjectCard
                    key={subject.id}
                    subject={mappedSubject as any}
                    onStartTimer={handleStartTimer}
                    showStartTimer={isScheduledToday && !isHoliday}
                  />
              );
            });
          })()}
        </View>
      </View>

      {/* Bottom padding for nav bar */}
      <View style={{ height: layout.bottomNavHeight + spacing["2xl"] }} />
    </ScrollView>

    <DatePickerSheet
      visible={showDatePicker}
      initialDate={selectedDate}
      minDate={activeSemester?.start_date}
      onClose={() => setShowDatePicker(false)}
      onSelect={(date) => {
        setShowDatePicker(false);
        setSelectedDate(date);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: canvas.base,
  },
  scrollContent: {
    paddingTop: Platform.OS === "web" ? spacing["2xl"] : spacing.lg,
  },

  // ── Header
  header: {
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.xl,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize["2xl"],
    color: textColors.primary,
    marginBottom: spacing.xs,
  },
  dateText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    color: textColors.secondary,
  },
  dateNavigator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: glass.medium,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: border.default,
  },
  dateNavButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.xs,
  },
  dateNavText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: textColors.primary,
    marginHorizontal: spacing.xs,
  },
  dateNavCurrent: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: textColors.primary,
    marginHorizontal: spacing.md,
  },
  semesterBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: glass.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: border.default,
  },
  semesterText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    color: textColors.secondary,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  semesterEditButton: {
    padding: 2,
  },

  // ── Hero Gauge
  heroSection: {
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.xl,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.18)",
    borderRadius: radius.xl,
    padding: spacing["2xl"],
    alignItems: "center",
    ...shadow.glow("rgba(99, 102, 241, 0.1)"),
  },
  heroContent: {
    alignItems: "center",
    gap: spacing.lg,
  },
  gaugeCenter: {
    alignItems: "center",
  },
  gaugePercentage: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize["3xl"],
    color: textColors.primary,
    letterSpacing: -1,
  },
  gaugeLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: textColors.tertiary,
    letterSpacing: 2,
    marginTop: 2,
  },
  heroStatus: {
    alignItems: "center",
  },
  heroStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    gap: spacing.sm,
  },
  heroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroStatusText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
  },
  thresholdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: "100%",
  },
  thresholdLine: {
    flex: 1,
    height: 1,
    backgroundColor: border.default,
  },
  thresholdText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
    letterSpacing: 0.5,
  },

  // ── Section
  section: {
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...textStyle.sectionTitle,
    color: textColors.primary,
  },
  sectionBadge: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: accent.secondary,
  },
  sectionMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: textColors.tertiary,
  },

  // ── Schedule
  scheduleList: {
    gap: spacing.md,
  },
  scheduleCard: {
    backgroundColor: glass.medium,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    gap: spacing.sm,
  },
  scheduleCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scheduleSubjectInfo: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  scheduleSubjectShort: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: textColors.primary,
  },
  scheduleTimeText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  scheduleRoomText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 4,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  resetBtn: { flexDirection: "row", alignItems: "center", padding: 4 },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: 4,
  },
  actionBtn: {
    width: "48%", // 2x2 grid
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Subjects
  subjectsList: {
    gap: spacing.sm + 2,
  },
});
