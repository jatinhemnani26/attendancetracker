import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { MAP_NODES, MAP_EDGES } from '../data/MapGraph';
import { CAMPUS_BUILDINGS } from '../data/CampusBuildings';

const LOCATION_OFFSET_KEY = 'CAMPUS_GPS_OFFSET';
const LEARNED_BIAS_KEY = 'CAMPUS_LEARNED_BIAS_V1';

// ─── 1. HIGH PRECISION AFFINE TRANSFORMATION MATRIX ──────────────────────────
// Triangulated from high-confidence field anchors (Canteen, Admin, Civil)
// Maps geographic coordinates (lng, lat) directly to Campus SVG Canvas pixels (x, y)
export const DEFAULT_AFFINE_TRANSFORM = {
  a: 391072.655214,
  b: 211453.179539,
  c: -32360765.298345,
  d: 345768.801077,
  e: -284404.949555,
  f: -18117268.000862,
};

// ─── 2. GROUND TRUTH CALIBRATED GPS POINTS (17 Captured Landmarks) ───────────
export const GROUND_TRUTH_GPS: Record<string, { lat: number; lng: number; acc: number }> = {
  block_17: { lat: 22.2643869, lng: 70.7105637, acc: 97.8 }, // Canteen
  block_7: { lat: 22.2644470, lng: 70.7105838, acc: 15.3 },  // Computer Engineering
  block_8: { lat: 22.2644186, lng: 70.7105841, acc: 16.3 },  // Information Technology
  block_10: { lat: 22.2640071, lng: 70.7110983, acc: 35.8 }, // M Wing
  block_9: { lat: 22.2639702, lng: 70.7110926, acc: 38.3 },  // Electronics & Comm
  block_11: { lat: 22.2639796, lng: 70.7111171, acc: 40.5 }, // Mechanical Workshop
  block_12: { lat: 22.2639722, lng: 70.7112840, acc: 21.6 }, // Civil Engineering
  block_5: { lat: 22.2644395, lng: 70.7110064, acc: 28.5 },  // Mechanical Engineering
  block_4: { lat: 22.2645372, lng: 70.7111940, acc: 16.9 },  // Bio Technology
  block_3: { lat: 22.2647752, lng: 70.7112053, acc: 17.5 },  // Chemical Engineering
  block_1: { lat: 22.2650616, lng: 70.7113240, acc: 26.4 },  // Admin Block
  block_15: { lat: 22.2647598, lng: 70.7112203, acc: 20.8 }, // Central Garden
  block_16: { lat: 22.2648304, lng: 70.7119777, acc: 16.9 }, // Central Library
  block_13a: { lat: 22.2647858, lng: 70.7113720, acc: 18.2 },// Classrooms 13A
  block_13b: { lat: 22.2647604, lng: 70.7111962, acc: 20.1 },// Classrooms 13B
  block_13e: { lat: 22.2646504, lng: 70.7112207, acc: 19.5 },// Classrooms 13E
  block_13f: { lat: 22.2647793, lng: 70.7113793, acc: 18.7 },// Classrooms 13F
};

// ─── 3. STATEFUL SMOOTHING & OUTLIER MEMORY ──────────────────────────────────
let previousSmoothedPos: { x: number; y: number } | null = null;
let lastFixTimestamp = 0;
let learnedBiasCache: { dx: number; dy: number } | null = null;

export const LocationService = {
  /**
   * Request high-accuracy GPS permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      console.warn("GPS Permission Error:", e);
      return false;
    }
  },

  /**
   * Outlier & Glitch Gate:
   * Discards inaccurate satellite fixes (> 40m) or teleportation jumps.
   */
  isValidFix(lat: number, lng: number, accuracyMeters?: number | null): boolean {
    // 1. Campus Geo-fence sanity check (Rajkot campus approx bounding box)
    if (lat < 22.25 || lat > 22.28 || lng < 70.69 || lng > 70.73) {
      return false;
    }
    // 2. Reject fixes with high dilution of precision / large uncertainty
    if (accuracyMeters != null && accuracyMeters > 40) {
      return false;
    }
    return true;
  },

  /**
   * Translates (lat, lng) to SVG (x, y) coordinates using the calibrated Affine Matrix.
   */
  gpsToPixel(lat: number, lng: number, offset = { dx: 0, dy: 0 }): { x: number; y: number } {
    const { a, b, c, d, e, f } = DEFAULT_AFFINE_TRANSFORM;

    // Direct affine linear transformation
    const rawX = a * lng + b * lat + c;
    const rawY = d * lng + e * lat + f;

    // Apply manual or learned bias offsets
    const biasX = learnedBiasCache ? learnedBiasCache.dx : 0;
    const biasY = learnedBiasCache ? learnedBiasCache.dy : 0;

    return {
      x: rawX + offset.dx + biasX,
      y: rawY + offset.dy + biasY,
    };
  },

  /**
   * Exponential Moving Average (EMA) / Low-Pass Smoother:
   * Prevents discrete GPS jumps and blue-dot vibration.
   */
  smoothPosition(rawX: number, rawY: number, alpha = 0.35): { x: number; y: number } {
    const now = Date.now();
    const dt = (now - lastFixTimestamp) / 1000;
    lastFixTimestamp = now;

    if (!previousSmoothedPos) {
      previousSmoothedPos = { x: rawX, y: rawY };
      return previousSmoothedPos;
    }

    // Velocity check: if jump distance exceeds pedestrian walking speed (> 15m/s), soften jump
    const jumpDist = Math.hypot(rawX - previousSmoothedPos.x, rawY - previousSmoothedPos.y);
    const speed = dt > 0 ? jumpDist / dt : 0;
    const effectiveAlpha = speed > 40 ? 0.15 : alpha;

    const smoothX = effectiveAlpha * rawX + (1 - effectiveAlpha) * previousSmoothedPos.x;
    const smoothY = effectiveAlpha * rawY + (1 - effectiveAlpha) * previousSmoothedPos.y;

    previousSmoothedPos = { x: smoothX, y: smoothY };
    return previousSmoothedPos;
  },

  /**
   * Map-Matching / Road Snapper:
   * Orthogonally projects the smoothed position onto the nearest active walkway segment.
   * Keeps the dot locked to physical pathways when within threshold (default 38px ≈ 19m).
   */
  snapToNearestPath(x: number, y: number, maxSnapDistance = 38): { x: number; y: number; isSnapped: boolean } {
    let closestX = x;
    let closestY = y;
    let minDistance = Infinity;

    for (const edge of MAP_EDGES) {
      const n1 = MAP_NODES.find(n => n.id === edge.from);
      const n2 = MAP_NODES.find(n => n.id === edge.to);
      if (!n1 || !n2) continue;

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      let t = ((x - n1.x) * dx + (y - n1.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = n1.x + t * dx;
      const projY = n1.y + t * dy;

      const dist = Math.hypot(x - projX, y - projY);

      if (dist < minDistance) {
        minDistance = dist;
        closestX = projX;
        closestY = projY;
      }
    }

    if (minDistance <= maxSnapDistance) {
      return { x: closestX, y: closestY, isSnapped: true };
    }
    return { x, y, isSnapped: false };
  },

  /**
   * Geofencing & Arrival Detection:
   * Checks if user is within the arrival radius of the target door node.
   */
  checkArrival(currentX: number, currentY: number, targetEntranceId: string, arrivalRadiusPx = 28): boolean {
    const targetNode = MAP_NODES.find(n => n.id === targetEntranceId);
    if (!targetNode) return false;
    const dist = Math.hypot(currentX - targetNode.x, currentY - targetNode.y);
    return dist <= arrivalRadiusPx;
  },

  /**
   * Adaptive "Robot" Learning / Residual Bias Correction:
   * When user marks attendance or arrives at a building, compares the GPS position
   * with the building's known ground truth to continuously tune calibration.
   */
  async recordArrivalCorrection(buildingId: string, userLat: number, userLng: number): Promise<{ dx: number; dy: number }> {
    const building = CAMPUS_BUILDINGS.find(b => b.id === buildingId);
    if (!building) return { dx: 0, dy: 0 };

    const uncorrected = this.gpsToPixel(userLat, userLng, { dx: 0, dy: 0 });
    const residualDx = Math.round(building.x - uncorrected.x);
    const residualDy = Math.round(building.y - uncorrected.y);

    // Limit maximum single-step correction to prevent runaway offsets
    const clampedDx = Math.max(-40, Math.min(40, residualDx));
    const clampedDy = Math.max(-40, Math.min(40, residualDy));

    // Blend 25% of the new observation into existing learned bias
    const existing = await this.getLearnedBias();
    const newDx = Math.round(existing.dx * 0.75 + clampedDx * 0.25);
    const newDy = Math.round(existing.dy * 0.75 + clampedDy * 0.25);

    learnedBiasCache = { dx: newDx, dy: newDy };
    try {
      await AsyncStorage.setItem(LEARNED_BIAS_KEY, JSON.stringify(learnedBiasCache));
    } catch (e) {
      console.warn("Failed to store learned bias:", e);
    }

    return learnedBiasCache;
  },

  /**
   * Loads cached learned residual bias from AsyncStorage.
   */
  async getLearnedBias(): Promise<{ dx: number; dy: number }> {
    if (learnedBiasCache) return learnedBiasCache;
    try {
      const stored = await AsyncStorage.getItem(LEARNED_BIAS_KEY);
      if (stored) {
        learnedBiasCache = JSON.parse(stored);
        return learnedBiasCache!;
      }
    } catch (e) {}
    return { dx: 0, dy: 0 };
  },

  /**
   * Manual Single-Spot Calibration (backwards compatibility).
   */
  async saveCalibrationOffset(buildingId: string, currentLat: number, currentLng: number) {
    const targetBuilding = CAMPUS_BUILDINGS.find(b => b.id === buildingId);
    if (!targetBuilding) return { dx: 0, dy: 0 };

    const uncalibratedPix = this.gpsToPixel(currentLat, currentLng, { dx: 0, dy: 0 });
    const dx = Math.round(targetBuilding.x - uncalibratedPix.x);
    const dy = Math.round(targetBuilding.y - uncalibratedPix.y);
    const offset = { dx, dy };
    
    try {
      await AsyncStorage.setItem(LOCATION_OFFSET_KEY, JSON.stringify(offset));
    } catch (e) {
      console.warn("Save Calibration Error:", e);
    }
    return offset;
  },

  async getCalibrationOffset(): Promise<{ dx: number; dy: number }> {
    try {
      const stored = await AsyncStorage.getItem(LOCATION_OFFSET_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { dx: 0, dy: 0 };
  },

  async resetCalibration(): Promise<{ dx: number; dy: number }> {
    try {
      await AsyncStorage.removeItem(LOCATION_OFFSET_KEY);
      await AsyncStorage.removeItem(LEARNED_BIAS_KEY);
      learnedBiasCache = null;
      previousSmoothedPos = null;
    } catch (e) {
      console.warn("Reset Calibration Error:", e);
    }
    return { dx: 0, dy: 0 };
  }
};
