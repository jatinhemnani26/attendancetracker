import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const ExpoAsyncStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const DEFAULT_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ieimaotamtsywkvflknb.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaW1hb3RhbXRzeXdrdmZsa25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTc3NzEsImV4cCI6MjEwMDEzMzc3MX0.l2cwbexUtleArDHdRhO-v0B-GC3RAcDgue-JRYRURBQ';

export function createSupabaseInstance(url: string, anonKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: {
      storage: ExpoAsyncStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

let activeClient: SupabaseClient<Database> = createSupabaseInstance(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);

export function switchSupabaseClient(url: string, anonKey: string) {
  activeClient = createSupabaseInstance(url, anonKey);
}

export function resetSupabaseClient() {
  activeClient = createSupabaseInstance(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
}

export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const val = (activeClient as any)[prop];
    return typeof val === 'function' ? val.bind(activeClient) : val;
  },
});
