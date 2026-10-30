import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'civic_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface CivicStoreData {
  users: any[];
  complaints: any[];
  departments: any[];
  complaintHistory: any[];
  complaintDuplicates: any[];
  aiInsights: any[];
}

const DEFAULT_DEPARTMENTS = [
  { id: 'dept-1', departmentName: 'Road Damage', description: 'Potholes, asphalt damage, footpaths, bridges' },
  { id: 'dept-2', departmentName: 'Waterlogging', description: 'Monsoon flooding, submerged roads, water stagnation' },
  { id: 'dept-3', departmentName: 'Waste Management', description: 'Garbage accumulation, overflowing bins, debris' },
  { id: 'dept-4', departmentName: 'Streetlight Issues', description: 'Broken street lamps, dark spots, electrical fixtures' },
  { id: 'dept-5', departmentName: 'Water Supply', description: 'Contaminated water, pipe bursts, low pressure' },
  { id: 'dept-6', departmentName: 'Drainage Problems', description: 'Clogged sewers, overflowing gutters, sludge' },
  { id: 'dept-7', departmentName: 'Public Safety', description: 'Sparks, exposed wires, stray animal hazards, emergencies' }
];

const loadStore = (): CivicStoreData => {
  if (!fs.existsSync(DB_FILE)) {
    const initial: CivicStoreData = {
      users: [],
      complaints: [],
      departments: DEFAULT_DEPARTMENTS,
      complaintHistory: [],
      complaintDuplicates: [],
      aiInsights: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return {
      users: [],
      complaints: [],
      departments: DEFAULT_DEPARTMENTS,
      complaintHistory: [],
      complaintDuplicates: [],
      aiInsights: []
    };
  }
};

const saveStore = (data: CivicStoreData): void => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

export const dbStore = {
  getUsers: () => loadStore().users,
  findUserByEmail: (email: string) => loadStore().users.find(u => u.email.toLowerCase() === email.toLowerCase()),
  findUserById: (id: string) => loadStore().users.find(u => u.id === id),
  createUser: (user: any) => {
    const store = loadStore();
    store.users.push(user);
    saveStore(store);
    return user;
  },

  getComplaints: (filterFn?: (c: any) => boolean) => {
    const all = loadStore().complaints;
    return filterFn ? all.filter(filterFn) : all;
  },
  findComplaintById: (id: string) => loadStore().complaints.find(c => c.id === id),
  createComplaint: (complaint: any) => {
    const store = loadStore();
    store.complaints.unshift(complaint);
    saveStore(store);
    return complaint;
  },
  updateComplaint: (id: string, updates: any) => {
    const store = loadStore();
    const idx = store.complaints.findIndex(c => c.id === id);
    if (idx !== -1) {
      store.complaints[idx] = { ...store.complaints[idx], ...updates, updatedAt: new Date().toISOString() };
      saveStore(store);
      return store.complaints[idx];
    }
    return null;
  },

  getDepartments: () => loadStore().departments,
  createDepartment: (dept: any) => {
    const store = loadStore();
    store.departments.push(dept);
    saveStore(store);
    return dept;
  },

  getHistory: (complaintId: string) => loadStore().complaintHistory.filter(h => h.complaintId === complaintId),
  createHistory: (historyEntry: any) => {
    const store = loadStore();
    store.complaintHistory.push(historyEntry);
    saveStore(store);
    return historyEntry;
  },

  getDuplicates: (complaintId: string) => loadStore().complaintDuplicates.filter(d => d.originalComplaintId === complaintId || d.duplicateComplaintId === complaintId),
  createDuplicate: (dup: any) => {
    const store = loadStore();
    store.complaintDuplicates.push(dup);
    saveStore(store);
    return dup;
  },

  getInsights: () => loadStore().aiInsights,
  createInsight: (insight: any) => {
    const store = loadStore();
    store.aiInsights.unshift(insight);
    saveStore(store);
    return insight;
  }
};
