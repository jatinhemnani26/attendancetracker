import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { 
  DEFAULT_SUPABASE_URL, 
  DEFAULT_SUPABASE_ANON_KEY, 
  switchSupabaseClient, 
  resetSupabaseClient 
} from '../lib/supabase';

const BYODB_STORAGE_KEY = '@attendance_byodb_config';
const GUEST_MODE_KEY = '@attendance_guest_mode';

export interface BYODBConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isCustom: boolean;
}

export const BYODBService = {
  /**
   * Loads any stored custom BYODB configuration and activates it.
   */
  async initConfig(): Promise<BYODBConfig | null> {
    try {
      const stored = await AsyncStorage.getItem(BYODB_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { supabaseUrl: string; supabaseAnonKey: string };
        if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
          switchSupabaseClient(parsed.supabaseUrl, parsed.supabaseAnonKey);
          return {
            supabaseUrl: parsed.supabaseUrl,
            supabaseAnonKey: parsed.supabaseAnonKey,
            isCustom: true,
          };
        }
      }
    } catch (e) {
      console.warn('BYODB init error:', e);
    }
    return null;
  },

  /**
   * Returns whether a custom database is currently active.
   */
  async getActiveConfig(): Promise<BYODBConfig> {
    try {
      const stored = await AsyncStorage.getItem(BYODB_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          supabaseUrl: parsed.supabaseUrl,
          supabaseAnonKey: parsed.supabaseAnonKey,
          isCustom: true,
        };
      }
    } catch {}
    return {
      supabaseUrl: DEFAULT_SUPABASE_URL,
      supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
      isCustom: false,
    };
  },

  /**
   * Tests whether the provided Supabase credentials are valid by querying auth session.
   */
  async validateCredentials(url: string, anonKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const trimmedUrl = url.trim().replace(/\/$/, '');
      const trimmedKey = anonKey.trim();

      if (!trimmedUrl.startsWith('https://')) {
        return { success: false, error: 'Project URL must begin with https://' };
      }
      if (trimmedKey.length < 20) {
        return { success: false, error: 'Invalid anon public API key format' };
      }

      const testClient = createClient(trimmedUrl, trimmedKey);
      const { error } = await testClient.auth.getSession();
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to connect to Supabase' };
    }
  },

  /**
   * Saves custom Supabase credentials and switches the active client.
   */
  async saveConfig(url: string, anonKey: string): Promise<void> {
    const trimmedUrl = url.trim().replace(/\/$/, '');
    const trimmedKey = anonKey.trim();
    await AsyncStorage.setItem(
      BYODB_STORAGE_KEY,
      JSON.stringify({ supabaseUrl: trimmedUrl, supabaseAnonKey: trimmedKey })
    );
    switchSupabaseClient(trimmedUrl, trimmedKey);
  },

  /**
   * Resets configuration back to official default Supabase.
   */
  async resetToDefault(): Promise<void> {
    await AsyncStorage.removeItem(BYODB_STORAGE_KEY);
    resetSupabaseClient();
  },

  /**
   * Checks if guest sandbox mode is enabled.
   */
  async isGuestMode(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(GUEST_MODE_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Sets guest sandbox mode status.
   */
  async setGuestMode(enabled: boolean): Promise<void> {
    if (enabled) {
      await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
    }
  },
};
