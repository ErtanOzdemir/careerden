export interface StoredFileInput {
  fileName: string;
  contentType: string;
  body: Buffer;
  metadata?: Record<string, string>;
}

export interface StoredFile {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  url?: string;
}

export interface FileStorage {
  put(file: StoredFileInput): Promise<StoredFile>;
  getSignedUrl(fileId: string): Promise<string>;
}
