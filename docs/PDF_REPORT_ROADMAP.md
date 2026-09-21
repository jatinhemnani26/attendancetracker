# 📄 Attendance Audit & Compliance PDF Report — Roadmap & Feature Specs

> **Document Purpose:** Architectural blueprint and feature specifications for extending the Analytics PDF export into an institutional-grade, highly detailed attendance dossier. Stored for future implementation and design reference.

---

## 🏛️ 1. Executive Summary & Risk Intelligence (Page 1 Top)

### 1.1 Attendance Health Index (KPI Quadrant)
- **Cumulative Metric:** Overall Attendance % with clear visual gauge badge (Green `≥85%`, Amber `75%–84%`, Red `<75%`).
- **Lecture Volume:** Total Conducted vs Total Attended vs Total Missed vs Cancelled.
- **Compliance Status:** Official institutional eligibility badge:
  - `ELIGIBLE`: All subjects ≥ 75%.
  - `CONDITIONAL / CAUTION`: 1–2 subjects between 75% and 80%.
  - `DEFAULTER / DETAINED RISK`: At least one subject < 75%.
- **Safe Bunk Reserve:** Total number of lectures across all subjects that can still be missed before touching the 75% critical cutoff.

---

## 📊 2. Deep Subject & Faculty Ledger Table

| Column Name | Description | Example Data |
| :--- | :--- | :--- |
| **Course Code & Title** | Official catalog code + full name | `CS401 • Advanced Operating Systems` |
| **Faculty & Department** | Assigned professor + department tag | `Prof. S. P. Agrawal (CSE)` |
| **Session Breakdown** | Split counts by delivery format | `Theory: 22/28 (78%)`<br>`Lab: 10/10 (100%)`<br>`Tutorial: 4/4 (100%)` |
| **Total Volume** | Conducted, Attended, Missed | `Conducted: 42 \| Attended: 36 \| Missed: 6` |
| **Current %** | Color-coded percentage badge | `85.7%` 🟢 |
| **Target Cutoff** | Semester regulatory threshold | `75.0%` |
| **Compliance Action** | Precise mathematical verdict | `+4 Bunks Left` (Safe) or `Need +5 Consecutive Classes` (Critical) |

---

## 📅 3. Chronological Date-by-Date Absence Log (Defaulter Audit)

Instead of only showing aggregate counts, provide an itemized log of every missed or cancelled session:
- **Date & Day:** e.g., `Thursday, 12 Oct 2026`
- **Slot Time & Room:** `10:00 AM – 11:00 AM (Room 304, Tech Wing)`
- **Subject:** `Data Structures & Algorithms (Theory)`
- **Faculty:** `Dr. M. Sharma`
- **Status:** `Absent (Unexcused)` vs `Medical Leave` vs `College Duty / Proxy` vs `Class Cancelled`
- **Cumulative % at that date:** Trailing attendance percentage after that day's log.

---

## 📈 4. Visual Charts & Trend Sparklines (Embedded SVG / Canvas)

- **Semester Attendance Trajectory:** Line chart showing the week-by-week attendance progression from Day 1 to the current date, with a dotted horizontal line at 75%.
- **Theory vs Lab Parity Bars:** Horizontal progress bars comparing lecture compliance against practical/lab compliance.
- **Day-of-the-Week Absence Heatmap:** Small 5-column mini-chart showing which weekdays have the highest bunk rate (e.g., Monday mornings vs Friday afternoons).

---

## 🎯 5. Mathematical Recovery Timeline (The "Fix-My-Attendance" Plan)

For any subject in the **Caution** or **Defaulter** zone (<75%):
- **Deficit Classes:** Exact count of consecutive classes required to hit 75%.
- **Projected Recovery Date:** Based on the user's weekly timetable, automatically calculates the earliest calendar date the student can achieve compliance:
  > *Example: "At 3 lectures/week, attending all classes will restore DBMS to 75.0% by **November 6, 2026**."*
- **Maximum Attainable Attendance:** If the student attends 100% of remaining scheduled lectures until semester end, what is their theoretical ceiling?

---

## 🔒 6. Document Security & Institutional Validation Footer

- **System Identifier:** App version, runtime environment (`1.0.0`), and database transaction timestamp.
- **Verification Hash:** SHA-256 integrity checksum derived from the attendance record dataset.
- **Report Generation Timestamp:** `Generated on 22-Sep-2026 at 00:55:00 IST`.
- **Disclaimer:** Standard academic note stating this document reflects recorded student timetable telemetry and official college database synchronization.
