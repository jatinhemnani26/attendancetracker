/**
 * GuestModeService — Ephemeral In-Memory & Session Storage Sandbox
 * 
 * Provides a zero-database, client-only sandbox for public visitors.
 * All operations are kept purely in browser sessionStorage / local memory.
 * The moment the browser tab is closed, all guest data vanishes cleanly.
 */

import { Platform } from 'react-native';

const GUEST_SESSION_KEY = '@attendance_guest_active';
const GUEST_DATA_KEY = '@attendance_guest_tables_v1';

export interface GuestStore {
  profiles: any[];
  academic_semesters: any[];
  timetable_versions: any[];
  subjects: any[];
  timetable_slots: any[];
  attendance_records: any[];
  holidays: any[];
  academic_tasks: any[];
}

let inMemoryStore: GuestStore | null = null;
let isGuestActive = false;

// Initial high-fidelity seed data
function createSeedData(): GuestStore {
  const userId = 'guest-user-001';
  const semId = 'sem-guest-1';
  const verId = 'ver-guest-1';

  const sub1 = 'sub-dsa-1';
  const sub2 = 'sub-cn-2';
  const sub3 = 'sub-dbms-3';
  const sub4 = 'sub-os-4';
  const sub5 = 'sub-wt-5';

  const subjects = [
    {
      id: sub1,
      user_id: userId,
      semester_id: semId,
      name: 'Data Structures & Algorithms',
      short_name: 'DSA',
      color: '#10B981',
      target_threshold: 75,
      credits: 4,
      teachers: ['Dr. Sharma'],
      created_at: new Date().toISOString(),
    },
    {
      id: sub2,
      user_id: userId,
      semester_id: semId,
      name: 'Computer Networks',
      short_name: 'CN',
      color: '#6366F1',
      target_threshold: 75,
      credits: 3,
      teachers: ['Prof. Verma'],
      created_at: new Date().toISOString(),
    },
    {
      id: sub3,
      user_id: userId,
      semester_id: semId,
      name: 'Database Management Systems',
      short_name: 'DBMS',
      color: '#0EA5E9',
      target_threshold: 75,
      credits: 4,
      teachers: ['Dr. Gupta'],
      created_at: new Date().toISOString(),
    },
    {
      id: sub4,
      user_id: userId,
      semester_id: semId,
      name: 'Operating Systems',
      short_name: 'OS',
      color: '#F43F5E',
      target_threshold: 75,
      credits: 4,
      teachers: ['Prof. Patel'],
      created_at: new Date().toISOString(),
    },
    {
      id: sub5,
      user_id: userId,
      semester_id: semId,
      name: 'Web Technologies & Cloud',
      short_name: 'WT',
      color: '#8B5CF6',
      target_threshold: 75,
      credits: 3,
      teachers: ['Dr. Iyer'],
      created_at: new Date().toISOString(),
    },
  ];

  // Timetable slots (Mon=1 to Fri=5)
  const timetable_slots = [
    { id: 'slot-1', user_id: userId, semester_id: semId, version_id: verId, subject_id: sub1, day_of_week: 1, start_time: '09:00', end_time: '10:00', room_number: 'LH-101', class_type: 'theory', default_teacher: 'Dr. Sharma' },
    { id: 'slot-2', user_id: userId, semester_id: semId, version_id: verId, subject_id: sub2, day_of_week: 1, start_time: '10:00', end_time: '11:00', room_number: 'LH-102', class_type: 'theory', default_teacher: 'Prof. Verma' },
    { id: 'slot-3', user_id: userId, semester_id: semId, version_id: verId, subject_id: sub3, day_of_week: 2, start_time: '09:00', end_time: '10:00', room_number: 'Lab-3', class_type: 'lab', default_teacher: 'Dr. Gupta' },
    { id: 'slot-4', user_id: userId, semester_id: semId, version_id: verId, subject_id: sub4, day_of_week: 2, start_time: '11:00', end_time: '12:00', room_number: 'LH-201', class_type: 'theory', default_teacher: 'Prof. Patel' },
    { id: 'slot-5', user_id: userId, semester_id: semId, version_id: verId, subject_id: sub5, day_of_week: 3, start_time: '10:00', end_time: '11:00', room_number: 'LH-105', class_type: 'theory', default_teacher: 'Dr. Iyer' },
    { id: 'slot-6', user_id: userId, semester_id: semId, version_id: verId, subject_id: sub1, day_of_week: 4, start_time: '09:00', end_time: '10:00', room_number: 'LH-101', class_type: 'theory', default_teacher: 'Dr. Sharma' },
    { id: 'slot-7', user_id: userId, semester_id: semId, version_id: verId, subject_id: sub2, day_of_week: 5, start_time: '14:00', end_time: '15:00', room_number: 'Lab-1', class_type: 'lab', default_teacher: 'Prof. Verma' },
  ];

  // Past 20 days attendance logs (showing high compliance ~82%)
  const attendance_records: any[] = [];
  const today = new Date();
  for (let i = 25; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const day = d.getDay();

    if (day >= 1 && day <= 5) {
      // Pick 2 subjects for that day
      const sA = subjects[(i + 1) % subjects.length];
      const sB = subjects[(i + 3) % subjects.length];
      
      attendance_records.push({
        id: `rec-${i}-A`,
        user_id: userId,
        subject_id: sA.id,
        date: dateStr,
        status: i % 7 === 0 ? 'absent' : 'present',
        ist_start_time: '09:00:00',
        ist_end_time: '10:00:00',
        class_type: 'theory',
        teacher_name: sA.teachers[0],
        created_at: d.toISOString(),
      });

      attendance_records.push({
        id: `rec-${i}-B`,
        user_id: userId,
        subject_id: sB.id,
        date: dateStr,
        status: 'present',
        ist_start_time: '11:00:00',
        ist_end_time: '12:00:00',
        class_type: 'theory',
        teacher_name: sB.teachers[0],
        created_at: d.toISOString(),
      });
    }
  }

  const academic_tasks = [
    {
      id: 'task-1',
      user_id: userId,
      subject_id: sub1,
      title: 'DSA: Implement Red-Black Trees & Benchmarks',
      task_type: 'assignment',
      priority: 'high',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
      is_completed: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'task-2',
      user_id: userId,
      subject_id: sub3,
      title: 'DBMS: B+ Tree Indexing Practical Quiz',
      task_type: 'quiz',
      priority: 'medium',
      due_date: new Date(Date.now() + 86400000 * 5).toISOString(),
      is_completed: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'task-3',
      user_id: userId,
      subject_id: sub2,
      title: 'CN: Wireshark Packet Capture Report',
      task_type: 'assignment',
      priority: 'low',
      due_date: new Date(Date.now() + 86400000 * 7).toISOString(),
      is_completed: true,
      created_at: new Date().toISOString(),
    },
  ];

  return {
    profiles: [
      {
        id: userId,
        full_name: 'Guest Student',
        college_name: 'Campus Engineering College',
        default_target_threshold: 75,
        created_at: new Date().toISOString(),
      },
    ],
    academic_semesters: [
      {
        id: semId,
        user_id: userId,
        name: 'Spring Semester 2026',
        start_date: '2026-01-05',
        end_date: '2026-06-30',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    timetable_versions: [
      {
        id: verId,
        user_id: userId,
        semester_id: semId,
        name: 'Spring Schedule',
        start_date: '2026-01-05',
        end_date: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    subjects,
    timetable_slots,
    attendance_records,
    holidays: [],
    academic_tasks,
  };
}

// Session Storage / Memory persistence
function loadStore(): GuestStore {
  if (inMemoryStore) return inMemoryStore;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(GUEST_DATA_KEY);
      if (raw) {
        inMemoryStore = JSON.parse(raw);
        return inMemoryStore!;
      }
    } catch {}
  }
  inMemoryStore = createSeedData();
  saveStore(inMemoryStore);
  return inMemoryStore;
}

function saveStore(store: GuestStore) {
  inMemoryStore = store;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(GUEST_DATA_KEY, JSON.stringify(store));
    } catch {}
  }
}

type AuthListener = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: any) => void;
const authListeners = new Set<AuthListener>();

export const GuestModeService = {
  subscribeAuth(listener: AuthListener) {
    authListeners.add(listener);
    return () => authListeners.delete(listener);
  },

  notifyAuth(event: 'SIGNED_IN' | 'SIGNED_OUT', session: any) {
    authListeners.forEach((l) => {
      try { l(event, session); } catch {}
    });
  },

  isActive(): boolean {
    if (isGuestActive) return true;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        return window.sessionStorage.getItem(GUEST_SESSION_KEY) === 'true';
      } catch {
        return false;
      }
    }
    return false;
  },

  enable(): void {
    isGuestActive = true;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(GUEST_SESSION_KEY, 'true');
      } catch {}
    }
    loadStore();
    this.notifyAuth('SIGNED_IN', this.getGuestSession());
  },

  disable(): void {
    isGuestActive = false;
    inMemoryStore = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(GUEST_SESSION_KEY);
        window.sessionStorage.removeItem(GUEST_DATA_KEY);
      } catch {}
    }
    this.notifyAuth('SIGNED_OUT', null);
  },

  getGuestSession() {
    return {
      user: {
        id: 'guest-user-001',
        email: 'guest@attendancetracker.demo',
        user_metadata: { full_name: 'Guest Student' },
      },
      access_token: 'guest-session-token',
    };
  },

  /**
   * Chainable Query Builder mimicking Supabase query interface for in-memory GuestStore
   */
  createQuery(tableName: string) {
    const store = loadStore();
    const tableKey = tableName as keyof GuestStore;
    let data = (store[tableKey] ? [...store[tableKey]] : []) as any[];

    const builder: any = {
      _selectFields: '*',
      _single: false,

      select(fields = '*') {
        builder._selectFields = fields;
        return builder;
      },

      eq(field: string, val: any) {
        data = data.filter((item) => item[field] === val);
        return builder;
      },

      neq(field: string, val: any) {
        data = data.filter((item) => item[field] !== val);
        return builder;
      },

      in(field: string, arr: any[]) {
        data = data.filter((item) => arr.includes(item[field]));
        return builder;
      },

      order(field: string, { ascending = true }: { ascending?: boolean } = {}) {
        data.sort((a, b) => {
          if (a[field] < b[field]) return ascending ? -1 : 1;
          if (a[field] > b[field]) return ascending ? 1 : -1;
          return 0;
        });
        return builder;
      },

      limit(n: number) {
        data = data.slice(0, n);
        return builder;
      },

      single() {
        builder._single = true;
        return builder;
      },

      async insert(rows: any | any[]) {
        const toAdd = Array.isArray(rows) ? rows : [rows];
        const newRecords = toAdd.map((r) => ({
          id: r.id || `guest-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          created_at: new Date().toISOString(),
          ...r,
        }));
        if (!store[tableKey]) (store as any)[tableKey] = [];
        (store[tableKey] as any[]).push(...newRecords);
        saveStore(store);
        return {
          data: builder._single ? newRecords[0] : newRecords,
          error: null,
          select() {
            return {
              single() {
                return Promise.resolve({ data: newRecords[0], error: null });
              },
            };
          },
        };
      },

      async update(updates: any) {
        // Updates items matched by previous filters
        const currentTable = (store[tableKey] || []) as any[];
        const matchedIds = data.map((d) => d.id);
        store[tableKey] = currentTable.map((item) => {
          if (matchedIds.includes(item.id)) {
            return { ...item, ...updates };
          }
          return item;
        }) as any;
        saveStore(store);
        return {
          data: builder._single ? data[0] : data,
          error: null,
          select() {
            return {
              single() {
                return Promise.resolve({ data: data[0] ? { ...data[0], ...updates } : null, error: null });
              },
            };
          },
        };
      },

      async delete() {
        const currentTable = (store[tableKey] || []) as any[];
        const deleteIds = data.map((d) => d.id);
        store[tableKey] = currentTable.filter((item) => !deleteIds.includes(item.id)) as any;
        saveStore(store);
        return { data: null, error: null };
      },

      // Executes the query when awaited
      then(onfulfilled?: any, onrejected?: any) {
        const result = {
          data: builder._single ? (data[0] || null) : data,
          error: null,
        };
        return Promise.resolve(result).then(onfulfilled, onrejected);
      },
    };

    return builder;
  },
};
