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
  Vibration,
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

interface OptimizerCandidate {
  dateStr: string;
  dayNum: number;
  dayName: string;
  monthName: string;
  slots: TimetableSlot[];
  tier: 1 | 2 | 3;
  tierLabel: string;
  damageScore: number;
  minProjectedPct: number;
  summary: string;
  isFridayOrMonday: boolean;
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

  // --- Selected Date in Day Inspector (Default to tomorrow or today) ---
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  // --- Simulation State ---
  // date strings: Set of 'YYYY-MM-DD'
  const [simulatedHolidays, setSimulatedHolidays] = useState<Set<string>>(new Set());
  // date -> 'all' (entire day) or string[] of slot IDs
  const [simulatedBunks, setSimulatedBunks] = useState<Record<string, "all" | string[]>>({});

  // --- Smart Bunk Optimizer Sub-Feature State ---
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [chillDaysCount, setChillDaysCount] = useState<number>(2);

  // --- Modals ---
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
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

  // --- Intelligent "Smart Bunk Optimizer" Engine (Idea D) ---
  // Priority: 1. Preserves >=85% across all subjects
  //           2. Preserves >=75% across all subjects
  //           3. Least Damage Causable (avoids fragile subjects near 75%, avoids labs, favors low lecture days & long weekends)
  const optimizerSuggestions = useMemo<OptimizerCandidate[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(targetEndDate);
    endDate.setHours(23, 59, 59, 999);

    const candidates: OptimizerCandidate[] = [];
    const baseStats = simulationResults.subjectStats;

    const cur = new Date(today);
    cur.setDate(cur.getDate() + 1);

    while (cur <= endDate) {
      const dateStr = cur.toISOString().slice(0, 10);
      const dayOfWeek = cur.getDay();

      if (dayOfWeek === 0 || officialHolidaysSet.has(dateStr)) {
        cur.setDate(cur.getDate() + 1);
        continue;
      }

      const slots = timetableSlots.filter((s) => s.day_of_week === dayOfWeek);
      if (slots.length === 0) {
        cur.setDate(cur.getDate() + 1);
        continue;
      }

      const isFridayOrMonday = dayOfWeek === 1 || dayOfWeek === 5;

      let allAbove85 = true;
      let allAbove75 = true;
      let minPct = 100;
      let damageScore = 0;

      // Base penalty for class volume (favor lighter days)
      damageScore += slots.length * 10;

      // Bonus for extending weekend (consecutive rest is best)
      if (isFridayOrMonday) {
        damageScore -= 15;
      }

      const subjectSlotsCount: Record<string, number> = {};
      slots.forEach((s) => {
        subjectSlotsCount[s.subject_id] = (subjectSlotsCount[s.subject_id] || 0) + 1;
        const cType = (s.class_type as string) || "";
        if (cType === "lab" || cType === "practical") {
          damageScore += 35; // Missing lab classes causes high deficit
        }
      });

      // Assess impact on each subject if this full day is bunked
      Object.keys(baseStats).forEach((subId) => {
        const s = baseStats[subId];
        const extraBunks = subjectSlotsCount[subId] || 0;
        const hypotheticalAttended = s.totalAttended - extraBunks;
        const hypotheticalConducted = s.totalConducted;
        const hypoPct =
          hypotheticalConducted === 0
            ? 0
            : Math.round((hypotheticalAttended / hypotheticalConducted) * 100);

        if (hypoPct < minPct) minPct = hypoPct;
        if (hypoPct < 85) allAbove85 = false;
        if (hypoPct < 75) allAbove75 = false;

        const buffer = s.projectedPercentage - s.threshold;
        if (extraBunks > 0) {
          if (buffer <= 2) {
            damageScore += 80 * extraBunks; // Very fragile, near 75%
          } else if (buffer <= 5) {
            damageScore += 30 * extraBunks;
          } else if (buffer > 10) {
            damageScore -= 10 * extraBunks; // Healthy surplus buffer
          }
        }
      });

      let tier: 1 | 2 | 3 = 3;
      let tierLabel = "⚠️ Low Threshold / Risky";
      if (allAbove85) {
        tier = 1;
        tierLabel = "🛡️ Tier 1 (All ≥ 85%)";
      } else if (allAbove75) {
        tier = 2;
        tierLabel = "⚡ Tier 2 (All ≥ 75%)";
      }

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];

      const subNames = Array.from(
        new Set(
          slots.map((sl) => {
            const sub = subjects.find((s) => s.id === sl.subject_id);
            return sub?.name ? (sub.name.length > 12 ? sub.name.slice(0, 10) + "…" : sub.name) : "Class";
          })
        )
      ).slice(0, 3).join(", ");

      const weekendNote = isFridayOrMonday ? " • Extends Weekend" : "";
      const summary = `${slots.length} class${slots.length > 1 ? "es" : ""} (${subNames})${weekendNote}`;

      candidates.push({
        dateStr,
        dayNum: cur.getDate(),
        dayName: dayNames[dayOfWeek],
        monthName: monthNames[cur.getMonth()],
        slots,
        tier,
        tierLabel,
        damageScore,
        minProjectedPct: minPct,
        summary,
        isFridayOrMonday,
      });

      cur.setDate(cur.getDate() + 1);
    }

    // Rank candidates: Tier 1 first, then Tier 2, then Tier 3; lowest damageScore first
    candidates.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.damageScore - b.damageScore;
    });

    return candidates.slice(0, chillDaysCount);
  }, [
    timetableSlots,
    officialHolidaysSet,
    targetEndDate,
    simulationResults.subjectStats,
    chillDaysCount,
    subjects,
  ]);

  const suggestedDateSet = useMemo(() => {
    return new Set(optimizerSuggestions.map((c) => c.dateStr));
  }, [optimizerSuggestions]);

  // Apply Optimizer Suggestions in 1 tap
  const handleApplyOptimizerSuggestions = () => {
    setSimulatedBunks((prev) => {
      const next = { ...prev };
      optimizerSuggestions.forEach((c) => {
        next[c.dateStr] = "all";
      });
      return next;
    });
    setSimulatedHolidays((prev) => {
      const next = new Set(prev);
      optimizerSuggestions.forEach((c) => next.delete(c.dateStr));
      return next;
    });
    Alert.alert(
      "Smart Suggestions Applied",
      `Applied ${optimizerSuggestions.length} optimized chill day(s) to your calendar sandbox.`
    );
  };

  // Clear suggested bunks
  const handleClearOptimizerSuggestions = () => {
    setSimulatedBunks((prev) => {
      const next = { ...prev };
      optimizerSuggestions.forEach((c) => {
        delete next[c.dateStr];
      });
      return next;
    });
  };

  // Single Tap: Select date in the Split-View Day Inspector
  const handleDayPress = (day: (typeof calendarDays)[0]) => {
    if (!day.isCurrentMonth) return;
    setSelectedDate(day.dateStr);
  };

  // Long Press: Instantly toggle Full Bunk / Normal Study Day
  const handleDayLongPress = (day: (typeof calendarDays)[0]) => {
    if (!day.isCurrentMonth || day.isPast || day.isSunday || day.isOfficialHoliday) return;
    try {
      Vibration.vibrate(35);
    } catch (e) {}

    setSelectedDate(day.dateStr);

    const isFullBunk = simulatedBunks[day.dateStr] === "all";
    if (isFullBunk) {
      setSimulatedBunks((prev) => {
        const copy = { ...prev };
        delete copy[day.dateStr];
        return copy;
      });
    } else {
      setSimulatedHolidays((prev) => {
        const next = new Set(prev);
        next.delete(day.dateStr);
        return next;
      });
      setSimulatedBunks((prev) => ({
        ...prev,
        [day.dateStr]: "all",
      }));
    }
  };

  // Inspector Action: Toggle Full Day Bunk
  const handleToggleFullBunk = (dateStr: string) => {
    const isFullBunk = simulatedBunks[dateStr] === "all";
    if (isFullBunk) {
      setSimulatedBunks((prev) => {
        const copy = { ...prev };
        delete copy[dateStr];
        return copy;
      });
    } else {
      setSimulatedHolidays((prev) => {
        const next = new Set(prev);
        next.delete(dateStr);
        return next;
      });
      setSimulatedBunks((prev) => ({
        ...prev,
        [dateStr]: "all",
      }));
    }
  };

  // Inspector Action: Toggle Simulated Off-Day
  const handleToggleOffDay = (dateStr: string) => {
    const isSimHoli = simulatedHolidays.has(dateStr);
    if (isSimHoli) {
      setSimulatedHolidays((prev) => {
        const next = new Set(prev);
        next.delete(dateStr);
        return next;
      });
    } else {
      setSimulatedBunks((prev) => {
        const copy = { ...prev };
        delete copy[dateStr];
        return copy;
      });
      setSimulatedHolidays((prev) => {
        const next = new Set(prev);
        next.add(dateStr);
        return next;
      });
    }
  };

  // Inspector Action: Reset Date to Normal Study Day
  const handleResetSelectedDay = (dateStr: string) => {
    setSimulatedHolidays((prev) => {
      const next = new Set(prev);
      next.delete(dateStr);
      return next;
    });
    setSimulatedBunks((prev) => {
      const copy = { ...prev };
      delete copy[dateStr];
      return copy;
    });
  };

  // Inspector Action: Toggle Individual Lecture Chip on Date (Zero Modal Partial Bunks)
  const handleToggleSlotForDate = (slotId: string, daySlots: TimetableSlot[], dateStr: string) => {
    setSimulatedHolidays((prev) => {
      const next = new Set(prev);
      next.delete(dateStr);
      return next;
    });

    setSimulatedBunks((prev) => {
      const current = prev[dateStr];
      let activeBunkSlots: string[] = [];

      if (current === "all") {
        activeBunkSlots = daySlots.map((s) => s.id).filter((id) => id !== slotId);
      } else if (Array.isArray(current)) {
        if (current.includes(slotId)) {
          activeBunkSlots = current.filter((id) => id !== slotId);
        } else {
          activeBunkSlots = [...current, slotId];
        }
      } else {
        activeBunkSlots = [slotId];
      }

      if (activeBunkSlots.length === 0) {
        const copy = { ...prev };
        delete copy[dateStr];
        return copy;
      }
      if (activeBunkSlots.length === daySlots.length) {
        return { ...prev, [dateStr]: "all" };
      }
      return { ...prev, [dateStr]: activeBunkSlots };
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

  // Metadata for currently inspected date
  const selectedDayInfo = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    const dayOfWeek = d.getDay();
    const isSunday = dayOfWeek === 0;
    const isPast = selectedDate <= todayStr;
    const isOfficialHoliday = officialHolidaysSet.has(selectedDate);
    const isSimulatedHoliday = simulatedHolidays.has(selectedDate);
    const bunk = simulatedBunks[selectedDate];

    let bunkType: "none" | "all" | "partial" = "none";
    if (bunk === "all") bunkType = "all";
    else if (Array.isArray(bunk) && bunk.length > 0) bunkType = "partial";

    const isFutureWorkingDay = !isPast && !isSunday && !isOfficialHoliday;

    let badgeText = "Study Day";
    let badgeColor: string = palette.emerald[500];
    let badgeBg: string = "rgba(16, 185, 129, 0.15)";
    let description = "Normal college attendance is expected.";

    if (isPast) {
      badgeText = "Past Date";
      badgeColor = textColors.disabled;
      badgeBg = glass.medium;
      description = "Historical attendance records apply.";
    } else if (isSunday) {
      badgeText = "Sunday Off";
      badgeColor = palette.amber[500];
      badgeBg = "rgba(234, 179, 8, 0.12)";
      description = "No classes conducted on Sundays.";
    } else if (isOfficialHoliday) {
      badgeText = "Official Holiday";
      badgeColor = palette.blue[500];
      badgeBg = "rgba(59, 130, 246, 0.15)";
      description = "College officially declared holiday.";
    } else if (isSimulatedHoliday) {
      badgeText = "Simulated Off-Day";
      badgeColor = palette.amber[500];
      badgeBg = "rgba(245, 158, 11, 0.18)";
      description = "Exempted from attendance calculations.";
    } else if (bunkType === "all") {
      badgeText = "Full Bunk Day";
      badgeColor = palette.red[500];
      badgeBg = "rgba(239, 68, 68, 0.18)";
      description = "All scheduled lectures marked as skipped.";
    } else if (bunkType === "partial") {
      const bunkCount = Array.isArray(bunk) ? bunk.length : 0;
      badgeText = `Partial Bunk (${bunkCount} skipped)`;
      badgeColor = palette.orange[500];
      badgeBg = "rgba(249, 115, 22, 0.18)";
      description = "Selected classes marked as skipped.";
    }

    return {
      dateStr: selectedDate,
      dayOfWeek,
      isSunday,
      isPast,
      isOfficialHoliday,
      isSimulatedHoliday,
      bunkType,
      isFutureWorkingDay,
      badgeText,
      badgeColor,
      badgeBg,
      description,
    };
  }, [selectedDate, todayStr, officialHolidaysSet, simulatedHolidays, simulatedBunks]);

  // Slots for currently inspected date
  const selectedDaySlots = useMemo(() => {
    if (!selectedDate) return [];
    const d = new Date(selectedDate + "T00:00:00");
    const dayOfWeek = d.getDay();
    return timetableSlots.filter((s) => s.day_of_week === dayOfWeek);
  }, [selectedDate, timetableSlots]);

  const monthLabel = useMemo(() => {
    return currentMonthDate.toLocaleString("default", { month: "long", year: "numeric" });
  }, [currentMonthDate]);

  const formatInspectorDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      {/* Sandbox Isolation Notice */}
      <View style={styles.sandboxNoticeBanner}>
        <Ionicons name="shield-checkmark" size={14} color={accent.primary} />
        <Text style={styles.sandboxNoticeText}>
          Sandbox Active — Simulation is local. Official Supabase attendance remains untouched.
        </Text>
      </View>

      {/* Target Horizon Bar & Plan Controls */}
      <View style={styles.horizonBar}>
        <View style={styles.horizonTargetWrapper}>
          <Text style={styles.horizonLabel}>Forecast Horizon:</Text>
          <TouchableOpacity
            style={styles.horizonPill}
            onPress={() => {
              setTempEndDateInput(targetEndDate);
              setShowEndDateModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={13} color={accent.primary} />
            <Text style={styles.horizonPillText}>Until: {targetEndDate}</Text>
            <Ionicons name="pencil" size={11} color={textColors.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.planActionBtns}>
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => setShowSavePromptModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="save-outline" size={13} color={accent.primary} />
            <Text style={styles.planBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => setShowSavedPlansModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="folder-open-outline" size={13} color={textColors.secondary} />
            <Text style={styles.planBtnText}>Plans ({savedPlans.length})</Text>
          </TouchableOpacity>
          {(simulatedHolidays.size > 0 || Object.keys(simulatedBunks).length > 0) && (
            <TouchableOpacity
              style={[styles.planBtn, styles.planBtnReset]}
              onPress={handleResetAllSimulations}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={12} color={palette.red[500]} />
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

      {/* Clean Month Days Grid (No crammed text badges) */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day) => {
          if (!day.isCurrentMonth) {
            return <View key={day.dateStr} style={styles.emptyDayCell} />;
          }

          let cellBg: string = glass.subtle;
          const isSelected = day.dateStr === selectedDate;
          const isSuggested = suggestedDateSet.has(day.dateStr);

          if (day.isSunday) {
            cellBg = "rgba(234, 179, 8, 0.05)";
          } else if (day.isOfficialHoliday) {
            cellBg = "rgba(59, 130, 246, 0.10)";
          } else if (day.isSimulatedHoliday) {
            cellBg = "rgba(245, 158, 11, 0.14)";
          } else if (day.bunkType === "all") {
            cellBg = "rgba(239, 68, 68, 0.16)";
          } else if (day.bunkType === "partial") {
            cellBg = "rgba(249, 115, 22, 0.14)";
          } else if (!day.isPast && day.hasSlots) {
            cellBg = "rgba(16, 185, 129, 0.06)";
          }

          return (
            <TouchableOpacity
              key={day.dateStr}
              style={[
                styles.dayCell,
                { backgroundColor: cellBg },
                day.isPast && styles.pastDayCell,
                day.bunkType === "all" && { borderColor: "rgba(239, 68, 68, 0.7)", borderWidth: 1 },
                day.bunkType === "partial" && { borderColor: "rgba(249, 115, 22, 0.7)", borderWidth: 1 },
                day.isSimulatedHoliday && { borderColor: "rgba(245, 158, 11, 0.6)", borderWidth: 1 },
                day.isOfficialHoliday && { borderColor: "rgba(59, 130, 246, 0.4)", borderWidth: 1 },
                isSuggested && !day.isPast && { borderColor: palette.blue[400], borderWidth: 1.5 },
                isSelected && styles.selectedDayCell,
              ]}
              onPress={() => handleDayPress(day)}
              onLongPress={() => handleDayLongPress(day)}
              delayLongPress={280}
              activeOpacity={0.65}
            >
              <Text
                style={[
                  styles.dayNumText,
                  day.isPast && styles.pastDayNumText,
                  day.isSunday && { color: palette.amber[500] },
                  isSelected && styles.selectedDayNumText,
                ]}
              >
                {day.dayNum}
              </Text>

              {/* Minimalist Micro Indicator Dots (Zero Crammed Text) */}
              <View style={styles.dotContainer}>
                {day.bunkType === "all" ? (
                  <View style={[styles.microDot, { backgroundColor: palette.red[500] }]} />
                ) : day.bunkType === "partial" ? (
                  <View style={styles.twoDotsRow}>
                    <View style={[styles.microDotMini, { backgroundColor: palette.orange[500] }]} />
                    <View style={[styles.microDotMini, { backgroundColor: palette.orange[500] }]} />
                  </View>
                ) : day.isSimulatedHoliday ? (
                  <View style={[styles.microDot, { backgroundColor: palette.amber[500] }]} />
                ) : day.isOfficialHoliday ? (
                  <View style={[styles.microDot, { backgroundColor: palette.blue[500] }]} />
                ) : !day.isPast && day.hasSlots ? (
                  <View style={[styles.microDot, { backgroundColor: "rgba(16, 185, 129, 0.75)" }]} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend & UX Guide */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "rgba(16, 185, 129, 0.75)" }]} />
          <Text style={styles.legendLabel}>Study</Text>
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
        <Text style={styles.legendHintText}>• Hold date to quick-bunk</Text>
      </View>

      {/* Split-View Day Inspector Card (Solution 1 + Zero Modal Friction) */}
      <View style={styles.dayInspectorCard}>
        {/* Inspector Header */}
        <View style={styles.inspectorHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="calendar" size={14} color={accent.primary} />
              <Text style={styles.inspectorDateTitle}>{formatInspectorDate(selectedDate)}</Text>
            </View>
            <Text style={styles.inspectorSubTitle} numberOfLines={1}>
              {selectedDayInfo.description}
            </Text>
          </View>
          <View style={[styles.inspectorBadge, { backgroundColor: selectedDayInfo.badgeBg }]}>
            <Text style={[styles.inspectorBadgeText, { color: selectedDayInfo.badgeColor }]}>
              {selectedDayInfo.badgeText}
            </Text>
          </View>
        </View>

        {/* Quick Action Buttons for the Inspected Day */}
        {selectedDayInfo.isFutureWorkingDay && (
          <View style={styles.inspectorActionsRow}>
            <TouchableOpacity
              style={[
                styles.inspectorActionBtn,
                selectedDayInfo.bunkType === "all" && styles.inspectorActionBtnActiveRed,
              ]}
              onPress={() => handleToggleFullBunk(selectedDate)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={selectedDayInfo.bunkType === "all" ? "close-circle" : "close-circle-outline"}
                size={14}
                color={selectedDayInfo.bunkType === "all" ? palette.white : palette.red[500]}
              />
              <Text
                style={[
                  styles.inspectorActionBtnText,
                  selectedDayInfo.bunkType === "all" && { color: palette.white },
                ]}
              >
                {selectedDayInfo.bunkType === "all" ? "Bunking Full Day" : "Bunk Whole Day"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.inspectorActionBtn,
                selectedDayInfo.isSimulatedHoliday && styles.inspectorActionBtnActiveAmber,
              ]}
              onPress={() => handleToggleOffDay(selectedDate)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={selectedDayInfo.isSimulatedHoliday ? "sunny" : "sunny-outline"}
                size={14}
                color={selectedDayInfo.isSimulatedHoliday ? palette.white : palette.amber[500]}
              />
              <Text
                style={[
                  styles.inspectorActionBtnText,
                  selectedDayInfo.isSimulatedHoliday && { color: palette.white },
                ]}
              >
                {selectedDayInfo.isSimulatedHoliday ? "Marked as Off-Day" : "Mark Off-Day"}
              </Text>
            </TouchableOpacity>

            {(selectedDayInfo.bunkType !== "none" || selectedDayInfo.isSimulatedHoliday) && (
              <TouchableOpacity
                style={[styles.inspectorActionBtn, styles.inspectorResetBtn]}
                onPress={() => handleResetSelectedDay(selectedDate)}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={13} color={textColors.secondary} />
                <Text style={[styles.inspectorActionBtnText, { color: textColors.secondary }]}>
                  Reset
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Interactive Lecture Chips (Zero Modal Partial Bunking) */}
        {selectedDayInfo.isFutureWorkingDay && selectedDaySlots.length > 0 ? (
          <View style={styles.chipsSection}>
            <Text style={styles.chipsSectionLabel}>
              Tap lecture chip to toggle bunking:
            </Text>
            <View style={styles.chipsWrapper}>
              {selectedDaySlots.map((slot) => {
                const sub = subjects.find((s) => s.id === slot.subject_id);
                const currentBunk = simulatedBunks[selectedDate];
                const isBunked =
                  currentBunk === "all" ||
                  (Array.isArray(currentBunk) && currentBunk.includes(slot.id));

                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.lectureChip,
                      isBunked ? styles.lectureChipBunked : styles.lectureChipAttending,
                    ]}
                    onPress={() => handleToggleSlotForDate(slot.id, selectedDaySlots, selectedDate)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.chipLeft}>
                      <Text
                        style={[
                          styles.chipSubjectText,
                          isBunked && styles.chipSubjectTextBunked,
                        ]}
                        numberOfLines={1}
                      >
                        {sub?.name || "Lecture"}
                      </Text>
                      <Text style={styles.chipTimeText}>
                        {slot.start_time.slice(0, 5)} • {(slot.class_type || "theory").toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.chipStatusPill,
                        isBunked ? styles.chipStatusPillBunked : styles.chipStatusPillAttending,
                      ]}
                    >
                      <Ionicons
                        name={isBunked ? "close" : "checkmark"}
                        size={11}
                        color={isBunked ? palette.red[500] : palette.emerald[500]}
                      />
                      <Text
                        style={[
                          styles.chipStatusText,
                          { color: isBunked ? palette.red[500] : palette.emerald[500] },
                        ]}
                      >
                        {isBunked ? "Bunk" : "Attend"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyDayNotice}>
            <Ionicons
              name={
                selectedDayInfo.isSunday
                  ? "cafe-outline"
                  : selectedDayInfo.isOfficialHoliday
                  ? "balloon-outline"
                  : selectedDayInfo.isSimulatedHoliday
                  ? "sunny-outline"
                  : selectedDayInfo.isPast
                  ? "time-outline"
                  : "calendar-outline"
              }
              size={16}
              color={textColors.tertiary}
            />
            <Text style={styles.emptyDayNoticeText}>
              {selectedDayInfo.isSunday
                ? "Weekly Sunday off — No timetable classes."
                : selectedDayInfo.isOfficialHoliday
                ? "Official holiday — College closed."
                : selectedDayInfo.isSimulatedHoliday
                ? "Simulated off-day — Classes exempted from attendance calculation."
                : selectedDayInfo.isPast
                ? "Past date — Official database records apply."
                : "No timetable classes scheduled for this day."}
            </Text>
          </View>
        )}
      </View>

      {/* Sub-Feature: Intelligent "Smart Bunk Optimizer" (Idea D) */}
      <View style={styles.optimizerContainer}>
        <TouchableOpacity
          style={styles.optimizerHeaderRow}
          onPress={() => setShowOptimizer((prev) => !prev)}
          activeOpacity={0.7}
        >
          <View style={styles.optimizerHeaderLeft}>
            <View style={styles.optimizerIconBox}>
              <Ionicons name="sparkles" size={16} color={palette.amber[500]} />
            </View>
            <View>
              <Text style={styles.optimizerTitle}>Smart Bunk Optimizer</Text>
              <Text style={styles.optimizerSubtitle}>
                Auto-suggest safest days (Tier 1 ≥85%, Tier 2 ≥75%, Least Damage)
              </Text>
            </View>
          </View>
          <Ionicons
            name={showOptimizer ? "chevron-up" : "chevron-down"}
            size={18}
            color={textColors.secondary}
          />
        </TouchableOpacity>

        {showOptimizer && (
          <View style={styles.optimizerBody}>
            {/* Chill Days Stepper */}
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Days to Chill:</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setChillDaysCount((c) => Math.max(1, c - 1))}
                  disabled={chillDaysCount <= 1}
                >
                  <Ionicons
                    name="remove"
                    size={16}
                    color={chillDaysCount <= 1 ? textColors.disabled : textColors.primary}
                  />
                </TouchableOpacity>
                <Text style={styles.stepperValueText}>{chillDaysCount} Day{chillDaysCount > 1 ? "s" : ""}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setChillDaysCount((c) => Math.min(5, c + 1))}
                  disabled={chillDaysCount >= 5}
                >
                  <Ionicons
                    name="add"
                    size={16}
                    color={chillDaysCount >= 5 ? textColors.disabled : textColors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Candidate Suggestions List */}
            {optimizerSuggestions.length === 0 ? (
              <Text style={styles.noSuggestionsText}>
                No viable chill days found within the selected horizon without breaching attendance rules.
              </Text>
            ) : (
              <View style={styles.suggestionsList}>
                {optimizerSuggestions.map((cand, idx) => (
                  <TouchableOpacity
                    key={cand.dateStr}
                    style={[
                      styles.suggestionItem,
                      cand.dateStr === selectedDate && styles.suggestionItemActive,
                    ]}
                    onPress={() => setSelectedDate(cand.dateStr)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionDateCol}>
                      <Text style={styles.suggestionDayName}>{cand.dayName}</Text>
                      <Text style={styles.suggestionDayNum}>{cand.dayNum}</Text>
                      <Text style={styles.suggestionMonthName}>{cand.monthName}</Text>
                    </View>

                    <View style={{ flex: 1, paddingHorizontal: spacing.sm }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <View
                          style={[
                            styles.tierBadge,
                            cand.tier === 1
                              ? styles.tierBadgeEmerald
                              : cand.tier === 2
                              ? styles.tierBadgeAmber
                              : styles.tierBadgeRed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.tierBadgeText,
                              cand.tier === 1
                                ? { color: palette.emerald[500] }
                                : cand.tier === 2
                                ? { color: palette.amber[500] }
                                : { color: palette.red[500] },
                            ]}
                          >
                            {cand.tierLabel}
                          </Text>
                        </View>
                        {cand.isFridayOrMonday && (
                          <View style={styles.longWeekendPill}>
                            <Text style={styles.longWeekendPillText}>Weekend+</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.suggestionSummary} numberOfLines={1}>
                        {cand.summary}
                      </Text>
                    </View>

                    <Ionicons name="arrow-forward-circle-outline" size={20} color={textColors.tertiary} />
                  </TouchableOpacity>
                ))}

                {/* Batch Action Buttons */}
                <View style={styles.optimizerActionRow}>
                  <TouchableOpacity
                    style={styles.applySuggestionsBtn}
                    onPress={handleApplyOptimizerSuggestions}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-done" size={16} color={palette.white} />
                    <Text style={styles.applySuggestionsBtnText}>
                      Apply {optimizerSuggestions.length} Day{optimizerSuggestions.length > 1 ? "s" : ""} to Calendar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.clearSuggestionsBtn}
                    onPress={handleClearOptimizerSuggestions}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={16} color={textColors.secondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
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

      {/* --- MODAL: Subject Impact Breakdown --- */}
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

      {/* --- MODAL: Edit Horizon End Date --- */}
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

      {/* --- MODAL: Save Plan Prompt --- */}
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
              Give this scenario a name to revisit or compare later.
            </Text>

            <TextInput
              style={styles.textInputStyle}
              value={newPlanName}
              onChangeText={setNewPlanName}
              placeholder="e.g. Fest Week Bunk, Long Weekend"
              placeholderTextColor={textColors.disabled}
              autoFocus
            />

            <TouchableOpacity style={styles.doneModalBtn} onPress={handleSaveCurrentPlan}>
              <Text style={styles.doneModalBtnText}>Save Locally</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL: Saved Plans List --- */}
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
    paddingBottom: 110,
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
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectedDayCell: {
    borderColor: accent.primary,
    borderWidth: 2,
    backgroundColor: "rgba(59, 130, 246, 0.18)",
  },
  pastDayCell: {
    opacity: 0.35,
  },
  dayNumText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: textColors.primary,
  },
  selectedDayNumText: {
    color: accent.primary,
  },
  pastDayNumText: {
    color: textColors.disabled,
  },
  dotContainer: {
    height: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  microDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  twoDotsRow: {
    flexDirection: "row",
    gap: 2,
  },
  microDotMini: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 9,
    color: textColors.tertiary,
  },
  legendHintText: {
    fontFamily: fontFamily.regular,
    fontSize: 9,
    color: textColors.disabled,
    fontStyle: "italic",
  },
  dayInspectorCard: {
    backgroundColor: canvas.elevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: border.default,
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  inspectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  inspectorDateTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: textColors.primary,
  },
  inspectorSubTitle: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: textColors.tertiary,
    marginTop: 2,
  },
  inspectorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  inspectorBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
  },
  inspectorActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  inspectorActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: glass.medium,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: border.default,
  },
  inspectorActionBtnActiveRed: {
    backgroundColor: palette.red[500],
    borderColor: palette.red[500],
  },
  inspectorActionBtnActiveAmber: {
    backgroundColor: palette.amber[500],
    borderColor: palette.amber[500],
  },
  inspectorResetBtn: {
    backgroundColor: "transparent",
    borderColor: border.subtle,
  },
  inspectorActionBtnText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    color: textColors.primary,
  },
  chipsSection: {
    marginTop: spacing.xs,
  },
  chipsSectionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: textColors.tertiary,
    marginBottom: 6,
  },
  chipsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  lectureChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: "48%",
    flex: 1,
  },
  lectureChipAttending: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  lectureChipBunked: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  chipLeft: {
    flex: 1,
    paddingRight: 6,
  },
  chipSubjectText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: textColors.primary,
  },
  chipSubjectTextBunked: {
    color: palette.red[500],
    textDecorationLine: "line-through",
  },
  chipTimeText: {
    fontFamily: fontFamily.regular,
    fontSize: 9,
    color: textColors.tertiary,
    marginTop: 1,
  },
  chipStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  chipStatusPillAttending: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  chipStatusPillBunked: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  chipStatusText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
  },
  emptyDayNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xs,
  },
  emptyDayNoticeText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: textColors.tertiary,
    flex: 1,
  },
  optimizerContainer: {
    backgroundColor: canvas.elevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: border.default,
  },
  optimizerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optimizerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  optimizerIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  optimizerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: textColors.primary,
  },
  optimizerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 9,
    color: textColors.tertiary,
    marginTop: 1,
  },
  optimizerBody: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: border.subtle,
    paddingTop: spacing.sm,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  stepperLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: glass.medium,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: border.default,
  },
  stepperBtn: {
    padding: 4,
  },
  stepperValueText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: textColors.primary,
    minWidth: 46,
    textAlign: "center",
  },
  noSuggestionsText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: textColors.tertiary,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  suggestionsList: {
    gap: 6,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: glass.subtle,
    borderRadius: radius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: border.subtle,
  },
  suggestionItemActive: {
    borderColor: accent.primary,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  suggestionDateCol: {
    alignItems: "center",
    width: 36,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: border.subtle,
  },
  suggestionDayName: {
    fontFamily: fontFamily.semiBold,
    fontSize: 8,
    color: textColors.tertiary,
    textTransform: "uppercase",
  },
  suggestionDayNum: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: textColors.primary,
  },
  suggestionMonthName: {
    fontFamily: fontFamily.regular,
    fontSize: 8,
    color: textColors.tertiary,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierBadgeEmerald: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  tierBadgeAmber: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  tierBadgeRed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  tierBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 8,
  },
  longWeekendPill: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  longWeekendPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: 8,
    color: palette.blue[400],
  },
  suggestionSummary: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: textColors.secondary,
  },
  optimizerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  applySuggestionsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: accent.primary,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  applySuggestionsBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    color: palette.white,
  },
  clearSuggestionsBtn: {
    padding: 8,
    backgroundColor: glass.medium,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: border.default,
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
