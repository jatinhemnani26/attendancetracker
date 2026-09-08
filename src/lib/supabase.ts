import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { GuestModeService } from '../services/GuestModeService';

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

function createMockRealtimeChannel(topic: string = 'mock-channel') {
  const channelObj: any = {
    topic,
    params: {},
    subTopic: topic,
    on: () => channelObj,
    subscribe: (callback?: (status: string, err?: any) => void) => {
      if (typeof callback === 'function') {
        try {
          callback('SUBSCRIBED');
        } catch {}
      }
      return channelObj;
    },
    unsubscribe: async () => 'ok',
    send: async () => 'ok',
  };
  return channelObj;
}

export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    if (prop === 'auth') {
      const activeAuth = activeClient.auth;
      return new Proxy(activeAuth, {
        get(authTarget, authProp) {
          if (GuestModeService.isActive()) {
            if (authProp === 'getSession') {
              return async () => ({ data: { session: GuestModeService.getGuestSession() }, error: null });
            }
            if (authProp === 'getUser') {
              return async () => ({ data: { user: GuestModeService.getGuestSession().user }, error: null });
            }
            if (authProp === 'signOut') {
              return async () => {
                GuestModeService.disable();
                return { error: null };
              };
            }
          }
          if (authProp === 'onAuthStateChange') {
            return (callback: any) => {
              const guestUnsub = GuestModeService.subscribeAuth((event, session) => {
                callback(event, session);
              });
              const { data } = activeAuth.onAuthStateChange(callback);
              return {
                data: {
                  subscription: {
                    unsubscribe: () => {
                      guestUnsub();
                      data?.subscription?.unsubscribe();
                    },
                  },
                },
              };
            };
          }
          const val = (activeAuth as any)[authProp];
          return typeof val === 'function' ? val.bind(activeAuth) : val;
        },
      });
    }

    if (GuestModeService.isActive()) {
      if (prop === 'from') {
        return (table: string) => GuestModeService.createQuery(table);
      }
      if (prop === 'channel') {
        return (topic: string) => createMockRealtimeChannel(topic);
      }
      if (prop === 'removeChannel') {
        return async (_channel: any) => 'ok';
      }
      if (prop === 'removeAllChannels') {
        return async () => [];
      }
      if (prop === 'getChannels') {
        return () => [];
      }
      if (prop === 'rpc') {
        return async () => ({ data: null, error: null });
      }
    }

    const val = (activeClient as any)[prop];
    return typeof val === 'function' ? val.bind(activeClient) : val;
  },
});

