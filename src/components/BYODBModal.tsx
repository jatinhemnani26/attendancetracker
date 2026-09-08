import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, accent, canvas, text as textColors, border } from '../theme/colors';
import { BYODBService, BYODBConfig } from '../services/BYODBService';

interface BYODBModalProps {
  visible: boolean;
  onClose: () => void;
  onConfigApplied: () => void;
}

export default function BYODBModal({ visible, onClose, onConfigApplied }: BYODBModalProps) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (visible) {
      BYODBService.getActiveConfig().then((cfg) => {
        setIsCustom(cfg.isCustom);
        if (cfg.isCustom) {
          setUrl(cfg.supabaseUrl);
          setAnonKey(cfg.supabaseAnonKey);
        } else {
          setUrl('');
          setAnonKey('');
        }
        setStatusMessage(null);
      });
    }
  }, [visible]);

  const handleTestAndSave = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter both your Supabase URL and Anon Key.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const check = await BYODBService.validateCredentials(url, anonKey);
    if (!check.success) {
      setIsLoading(false);
      setStatusMessage({ type: 'error', text: check.error || 'Connection failed. Verify your URL and Anon Key.' });
      return;
    }

    await BYODBService.saveConfig(url, anonKey);
    setIsLoading(false);
    setIsCustom(true);
    setStatusMessage({ type: 'success', text: 'Connected to custom Supabase database!' });
    
    setTimeout(() => {
      onConfigApplied();
      onClose();
    }, 800);
  };

  const handleReset = async () => {
    setIsLoading(true);
    await BYODBService.resetToDefault();
    setUrl('');
    setAnonKey('');
    setIsCustom(false);
    setIsLoading(false);
    setStatusMessage({ type: 'success', text: 'Reset to official project database.' });
    
    setTimeout(() => {
      onConfigApplied();
      onClose();
    }, 800);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="server-outline" size={20} color={accent.primary} />
              </View>
              <View>
                <Text style={styles.title}>Custom Database (BYODB)</Text>
                <Text style={styles.subtitle}>Bring Your Own Supabase Backend</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={textColors.disabled} />
            </TouchableOpacity>
          </View>

          {/* Privacy / Safety Notice */}
          <View style={styles.noticeBox}>
            <Ionicons name="shield-checkmark-outline" size={16} color={palette.emerald[400]} />
            <Text style={styles.noticeText}>
              Your credentials are saved strictly in your client storage and only query your Supabase instance.
            </Text>
          </View>

          {/* URL Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>SUPABASE PROJECT URL</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://xyzcompany.supabase.co"
              placeholderTextColor={textColors.disabled}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Anon Key Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>SUPABASE ANON PUBLIC KEY</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={anonKey}
              onChangeText={setAnonKey}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              placeholderTextColor={textColors.disabled}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={2}
              editable={!isLoading}
            />
          </View>

          {/* Status Message */}
          {statusMessage && (
            <View
              style={[
                styles.statusBox,
                statusMessage.type === 'error' ? styles.statusError : styles.statusSuccess,
              ]}
            >
              <Ionicons
                name={statusMessage.type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                size={16}
                color={statusMessage.type === 'error' ? palette.rose[400] : palette.emerald[400]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: statusMessage.type === 'error' ? palette.rose[400] : palette.emerald[400] },
                ]}
              >
                {statusMessage.text}
              </Text>
            </View>
          )}

          {/* Schema Guide Link */}
          <TouchableOpacity
            style={styles.schemaLink}
            onPress={() => Linking.openURL('https://github.com/jatinhemnani26/attendancetracker/blob/main/supabase/complete_schema.sql')}
          >
            <Ionicons name="document-text-outline" size={14} color={accent.primary} />
            <Text style={styles.schemaLinkText}>View complete_schema.sql in GitHub repo</Text>
          </TouchableOpacity>

          {/* Actions */}
          <View style={styles.actions}>
            {isCustom && (
              <TouchableOpacity style={styles.resetButton} onPress={handleReset} disabled={isLoading}>
                <Text style={styles.resetButtonText}>Reset to Default</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveButton, !isCustom && { flex: 1 }]}
              onPress={handleTestAndSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Connect Database</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans-Bold',
  },
  subtitle: {
    color: textColors.disabled,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 18,
  },
  noticeText: {
    color: palette.slate[300],
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    flex: 1,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: palette.slate[400],
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  inputMultiline: {
    height: 60,
    textAlignVertical: 'top',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  statusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusError: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    flex: 1,
  },
  schemaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  schemaLinkText: {
    color: accent.primary,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-SemiBold',
    textDecorationLine: 'underline',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: palette.slate[300],
    fontSize: 13,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  saveButton: {
    flex: 1.4,
    backgroundColor: accent.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans-Bold',
  },
});
