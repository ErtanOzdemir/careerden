import type { FileStorage } from "@link2cv/domain";
import { RustFsFileStorage, type RustFsFileStorageOptions } from "./rustfs-file.storage.js";

export type FileStorageConfig = RustFsFileStorageOptions;

export function createFileStorage(config: FileStorageConfig): FileStorage {
  return new RustFsFileStorage(config);
}
