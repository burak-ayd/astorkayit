export interface RecordItem {
  id: number;
  title: string;
  description: string;
  photos: string[];
  is_hidden: boolean;
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PhotoItem {
  id: number;
  record_id: number;
  uri: string;
  created_at: string;
}

export interface DateFilter {
  startDate: Date | null;
  endDate: Date | null;
}

export interface StorageStats {
  totalRecords: number;
  totalPhotos: number;
  totalSizeBytes: number;
}
