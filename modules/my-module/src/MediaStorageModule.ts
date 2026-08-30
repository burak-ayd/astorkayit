import { NativeModule, requireNativeModule } from 'expo';

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
  mimeType?: string;
  scannedUri?: string;
  success: boolean;
}

export interface FileItem {
  name: string;
  path: string;
  size: number;
  lastModified: number;
}

declare class MediaStorageModuleType extends NativeModule<{}> {
  getMediaBasePath(): string | null;
  initializeDirectories(): Promise<InitResult>;
  createFile(relativePath: string, content: string): Promise<CreateFileResult>;
  saveMediaFile(
    sourceUriString: string,
    relativeDestinationPath: string
  ): Promise<SavedMediaResult>;
  hasNoMedia(relativeDirectory: string): boolean;
  createNoMedia(relativeDirectory: string): Promise<boolean>;
  removeNoMedia(relativeDirectory: string): Promise<boolean>;
  scanFile(relativeOrAbsolutePath: string): Promise<boolean>;
  deleteFile(relativeOrAbsolutePath: string): Promise<boolean>;
  deleteDirectory(relativeOrAbsolutePath: string): Promise<boolean>;
  listFiles(relativePath: string): Promise<FileItem[]>;
  exists(relativePath: string): boolean;
  shareMediaFiles(
    filePaths: string[],
    title?: string,
    message?: string
  ): Promise<boolean>;
  createZipExport(
    zipRelativePath: string,
    htmlContent: string,
    jsonContent: string,
    folderRelativePaths: string[]
  ): Promise<{ path: string; name: string; size: number; success: boolean }>;
  startSyncForegroundService(title: string, message: string): Promise<boolean>;
  updateSyncForegroundService(
    title: string,
    message: string,
    progress: number,
    max: number
  ): Promise<boolean>;
  stopSyncForegroundService(): Promise<boolean>;
}

// Try to load the native module, return null if not available (e.g. Expo Go)
let module: MediaStorageModuleType | null = null;
try {
  module = requireNativeModule<MediaStorageModuleType>('MediaStorage');
} catch {
  console.warn(
    'MediaStorage native module not found. ' +
      'This is expected in Expo Go. Use "npx expo run:android" for a development build.'
  );
}

export default module;
