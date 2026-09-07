import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, StyleSheet, Dimensions, TextInput, TouchableOpacity,
  Text, ScrollView, DeviceEventEmitter, Keyboard,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { CampusSvgCanvas } from '../../components/map/CampusSvgCanvas';
import { BuildingDetailSheet } from '../../components/map/BuildingDetailSheet';
import { CAMPUS_BUILDINGS, CampusBuilding } from '../../data/CampusBuildings';
import { INDOOR_DIRECTORIES, IndoorRoom } from '../../data/IndoorDirectories';
import { PathfindingService } from '../../services/PathfindingService';
import { LocationService } from '../../services/LocationService';
import { MapNode } from '../../data/MapGraph';
import { canvas, text as textColors, border, accent } from '../../theme/colors';

const MAP_IMAGE_WIDTH = 800;
const MAP_IMAGE_HEIGHT = 650;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const categories = [
  { key: 'All', icon: 'apps', label: 'All' },
  { key: 'academic', icon: 'school', label: 'Depts' },
  { key: 'facility', icon: 'cafe', label: 'Facility' },
  { key: 'admin', icon: 'briefcase', label: 'Admin' },
];

function parsePoints(points: string | undefined): { x: number; y: number }[] {
  if (!points) return [];
  return points.split(' ').map(p => {
    const [x, y] = p.split(',').map(Number);
    return { x: x || 0, y: y || 0 };
  });
}

export default function CampusMapScreen() {
  const insets = useSafeAreaInsets();

  // ─── State ─────────────────────────────────────────────────────────
  const [selectedBuilding, setSelectedBuilding] = useState<CampusBuilding | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [is3D, setIs3D] = useState(false);
  const [floor, setFloor] = useState(0);
  const [navigatingTo, setNavigatingTo] = useState<CampusBuilding | null>(null);
  const [route, setRoute] = useState<{ path: MapNode[]; minutes: number; distance: number } | null>(null);
  const [showRoutePicker, setShowRoutePicker] = useState(false);
  const [routePickerMode, setRoutePickerMode] = useState<'from' | 'to'>('from');
  const [routeFrom, setRouteFrom] = useState<CampusBuilding | null>(null);
  const [livePosition, setLivePosition] = useState<{ x: number; y: number; heading: number } | null>(null);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [followUser, setFollowUser] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

  // ─── Gesture Shared Values ─────────────────────────────────────────
  const scale = useSharedValue(0.85);
  const savedScale = useSharedValue(0.85);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // ─── Refs ──────────────────────────────────────────────────────────
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Deterministic Point-in-Polygon (Raycasting) ───────────────────
  const isPointInPolygon = (x: number, y: number, vs: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].x, yi = vs[i].y;
      const xj = vs[j].x, yj = vs[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const handleMapTap = (screenX: number, screenY: number) => {
    // Exact touch-to-SVG transformation using dynamically measured viewport size
    const svgCenterX = MAP_IMAGE_WIDTH / 2;   // 400
    const svgCenterY = MAP_IMAGE_HEIGHT / 2;  // 325
    const viewportCenterX = viewportSize.width / 2;
    const viewportCenterY = viewportSize.height / 2;

    const svgX = (screenX - viewportCenterX - translateX.value) / scale.value + svgCenterX;
    const svgY = (screenY - viewportCenterY - translateY.value) / scale.value + svgCenterY;

    let hitBuilding: CampusBuilding | null = null;
    let minDistance = Infinity;
    let nearestBuilding: CampusBuilding | null = null;

    for (const b of CAMPUS_BUILDINGS) {
      const heightFactor = b.heightFactor || 1;
      const dx = is3D ? -heightFactor * 6 : 0;
      const dy = is3D ? -heightFactor * 12 : 0;

      // 1. Circle test (with 8px touch margin)
      if (b.shapeType === 'circle' && b.circle) {
        const dist = Math.hypot(svgX - (b.circle.cx + dx), svgY - (b.circle.cy + dy));
        if (dist <= b.circle.r + 8) {
          hitBuilding = b;
          break;
        }
      }

      // 2. Base polygon test
      if (b.polygon) {
        const basePts = parsePoints(b.polygon);
        if (isPointInPolygon(svgX, svgY, basePts)) {
          hitBuilding = b;
          break;
        }

        // 3. 3D roof polygon test (if 3D mode is active)
        if (is3D && heightFactor > 0) {
          const roofPts = basePts.map(p => ({ x: p.x + dx, y: p.y + dy }));
          if (isPointInPolygon(svgX, svgY, roofPts)) {
            hitBuilding = b;
            break;
          }
        }
      }

      // 4. Centroid proximity check (within 35px of building center / number badge)
      const bCenter = { x: b.x + dx, y: b.y + dy };
      const distToCenter = Math.hypot(svgX - bCenter.x, svgY - bCenter.y);
      if (distToCenter < minDistance) {
        minDistance = distToCenter;
        nearestBuilding = b;
      }
    }

    // Fallback: If tapped within 35px of a building's label or edge, select it
    if (!hitBuilding && nearestBuilding && minDistance <= 35) {
      hitBuilding = nearestBuilding;
    }

    if (hitBuilding) {
      handleSelectBuilding(hitBuilding);
    } else {
      // Tapped open ground — dismiss detail sheet
      if (selectedBuilding) {
        setSelectedBuilding(null);
        setTooltip(null);
      }
      setIsSearchFocused(false);
      Keyboard.dismiss();
    }
  };

  // ─── Gestures ──────────────────────────────────────────────────────
  const tapGesture = Gesture.Tap()
    .maxDistance(25)
    .maxDuration(350)
    .runOnJS(true)
    .onEnd((e) => {
      handleMapTap(e.x, e.y);
    });

  const panGesture = Gesture.Pan()
    .minDistance(12)
    .maxPointers(1)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
      if (followUser) {
        runOnJS(setFollowUser)(false);
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.4, Math.min(savedScale.value * e.scale, 4.0));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const composedGesture = Gesture.Simultaneous(
    tapGesture,
    Gesture.Simultaneous(panGesture, pinchGesture)
  );

  const animatedMapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ] as const,
  }));

  // ─── Smart Camera Framing (Google Maps Style) ──────────────────────
  const centerOnBuilding = (building: CampusBuilding, targetFloor = 0) => {
    const targetScale = 1.45;
    scale.value = withSpring(targetScale, { damping: 18, stiffness: 120 });
    savedScale.value = targetScale;

    const bx = building.x ?? (MAP_IMAGE_WIDTH / 2);
    const by = building.y ?? (MAP_IMAGE_HEIGHT / 2);

    // Frame building in upper 28% of screen so it floats cleanly above bottom sheet
    const targetScreenY = SCREEN_HEIGHT * 0.28;
    const tx = -(bx - 400) * targetScale;
    const ty = targetScreenY - (SCREEN_HEIGHT / 2) - (by - 325) * targetScale;

    translateX.value = withSpring(tx, { damping: 18, stiffness: 120 });
    translateY.value = withSpring(ty, { damping: 18, stiffness: 120 });
    savedTranslateX.value = tx;
    savedTranslateY.value = ty;
  };

  const centerOnCoordinates = (x: number, y: number) => {
    const targetScale = Math.max(scale.value, 1.3);
    scale.value = withSpring(targetScale);
    savedScale.value = targetScale;

    const tx = -(x - 400) * targetScale;
    const ty = -(y - 325) * targetScale;

    translateX.value = withSpring(tx);
    translateY.value = withSpring(ty);
    savedTranslateX.value = tx;
    savedTranslateY.value = ty;
  };

  // ─── Building Selection ────────────────────────────────────────────
  const handleSelectBuilding = (building: CampusBuilding, targetFloor = 0) => {
    setFloor(targetFloor);
    setSelectedBuilding(building);
    centerOnBuilding(building, targetFloor);
    setIsSearchFocused(false);
    Keyboard.dismiss();

    setTooltip({ x: building.x, y: building.y, name: building.name });
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 2500);
  };

  // ─── Event Listener for Timetable Deep Linking ─────────────────────
  useEffect(() => {
    const sub1 = DeviceEventEmitter.addListener(
      'navigate_map_building',
      ({ buildingId, floor: targetFloor = 0 }: { buildingId: string; floor?: number }) => {
        const found = CAMPUS_BUILDINGS.find(b => b.id === buildingId);
        if (found) {
          handleSelectBuilding(found, targetFloor);
        }
      }
    );

    const sub2 = DeviceEventEmitter.addListener(
      'NAVIGATE_TO_MAP',
      ({ roomNumber }: { roomNumber?: string }) => {
        if (!roomNumber) return;
        const q = String(roomNumber).toLowerCase().trim();
        let matchedBldg: CampusBuilding | null = null;
        let matchedFloor = 0;

        for (const [bldgId, floors] of Object.entries(INDOOR_DIRECTORIES)) {
          for (const [floorNum, rooms] of Object.entries(floors)) {
            for (const r of rooms) {
              if (r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) {
                matchedBldg = CAMPUS_BUILDINGS.find(b => b.id === bldgId) || null;
                matchedFloor = Number(floorNum);
                break;
              }
            }
            if (matchedBldg) break;
          }
          if (matchedBldg) break;
        }

        if (!matchedBldg) {
          matchedBldg = CAMPUS_BUILDINGS.find(
            b => b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q) || b.number === q
          ) || null;
        }

        if (matchedBldg) {
          handleSelectBuilding(matchedBldg, matchedFloor);
        }
      }
    );

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  // ─── Location Tracking & Follow-Me ─────────────────────────────────
  useEffect(() => {
    return () => {
      stopLiveTracking();
    };
  }, []);

  const startLiveTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      setIsLiveTracking(true);
      setFollowUser(true);

      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
        async (pos) => {
          try {
            const offset = await LocationService.getCalibrationOffset();
            const pix = LocationService.gpsToPixel(pos.coords.latitude, pos.coords.longitude, offset);
            const snapped = LocationService.snapToNearestPath(pix.x, pix.y);
            
            setLivePosition({
              x: snapped.x,
              y: snapped.y,
              heading: pos.coords.heading || 0,
            });

            if (followUser) {
              centerOnCoordinates(snapped.x, snapped.y);
            }
          } catch (e) {
            // Safe fallback
          }
        }
      );
    } catch (err) {
      setIsLiveTracking(false);
      setFollowUser(false);
    }
  };

  const stopLiveTracking = () => {
    setIsLiveTracking(false);
    setFollowUser(false);
    locationSub.current?.remove();
    locationSub.current = null;
    setLivePosition(null);
  };

  const handleToggleLocation = () => {
    if (!isLiveTracking) {
      startLiveTracking();
    } else if (!followUser && livePosition) {
      // Recenter on user
      setFollowUser(true);
      centerOnCoordinates(livePosition.x, livePosition.y);
    } else {
      stopLiveTracking();
    }
  };

  // ─── Calibration ───────────────────────────────────────────────────
  const handleCalibrateSpot = async () => {
    try {
      if (selectedBuilding) {
        const pos = await Location.getCurrentPositionAsync({});
        await LocationService.saveCalibrationOffset(selectedBuilding.id, pos.coords.latitude, pos.coords.longitude);
      }
    } catch (e) {}
  };

  // ─── Navigation ────────────────────────────────────────────────────
  const handleStartNavigation = (building: CampusBuilding) => {
    setNavigatingTo(building);
    setRouteFrom(null);
    setRoutePickerMode('from');
    setShowRoutePicker(true);
    setSelectedBuilding(null);
    setTooltip(null);
  };

  const handlePickBuilding = (building: CampusBuilding) => {
    if (routePickerMode === 'from') {
      setRouteFrom(building);
      setRoutePickerMode('to');
    } else {
      // Calculate route
      const fromId = routeFrom?.entranceNode || routeFrom?.id || '';
      const toId = building.entranceNode || building.id;
      const result = PathfindingService.findShortestPath(fromId, toId);
      if (result && result.path.length > 0) {
        setRoute({
          path: result.path,
          minutes: result.estimatedMinutes,
          distance: result.totalDistancePixels * 0.5,
        });
      }
      setShowRoutePicker(false);
      setNavigatingTo(building);
    }
  };

  const clearNavigation = () => {
    setRoute(null);
    setNavigatingTo(null);
    setRouteFrom(null);
    setShowRoutePicker(false);
  };

  // ─── Deep Room & Building Search ───────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const buildingMatches: { type: 'building'; building: CampusBuilding }[] = [];
    CAMPUS_BUILDINGS.forEach(b => {
      if (b.name.toLowerCase().includes(q) || b.shortName.toLowerCase().includes(q) || b.number.includes(q)) {
        buildingMatches.push({ type: 'building', building: b });
      }
    });

    const roomMatches: { type: 'room'; building: CampusBuilding; floor: number; room: IndoorRoom }[] = [];
    Object.entries(INDOOR_DIRECTORIES).forEach(([bldgId, floors]) => {
      const bldg = CAMPUS_BUILDINGS.find(b => b.id === bldgId);
      if (!bldg) return;

      Object.entries(floors).forEach(([floorNum, rooms]) => {
        rooms.forEach(r => {
          if (r.name.toLowerCase().includes(q)) {
            roomMatches.push({
              type: 'room',
              building: bldg,
              floor: Number(floorNum),
              room: r,
            });
          }
        });
      });
    });

    return [...buildingMatches.slice(0, 4), ...roomMatches.slice(0, 6)];
  }, [searchQuery]);

  // ─── Filtered Buildings by Category ────────────────────────────────
  const filteredBuildings = useMemo(() => {
    return CAMPUS_BUILDINGS.filter((b) => {
      if (selectedCategory === 'All') return true;
      return b.category === selectedCategory;
    });
  }, [selectedCategory]);

  const pickerBuildings = useMemo(() => {
    return CAMPUS_BUILDINGS.filter(b => {
      if (routePickerMode === 'from') return true;
      return b.id !== routeFrom?.id;
    });
  }, [routePickerMode, routeFrom]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header Controls (Safe Area Compliant) */}
      <View style={[styles.header, { top: Math.max(48, insets.top + 8) }]}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={textColors.secondary} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search buildings, labs, classrooms..."
            placeholderTextColor={textColors.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearchFocused(false); Keyboard.dismiss(); }} style={{ padding: 8 }}>
              <Ionicons name="close-circle" size={18} color={textColors.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete Dropdown */}
        {isSearchFocused && searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 220 }}>
              {searchResults.map((item, i) => {
                if (item.type === 'building') {
                  return (
                    <TouchableOpacity
                      key={`search_bldg_${item.building.id}_${i}`}
                      style={styles.searchResultItem}
                      onPress={() => {
                        handleSelectBuilding(item.building, 0);
                        setSearchQuery('');
                      }}
                    >
                      <View style={[styles.searchResultBadge, { backgroundColor: item.building.color }]}>
                        <Text style={styles.searchResultBadgeText}>{item.building.number}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchResultTitle}>{item.building.name}</Text>
                        <Text style={styles.searchResultSubtitle}>{item.building.shortName} • {item.building.type}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={textColors.tertiary} />
                    </TouchableOpacity>
                  );
                } else {
                  return (
                    <TouchableOpacity
                      key={`search_room_${item.room.id}_${i}`}
                      style={styles.searchResultItem}
                      onPress={() => {
                        handleSelectBuilding(item.building, item.floor);
                        setSearchQuery('');
                      }}
                    >
                      <View style={[styles.searchResultBadge, { backgroundColor: '#6366F1' }]}>
                        <Ionicons name="business" size={14} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchResultTitle}>{item.room.name}</Text>
                        <Text style={styles.searchResultSubtitle}>
                          {item.building.name} • Floor {item.floor === 0 ? 'G' : item.floor}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={accent.primary} />
                    </TouchableOpacity>
                  );
                }
              })}
            </ScrollView>
          </View>
        )}

        {/* Category Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, selectedCategory === cat.key && styles.categoryChipSelected]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={selectedCategory === cat.key ? '#fff' : textColors.secondary}
              />
              <Text style={[styles.categoryText, selectedCategory === cat.key && styles.categoryTextSelected]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 2D/3D & GPS Floating Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlButton} onPress={() => setIs3D(!is3D)} activeOpacity={0.8}>
            <Text style={styles.controlText}>{is3D ? '2D' : '3D'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isLiveTracking && styles.controlButtonActive,
              followUser && { backgroundColor: '#10B981', borderColor: '#10B981' },
            ]}
            onPress={handleToggleLocation}
            activeOpacity={0.8}
          >
            <Ionicons
              name={followUser ? 'navigate' : isLiveTracking ? 'location' : 'location-outline'}
              size={20}
              color={isLiveTracking ? '#fff' : textColors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Banner */}
      {route && navigatingTo && (
        <View style={[styles.banner, { top: Math.max(160, insets.top + 120) }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Navigating to {navigatingTo.name}</Text>
            <Text style={styles.bannerSubtitle}>
              🚶 {route.minutes} min · {Math.round(route.distance)}m
            </Text>
          </View>
          <TouchableOpacity onPress={clearNavigation} style={styles.bannerClose}>
            <Ionicons name="close-circle" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Route Picker Modal */}
      {showRoutePicker && (
        <View style={styles.routePickerOverlay}>
          <View style={styles.routePicker}>
            <Text style={styles.pickerTitle}>
              {routePickerMode === 'from' ? '📍 Select Start Location' : '🎯 Navigate to where?'}
            </Text>
            {routeFrom && routePickerMode === 'to' && (
              <Text style={styles.pickerFromLabel}>From: {routeFrom.name}</Text>
            )}

            {/* Use My Location Option */}
            {routePickerMode === 'from' && livePosition && (
              <TouchableOpacity
                style={[styles.pickerOption, { backgroundColor: 'rgba(59,130,246,0.15)' }]}
                onPress={() => {
                  setRouteFrom({
                    id: 'current_location',
                    name: 'My Location',
                    entranceNode: 'current_location',
                  } as any);
                  setRoutePickerMode('to');
                }}
              >
                <Ionicons name="navigate" size={18} color="#3B82F6" />
                <Text style={[styles.pickerOptionText, { color: '#3B82F6', fontWeight: 'bold' }]}>
                  Use My Location
                </Text>
              </TouchableOpacity>
            )}

            <ScrollView style={{ maxHeight: 300 }}>
              {pickerBuildings.map((b) => (
                <TouchableOpacity key={b.id} style={styles.pickerOption} onPress={() => handlePickBuilding(b)}>
                  <View style={[styles.pickerDot, { backgroundColor: b.color }]} />
                  <Text style={styles.pickerOptionText}>{b.name}</Text>
                  <Text style={styles.pickerShortName}>{b.shortName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity onPress={() => { setShowRoutePicker(false); clearNavigation(); }} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Map Canvas */}
      <View
        style={styles.mapContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setViewportSize({ width, height });
          }
        }}
      >
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.mapViewport, animatedMapStyle]}>
            <CampusSvgCanvas
              width={MAP_IMAGE_WIDTH}
              height={MAP_IMAGE_HEIGHT}
              buildings={filteredBuildings}
              selectedBuildingId={selectedBuilding?.id || null}
              is3D={is3D}
              activeFloor={floor}
              route={route}
              livePosition={livePosition}
              onBuildingPress={handleSelectBuilding}
            />
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Building Detail Sheet */}
      {selectedBuilding && (
        <BuildingDetailSheet
          building={selectedBuilding}
          floor={floor}
          onFloorChange={setFloor}
          onClose={() => { setSelectedBuilding(null); setTooltip(null); }}
          onNavigate={() => handleStartNavigation(selectedBuilding)}
          onCalibrate={handleCalibrateSpot}
        />
      )}

      {/* Map Legend */}
      <View style={[styles.legend, { bottom: Math.max(20, insets.bottom + 8) }]}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#475569' }]} />
          <Text style={styles.legendLabel}>Academic</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
          <Text style={styles.legendLabel}>Admin</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
          <Text style={styles.legendLabel}>Facility</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#334155' }]} />
          <Text style={styles.legendLabel}>Roads</Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 15,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(19, 26, 42, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    color: textColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  searchDropdown: {
    backgroundColor: '#0C111C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  searchResultBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  searchResultTitle: {
    color: textColors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultSubtitle: {
    color: textColors.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  categoryScroll: {
    gap: 6,
    marginBottom: 8,
    alignItems: 'center',
    paddingRight: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(19, 26, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
    borderColor: border.default,
    borderWidth: 1,
  },
  categoryChipSelected: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  categoryText: {
    color: textColors.secondary,
    fontSize: 12,
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  controlButton: {
    backgroundColor: 'rgba(19, 26, 42, 0.9)',
    padding: 10,
    borderRadius: 20,
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42,
    minHeight: 42,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  controlButtonActive: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  controlText: {
    color: textColors.primary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  mapViewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: accent.primary,
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  bannerClose: {
    padding: 4,
  },
  routePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  routePicker: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: canvas.elevated,
    padding: 20,
    borderRadius: 20,
    borderColor: border.default,
    borderWidth: 1,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  pickerTitle: {
    color: textColors.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  pickerFromLabel: {
    color: accent.primary,
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '600',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: border.default,
    gap: 10,
  },
  pickerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pickerOptionText: {
    color: textColors.primary,
    fontSize: 15,
    flex: 1,
  },
  pickerShortName: {
    color: textColors.tertiary,
    fontSize: 12,
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  cancelText: {
    color: accent.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
  legend: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(12, 17, 28, 0.92)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 5,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendLabel: {
    color: textColors.secondary,
    fontSize: 10,
  },
});
