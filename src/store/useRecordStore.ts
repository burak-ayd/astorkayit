import { create } from 'zustand';
import type { RecordItem, DateFilter, StorageStats } from '@/types';
import * as db from '@/database/db';

interface RecordStoreState {
  records: RecordItem[];
  isLoading: boolean;
  searchQuery: string;
  dateFilter: DateFilter;
  stats: StorageStats;

  // Actions
  loadRecords: () => Promise<void>;
  addRecord: (title: string, description: string, photoUris: string[], isHidden?: boolean) => Promise<number>;
  updateRecord: (id: number, title: string, description: string, photoUris: string[], isHidden?: boolean) => Promise<void>;
  toggleRecordVisibility: (id: number, hide: boolean) => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
  clearAllRecords: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setDateFilter: (filter: DateFilter) => void;
  resetFilters: () => void;
  loadStats: () => Promise<void>;
}

export const useRecordStore = create<RecordStoreState>((set, get) => ({
  records: [],
  isLoading: false,
  searchQuery: '',
  dateFilter: { startDate: null, endDate: null },
  stats: { totalRecords: 0, totalPhotos: 0, totalSizeBytes: 0 },

  loadRecords: async () => {
    try {
      set({ isLoading: true });
      const records = await db.getAllRecords();
      set({ records });
      await get().loadStats();
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addRecord: async (title: string, description: string, photoUris: string[], isHidden: boolean = false) => {
    try {
      set({ isLoading: true });
      const id = await db.insertRecord(title, description, photoUris, isHidden);
      await get().loadRecords();
      return id;
    } finally {
      set({ isLoading: false });
    }
  },

  updateRecord: async (id: number, title: string, description: string, photoUris: string[], isHidden?: boolean) => {
    try {
      set({ isLoading: true });
      await db.updateRecord(id, title, description, photoUris, isHidden);
      await get().loadRecords();
    } finally {
      set({ isLoading: false });
    }
  },

  toggleRecordVisibility: async (id: number, hide: boolean) => {
    try {
      set({ isLoading: true });
      await db.setRecordGalleryVisibility(id, hide);
      await get().loadRecords();
    } finally {
      set({ isLoading: false });
    }
  },

  deleteRecord: async (id: number) => {
    try {
      set({ isLoading: true });
      await db.deleteRecord(id);
      await get().loadRecords();
    } finally {
      set({ isLoading: false });
    }
  },

  clearAllRecords: async () => {
    try {
      set({ isLoading: true });
      await db.deleteAllRecords();
      await get().loadRecords();
    } finally {
      set({ isLoading: false });
    }
  },

  setSearchQuery: (searchQuery: string) => {
    set({ searchQuery });
  },

  setDateFilter: (dateFilter: DateFilter) => {
    set({ dateFilter });
  },

  resetFilters: () => {
    set({
      searchQuery: '',
      dateFilter: { startDate: null, endDate: null },
    });
  },

  loadStats: async () => {
    try {
      const stats = await db.getStorageStats();
      set({ stats });
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  },
}));

// Helper selector for filtered records
export function selectFilteredRecords(
  records: RecordItem[],
  searchQuery: string,
  dateFilter: DateFilter
): RecordItem[] {
  let result = records;

  // Search query filter (title + description)
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }

  // Date range filter
  if (dateFilter.startDate || dateFilter.endDate) {
    result = result.filter((r) => {
      const recordDate = new Date(r.created_at);

      if (dateFilter.startDate) {
        const start = new Date(dateFilter.startDate);
        start.setHours(0, 0, 0, 0);
        if (recordDate < start) return false;
      }

      if (dateFilter.endDate) {
        const end = new Date(dateFilter.endDate);
        end.setHours(23, 59, 59, 999);
        if (recordDate > end) return false;
      }

      return true;
    });
  }

  return result;
}
