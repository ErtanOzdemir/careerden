import type { StoredFileContent } from "@careerden/domain";

export interface SignedFileLink {
  fileId: string;
  expires: string;
  signature: string;
}

// Reads stored files through download links that the same storage adapter signed.
export interface SignedFileReader {
  verifySignedUrl(link: SignedFileLink): boolean;
  // Resolves null when the file no longer exists.
  find(fileId: string): Promise<StoredFileContent | null>;
}
