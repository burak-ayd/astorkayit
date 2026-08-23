export interface InitResult {
  basePath: string;
  directories: Record<string, boolean>;
  success: boolean;
}

export interface CreateFileResult {
  path: string;
  success: boolean;
}

export interface SavedMediaResult {
  path: string;
  name: string;
  size: number;
  success: boolean;
}

export interface FileItem {
  name: string;
  path: string;
  size: number;
  lastModified: number;
}
