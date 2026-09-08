import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, accent } from '../theme/colors';

export const APK_DOWNLOAD_URL = 'https://expo.dev/artifacts/eas/AG27TWjpYW4S5nDgj3rdnxvSPS_0tAwvh6RN1vT_pqg.apk';

export default function WebDownloadBanner() {
  const [dismissed, setDismissed] = useState(false);

  // Only render on web browsers
  if (Platform.OS !== 'web' || dismissed) {
    return null;
  }

  const handleDownload = () => {
    Linking.openURL(APK_DOWNLOAD_URL).catch((err) => {
      console.error('Failed to open APK download link', err);
    });
  };

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Ionicons name="logo-android" size={16} color={palette.emerald[400]} />
          <Text style={styles.badgeText}>Android APK v1.0.0</Text>
        </View>
        <Text style={styles.message} numberOfLines={1}>
          For native background class alarms & offline sync, get the mobile app.
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.downloadBtn} 
          onPress={handleDownload}
          activeOpacity={0.8}
        >
          <Ionicons name="download-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.downloadBtnText}>Download App</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.closeBtn} 
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={palette.slate[400]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 99999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  badgeText: {
    color: palette.emerald[400],
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  message: {
    color: palette.slate[200],
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Medium',
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: accent.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  closeBtn: {
    padding: 4,
  },
});
