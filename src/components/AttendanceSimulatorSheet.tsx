import React, { useCallback, useMemo, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { canvas, glass, border, text as textColors, shadow, accent, palette, gauge } from "../theme/colors";
import { fontFamily, fontSize } from "../theme/typography";
import { spacing, radius } from "../theme/spacing";
import AttendanceGauge from "./AttendanceGauge";

export interface AttendanceSimulatorSheetProps {
  subject: any;
  records?: any[];
}

export interface AttendanceSimulatorSheetRef {
  present: () => void;
  dismiss: () => void;
}

const AttendanceSimulatorSheet = forwardRef<AttendanceSimulatorSheetRef, AttendanceSimulatorSheetProps>(
  ({ subject, records }, ref) => {
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const [classTypeFilter, setClassTypeFilter] = useState<'all' | 'theory' | 'lab' | 'tutorial'>('all');

    useImperativeHandle(ref, () => ({
      present: () => {
        // Reset state on open
        setSimAttended(0);
        setSimMissed(0);
        setClassTypeFilter('all');
        setTimeout(() => bottomSheetModalRef.current?.present(), 0);
      },
      dismiss: () => {
        bottomSheetModalRef.current?.dismiss();
      },
    }));

    const snapPoints = useMemo(() => ["85%"], []);
    const [simAttended, setSimAttended] = useState(0);
    const [simMissed, setSimMissed] = useState(0);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.7} />
      ),
      []
    );

    const threshold = subject ? (subject.threshold || subject.target_threshold || 75) : 75;
    
    // Derive initial counts based on classTypeFilter
    const { initialConducted, initialAttended } = useMemo(() => {
      if (!subject) return { initialConducted: 0, initialAttended: 0 };
      if (classTypeFilter === 'all' || !records || records.length === 0) {
        return {
          initialConducted: subject.totalConducted || 0,
          initialAttended: subject.totalAttended || 0,
        };
      }
      const matchingRecords = records.filter(
        (r) => r.subject_id === subject.id && (r.class_type || 'theory').toLowerCase() === classTypeFilter
      );
      const conducted = matchingRecords.filter((r) => r.status !== 'cancelled').length;
      const attended = matchingRecords.filter((r) => r.status === 'present').length;
      return { initialConducted: conducted, initialAttended: attended };
    }, [subject, records, classTypeFilter]);

    const simTotalConducted = initialConducted + simAttended + simMissed;
    const simTotalAttended = initialAttended + simAttended;
    const simulatedPercentage = simTotalConducted === 0 ? 0 : Math.round((simTotalAttended / simTotalConducted) * 100);

    // Math engine
    let safeBunks = 0;
    let recoveryClasses = 0;

    if (simTotalConducted > 0) {
      const allowedBunks = Math.floor((simTotalAttended * 100) / threshold) - simTotalConducted;
      safeBunks = Math.max(0, allowedBunks);

      const needed = Math.ceil((threshold * simTotalConducted - 100 * simTotalAttended) / (100 - threshold));
      recoveryClasses = Math.max(0, needed);
    }

    const isSafe = simulatedPercentage >= threshold;

    let verdictText = "";
    let verdictColor = "";

    if (simulatedPercentage >= threshold + 10) {
      verdictText = `You are comfortably above ${threshold}%. Safe to miss ${safeBunks} classes.`;
      verdictColor = gauge.safe;
    } else if (simulatedPercentage >= threshold) {
      verdictText = `You are barely safe. Safe to miss ${safeBunks} classes.`;
      verdictColor = gauge.warning;
    } else {
      verdictText = `You are falling short! Need to attend ${recoveryClasses} consecutive classes.`;
      verdictColor = gauge.critical;
    }

    return (
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.contentContainer}>
          {!subject ? null : ( <>

          <View style={styles.header}>
            <Text style={styles.title}>Simulator</Text>
            <Text style={styles.subtitle}>{subject.name || subject.short_name}</Text>
          </View>

          {/* Session Type Filter Pills */}
          <View style={styles.filterRow}>
            {(['all', 'theory', 'lab', 'tutorial'] as const).map((type) => {
              const isActive = classTypeFilter === type;
              const label =
                type === 'all' ? 'All' : type === 'lab' ? 'Lab' : type === 'theory' ? 'Theory' : 'Tutorial';
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => {
                    setClassTypeFilter(type);
                    setSimAttended(0);
                    setSimMissed(0);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.gaugeContainer}>
            <AttendanceGauge
              percentage={simulatedPercentage}
              threshold={threshold}
              size={180}
              strokeWidth={12}
            />
          </View>

          <View style={styles.verdictCard}>
            <View style={[styles.verdictIndicator, { backgroundColor: verdictColor }]} />
            <Text style={styles.verdictText}>{verdictText}</Text>
          </View>

          <View style={styles.controlsContainer}>
            <View style={styles.controlBox}>
              <Text style={styles.controlLabel}>Simulate Attended</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => setSimAttended(Math.max(0, simAttended - 1))}
                >
                  <Ionicons name="remove" size={20} color={textColors.primary} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>+{simAttended}</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => setSimAttended(simAttended + 1)}
                >
                  <Ionicons name="add" size={20} color={textColors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.controlBox}>
              <Text style={styles.controlLabel}>Simulate Missed</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => setSimMissed(Math.max(0, simMissed - 1))}
                >
                  <Ionicons name="remove" size={20} color={textColors.primary} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>+{simMissed}</Text>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={() => setSimMissed(simMissed + 1)}
                >
                  <Ionicons name="add" size={20} color={textColors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          <TouchableOpacity style={styles.resetButton} onPress={() => { setSimAttended(0); setSimMissed(0); }}>
             <Text style={styles.resetText}>Reset Simulation</Text>
          </TouchableOpacity>
                  </>)}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: canvas.elevated,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
  },
  handleIndicator: {
    backgroundColor: border.subtle,
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["3xl"],
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: textColors.primary,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: textColors.secondary,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: glass.medium,
    padding: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: border.default,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  filterPillActive: {
    backgroundColor: accent.primary,
  },
  filterPillText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: textColors.secondary,
  },
  filterPillTextActive: {
    fontFamily: fontFamily.bold,
    color: palette.white,
  },
  gaugeContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.xl,
  },
  verdictCard: {
    flexDirection: "row",
    backgroundColor: glass.light,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    width: "100%",
    marginBottom: spacing["2xl"],
    borderWidth: 1,
    borderColor: border.default,
  },
  verdictIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  verdictText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: textColors.primary,
    flex: 1,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  controlBox: {
    flex: 1,
    backgroundColor: glass.medium,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: border.default,
  },
  controlLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: textColors.secondary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  stepperButton: {
    backgroundColor: glass.light,
    borderRadius: radius.full,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: border.subtle,
  },
  stepperValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
    color: textColors.primary,
    minWidth: 30,
    textAlign: "center",
  },
  resetButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: glass.light,
    borderWidth: 1,
    borderColor: border.default,
  },
  resetText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: textColors.secondary,
  }
});

export default AttendanceSimulatorSheet;
