import { createHash } from "node:crypto";
import type { SnapshotRequest } from "./snapshot_contract.js";
import { snapshotKey } from "./snapshot_contract.js";

export type SnapshotStorage = {
  head(bucket: string, key: string): Promise<{ found: boolean }>;
  presign(bucket: string, key: string, idempotencyKey: string): Promise<{ url: string }>;
};

export type SnapshotResult = {
  status: "uploaded" | "already_present";
  key: string;
  bytes: number;
};

function stableJson(input: SnapshotRequest): string {
  return JSON.stringify({
    schemaVersion: 1,
    schoolId: input.schoolId,
    snapshotDate: input.snapshotDate,
    courses: [...input.courses].sort((a, b) => a.courseId.localeCompare(b.courseId)),
  });
}

export async function writeNightlySnapshot(
  storage: SnapshotStorage,
  bucket: string,
  input: SnapshotRequest,
): Promise<SnapshotResult> {
  const key = snapshotKey(input);
  const payload = stableJson(input);
  const bytes = Buffer.byteLength(payload);
  const existing = await storage.head(bucket, key);

  if (existing.found) return { status: "already_present", key, bytes };

  const requestId = createHash("sha256").update(`${bucket}:${key}`).digest("hex");
  const signed = await storage.presign(bucket, key, requestId);
  const upload = await fetch(signed.url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  if (!upload.ok) throw new Error(`Snapshot upload returned ${upload.status}`);

  return { status: "uploaded", key, bytes };
}
