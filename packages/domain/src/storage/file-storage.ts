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

export interface StoredFileContent extends StoredFile {
  body: Buffer;
}

export interface FileStorage {
  put(file: StoredFileInput): Promise<StoredFile>;
  get(fileId: string): Promise<StoredFileContent>;
  getSignedUrl(fileId: string): Promise<string>;
}
