import assert from "node:assert/strict";
import test from "node:test";
import type { SnapshotStorage } from "../src/snapshot_service.js";
import { writeNightlySnapshot } from "../src/snapshot_service.js";

test("a rerun for the same school and date keeps the existing nightly snapshot", async () => {
  let presignCalls = 0;
  const storage: SnapshotStorage = {
    head: async () => ({ found: true }),
    presign: async () => {
      presignCalls += 1;
      return { url: "https://uploads.example.test/signed" };
    },
  };

  const result = await writeNightlySnapshot(storage, "learning-nightly-snapshots", {
    schoolId: "north-campus",
    snapshotDate: "2026-09-19",
    courses: [],
  });

  assert.deepEqual(result, {
    status: "already_present",
    key: "schools/north-campus/nightly/2026-09-19.json",
    bytes: 86,
  });
  assert.equal(presignCalls, 0);
});
