import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Polygon, Polyline, Circle, G, Text as SvgText,
  Rect, Defs, LinearGradient, Stop,
} from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { CampusBuilding, MAIN_PATHS } from '../../data/CampusBuildings';
import { MapNode } from '../../data/MapGraph';
import { accent } from '../../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface CampusSvgCanvasProps {
  width: number;
  height: number;
  buildings: CampusBuilding[];
  selectedBuildingId: string | null;
  is3D: boolean;
  activeFloor: number;
  route: { path: MapNode[]; minutes: number; distance: number } | null;
  livePosition: { x: number; y: number; heading: number } | null;
  onBuildingPress: (building: CampusBuilding) => void;
}

// ─── Utility Functions ──────────────────────────────────────────────

function parsePoints(points: string | undefined): { x: number; y: number }[] {
  if (!points) return [];
  return points.split(' ').map(p => {
    const [x, y] = p.split(',').map(Number);
    return { x: x || 0, y: y || 0 };
  });
}

function formatPoints(points: { x: number; y: number }[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

function getCenter(building: CampusBuilding): { x: number; y: number } {
  if (building.shapeType === 'circle' && building.circle) {
    return { x: building.circle.cx, y: building.circle.cy };
  }
  const points = parsePoints(building.polygon);
  if (points.length === 0) return { x: building.x, y: building.y };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function adjustColor(hex: string, amount: number): string {
  if (!hex) return '#000000';
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}



export const CampusSvgCanvas: React.FC<CampusSvgCanvasProps> = ({
  width,
  height,
  buildings,
  selectedBuildingId,
  is3D,
  activeFloor,
  route,
  livePosition,
  onBuildingPress,
}) => {
  // Route animation
  const dashOffset = useSharedValue(0);

  useEffect(() => {
    if (route) {
      dashOffset.value = withRepeat(
        withTiming(-24, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      dashOffset.value = 0;
    }
  }, [route]);

  const animatedPolylineProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  // GPS pulse animation
  const pulseRadius = useSharedValue(12);

  useEffect(() => {
    if (livePosition) {
      pulseRadius.value = withRepeat(
        withTiming(20, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        true
      );
    }
  }, [livePosition]);

  const animatedPulseProps = useAnimatedProps(() => ({
    r: pulseRadius.value,
    opacity: 1 - (pulseRadius.value - 12) / 16, // Fade as it expands
  }));

  // Sort buildings by Y for painter's algorithm
  const sortedBuildings = useMemo(() => {
    return [...buildings].sort((a, b) => {
      const aCenter = getCenter(a);
      const bCenter = getCenter(b);
      return aCenter.y - bCenter.y;
    });
  }, [buildings]);

  // ─── Render a single building ──────────────────────────────────────

  const renderBuilding = (building: CampusBuilding) => {
    const isSelected = selectedBuildingId === building.id;
    const center = getCenter(building);
    const heightFactor = building.heightFactor || 1;

    const dx = is3D ? -heightFactor * 6 : 0;
    const dy = is3D ? -heightFactor * 12 : 0;

    const darkColor = adjustColor(building.color, -40);
    const lightColor = adjustColor(building.color, 20);

    const isCircle = building.shapeType === 'circle' && building.circle;

    return (
      <G key={building.id} onPress={() => onBuildingPress(building)}>
        {/* ── Shadow ── */}
        {is3D && isCircle && (
          <Circle
            cx={building.circle!.cx + 8}
            cy={building.circle!.cy + 8}
            r={building.circle!.r}
            fill="#000000"
            opacity={0.25}
          />
        )}
        {is3D && !isCircle && building.polygon && (
          <Polygon
            points={formatPoints(parsePoints(building.polygon).map(p => ({ x: p.x + 8, y: p.y + 8 })))}
            fill="#000000"
            opacity={0.25}
          />
        )}

        {/* ── 3D Walls (Circle) ── */}
        {is3D && heightFactor > 0 && isCircle && (
          <G>
            <Circle cx={building.circle!.cx + dx / 2} cy={building.circle!.cy + dy / 2} r={building.circle!.r} fill={darkColor} />
            <Circle cx={building.circle!.cx + dx} cy={building.circle!.cy + dy} r={building.circle!.r} fill={lightColor} stroke="#ffffff" strokeWidth="1" />
          </G>
        )}

        {/* ── 3D Walls (Polygon) ── */}
        {is3D && heightFactor > 0 && !isCircle && building.polygon && (() => {
          const basePts = parsePoints(building.polygon!);
          const roofPts = basePts.map(p => ({ x: p.x + dx, y: p.y + dy }));
          return (
            <G>
              {basePts.map((p, i) => {
                const nextIdx = (i + 1) % basePts.length;
                const nextP = basePts[nextIdx];
                const wallPts = [
                  { x: p.x, y: p.y },
                  { x: nextP.x, y: nextP.y },
                  { x: nextP.x + dx, y: nextP.y + dy },
                  { x: p.x + dx, y: p.y + dy },
                ];
                return (
                  <Polygon
                    key={`wall-${building.id}-${i}`}
                    points={formatPoints(wallPts)}
                    fill={darkColor}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="0.5"
                  />
                );
              })}
              <Polygon points={formatPoints(roofPts)} fill={lightColor} stroke="#ffffff" strokeWidth="1" />
            </G>
          );
        })()}

        {/* ── Flat View ── */}
        {!is3D && isCircle && (
          <Circle
            cx={building.circle!.cx}
            cy={building.circle!.cy}
            r={building.circle!.r}
            fill={building.color}
            opacity={0.5}
            stroke="#ffffff"
            strokeWidth="1"
          />
        )}
        {!is3D && !isCircle && building.polygon && (
          <Polygon
            points={formatPoints(parsePoints(building.polygon))}
            fill={building.color}
            opacity={0.5}
            stroke="#ffffff"
            strokeWidth="1"
          />
        )}

        {/* ── Selection Highlight ── */}
        {isSelected && isCircle && (
          <Circle
            cx={building.circle!.cx + dx}
            cy={building.circle!.cy + dy}
            r={building.circle!.r + 3}
            fill="none"
            stroke={accent.primary}
            strokeWidth="3"
          />
        )}
        {isSelected && !isCircle && building.polygon && (
          <Polygon
            points={formatPoints(parsePoints(building.polygon!).map(p => ({ x: p.x + dx, y: p.y + dy })))}
            fill="none"
            stroke={accent.primary}
            strokeWidth="3"
          />
        )}

        {/* ── Building Label ── */}
        <SvgText
          x={center.x + dx}
          y={center.y + dy}
          fill="#ffffff"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
          alignmentBaseline="middle"
          pointerEvents="none"
        >
          {building.number}
        </SvgText>
      </G>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} viewBox="0 0 800 650">
        <Defs>
          <LinearGradient id="groundGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0F172A" stopOpacity="1" />
            <Stop offset="1" stopColor="#020617" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="routeGlow" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={accent.primary} stopOpacity="0.8" />
            <Stop offset="1" stopColor="#818CF8" stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#groundGrad)" />

        {/* Grid pattern for depth */}
        {Array.from({ length: 13 }, (_, i) => (
          <Rect key={`gv-${i}`} x={i * 65} y="0" width="1" height="650" fill="rgba(255,255,255,0.02)" />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <Rect key={`gh-${i}`} x="0" y={i * 65} width="800" height="1" fill="rgba(255,255,255,0.02)" />
        ))}

        {/* Main Paths (Roads) */}
        {MAIN_PATHS.map((path, idx) => (
          <G key={`main-path-${idx}`}>
            {/* Road body */}
            <Polyline
              points={path.nodes.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#334155"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Road edge */}
            <Polyline
              points={path.nodes.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#475569"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.3}
            />
            {/* Center dashes */}
            <Polyline
              points={path.nodes.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="5,5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        ))}



        {/* Buildings */}
        {sortedBuildings.map(renderBuilding)}

        {/* Route Line */}
        {route && route.path.length > 0 && (
          <G>
            {/* Glow shadow */}
            <Polyline
              points={route.path.map(n => `${n.x},${n.y}`).join(' ')}
              fill="none"
              stroke={accent.primary}
              strokeWidth="8"
              opacity={0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Animated dashes */}
            <AnimatedPolyline
              points={route.path.map(n => `${n.x},${n.y}`).join(' ')}
              fill="none"
              stroke={accent.primary}
              strokeWidth="4"
              strokeDasharray="12,6"
              animatedProps={animatedPolylineProps}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Distance markers */}
            {route.path.filter((_, i) => i > 0 && i % 10 === 0).map((n, i) => (
              <G key={`dist-${i}`}>
                <Circle cx={n.x} cy={n.y} r="8" fill="rgba(99,102,241,0.8)" />
                <SvgText x={n.x} y={n.y + 3} fill="#fff" fontSize="6" textAnchor="middle" fontWeight="bold">
                  {Math.round(i * 10 * 0.5)}m
                </SvgText>
              </G>
            ))}
          </G>
        )}

        {/* Live GPS Position */}
        {livePosition && (
          <G>
            {/* Outer pulse ring */}
            <AnimatedCircle
              cx={livePosition.x}
              cy={livePosition.y}
              fill="rgba(59, 130, 246, 0.15)"
              animatedProps={animatedPulseProps}
            />
            {/* Accuracy ring */}
            <Circle
              cx={livePosition.x}
              cy={livePosition.y}
              r="12"
              fill="rgba(59, 130, 246, 0.25)"
            />
            {/* Core dot */}
            <Circle
              cx={livePosition.x}
              cy={livePosition.y}
              r="6"
              fill="#3B82F6"
              stroke="#ffffff"
              strokeWidth="2"
            />
            {/* Heading arrow */}
            <Polygon
              points="-4,6 4,6 0,-8"
              fill="#ffffff"
              transform={`translate(${livePosition.x}, ${livePosition.y}) rotate(${livePosition.heading || 0})`}
            />
          </G>
        )}
      </Svg>
    </View>
  );
};
