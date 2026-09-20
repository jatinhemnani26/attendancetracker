import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import {
  canvas,
  glass,
  border,
  text as textColors,
  accent,
  palette,
  gauge,
  heat,
  shadow,
} from "../theme/colors";
import { fontFamily, fontSize } from "../theme/typography";
import { spacing, radius, layout } from "../theme/spacing";
import { DatabaseService } from "../services/DatabaseService";
import { Database } from "../lib/database.types";

type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
type RecordRow = Database["public"]["Tables"]["attendance_records"]["Row"];
type TimetableSlot = Database["public"]["Tables"]["timetable_slots"]["Row"];
type SemesterRow = Database["public"]["Tables"]["academic_semesters"]["Row"];

interface SavedBunkPlan {
  id: string;
  name: string;
  createdAt: string;
  targetEndDate: string;
  simulatedHolidays: string[];
  simulatedBunks: Record<string, "all" | string[]>; // date -> 'all' or slot IDs
}

const STORAGE_KEY = "@attendance_saved_bunk_plans_v1";

interface CalendarPlannerViewProps {
  subjects: SubjectRow[];
  records: RecordRow[];
  holidays: any[];
  activeSemester: SemesterRow | null;
  onRefreshData?: () => void;
}

export default function CalendarPlannerView({
  subjects,
  records,
  holidays,
  activeSemester,
}: CalendarPlannerViewProps) {
  // --- Timetable Slots State ---
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);

  // --- Horizon Target End Date ---
  const defaultEndDate = useMemo(() => {
    if (activeSemester?.end_date) {
      return activeSemester.end_date.slice(0, 10);
    }
    // Fallback: 75 days from today
    const d = new Date();
    d.setDate(d.getDate() + 75);
    return d.toISOString().slice(0, 10);
  }, [activeSemester]);

  const [targetEndDate, setTargetEndDate] = useState<string>(defaultEndDate);
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [tempEndDateInput, setTempEndDateInput] = useState(defaultEndDate);

  // --- Calendar Month Navigation ---
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // --- Simulation State ---
  // date strings: Set of 'YYYY-MM-DD'
  const [simulatedHolidays, setSimulatedHolidays] = useState<Set<string>>(new Set());
  // date -> 'all' (entire day) or string[] of slot IDs
  const [simulatedBunks, setSimulatedBunks] = useState<Record<string, "all" | string[]>>({});

  // --- Day Action Modal State ---
  const [selectedDateModal, setSelectedDateModal] = useState<string | null>(null);
  const [dayModalMode, setDayModalMode] = useState<"choose" | "slots">("choose");

  // --- Subject Impact Breakdown Modal ---
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // --- Saved Plans State ---
  const [savedPlans, setSavedPlans] = useState<SavedBunkPlan[]>([]);
  const [showSavedPlansModal, setShowSavedPlansModal] = useState(false);
  const [showSavePromptModal, setShowSavePromptModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");

  // Load Timetable slots on mount or when semester changes
  useEffect(() => {
    let isMounted = true;
    async function loadSlots() {
      if (!activeSemester) return;
      setIsLoadingSlots(true);
      try {
        const slots = await DatabaseService.fetchTimetable(activeSemester.id);
        if (isMounted) setTimetableSlots(slots || []);
      } catch (e) {
        console.warn("Failed to load timetable slots for simulator:", e);
      } finally {
        if (isMounted) setIsLoadingSlots(false);
      }
    }
    loadSlots();
    return () => {
      isMounted = false;
    };
  }, [activeSemester]);

  // Load Saved Plans from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        try {
          setSavedPlans(JSON.parse(data));
        } catch (e) {}
      }
    });
  }, []);

  const savePlansToStorage = async (plans: SavedBunkPlan[]) => {
    setSavedPlans(plans);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  };

  // Set of Official Holidays strings (from DB)
  const officialHolidaysSet = useMemo(() => {
    const set = new Set<string>();
    holidays.forEach((h) => {
      if (h.date) set.add(h.date.slice(0, 10));
      if (h.start_date && h.end_date) {
        let cur = new Date(h.start_date);
        const end = new Date(h.end_date);
        while (cur <= end) {
          set.add(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
      }
    });
    return set;
  }, [holidays]);

  // --- Core Horizon Calculation Engine ---
  const simulationResults = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(targetEndDate);
    endDate.setHours(23, 59, 59, 999);

    // Subject stats mapping: subjectId -> stats
    const stats: Record<
      string,
      {
        realAttended: number;
        realConducted: number;
        simAttended: number;
        simConducted: number;
        totalAttended: number;
        totalConducted: number;
        currentPercentage: number;
        projectedPercentage: number;
        threshold: number;
        bunkedCount: number;
      }
    > = {};

    subjects.forEach((s) => {
      const subRecords = records.filter((r) => r.subject_id === s.id);
      const rConducted = subRecords.filter((r) => r.status !== "cancelled").length;
      const rAttended = subRecords.filter((r) => r.status === "present").length;
      const curPct = rConducted === 0 ? 0 : Math.round((rAttended / rConducted) * 100);

      stats[s.id] = {
        realAttended: rAttended,
        realConducted: rConducted,
        simAttended: 0,
        simConducted: 0,
        totalAttended: rAttended,
        totalConducted: rConducted,
        currentPercentage: curPct,
        projectedPercentage: curPct,
        threshold: s.target_threshold || 75,
        bunkedCount: 0,
      };
    });

    let totalFutureWorkingDays = 0;
    let totalSimulatedHolidays = 0;
    let totalSimulatedBunks = 0;

    // Iterate through all days from tomorrow up to targetEndDate
    const curDay = new Date(today);
    curDay.setDate(curDay.getDate() + 1); // Start from tomorrow

    while (curDay <= endDate) {
      const dayStr = curDay.toISOString().slice(0, 10);
      const dayOfWeek = curDay.getDay(); // 0 is Sunday

      // 1. Check if Sunday -> Excluded (Weekend)
      if (dayOfWeek === 0) {
        curDay.setDate(curDay.getDate() + 1);
        continue;
      }

      // 2. Check if Official Holiday from DB -> Excluded
      if (officialHolidaysSet.has(dayStr)) {
        curDay.setDate(curDay.getDate() + 1);
        continue;
      }

      // 3. Check if User Simulated Holiday -> Excluded
      if (simulatedHolidays.has(dayStr)) {
        totalSimulatedHolidays++;
        curDay.setDate(curDay.getDate() + 1);
        continue;
      }

      // 4. Normal Working Day: Resolve timetable slots for this day of week
      const daySlots = timetableSlots.filter((slot) => slot.day_of_week === dayOfWeek);

      if (daySlots.length > 0) {
        totalFutureWorkingDays++;
      }

      const bunkEntry = simulatedBunks[dayStr];

      daySlots.forEach((slot) => {
        if (!stats[slot.subject_id]) return;

        let isBunked = false;
        if (bunkEntry === "all") {
          isBunked = true;
        } else if (Array.isArray(bunkEntry) && bunkEntry.includes(slot.id)) {
          isBunked = true;
        }

        if (isBunked) {
          // Bunked: College conducted it, student skipped it
          stats[slot.subject_id].simConducted += 1;
          stats[slot.subject_id].bunkedCount += 1;
          totalSimulatedBunks++;
        } else {
          // Default Study Day: College conducted, student attended
          stats[slot.subject_id].simConducted += 1;
          stats[slot.subject_id].simAttended += 1;
        }
      });

      curDay.setDate(curDay.getDate() + 1);
    }

    // Finalize subject percentages & cumulative metrics
    let totalOverallConducted = 0;
    let totalOverallAttended = 0;
    let totalCurrentOverallConducted = 0;
    let totalCurrentOverallAttended = 0;

    Object.keys(stats).forEach((subId) => {
      const s = stats[subId];
      s.totalAttended = s.realAttended + s.simAttended;
      s.totalConducted = s.realConducted + s.simConducted;
      s.projectedPercentage =
        s.totalConducted === 0 ? 0 : Math.round((s.totalAttended / s.totalConducted) * 100);

      totalOverallAttended += s.totalAttended;
      totalOverallConducted += s.totalConducted;
      totalCurrentOverallAttended += s.realAttended;
      totalCurrentOverallConducted += s.realConducted;
    });

    const currentOverallPercentage =
      totalCurrentOverallConducted === 0
        ? 0
        : Math.round((totalCurrentOverallAttended / totalCurrentOverallConducted) * 100);

    const projectedOverallPercentage =
      totalOverallConducted === 0
        ? 0
        : Math.round((totalOverallAttended / totalOverallConducted) * 100);

    return {
      subjectStats: stats,
      totalFutureWorkingDays,
      totalSimulatedHolidays,
      totalSimulatedBunks,
      currentOverallPercentage,
      projectedOverallPercentage,
    };
  }, [
    subjects,
    records,
    timetableSlots,
    officialHolidaysSet,
    simulatedHolidays,
    simulatedBunks,
    targetEndDate,
  ]);

  // --- Calendar Month Grid Math ---
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust so Monday is 0: Sunday becomes 6
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isPast: boolean;
      isSunday: boolean;
      isOfficialHoliday: boolean;
      isSimulatedHoliday: boolean;
      bunkType: "none" | "all" | "partial";
      hasSlots: boolean;
      slotCount: number;
    }[] = [];

    // Empty padding days for previous month
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push({
        dateStr: `pad_prev_${i}`,
        dayNum: 0,
        isCurrentMonth: false,
        isPast: true,
        isSunday: false,
        isOfficialHoliday: false,
        isSimulatedHoliday: false,
        bunkType: "none",
        hasSlots: false,
        slotCount: 0,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = dateObj.toISOString().slice(0, 10);
      const isSunday = dateObj.getDay() === 0;
      const isPast = dateStr <= todayStr;
      const isOffHoli = officialHolidaysSet.has(dateStr);
      const isSimHoli = simulatedHolidays.has(dateStr);

      const bunk = simulatedBunks[dateStr];
      let bunkType: "none" | "all" | "partial" = "none";
      if (bunk === "all") bunkType = "all";
      else if (Array.isArray(bunk) && bunk.length > 0) bunkType = "partial";

      const dayOfWeek = dateObj.getDay();
      const slots = timetableSlots.filter((s) => s.day_of_week === dayOfWeek);

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isPast,
        isSunday,
        isOfficialHoliday: isOffHoli,
        isSimulatedHoliday: isSimHoli,
        bunkType,
        hasSlots: slots.length > 0,
        slotCount: slots.length,
      });
    }

    return days;
  }, [
    currentMonthDate,
    todayStr,
    officialHolidaysSet,
    simulatedHolidays,
    simulatedBunks,
    timetableSlots,
  ]);

  // Handle Day Tap
  const handleDayPress = (day: (typeof calendarDays)[0]) => {
    if (!day.isCurrentMonth) return;
    if (day.isPast) {
      Alert.alert("Past Date", "Simulations can only forecast present and future dates.");
      return;
    }
    if (day.isSunday) {
      Alert.alert("Sunday / Weekly Off", "No classes are scheduled on Sundays.");
      return;
    }
    if (day.isOfficialHoliday) {
      Alert.alert("Official Holiday", "College is officially closed on this day.");
      return;
    }

    setSelectedDateModal(day.dateStr);
    setDayModalMode("choose");
  };

  // Action: Mark as Holiday
  const handleMarkAsHoliday = () => {
    if (!selectedDateModal) return;
    setSimulatedHolidays((prev) => {
      const next = new Set(prev);
      next.add(selectedDateModal);
      return next;
    });
    // Remove any bunks for this day
    setSimulatedBunks((prev) => {
      const copy = { ...prev };
      delete copy[selectedDateModal];
      return copy;
    });
    setSelectedDateModal(null);
  };

  // Action: Reset Date to Normal Study Day
  const handleResetDay = () => {
    if (!selectedDateModal) return;
    setSimulatedHolidays((prev) => {
      const next = new Set(prev);
      next.delete(selectedDateModal);
      return next;
    });
    setSimulatedBunks((prev) => {
      const copy = { ...prev };
      delete copy[selectedDateModal];
      return copy;
    });
    setSelectedDateModal(null);
  };

  // Action: Bunk All Slots on Date
  const handleBunkEntireDay = () => {
    if (!selectedDateModal) return;
    setSimulatedHolidays((prev) => {
      const next = new Set(prev);
      next.delete(selectedDateModal);
      return next;
    });
    setSimulatedBunks((prev) => ({
      ...prev,
      [selectedDateModal]: "all",
    }));
    setSelectedDateModal(null);
  };

  // Action: Toggle Individual Slot on Date
  const handleToggleSlot = (slotId: string, daySlots: TimetableSlot[]) => {
    if (!selectedDateModal) return;
    setSimulatedHolidays((prev) => {
      const next = new Set(prev);
      next.delete(selectedDateModal);
      return next;
    });

    setSimulatedBunks((prev) => {
      const current = prev[selectedDateModal];
      let activeBunkSlots: string[] = [];

      if (current === "all") {
        // Was all bunked, now toggling one slot means all except this one are bunked
        activeBunkSlots = daySlots.map((s) => s.id).filter((id) => id !== slotId);
      } else if (Array.isArray(current)) {
        if (current.includes(slotId)) {
          activeBunkSlots = current.filter((id) => id !== slotId);
        } else {
          activeBunkSlots = [...current, slotId];
        }
      } else {
        // Was normal, now toggling this slot means it's the only one bunked
        activeBunkSlots = [slotId];
      }

      if (activeBunkSlots.length === 0) {
        const copy = { ...prev };
        delete copy[selectedDateModal];
        return copy;
      }
      if (activeBunkSlots.length === daySlots.length) {
        return { ...prev, [selectedDateModal]: "all" };
      }
      return { ...prev, [selectedDateModal]: activeBunkSlots };
    });
  };

  // Save Current Plan to AsyncStorage
  const handleSaveCurrentPlan = async () => {
    if (!newPlanName.trim()) {
      Alert.alert("Name Required", "Please enter a name for this bunk plan.");
      return;
    }
    const newPlan: SavedBunkPlan = {
      id: "plan_" + Date.now(),
      name: newPlanName.trim(),
      createdAt: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      targetEndDate,
      simulatedHolidays: Array.from(simulatedHolidays),
      simulatedBunks,
    };
    const updated = [newPlan, ...savedPlans];
    await savePlansToStorage(updated);
    setNewPlanName("");
    setShowSavePromptModal(false);
    Alert.alert("Plan Saved", `"${newPlan.name}" saved securely in local sandbox.`);
  };

  // Load a Saved Plan
  const handleLoadPlan = (plan: SavedBunkPlan) => {
    setTargetEndDate(plan.targetEndDate);
    setSimulatedHolidays(new Set(plan.simulatedHolidays));
    setSimulatedBunks(plan.simulatedBunks);
    setShowSavedPlansModal(false);
  };

  // Delete a Saved Plan
  const handleDeletePlan = async (id: string) => {
    const updated = savedPlans.filter((p) => p.id !== id);
    await savePlansToStorage(updated);
  };

  // Clear All Simulation in Active Sandbox
  const handleResetAllSimulations = () => {
    Alert.alert(
      "Reset Sandbox",
      "Are you sure you want to clear all marked bunks and holidays in this simulation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset All",
          style: "destructive",
          onPress: () => {
            setSimulatedHolidays(new Set());
            setSimulatedBunks({});
          },
        },
      ]
    );
  };

  // Slots for currently selected date modal
  const selectedDaySlots = useMemo(() => {
    if (!selectedDateModal) return [];
    const d = new Date(selectedDateModal);
    const dayOfWeek = d.getDay();
    return timetableSlots.filter((s) => s.day_of_week === dayOfWeek);
  }, [selectedDateModal, timetableSlots]);

  const monthLabel = useMemo(() => {
    return currentMonthDate.toLocaleString("default", { month: "long", year: "numeric" });
  }, [currentMonthDate]);

  return (
    <View style={styles.container}>
      {/* Sandbox Isolation Notice */}
      <View style={styles.sandboxNoticeBanner}>
        <Ionicons name="shield-checkmark" size={15} color={accent.primary} />
        <Text style={styles.sandboxNoticeText}>
          Sandbox Active — Simulation is local. Official attendance records in Supabase remain untouched.
        </Text>
      </View>

      {/* Target Horizon Bar & Save Controls */}
      <View style={styles.horizonBar}>
        <View style={styles.horizonTargetWrapper}>
          <Text style={styles.horizonLabel}>Simulate Horizon:</Text>
          <TouchableOpacity
            style={styles.horizonPill}
            onPress={() => {
              setTempEndDateInput(targetEndDate);
              setShowEndDateModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={14} color={accent.primary} />
            <Text style={styles.horizonPillText}>Until: {targetEndDate}</Text>
            <Ionicons name="pencil" size={12} color={textColors.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.planActionBtns}>
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => setShowSavePromptModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="save-outline" size={14} color={accent.primary} />
            <Text style={styles.planBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => setShowSavedPlansModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="folder-open-outline" size={14} color={textColors.secondary} />
            <Text style={styles.planBtnText}>Plans ({savedPlans.length})</Text>
          </TouchableOpacity>
          {(simulatedHolidays.size > 0 || Object.keys(simulatedBunks).length > 0) && (
            <TouchableOpacity
              style={[styles.planBtn, styles.planBtnReset]}
              onPress={handleResetAllSimulations}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={13} color={palette.red[500]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Month Navigator Header */}
      <View style={styles.monthNavRow}>
        <TouchableOpacity
          style={styles.monthNavArrow}
          onPress={() => {
            const prev = new Date(currentMonthDate);
            prev.setMonth(prev.getMonth() - 1);
            setCurrentMonthDate(prev);
          }}
        >
          <Ionicons name="chevron-back" size={18} color={textColors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthTitleText}>{monthLabel}</Text>
        <TouchableOpacity
          style={styles.monthNavArrow}
          onPress={() => {
            const next = new Date(currentMonthDate);
            next.setMonth(next.getMonth() + 1);
            setCurrentMonthDate(next);
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={textColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Weekday Labels Header */}
      <View style={styles.weekdayHeader}>
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
          <Text key={i} style={[styles.weekdayText, i === 6 && { color: palette.amber[500] }]}>
            {day}
          </Text>
        ))}
      </View>

      {/* Month Days Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, idx) => {
          if (!day.isCurrentMonth) {
            return <View key={day.dateStr} style={styles.emptyDayCell} />;
          }

          let cellBg: string = glass.subtle;
          let badgeText = "";
          let badgeColor = "";

          if (day.isSunday) {
            cellBg = "rgba(234, 179, 8, 0.08)";
            badgeText = "SUN";
            badgeColor = palette.amber[500];
          } else if (day.isOfficialHoliday) {
            cellBg = "rgba(59, 130, 246, 0.12)";
            badgeText = "HOLI";
            badgeColor = palette.blue[500];
          } else if (day.isSimulatedHoliday) {
            cellBg = "rgba(245, 158, 11, 0.15)";
            badgeText = "OFF";
            badgeColor = palette.amber[500];
          } else if (day.bunkType === "all") {
            cellBg = "rgba(239, 68, 68, 0.18)";
            badgeText = "BUNK";
            badgeColor = palette.red[500];
          } else if (day.bunkType === "partial") {
            cellBg = "rgba(249, 115, 22, 0.15)";
            badgeText = "PART";
            badgeColor = palette.orange[500];
          } else if (!day.isPast && day.hasSlots) {
            cellBg = "rgba(16, 185, 129, 0.07)";
          }

          return (
            <TouchableOpacity
              key={day.dateStr}
              style={[
                styles.dayCell,
                { backgroundColor: cellBg },
                day.isPast && styles.pastDayCell,
                day.bunkType === "all" && { borderColor: palette.red[500], borderWidth: 1 },
                day.bunkType === "partial" && { borderColor: palette.orange[500], borderWidth: 1 },
                day.isSimulatedHoliday && { borderColor: palette.amber[500], borderWidth: 1 },
              ]}
              onPress={() => handleDayPress(day)}
              activeOpacity={day.isPast ? 1 : 0.6}
            >
              <Text
                style={[
                  styles.dayNumText,
                  day.isPast && styles.pastDayNumText,
                  day.isSunday && { color: palette.amber[500] },
                ]}
              >
                {day.dayNum}
              </Text>

              {badgeText ? (
                <View style={[styles.microBadge, { backgroundColor: badgeColor }]}>
                  <Text style={styles.microBadgeText}>{badgeText}</Text>
                </View>
              ) : !day.isPast && day.hasSlots ? (
                <Text style={styles.slotsCountText}>{day.slotCount}L</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend Ribbon */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "rgba(16, 185, 129, 0.6)" }]} />
          <Text style={styles.legendLabel}>Study Day</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.red[500] }]} />
          <Text style={styles.legendLabel}>Bunk</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.orange[500] }]} />
          <Text style={styles.legendLabel}>Partial</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.amber[500] }]} />
          <Text style={styles.legendLabel}>Off/Holi</Text>
        </View>
      </View>

      {/* Sticky Bottom Impact Dock */}
      <View style={styles.impactDock}>
        <View style={styles.impactSummaryLeft}>
          <Text style={styles.impactTitle}>Projected Overall</Text>
          <View style={styles.impactPercentageRow}>
            <Text style={styles.currentPctText}>
              {simulationResults.currentOverallPercentage}%
            </Text>
            <Ionicons name="arrow-forward" size={14} color={textColors.tertiary} style={{ marginHorizontal: 4 }} />
            <Text
              style={[
                styles.projectedPctText,
                {
                  color:
                    simulationResults.projectedOverallPercentage >= 85
                      ? gauge.safe
                      : simulationResults.projectedOverallPercentage >= 75
                      ? gauge.warning
                      : gauge.critical,
                },
              ]}
            >
              {simulationResults.projectedOverallPercentage}%
            </Text>
          </View>
          <Text style={styles.impactSubDetail}>
            {simulationResults.totalSimulatedBunks} bunks • {simulationResults.totalSimulatedHolidays} off-days
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewBreakdownBtn}
          onPress={() => setShowBreakdownModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.viewBreakdownBtnText}>Breakdown</Text>
          <Ionicons name="chevron-forward" size={14} color={palette.white} />
        </TouchableOpacity>
      </View>

      {/* --- MODAL 1: Day Action Modal (Holiday / Bunk / Reset) --- */}
      <Modal visible={!!selectedDateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalDateTitle}>{selectedDateModal}</Text>
                <Text style={styles.modalDateSub}>
                  {selectedDaySlots.length} classes scheduled on timetable
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDateModal(null)}>
                <Ionicons name="close" size={22} color={textColors.tertiary} />
              </TouchableOpacity>
            </View>

            {dayModalMode === "choose" ? (
              <View style={styles.chooseActionList}>
                <TouchableOpacity
                  style={styles.actionOptionCard}
                  onPress={handleMarkAsHoliday}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                    <Ionicons name="sunny-outline" size={20} color={palette.amber[500]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionOptionTitle}>Mark as Holiday / Off-Day</Text>
                    <Text style={styles.actionOptionDesc}>
                      College closed or mass bunk. Zero classes conducted or counted.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionOptionCard}
                  onPress={() => setDayModalMode("slots")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                    <Ionicons name="close-circle-outline" size={20} color={palette.red[500]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionOptionTitle}>Bunk Day / Select Lectures</Text>
                    <Text style={styles.actionOptionDesc}>
                      Skip full day or toggle individual lecture/lab slots.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionOptionCard}
                  onPress={handleResetDay}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={palette.emerald[500]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionOptionTitle}>Reset to Normal Study Day</Text>
                    <Text style={styles.actionOptionDesc}>
                      Default state: you attend all scheduled classes on this day.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              /* Slots Toggle Mode */
              <View style={styles.slotsListContainer}>
                <View style={styles.slotsQuickActionsRow}>
                  <TouchableOpacity style={styles.slotQuickBtn} onPress={handleBunkEntireDay}>
                    <Text style={styles.slotQuickBtnText}>Bunk Whole Day</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.slotQuickBtn} onPress={handleResetDay}>
                    <Text style={styles.slotQuickBtnText}>Attend All</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {selectedDaySlots.map((slot) => {
                    const subject = subjects.find((s) => s.id === slot.subject_id);
                    const currentBunk = selectedDateModal
                      ? simulatedBunks[selectedDateModal]
                      : undefined;
                    const isBunked =
                      currentBunk === "all" ||
                      (Array.isArray(currentBunk) && currentBunk.includes(slot.id));

                    return (
                      <View key={slot.id} style={styles.slotItemCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.slotSubjectName} numberOfLines={1}>
                            {subject?.name || "Subject"}
                          </Text>
                          <Text style={styles.slotTimeText}>
                            {slot.start_time} - {slot.end_time} • Room {slot.room_number || "TBA"}
                          </Text>
                          <View style={styles.slotTypeBadge}>
                            <Text style={styles.slotTypeText}>
                              {(slot.class_type || "theory").toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.slotToggleBtn,
                            isBunked ? styles.slotToggleBunked : styles.slotToggleAttending,
                          ]}
                          onPress={() => handleToggleSlot(slot.id, selectedDaySlots)}
                        >
                          <Text
                            style={[
                              styles.slotToggleBtnText,
                              isBunked && { color: palette.red[500] },
                            ]}
                          >
                            {isBunked ? "Bunking ❌" : "Attending ✅"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={styles.doneModalBtn}
                  onPress={() => setSelectedDateModal(null)}
                >
                  <Text style={styles.doneModalBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* --- MODAL 2: Subject Impact Breakdown --- */}
      <Modal visible={showBreakdownModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.actionModalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalDateTitle}>Subject Breakdown</Text>
                <Text style={styles.modalDateSub}>
                  Projected attendance by horizon ({targetEndDate})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowBreakdownModal(false)}>
                <Ionicons name="close" size={22} color={textColors.tertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.md }}>
              {subjects.map((sub) => {
                const s = simulationResults.subjectStats[sub.id];
                if (!s) return null;
                const isSafe = s.projectedPercentage >= s.threshold;
                const delta = s.projectedPercentage - s.currentPercentage;

                return (
                  <View key={sub.id} style={styles.breakdownRow}>
                    <View style={{ flex: 1, paddingRight: spacing.sm }}>
                      <Text style={styles.breakdownSubName} numberOfLines={1}>
                        {sub.name}
                      </Text>
                      <Text style={styles.breakdownDetailText}>
                        Attended: {s.totalAttended}/{s.totalConducted} • Bunked: {s.bunkedCount} slots
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={styles.breakdownCurPct}>{s.currentPercentage}%</Text>
                        <Ionicons name="arrow-forward" size={12} color={textColors.disabled} />
                        <Text
                          style={[
                            styles.breakdownProjPct,
                            {
                              color:
                                s.projectedPercentage >= 85
                                  ? gauge.safe
                                  : s.projectedPercentage >= 75
                                  ? gauge.warning
                                  : gauge.critical,
                            },
                          ]}
                        >
                          {s.projectedPercentage}%
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.deltaPill,
                          {
                            backgroundColor:
                              delta >= 0
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.deltaPillText,
                            { color: delta >= 0 ? palette.emerald[500] : palette.red[500] },
                          ]}
                        >
                          {delta >= 0 ? `+${delta}%` : `${delta}%`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.doneModalBtn, { marginTop: spacing.lg }]}
              onPress={() => setShowBreakdownModal(false)}
            >
              <Text style={styles.doneModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 3: Edit Horizon End Date --- */}
      <Modal visible={showEndDateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalDateTitle}>Set Simulation Horizon</Text>
              <TouchableOpacity onPress={() => setShowEndDateModal(false)}>
                <Ionicons name="close" size={22} color={textColors.tertiary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDateSub}>
              All future days between tomorrow and this end date will be factored into the calculation.
            </Text>

            <TextInput
              style={styles.textInputStyle}
              value={tempEndDateInput}
              onChangeText={setTempEndDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={textColors.disabled}
              maxLength={10}
            />

            <View style={styles.quickHorizonPresets}>
              {[
                { label: "+2 Wks", days: 14 },
                { label: "+1 Mo", days: 30 },
                { label: "+2 Mo", days: 60 },
                {
                  label: "Sem End",
                  days: null,
                },
              ].map((preset, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.presetPill}
                  onPress={() => {
                    if (preset.days === null) {
                      setTempEndDateInput(defaultEndDate);
                    } else {
                      const d = new Date();
                      d.setDate(d.getDate() + preset.days);
                      setTempEndDateInput(d.toISOString().slice(0, 10));
                    }
                  }}
                >
                  <Text style={styles.presetPillText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.doneModalBtn}
              onPress={() => {
                if (!tempEndDateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  Alert.alert("Invalid Format", "Please enter a valid date in YYYY-MM-DD format.");
                  return;
                }
                setTargetEndDate(tempEndDateInput);
                setShowEndDateModal(false);
              }}
            >
              <Text style={styles.doneModalBtnText}>Apply Horizon</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 4: Save Plan Prompt --- */}
      <Modal visible={showSavePromptModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalDateTitle}>Save Bunk Blueprint</Text>
              <TouchableOpacity onPress={() => setShowSavePromptModal(false)}>
                <Ionicons name="close" size={22} color={textColors.tertiary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDateSub}>
              Give this scenario a name to revisit or edit later.
            </Text>

            <TextInput
              style={styles.textInputStyle}
              value={newPlanName}
              onChangeText={setNewPlanName}
              placeholder="e.g. College Fest Leaves, Long Weekend"
              placeholderTextColor={textColors.disabled}
              autoFocus
            />

            <TouchableOpacity style={styles.doneModalBtn} onPress={handleSaveCurrentPlan}>
              <Text style={styles.doneModalBtnText}>Save Locally</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL 5: Saved Plans List --- */}
      <Modal visible={showSavedPlansModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.actionModalCard, { maxHeight: "75%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalDateTitle}>Saved Bunk Plans</Text>
              <TouchableOpacity onPress={() => setShowSavedPlansModal(false)}>
                <Ionicons name="close" size={22} color={textColors.tertiary} />
              </TouchableOpacity>
            </View>

            {savedPlans.length === 0 ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
                <Ionicons name="folder-open-outline" size={36} color={textColors.disabled} />
                <Text style={[styles.modalDateSub, { marginTop: spacing.sm }]}>
                  No saved plans yet.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                {savedPlans.map((plan) => (
                  <View key={plan.id} style={styles.savedPlanCard}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => handleLoadPlan(plan)}
                    >
                      <Text style={styles.savedPlanName}>{plan.name}</Text>
                      <Text style={styles.savedPlanMeta}>
                        Created: {plan.createdAt} • Target: {plan.targetEndDate}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ padding: spacing.xs }}
                      onPress={() => handleDeletePlan(plan.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color={palette.red[500]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.doneModalBtn, { marginTop: spacing.md }]}
              onPress={() => setShowSavedPlansModal(false)}
            >
              <Text style={styles.doneModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 100,
  },
  sandboxNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  sandboxNoticeText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: textColors.secondary,
    flex: 1,
  },
  horizonBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  horizonTargetWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  horizonLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
  },
  horizonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: glass.medium,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: border.default,
  },
  horizonPillText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: textColors.primary,
  },
  planActionBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  planBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: glass.medium,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: border.default,
  },
  planBtnReset: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  planBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.primary,
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  monthNavArrow: {
    padding: spacing.xs,
  },
  monthTitleText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: textColors.primary,
  },
  weekdayHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
    marginBottom: spacing.xs,
  },
  weekdayText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
    width: 38,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    rowGap: 6,
  },
  emptyDayCell: {
    width: 42,
    height: 48,
  },
  dayCell: {
    width: 42,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pastDayCell: {
    opacity: 0.35,
  },
  dayNumText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: textColors.primary,
  },
  pastDayNumText: {
    color: textColors.disabled,
  },
  microBadge: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  microBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 7,
    color: palette.white,
  },
  slotsCountText: {
    fontFamily: fontFamily.medium,
    fontSize: 8,
    color: textColors.tertiary,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 9,
    color: textColors.tertiary,
  },
  impactDock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: canvas.elevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: border.default,
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  impactSummaryLeft: {
    flex: 1,
  },
  impactTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    color: textColors.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  impactPercentageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  currentPctText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: textColors.secondary,
  },
  projectedPctText: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize.xl,
  },
  impactSubDetail: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: textColors.tertiary,
  },
  viewBreakdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: accent.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  viewBreakdownBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: palette.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  actionModalCard: {
    width: "100%",
    backgroundColor: canvas.elevated,
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: border.default,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  modalDateTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: textColors.primary,
  },
  modalDateSub: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
    marginTop: 2,
  },
  chooseActionList: {
    gap: spacing.sm,
  },
  actionOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: glass.medium,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: border.default,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionOptionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: textColors.primary,
  },
  actionOptionDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: textColors.secondary,
    marginTop: 2,
  },
  slotsListContainer: {
    gap: spacing.sm,
  },
  slotsQuickActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  slotQuickBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: glass.medium,
    alignItems: "center",
    borderWidth: 1,
    borderColor: border.default,
  },
  slotQuickBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  slotItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: glass.subtle,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: border.subtle,
  },
  slotSubjectName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: textColors.primary,
  },
  slotTimeText: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: textColors.tertiary,
  },
  slotTypeBadge: {
    backgroundColor: glass.medium,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  slotTypeText: {
    fontFamily: fontFamily.bold,
    fontSize: 8,
    color: accent.primary,
  },
  slotToggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  slotToggleAttending: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  slotToggleBunked: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: palette.red[500],
  },
  slotToggleBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: palette.emerald[500],
  },
  doneModalBtn: {
    backgroundColor: accent.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  doneModalBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: palette.white,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  breakdownSubName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: textColors.primary,
  },
  breakdownDetailText: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: textColors.tertiary,
    marginTop: 2,
  },
  breakdownCurPct: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  breakdownProjPct: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
  deltaPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  deltaPillText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
  },
  textInputStyle: {
    backgroundColor: glass.medium,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: textColors.primary,
    borderWidth: 1,
    borderColor: border.default,
    marginTop: spacing.sm,
  },
  quickHorizonPresets: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  presetPill: {
    flex: 1,
    paddingVertical: spacing.xs,
    backgroundColor: glass.medium,
    borderRadius: radius.full,
    alignItems: "center",
    borderWidth: 1,
    borderColor: border.default,
  },
  presetPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  savedPlanCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: glass.medium,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: border.default,
  },
  savedPlanName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: textColors.primary,
  },
  savedPlanMeta: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: textColors.tertiary,
    marginTop: 2,
  },
});
