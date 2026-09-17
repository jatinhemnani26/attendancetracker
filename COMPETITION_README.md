# 🎓 Attendance Tracker & Campus GIS System
### 🏆 College Website & Web Application Competition Submission

---

## 📌 Executive Summary
**Attendance Tracker & Campus GIS System** is a next-generation, full-stack academic operating system and interactive campus wayfinding web application. Built for university students and faculty, it solves two critical campus challenges:
1. **Academic Attendance Compliance & Retention:** Real-time compliance monitoring, predictive bunk forecasting, and automated timetable scheduling.
2. **Campus Spatial Wayfinding:** An interactive 2D/3D vector GIS map of campus with indoor room directories and Dijkstra shortest-path navigation.

---

## 🌟 Key Innovations & Features

### 1. 📊 Master Compliance Dashboard & What-If Bunk Simulator
* **Dynamic Compliance Dial:** Circular progress dial tracking total attendance against university mandatory criteria (75%).
* **Predictive Bunk Simulator:** In-memory mathematical sandbox that calculates:
  * **Safe Bunks:** Exactly how many future lectures can be missed without breaching minimum thresholds.
  * **Recovery Count:** The exact streak of consecutive classes required to recover from a critical attendance percentage.
* **Live Class Stopwatch:** Real-time counter monitoring ongoing lecture duration.

### 2. 📅 Weekly Timetable & Smart Classroom Deep Linking
* **Day-by-Day Timetable:** Timetable with room numbers, teacher initials, and subject codes.
* **1-Tap Map Launcher:** Tapping the map icon next to any upcoming lecture instantly launches the campus map, highlights the correct building, and switches to the exact floor of that room.

### 3. 📈 Monthly Attendance Heatmap & Granular Analytics
* **GitHub-Style Heatmap:** Color-coded daily calendar (Present, Absent, Partial, Sunday, University Holiday).
* **Subject-Wise Analytics:** Detailed breakdown per subject, faculty member, and attendance margin.

### 4. 🗺️ Interactive Campus GIS Navigation Engine
* **Vector Map (2D & Isometric 3D):** Custom SVG rendering of 23 campus buildings with realistic walkways, roads, and 3D extruded heights.
* **Deterministic Point-in-Polygon (Raycasting):** Strict geometric hit-testing ensuring zero guesswork when tapping campus buildings.
* **Multi-Floor Indoor Directory:** Searchable directories for laboratories, HOD cabins, seminar halls, and classrooms across ground and upper floors.
* **Dijkstra Shortest-Path Wayfinding:** Graph-based pathfinding traversing around building perimeters along verified pedestrian pathways.
* **GPS Follow-Me Mode:** Real-time road-snapped location tracking with affine GPS-to-canvas coordinate transformation.

### 5. 🛠️ Campus Route Studio Pro (Standalone Web GIS Tool)
* Included in the root directory: `CampusRouteStudio.html`.
* A standalone, in-browser CAD/GIS wayfinding suite allowing campus administrators to:
  * Click and drag waypoints interactively.
  * Use magnetic snapping (🧲) to connect intersecting walkways.
  * Measure real-world distance in meters using an integrated distance ruler.
  * Test Dijkstra routing live between any two buildings.
  * Export pathway networks in both JSON and TypeScript formats.

---

## 💻 Tech Stack & Architecture

| Layer | Technologies Used |
|---|---|
| **Frontend Framework** | React 19, React Native Web (`react-native-web`), TypeScript |
| **Tooling & Build System** | Expo SDK 57, Metro Bundler, Babel |
| **Animations & Vector Graphics** | React Native Reanimated, SVG (`react-native-svg`) |
| **Backend & Database** | Supabase (PostgreSQL 15), Row-Level Security (RLS) |
| **Algorithms** | Dijkstra Shortest Path, Raycasting Point-in-Polygon, EMA GPS Smoothing |
| **Deployment** | Static HTML5/JS Web Export (`dist/`), Vercel (`vercel.json`) |

---

## 🚀 How to Run the Submission

### Option 1: Instant Production Web Preview (Recommended for Judges)
The production-optimized static website build is already pre-compiled inside the `dist/` directory:

1. Open your terminal in the project directory.
2. Run any static web server:
   ```bash
   npx serve dist
   # OR
   npx http-server dist
   ```
3. Open the provided `http://localhost:3000` (or `http://localhost:8080`) link in your web browser!

---

### Option 2: Run Full Source in Development Mode
To run the full source code with live hot-reloading:

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Start the Web Application:**
   ```bash
   npm run web
   ```
3. The application will start and open automatically in your browser at `http://localhost:8081`.

---

### Option 3: Launch Campus Route Studio Pro
Double-click `CampusRouteStudio.html` (or open it in Google Chrome / Microsoft Edge) to immediately use the standalone CAD/GIS pathway architect tool with no installation required!

---

## 📂 Project Structure

```
├── dist/                     # Pre-compiled, production-ready static web build
│   ├── index.html            # Main web entrypoint
│   ├── _expo/static/js/web/  # Compiled optimized JavaScript bundles
│   └── assets/               # Web assets & fonts
├── src/                      # Complete Application Source Code
│   ├── components/           # UI components (Attendance dial, bottom sheets, SVG canvas)
│   ├── screens/              # Screen views (Dashboard, Timetable, Analytics, Map)
│   ├── services/             # Pathfinding, Location, Database, Sync services
│   ├── data/                 # Campus buildings, indoor directories, pathway graph
│   └── theme/                # Theme tokens (colors, typography, spacing)
├── supabase/                 # PostgreSQL Database Schemas & Migrations
│   ├── complete_schema.sql   # Full PostgreSQL schema with tables, functions, & RLS
│   └── phase*.sql            # Incremental migrations
├── docs/                     # Visual showcase & screenshots
├── CampusRouteStudio.html    # Standalone In-Browser CAD/GIS Wayfinding Studio
├── CampusMapDigitizer.html   # Standalone Map Digitizing Tool
├── App.tsx                   # Main React Native / Web root application
├── package.json              # Project dependencies & scripts
├── tsconfig.json             # TypeScript configuration
└── vercel.json               # One-click deployment configuration for Vercel
```

---

## 🏆 Summary
This project represents a complete, production-grade engineering solution that bridges mobile-first responsive web design with advanced GIS graph algorithms, serving real-world utility for university campus life.
