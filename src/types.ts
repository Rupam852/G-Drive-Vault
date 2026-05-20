export interface FileItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'folder' | 'archive' | 'apk' | 'other';
  size: string;
  sizeBytes: number;
  date: string;
  timestamp: number;
  thumbnail?: string;
  webViewLink?: string;
  starred?: boolean;
  shared?: boolean;
  isHidden?: boolean;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface StorageStats {
  used: number;
  total: number;
  categories: {
    name: string;
    size: string;
    color: string;
    count: number;
    type: FileItem['type'];
  }[];
}
