import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { env } from "../config/env.js";

export type StoredFile = {
  storagePath: string;
  absolutePath: string;
};

export class StorageService {
  private root = path.resolve(env.UPLOAD_DIR);

  async save(buffer: Buffer, extension: string): Promise<StoredFile> {
    const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const today = new Date().toISOString().slice(0, 10);
    const relativeDir = path.join(today);
    const fileName = `${nanoid(24)}.${safeExtension}`;
    const absoluteDir = path.join(this.root, relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    const absolutePath = path.join(absoluteDir, fileName);
    await writeFile(absolutePath, buffer, { flag: "wx" });
    return { storagePath: path.join(relativeDir, fileName), absolutePath };
  }

  resolve(storagePath: string) {
    const absolutePath = path.resolve(this.root, storagePath);
    if (!absolutePath.startsWith(this.root)) {
      throw new Error("Invalid storage path");
    }
    return absolutePath;
  }

  async read(storagePath: string) {
    return readFile(this.resolve(storagePath));
  }

  async delete(storagePath: string) {
    try {
      await unlink(this.resolve(storagePath));
    } catch (error: unknown) {
      if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}
