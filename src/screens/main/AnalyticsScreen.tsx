/**
 * Attendance Tracker — Analytics & History Screen (Phase 4)
 *
 * Displays historical attendance logs, a monthly calendar view, and trend graphs.
 * Features:
 * - Dynamic Selector Dropdown for time periods (Months & Semesters).
 * - Real JS Date calendar calculations ensuring weekday alignments in proper Week-Rows.
 * - Dynamic color gradient heatmap showing attendance health.
 * - Dynamic content recalculations (risk cards, progress tracks, compliance markers).
 * - Export functions for CSV and PDF on mobile.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Modal,
  DeviceEventEmitter,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import {
  canvas,
  glass,
  border,
  text as textColors,
  accent,
  shadow,
  attendance as attendanceColors,
  gauge as gaugeColors,
  heat,
  palette,
} from "../../theme/colors";
import { fontFamily, fontSize, textStyle } from "../../theme/typography";
import { spacing, radius, layout } from "../../theme/spacing";
import { DatabaseService } from "../../services/DatabaseService";
import { Database } from "../../lib/database.types";
import { supabase } from "../../lib/supabase";
import HolidayManagerSheet from "../../components/HolidayManagerSheet";
import AttendanceSimulatorSheet, { AttendanceSimulatorSheetRef } from "../../components/AttendanceSimulatorSheet";
import CalendarPlannerView from "../../components/CalendarPlannerView";
import AttendanceGauge from "../../components/AttendanceGauge";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
type RecordRow = Database["public"]["Tables"]["attendance_records"]["Row"];
type SemesterRow = Database["public"]["Tables"]["academic_semesters"]["Row"];

const calculatePercentage = (attended: number, conducted: number) => {
  if (conducted === 0) return -1;
  return Math.round((attended / conducted) * 100);
};

// Dynamic Time Periods config
interface TimePeriod {
  id: string;
  label: string;
  type: "month" | "semester";
  year: number;
  monthIndex?: number; // 0-11
  startMonthIndex?: number;
  endMonthIndex?: number;
}

interface CalendarDay {
  day: number | null;
  dateStr: string | null;
  ratio: number;
}

// ── Helper to build month matrix ──
const getCalendarMatrix = (
  year: number,
  monthIndex: number,
  allRecords: RecordRow[],
  holidays: any[],
): CalendarDay[] => {
  const matrix: CalendarDay[] = [];
  const firstDay = new Date(year, monthIndex, 1);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun, 1=Mon, etc.
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  // 1. Padding days for start of month
  for (let i = 0; i < startDayOfWeek; i++) {
    matrix.push({ day: null, dateStr: null, ratio: -2 });
  }

  // 2. Calendar active days
  for (let d = 1; d <= totalDays; d++) {
    const currentDate = new Date(year, monthIndex, d);
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0; // Only Sunday is weekend by default

    const dateStr = `${year}-${(monthIndex + 1).toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    const dayRecords = allRecords.filter((r) => r.date === dateStr);

    let ratio = dayOfWeek === 0 ? -4 : -1; // Holiday/Weekend
    const isHoliday = holidays.some(
      (h) => h.date && h.date.startsWith(dateStr),
    );

    if (isHoliday) {
      ratio = -3; // Holiday
    } else if (dayRecords.filter((r) => r.status !== "cancelled").length > 0) {
      const activeRecords = dayRecords.filter((r) => r.status !== "cancelled");
      const presentCount = activeRecords.filter(
        (r) => r.status === "present",
      ).length;
      ratio = presentCount / activeRecords.length;
    } else if (!isWeekend) {
      ratio = -1;
      } else if (dayOfWeek === 0) {
        ratio = -4;
      }


    matrix.push({ day: d, dateStr, ratio });
  }

  // 3. Padding days for end of month to complete the 7-day grid
  const remainingDays = matrix.length % 7;
  if (remainingDays > 0) {
    const padEnd = 7 - remainingDays;
    for (let i = 0; i < padEnd; i++) {
      matrix.push({ day: null, dateStr: null, ratio: -2 });
    }
  }

  return matrix;
};

// Helper to chunk calendar days into rows of 7
const chunkArray = (arr: any[], size: number) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export default function AnalyticsScreen({ isActive = true }: { isActive?: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<"planner" | "overview" | "quick_sim">("planner");
  const [activeSemester, setActiveSemester] = useState<SemesterRow | null>(null);

  const [periods, setPeriods] = useState<TimePeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holidaySheetVisible, setHolidaySheetVisible] = useState(false);
  const [selectedSimSubject, setSelectedSimSubject] = useState<any>(null);
  const simulatorRef = useRef<AttendanceSimulatorSheetRef>(null);

  // Quick Sim in-page state
  const [quickSimSubjectId, setQuickSimSubjectId] = useState<string | null>(null);
  const [quickSimClassType, setQuickSimClassType] = useState<"all" | "theory" | "lab" | "tutorial">("all");
  const [quickSimAttended, setQuickSimAttended] = useState(0);
  const [quickSimMissed, setQuickSimMissed] = useState(0);

  const loadData = async () => {
    try {
      const allSemesters = await DatabaseService.fetchSemesters();
      if (!allSemesters || allSemesters.length === 0) return;

      const activeSem = allSemesters.find((s) => s.is_active) || allSemesters[0] || null;
      setActiveSemester(activeSem);

      const [fetchedSubjects, fetchedRecords] = await Promise.all([
        DatabaseService.fetchSubjects(),
        DatabaseService.fetchAttendanceRecords(),
      ]);
      const { data: holidaysData } = await (supabase as any)
        .from("holidays")
        .select("*");

      setSubjects(fetchedSubjects);
      setRecords(fetchedRecords);
      setHolidays(holidaysData || []);

      if (!quickSimSubjectId && fetchedSubjects.length > 0) {
        setQuickSimSubjectId(fetchedSubjects[0].id);
      }

      const newPeriods: TimePeriod[] = [];

      // Add all semesters
      allSemesters.forEach((sem) => {
        const semStart = new Date(sem.start_date);
        const semEnd = sem.end_date ? new Date(sem.end_date) : new Date();
        newPeriods.push({
          id: `sem_${sem.id}`,
          label: `${sem.name} (Full)`,
          type: "semester",
          year: semStart.getFullYear(),
          startMonthIndex: semStart.getMonth(),
          endMonthIndex: semEnd.getFullYear() > semStart.getFullYear() ? 11 : semEnd.getMonth(),
        });
      });

      // Add individual calendar months from semester start (or 5 months prior) up to current date
      const now = new Date();
      const semStart = activeSem?.start_date
        ? new Date(activeSem.start_date)
        : new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const startMonthDate = new Date(semStart.getFullYear(), semStart.getMonth(), 1);
      let curr = new Date(now.getFullYear(), now.getMonth(), 1);
      if (curr < startMonthDate) {
        curr = new Date(startMonthDate);
      }

      while (curr >= startMonthDate) {
        newPeriods.push({
          id: `m_${curr.getFullYear()}_${curr.getMonth()}`,
          label: curr.toLocaleString("default", {
            month: "long",
            year: "numeric",
          }),
          type: "month",
          year: curr.getFullYear(),
          monthIndex: curr.getMonth(),
        });
        curr = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
      }

      setPeriods(newPeriods);
      const currentMonthId = `m_${now.getFullYear()}_${now.getMonth()}`;
      if (!selectedPeriod) {
        const defaultPeriod =
          newPeriods.find((p) => p.id === currentMonthId) ||
          newPeriods.find((p) => p.type === "month") ||
          (activeSem && newPeriods.find((p) => p.id === `sem_${activeSem.id}`)) ||
          newPeriods[0];
        setSelectedPeriod(defaultPeriod);
      }
    } catch (error) {
      console.warn("Failed to load analytics data", error);
    }
  };

  useEffect(() => {
    if (!isActive) return;
    loadData();

    // Realtime changes listener for automatic updates
    const recordsChannel = supabase
      .channel("public:attendance_records_analytics")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        (_payload) => {
          loadData();
        },
      )
      .subscribe();

    const holidaysChannel = supabase
      .channel("public:holidays_analytics")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "holidays" },
        (_payload) => {
          loadData();
        },
      )
      .subscribe();

    const semestersChannel = supabase
      .channel("public:academic_semesters_analytics")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "academic_semesters" },
        (_payload) => {
          loadData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(recordsChannel);
      supabase.removeChannel(holidaysChannel);
      supabase.removeChannel(semestersChannel);
    };
  }, [isActive]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("semesterChanged", () => {
      loadData();
    });
    return () => sub.remove();
  }, []);

  // Computes active months to display heatmap grids for
  const activeMonths = useMemo(() => {
    if (!selectedPeriod) return [];
    if (selectedPeriod.type === "month") {
      return [
        { year: selectedPeriod.year, monthIndex: selectedPeriod.monthIndex! },
      ];
    }
    const months = [];
    for (
      let i = selectedPeriod.startMonthIndex!;
      i <= selectedPeriod.endMonthIndex!;
      i++
    ) {
      months.push({ year: selectedPeriod.year, monthIndex: i });
    }
    return months;
  }, [selectedPeriod]);

  // Recalculates metrics based on active period selection
  const periodSubjects = useMemo(() => {
    let filteredRecords = records;
    let displaySubjects = subjects;

    if (selectedPeriod?.type === "month") {
      const monthPrefix = `${selectedPeriod.year}-${(selectedPeriod.monthIndex! + 1).toString().padStart(2, '0')}`;
      filteredRecords = records.filter(r => r.date.startsWith(monthPrefix));
      
      const activeSubjectIds = new Set(filteredRecords.map(r => r.subject_id));
      displaySubjects = subjects.filter(s => activeSubjectIds.has(s.id));
    } else if (selectedPeriod?.type === "semester") {
       const semId = selectedPeriod.id.replace("sem_", "");
       displaySubjects = subjects.filter(s => s.semester_id === semId);
       const semSubjects = displaySubjects.map(s => s.id);
       filteredRecords = records.filter(r => semSubjects.includes(r.subject_id));
    }

    return displaySubjects.map((subject) => {
      const subRecords = filteredRecords.filter((r) => r.subject_id === subject.id);
      const conducted = subRecords.filter((r) => r.status !== "cancelled").length;
      const attended = subRecords.filter((r) => r.status === "present").length;
      const percentage = calculatePercentage(attended, conducted);
      return {
        ...subject,
        threshold: subject.target_threshold,
        totalConducted: conducted,
        totalAttended: attended,
        percentage,
      };
    });
  }, [subjects, records, selectedPeriod]);

  // Canonical Faculty Insights derived strictly from current semester's active subjects
  const facultyInsightsData = useMemo(() => {
    const currentSubjects = activeSemester
      ? subjects.filter((s) => s.semester_id === activeSemester.id)
      : subjects;

    const currentSubjectIds = new Set(currentSubjects.map((s) => s.id));
    const activeRecords = records.filter((r) => currentSubjectIds.has(r.subject_id));

    const teachersMap: Record<
      string,
      {
        displayName: string;
        code: string;
        subjects: string[];
        subjectIds: string[];
      }
    > = {};

    currentSubjects.forEach((sub) => {
      const teacherList = sub.teachers || [];
      teacherList.forEach((t) => {
        if (!t || typeof t !== "string") return;
        let name = t.trim();
        let code = "";

        if (name.startsWith("{")) {
          try {
            const parsed = JSON.parse(name);
            name = parsed.n || parsed.s || name;
            code = parsed.s || "";
          } catch (e) {}
        } else {
          const match = name.match(/^(.*?)\s*\((.*?)\)$/);
          if (match) {
            name = match[1].trim();
            code = match[2].trim();
          }
        }

        const canonicalKey = name.toLowerCase().replace(/^(prof|dr|mr|ms|mrs)\.?\s+/i, "");

        if (!teachersMap[canonicalKey]) {
          teachersMap[canonicalKey] = {
            displayName: name,
            code: code,
            subjects: [sub.short_name || sub.name],
            subjectIds: [sub.id],
          };
        } else {
          if (!teachersMap[canonicalKey].subjects.includes(sub.short_name || sub.name)) {
            teachersMap[canonicalKey].subjects.push(sub.short_name || sub.name);
          }
          if (!teachersMap[canonicalKey].subjectIds.includes(sub.id)) {
            teachersMap[canonicalKey].subjectIds.push(sub.id);
          }
          if (code && !teachersMap[canonicalKey].code) {
            teachersMap[canonicalKey].code = code;
          }
        }
      });
    });

    return Object.keys(teachersMap).map((key) => {
      const info = teachersMap[key];
      const matchNameLower = info.displayName.toLowerCase();
      const matchCodeLower = info.code.toLowerCase();

      const matchingRecords = activeRecords.filter((r) => {
        if (r.teacher_name) {
          let recTeacher = r.teacher_name.toLowerCase();
          if (recTeacher.startsWith("{")) {
            try {
              const p = JSON.parse(r.teacher_name);
              const pName = (p.n || "").toLowerCase();
              const pCode = (p.s || "").toLowerCase();
              if (pName.includes(key) || (matchCodeLower && pCode === matchCodeLower)) {
                return true;
              }
            } catch (e) {}
          }
          if (
            recTeacher === matchNameLower ||
            recTeacher.includes(key) ||
            (matchCodeLower && recTeacher === matchCodeLower)
          ) {
            return true;
          }
        }
        if (!r.teacher_name && info.subjectIds.includes(r.subject_id)) {
          const sub = currentSubjects.find((s) => s.id === r.subject_id);
          if (sub && (sub.teachers || []).length === 1) {
            return true;
          }
        }
        return false;
      });

      const conducted = matchingRecords.filter((r) => r.status !== "cancelled").length;
      const attended = matchingRecords.filter((r) => r.status === "present").length;
      const ratedRecords = matchingRecords.filter((r) => typeof r.rating === "number" && r.rating! > 0);
      const avgRating =
        ratedRecords.length > 0
          ? (ratedRecords.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedRecords.length).toFixed(1)
          : "N/A";
      const attPerc = calculatePercentage(attended, conducted);

      return {
        key,
        displayName: info.displayName,
        subjectLabel: info.subjects.join(", "),
        conducted,
        attended,
        attPerc: attPerc < 0 ? 0 : attPerc,
        avgRating,
      };
    });
  }, [subjects, records, activeSemester]);

  // Quick Sim derived values
  const activeSimSubject = useMemo(() => {
    if (quickSimSubjectId) {
      const found = periodSubjects.find((s) => s.id === quickSimSubjectId);
      if (found) return found;
    }
    return periodSubjects[0] || null;
  }, [quickSimSubjectId, periodSubjects]);

  const { quickSimBaseConducted, quickSimBaseAttended } = useMemo(() => {
    if (!activeSimSubject) return { quickSimBaseConducted: 0, quickSimBaseAttended: 0 };
    if (quickSimClassType === "all") {
      return {
        quickSimBaseConducted: activeSimSubject.totalConducted || 0,
        quickSimBaseAttended: activeSimSubject.totalAttended || 0,
      };
    }
    const matching = records.filter(
      (r) =>
        r.subject_id === activeSimSubject.id &&
        (r.class_type || "theory").toLowerCase() === quickSimClassType
    );
    const cond = matching.filter((r) => r.status !== "cancelled").length;
    const att = matching.filter((r) => r.status === "present").length;
    return { quickSimBaseConducted: cond, quickSimBaseAttended: att };
  }, [activeSimSubject, quickSimClassType, records]);

  const quickSimFinalConducted = quickSimBaseConducted + quickSimAttended + quickSimMissed;
  const quickSimFinalAttended = quickSimBaseAttended + quickSimAttended;
  const quickSimFinalPct =
    quickSimFinalConducted === 0
      ? 0
      : Math.round((quickSimFinalAttended / quickSimFinalConducted) * 100);

  const quickSimThreshold = activeSimSubject?.threshold || 75;

  let quickSimSafeBunks = 0;
  let quickSimRecoveryClasses = 0;
  if (quickSimFinalConducted > 0) {
    const allowed =
      Math.floor((quickSimFinalAttended * 100) / quickSimThreshold) - quickSimFinalConducted;
    quickSimSafeBunks = Math.max(0, allowed);
    const needed = Math.ceil(
      (quickSimThreshold * quickSimFinalConducted - 100 * quickSimFinalAttended) /
        (100 - quickSimThreshold)
    );
    quickSimRecoveryClasses = Math.max(0, needed);
  }

  let quickSimVerdictText = "";
  if (quickSimFinalPct >= quickSimThreshold + 10) {
    quickSimVerdictText = `Comfortably safe! Safe to miss ${quickSimSafeBunks} more classes.`;
  } else if (quickSimFinalPct >= quickSimThreshold) {
    quickSimVerdictText = `Borderline safe. Safe to miss ${quickSimSafeBunks} classes.`;
  } else {
    quickSimVerdictText = `Attendance deficit! Need to attend ${quickSimRecoveryClasses} consecutive classes.`;
  }

  // Calculates color codes based on attendance ratio
  const getHeatmapColor = (ratio: number) => {
    if (ratio === -3) return accent.primary; // Holiday (Blue)
    if (ratio === -2) return "transparent"; // Padding
    if (ratio === -1) return glass.medium; // Off / Weekend
    if (ratio === -4) return "#eab308"; // Golden Sunday
    if (ratio === 1) return attendanceColors.present.base; // 100% (Green)
    if (ratio >= 0.75) return heat.limeHeat; // 75% (Lime)
    if (ratio >= 0.5) return heat.yellowHeat; // 50% (Yellow)
    if (ratio >= 0.25) return heat.orangeHeat; // 25% (Orange)
    if (ratio === 0) return gaugeColors.critical; // 0% (Red)
    return glass.subtle;
  };

  // CSV Report Exporter
  const _handleExportCSV = async () => {
    if (!selectedPeriod) return;

    let csvContent =
      "Subject,Short Name,Attended,Conducted,Percentage,Threshold,Period\n";
    periodSubjects.forEach((s) => {
      csvContent += `"${s.name}","${s.short_name}",${s.totalAttended},${s.totalConducted},${s.percentage < 0 ? "-" : s.percentage + "%"},${s.threshold}%,"${selectedPeriod.label}"\n`;
    });

    if (Platform.OS === "web") {
      try {
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute(
          "download",
          `Attendance_Report_${selectedPeriod.id}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        alert("CSV compilation failed: " + e);
      }
    } else {
      try {
        const fileUri =
          (FileSystem as any).documentDirectory +
          `Attendance_Report_${selectedPeriod.id}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: "Export Attendance Report",
          });
        } else {
          alert("Sharing is not available on this device");
        }
      } catch (error) {
        alert("Failed to export CSV: " + error);
      }
    }
  };

  // PDF Official Document Generator
  const handleExportPDF = async () => {
    if (!selectedPeriod) return;

    // Defaulter risk summary counts
    let safeCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let totalAtt = 0;
    let totalCond = 0;

    periodSubjects.forEach((s) => {
      totalAtt += s.totalAttended;
      totalCond += s.totalConducted;
      if (s.percentage >= 85) safeCount++;
      else if (s.percentage >= 75) warningCount++;
      else criticalCount++;
    });

    const overallPct = calculatePercentage(totalAtt, totalCond);

    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Attendance Audit Report</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 10px; margin: 0; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
            .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
            .meta-box { text-align: right; }
            .meta-period { font-size: 14px; font-weight: 700; color: #0284c7; }
            .meta-date { font-size: 11px; color: #94a3b8; margin-top: 2px; }
            
            .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
            .card-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px; }
            .card-value { font-size: 20px; font-weight: 800; color: #0f172a; }
            .card-value.safe { color: #16a34a; }
            .card-value.warning { color: #d97706; }
            .card-value.danger { color: #dc2626; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th { background-color: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; }
            td { padding: 9px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
            tr:nth-child(even) { background-color: #f8fafc; }
            
            .badge-safe { color: #16a34a; font-weight: 700; }
            .badge-warning { color: #d97706; font-weight: 700; }
            .badge-danger { color: #dc2626; font-weight: 700; }
            
            .status-pill { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; }
            .pill-safe { background: #dcfce7; color: #15803d; }
            .pill-warning { background: #fef3c7; color: #b45309; }
            .pill-danger { background: #fee2e2; color: #b91c1c; }
            
            .footer-note { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Attendance Audit Report</h1>
              <div class="subtitle">Academic Compliance & Risk Analysis</div>
            </div>
            <div class="meta-box">
              <div class="meta-period">${selectedPeriod.label}</div>
              <div class="meta-date">Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="card">
              <div class="card-label">Cumulative Attendance</div>
              <div class="card-value ${overallPct >= 85 ? "safe" : overallPct >= 75 ? "warning" : "danger"}">${overallPct}%</div>
            </div>
            <div class="card">
              <div class="card-label">Total Classes</div>
              <div class="card-value">${totalAtt} / ${totalCond}</div>
            </div>
            <div class="card">
              <div class="card-label">Safe (>85%) / Defaulter (&lt;75%)</div>
              <div class="card-value"><span style="color:#16a34a">${safeCount}</span> / <span style="color:#dc2626">${criticalCount}</span></div>
            </div>
            <div class="card">
              <div class="card-label">Overall Status</div>
              <div class="card-value ${overallPct >= 75 ? "safe" : "danger"}" style="font-size: 15px; margin-top: 4px;">
                ${overallPct >= 75 ? "ELIGIBLE" : "DETENTION RISK"}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Type Breakdown</th>
                <th>Conducted</th>
                <th>Attended</th>
                <th>Missed</th>
                <th>Percentage</th>
                <th>Target</th>
                <th>Actionable Status</th>
              </tr>
            </thead>
            <tbody>
    `;

    periodSubjects.forEach((s) => {
      const missed = Math.max(0, s.totalConducted - s.totalAttended);
      const threshold = s.threshold || 75;
      
      let actionStatus = "";
      let pillClass = "pill-danger";
      let pctClass = "badge-danger";

      if (s.percentage >= 85) {
        pctClass = "badge-safe";
        pillClass = "pill-safe";
        const allowedBunks = Math.floor((s.totalAttended * 100) / threshold) - s.totalConducted;
        actionStatus = `Safe (+${Math.max(0, allowedBunks)} bunks left)`;
      } else if (s.percentage >= 75) {
        pctClass = "badge-warning";
        pillClass = "pill-warning";
        const allowedBunks = Math.floor((s.totalAttended * 100) / threshold) - s.totalConducted;
        actionStatus = `Borderline (+${Math.max(0, allowedBunks)} bunks left)`;
      } else {
        const needed = Math.ceil((threshold * s.totalConducted - 100 * s.totalAttended) / (100 - threshold));
        actionStatus = `Need +${Math.max(0, needed)} consecutive`;
      }

      // Compute Theory vs Lab breakdown
      const subRecords = records.filter((r) => r.subject_id === s.id);
      const theoryRecords = subRecords.filter((r) => (r.class_type || "theory").toLowerCase() === "theory");
      const labRecords = subRecords.filter((r) => (r.class_type || "").toLowerCase() === "lab");

      const tCond = theoryRecords.filter((r) => r.status !== "cancelled").length;
      const tAtt = theoryRecords.filter((r) => r.status === "present").length;
      const lCond = labRecords.filter((r) => r.status !== "cancelled").length;
      const lAtt = labRecords.filter((r) => r.status === "present").length;

      let typeBreakdownStr = "-";
      if (tCond > 0 && lCond > 0) {
        typeBreakdownStr = `T: ${tAtt}/${tCond} | L: ${lAtt}/${lCond}`;
      } else if (tCond > 0) {
        typeBreakdownStr = `Theory: ${tAtt}/${tCond}`;
      } else if (lCond > 0) {
        typeBreakdownStr = `Lab: ${lAtt}/${lCond}`;
      }

      htmlContent += `
        <tr>
          <td><strong>${s.name}</strong> <span style="color:#64748b">(${s.short_name})</span></td>
          <td style="color:#475569; font-size:11px;">${typeBreakdownStr}</td>
          <td>${s.totalConducted}</td>
          <td>${s.totalAttended}</td>
          <td style="color:${missed > 0 ? "#dc2626" : "#64748b"}">${missed}</td>
          <td class="${pctClass}">${s.percentage < 0 ? "-" : s.percentage + "%"}</td>
          <td>${threshold}%</td>
          <td><span class="status-pill ${pillClass}">${actionStatus}</span></td>
        </tr>
      `;
    });

    htmlContent += `
            </tbody>
          </table>

          <div class="footer-note">
            <span>Official Academic Audit Record • Computed mathematically from logged attendance records</span>
            <span>Thresholds: 🟢 &gt;85% Safe | 🟡 75-85% Borderline | 🔴 &lt;75% Critical</span>
          </div>
        </body>
      </html>
    `;

    if (Platform.OS === "web") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      } else {
        window.print();
      }
    } else {
      try {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Export Attendance PDF",
          });
        } else {
          alert("Sharing is not available on this device");
        }
      } catch (error) {
        alert("Failed to export PDF: " + error);
      }
    }
  };

  // Switch time period and reset calendar selections
  const handlePeriodSelect = (period: TimePeriod) => {
    setSelectedPeriod(period);
    setSelectedDay(null);
    setDropdownVisible(false);
  };

  return (
    <View style={styles.screen}>
      {/* Printable CSS style sheet override */}
      {Platform.OS === "web" && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            body { background: white !important; color: black !important; }
            .screen, scrollContent { padding: 0 !important; margin: 0 !important; }
            button, TouchableOpacity, .exportActionRow, .dropdownTrigger, .periodSelector, [role="button"] { display: none !important; }
            .heatmapCard, .matrixContainer { background: transparent !important; border: 1px solid #ddd !important; box-shadow: none !important; }
            .dayNumberText { color: #333 !important; }
            .legendText { color: #666 !important; }
            h1, h2, h3 { color: black !important; }
          }
        `,
          }}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Title Row */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>
            Smart insights and calendar tracking
          </Text>
        </View>

        {/* Sub-Tab Switcher Pill Bar */}
        <View style={styles.subTabBar}>
          {[
            { id: "planner", label: "Calendar & Bunk Planner", icon: "calendar-outline" },
            { id: "overview", label: "Insights & Matrix", icon: "bar-chart-outline" },
            { id: "quick_sim", label: "Quick Sim", icon: "flash-outline" },
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.subTabPill, isActive && styles.subTabPillActive]}
                onPress={() => setActiveSubTab(tab.id as any)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={14}
                  color={isActive ? palette.white : textColors.tertiary}
                />
                <Text
                  style={[styles.subTabPillText, isActive && styles.subTabPillTextActive]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeSubTab === "overview" && (
          <>
        {/* Dynamic Selector Dropdown Row & Exports */}
        <View style={styles.selectorRow}>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            activeOpacity={0.8}
            onPress={() => setDropdownVisible(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={accent.primary}
            />
            <Text style={styles.dropdownValue} numberOfLines={1}>
              {selectedPeriod?.label || "Loading..."}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={textColors.tertiary}
            />
          </TouchableOpacity>

          <View style={styles.exportActionRow}>
            <TouchableOpacity
              style={styles.actionPill}
              onPress={() => setHolidaySheetVisible(true)}
            >
              <Ionicons
                name="calendar-clear-outline"
                size={16}
                color={textColors.secondary}
              />
              <Text style={styles.actionPillText}>Holiday</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionPill}
              onPress={handleExportPDF}
            >
              <Ionicons
                name="print-outline"
                size={16}
                color={textColors.secondary}
              />
              <Text style={styles.actionPillText}>PDF</Text>
            </TouchableOpacity>
          </View>
        </View>



        {/* Faculty Insights (Canonical Semester Sourced) */}
        {facultyInsightsData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Faculty Insights</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -layout.screenPaddingH }}
              contentContainerStyle={{ paddingHorizontal: layout.screenPaddingH, gap: spacing.md }}
            >
              {facultyInsightsData.map((faculty) => {
                return (
                  <View key={faculty.key} style={styles.facultyCard}>
                    <View style={styles.facultyHeaderRow}>
                      <Text style={styles.facultyName} numberOfLines={1}>
                        {faculty.displayName}
                      </Text>
                      {faculty.subjectLabel ? (
                        <Text style={styles.facultySubjectBadge} numberOfLines={1}>
                          • {faculty.subjectLabel}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.facultyStatsRow}>
                      <View style={styles.facultyStatBox}>
                        <Text style={styles.facultyStatValue}>
                          {faculty.avgRating !== "N/A" ? `⭐ ${faculty.avgRating}` : "N/A"}
                        </Text>
                        <Text style={styles.facultyStatLabel}>Avg Rating</Text>
                      </View>
                      <View style={styles.facultyStatBox}>
                        <Text style={styles.facultyStatValue}>
                          {faculty.attended}/{faculty.conducted}
                        </Text>
                        <Text style={styles.facultyStatLabel}>Attended</Text>
                      </View>
                      <View style={styles.facultyStatBox}>
                        <Text
                          style={[
                            styles.facultyStatValue,
                            {
                              color:
                                faculty.attPerc >= 85
                                  ? gaugeColors.safe
                                  : faculty.attPerc >= 75
                                  ? gaugeColors.warning
                                  : gaugeColors.critical,
                            },
                          ]}
                        >
                          {faculty.attPerc}%
                        </Text>
                        <Text style={styles.facultyStatLabel}>Ratio</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Subject Risk Matrix with Compliance Lines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subject Risk Matrix</Text>
          <View style={styles.matrixContainer}>
            {periodSubjects.map((subject) => {
              let barColor: string = gaugeColors.critical;
              if (subject.percentage >= 85) barColor = gaugeColors.safe;
              else if (subject.percentage >= 75) barColor = gaugeColors.warning;

              return (
                <View key={subject.id} style={styles.matrixItem}>
                  <View style={styles.matrixHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.matrixSubjectName, { flexShrink: 1 }]} numberOfLines={1}>
                          {subject.name}
                        </Text>
                        <TouchableOpacity
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={[styles.simulateBtn, { alignSelf: 'flex-start', marginTop: 4 }]}
                          onPress={() => {
                            setSelectedSimSubject(subject);
                            setTimeout(() => simulatorRef.current?.present(), 0);
                          }}
                        >
                          <Ionicons name="calculator" size={10} color="#fff" />
                          <Text style={styles.simulateBtnText}>Simulate</Text>
                        </TouchableOpacity>
                      </View>
                    <Text
                      style={[styles.matrixPercentage, { color: barColor }]}
                    >{subject.percentage < 0 ? "-" : `${subject.percentage}%`}</Text>
                  </View>
                  <View style={styles.progressContainer} pointerEvents="none">
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(0, subject.percentage)}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />

                      {/* 75% Compliance line */}
                      <View style={[styles.markerLine, { left: "75%" }]}>
                        <Text style={[styles.markerLabel, { bottom: -14 }]}>
                          75%
                        </Text>
                      </View>

                      {/* 85% Compliance line */}
                      <View style={[styles.markerLine, { left: "85%" }]}>
                        <Text style={[styles.markerLabel, { bottom: -32 }]}>
                          85%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent History Log */}
        <View style={[styles.section, { marginTop: spacing["2xl"] }]}>
          <Text style={styles.sectionTitle}>Recent Log</Text>
          <View style={styles.historyList}>
            {records.slice(0, 10).map((r, idx) => {
              const subject = subjects.find((s) => s.id === r.subject_id);
              const isPresent = r.status === "present";
              return (
                <View key={idx} style={styles.historyItem}>
                  <View
                    style={[
                      styles.historyIcon,
                      {
                        backgroundColor: isPresent
                          ? attendanceColors.present.surface
                          : attendanceColors.absent.surface,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isPresent ? "checkmark" : "close"}
                      size={16}
                      color={
                        isPresent
                          ? attendanceColors.present.base
                          : attendanceColors.absent.base
                      }
                    />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historySubject}>
                      {subject?.name || "Unknown Subject"}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(r.date + "T00:00:00").toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isPresent
                          ? attendanceColors.present.surface
                          : attendanceColors.absent.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: isPresent
                            ? attendanceColors.present.base
                            : attendanceColors.absent.base,
                        },
                      ]}
                    >
                      {r.status}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        </>
        )}

        {/* Quick Sim Sub-Tab Body */}
        {activeSubTab === "quick_sim" && (
          <View style={styles.quickSimContainer}>
            <Text style={styles.quickSimSectionLabel}>SELECT SUBJECT</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -layout.screenPaddingH, marginBottom: spacing.md }}
              contentContainerStyle={{ paddingHorizontal: layout.screenPaddingH, gap: spacing.sm }}
            >
              {periodSubjects.map((sub) => {
                const isSelected = activeSimSubject?.id === sub.id;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[styles.simSubjectPill, isSelected && styles.simSubjectPillActive]}
                    onPress={() => {
                      setQuickSimSubjectId(sub.id);
                      setQuickSimAttended(0);
                      setQuickSimMissed(0);
                    }}
                  >
                    <Text
                      style={[styles.simSubjectPillText, isSelected && styles.simSubjectPillTextActive]}
                      numberOfLines={1}
                    >
                      {sub.short_name || sub.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Session Type Filter */}
            <View style={styles.simFilterRow}>
              {(["all", "theory", "lab", "tutorial"] as const).map((type) => {
                const isActive = quickSimClassType === type;
                const label =
                  type === "all" ? "All Sessions" : type.charAt(0).toUpperCase() + type.slice(1);
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.simTypePill, isActive && styles.simTypePillActive]}
                    onPress={() => {
                      setQuickSimClassType(type);
                      setQuickSimAttended(0);
                      setQuickSimMissed(0);
                    }}
                  >
                    <Text style={[styles.simTypePillText, isActive && styles.simTypePillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {activeSimSubject && (
              <View style={styles.quickSimCard}>
                <Text style={styles.quickSimSubjectTitle}>
                  {activeSimSubject.name} ({activeSimSubject.short_name})
                </Text>
                <Text style={styles.quickSimSubjectSub}>
                  Base: {quickSimBaseAttended} attended / {quickSimBaseConducted} conducted • Target: {activeSimSubject.threshold}%
                </Text>

                <View style={styles.quickSimGaugeWrapper}>
                  <AttendanceGauge
                    percentage={quickSimFinalPct}
                    threshold={activeSimSubject.threshold}
                    size={175}
                    strokeWidth={13}
                  />
                </View>

                {/* Verdict Card */}
                <View
                  style={[
                    styles.quickSimVerdictCard,
                    {
                      borderColor:
                        quickSimFinalPct >= activeSimSubject.threshold + 10
                          ? gaugeColors.safe
                          : quickSimFinalPct >= activeSimSubject.threshold
                          ? gaugeColors.warning
                          : gaugeColors.critical,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      quickSimFinalPct >= activeSimSubject.threshold
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={20}
                    color={
                      quickSimFinalPct >= activeSimSubject.threshold + 10
                        ? gaugeColors.safe
                        : quickSimFinalPct >= activeSimSubject.threshold
                        ? gaugeColors.warning
                        : gaugeColors.critical
                    }
                  />
                  <Text style={styles.quickSimVerdictText}>{quickSimVerdictText}</Text>
                </View>

                {/* Steppers */}
                <View style={styles.quickSimControlsRow}>
                  <View style={styles.quickSimControlBox}>
                    <Text style={styles.quickSimControlLabel}>Simulate Attended</Text>
                    <View style={styles.quickSimStepper}>
                      <TouchableOpacity
                        style={styles.quickSimStepperBtn}
                        onPress={() => setQuickSimAttended((prev) => Math.max(0, prev - 1))}
                      >
                        <Ionicons name="remove" size={18} color={textColors.primary} />
                      </TouchableOpacity>
                      <Text style={styles.quickSimStepperValue}>+{quickSimAttended}</Text>
                      <TouchableOpacity
                        style={styles.quickSimStepperBtn}
                        onPress={() => setQuickSimAttended((prev) => prev + 1)}
                      >
                        <Ionicons name="add" size={18} color={textColors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.quickSimControlBox}>
                    <Text style={styles.quickSimControlLabel}>Simulate Missed</Text>
                    <View style={styles.quickSimStepper}>
                      <TouchableOpacity
                        style={styles.quickSimStepperBtn}
                        onPress={() => setQuickSimMissed((prev) => Math.max(0, prev - 1))}
                      >
                        <Ionicons name="remove" size={18} color={textColors.primary} />
                      </TouchableOpacity>
                      <Text style={styles.quickSimStepperValue}>+{quickSimMissed}</Text>
                      <TouchableOpacity
                        style={styles.quickSimStepperBtn}
                        onPress={() => setQuickSimMissed((prev) => prev + 1)}
                      >
                        <Ionicons name="add" size={18} color={textColors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {(quickSimAttended > 0 || quickSimMissed > 0) && (
                  <TouchableOpacity
                    style={styles.quickSimResetBtn}
                    onPress={() => {
                      setQuickSimAttended(0);
                      setQuickSimMissed(0);
                    }}
                  >
                    <Text style={styles.quickSimResetText}>Reset Simulation</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Calendar Planner Sub-Tab Body */}
        {activeSubTab === "planner" && (
          <CalendarPlannerView
            subjects={subjects}
            records={records}
            holidays={holidays}
            activeSemester={activeSemester}
          />
        )}

        {/* Dynamic Period Selector Modal Dropdown */}
        <Modal
          visible={dropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDropdownVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setDropdownVisible(false)}
          >
            <View style={styles.dropdownContainer}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Select Period</Text>
                <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                  <Ionicons name="close" size={20} color={textColors.tertiary} />
                </TouchableOpacity>
              </View>
              {periods.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.dropdownItem,
                    selectedPeriod?.id === p.id && styles.dropdownItemActive,
                  ]}
                  onPress={() => handlePeriodSelect(p)}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedPeriod?.id === p.id &&
                        styles.dropdownItemTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                  {selectedPeriod?.id === p.id && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={accent.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Bottom padding for tab spacing */}
        <View
          style={{ height: layout.bottomNavHeight + spacing["3xl"] + 30 }}
        />
      </ScrollView>

      <HolidayManagerSheet
        visible={holidaySheetVisible}
        semesterId={undefined}
        onClose={() => setHolidaySheetVisible(false)}
        onRefresh={loadData}
      />
      <AttendanceSimulatorSheet
        ref={simulatorRef}
        subject={selectedSimSubject}
        records={records}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: canvas.base,
  },
  scrollContent: {
    paddingTop: Platform.OS === "web" ? spacing["3xl"] : spacing.xl,
    paddingHorizontal: layout.screenPaddingH,
  },

  // ── Header
  header: {
    marginBottom: spacing.md,
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

  // ── Selector Dropdown Row
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  dropdownTrigger: {
    minWidth: 140,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: glass.medium,
    borderWidth: 1,
    borderColor: border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  dropdownValue: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: textColors.primary,
  },
  exportActionRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: glass.light,
    borderWidth: 1,
    borderColor: border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  actionPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },

  // ── Semester Month Section Display
  monthSection: {
    marginBottom: spacing.xl,
  },
  monthSectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: textColors.primary,
    marginBottom: spacing.sm,
    textTransform: "capitalize",
  },

  // ── Heatmap Card and Grid Layouts
  heatmapCard: {
    backgroundColor: glass.subtle,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.low,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
  },
  heatmapGrid: {
    gap: 8,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between", // Maintains gaps between cells
  },
  heatCell: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: '13%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: border.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumberText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: palette.white,
  },
  heatmapLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: border.default,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: textColors.secondary,
  },

  // ── Selected Day Details Card
  detailCard: {
    backgroundColor: glass.medium,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing["2xl"],
    gap: spacing.md,
    ...shadow.medium,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: textColors.primary,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  detailStatusText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: textColors.primary,
  },
  detailStats: {
    gap: spacing.xs,
  },
  detailSubtext: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  detailLectureLog: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
    lineHeight: 20,
  },

  // ── Subject Risk Compliance Bar Layouts
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: textColors.primary,
    marginBottom: spacing.md,
  },
  matrixContainer: {
    gap: spacing.lg,
    backgroundColor: glass.light,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: border.default,
  },
  matrixItem: {
    gap: spacing.sm,
  },
  matrixHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matrixSubjectName: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: textColors.primary,
    flex: 1,
  },
  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  simulateBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    color: "#ffffff",
    textTransform: "uppercase",
  },
  matrixPercentage: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
  },
  progressContainer: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  progressTrack: {
    height: 8,
    backgroundColor: glass.medium,
    borderRadius: 4,
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  markerLine: {
    position: "absolute",
    top: 4,
    bottom: -16,
    width: 2,
    backgroundColor: border.medium,
    alignItems: "center",
    zIndex: 10,
  },
  markerLabel: {
    position: "absolute",
    bottom: -14,
    fontFamily: fontFamily.bold,
    fontSize: 7,
    color: textColors.tertiary,
    backgroundColor: "transparent",
    minWidth: 50,
    textAlign: "center",
  },

  // ── History Log Styles
  historyList: {
    gap: spacing.sm,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: glass.light,
    borderWidth: 1,
    borderColor: border.default,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  historyContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  historySubject: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: textColors.primary,
    marginBottom: 2,
  },
  historyDate: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: textColors.tertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    textTransform: "uppercase",
  },

  // ── Modal Selector Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  dropdownContainer: {
    backgroundColor: canvas.elevated,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.xl,
    width: "100%",
    maxWidth: 340,
    padding: spacing.lg,
    ...shadow.high,
  },
  dropdownTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: textColors.primary,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: border.default,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  dropdownItemActive: {
    backgroundColor: glass.light,
  },
  dropdownItemText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: textColors.secondary,
  },
  dropdownItemTextActive: {
    fontFamily: fontFamily.bold,
    color: accent.primary,
  },
  facultyCard: {
    backgroundColor: glass.medium,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: border.default,
    width: 260,
  },
  facultyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  facultyName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: textColors.primary,
    flexShrink: 1,
  },
  facultySubjectBadge: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: accent.primary,
    flexShrink: 1,
  },
  facultyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  facultyStatBox: {
    alignItems: 'center',
  },
  facultyStatValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.base,
    color: textColors.primary,
  },
  facultyStatLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
    marginTop: 2,
  },

  // ── Sub-Tab Switcher Bar
  subTabBar: {
    flexDirection: "row",
    backgroundColor: glass.medium,
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: border.default,
    gap: 4,
  },
  subTabPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: radius.full,
    gap: 6,
  },
  subTabPillActive: {
    backgroundColor: accent.primary,
  },
  subTabPillText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
  },
  subTabPillTextActive: {
    fontFamily: fontFamily.bold,
    color: palette.white,
  },

  // ── Quick Sim In-Page Styles
  quickSimContainer: {
    paddingBottom: spacing["3xl"],
  },
  quickSimSectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  simSubjectPill: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: glass.medium,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: border.default,
  },
  simSubjectPillActive: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: accent.primary,
  },
  simSubjectPillText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  simSubjectPillTextActive: {
    fontFamily: fontFamily.bold,
    color: accent.primary,
  },
  simFilterRow: {
    flexDirection: "row",
    backgroundColor: glass.medium,
    padding: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: border.default,
    marginBottom: spacing.md,
    gap: 4,
  },
  simTypePill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: radius.full,
  },
  simTypePillActive: {
    backgroundColor: accent.primary,
  },
  simTypePillText: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    color: textColors.secondary,
  },
  simTypePillTextActive: {
    fontFamily: fontFamily.bold,
    color: palette.white,
  },
  quickSimCard: {
    backgroundColor: canvas.elevated,
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: border.default,
  },
  quickSimSubjectTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: textColors.primary,
    textAlign: "center",
  },
  quickSimSubjectSub: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.tertiary,
    marginTop: 4,
    textAlign: "center",
  },
  quickSimGaugeWrapper: {
    marginVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  quickSimVerdictCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: glass.medium,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    width: "100%",
    marginBottom: spacing.lg,
  },
  quickSimVerdictText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.primary,
    flex: 1,
  },
  quickSimControlsRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
    marginBottom: spacing.md,
  },
  quickSimControlBox: {
    flex: 1,
    backgroundColor: glass.medium,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: border.default,
  },
  quickSimControlLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 10,
    color: textColors.tertiary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  quickSimStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  quickSimStepperBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: glass.light,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: border.subtle,
  },
  quickSimStepperValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: textColors.primary,
    minWidth: 28,
    textAlign: "center",
  },
  quickSimResetBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: glass.light,
    borderWidth: 1,
    borderColor: border.default,
  },
  quickSimResetText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: border.default,
  },
});
