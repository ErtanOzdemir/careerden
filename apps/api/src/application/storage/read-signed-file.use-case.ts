import type { StoredFileContent } from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import type { SignedFileReader } from "../../domain/storage/signed-file-reader.js";

export interface ReadSignedFileInput {
  fileId: string;
  expires?: string;
  signature?: string;
}

// The signed link is the credential, so this runs without an authenticated actor.
export class ReadSignedFileUseCase {
  constructor(private readonly files: SignedFileReader) {}

  async execute({ fileId, expires, signature }: ReadSignedFileInput): Promise<StoredFileContent> {
    if (
      expires === undefined ||
      signature === undefined ||
      !this.files.verifySignedUrl({ fileId, expires, signature })
    ) {
      throw new ApplicationError("forbidden", "Invalid or expired file link");
    }

    const file = await this.files.find(fileId);
    if (!file) throw new ApplicationError("not_found", "File not found");

    return file;
  }
}
