import { readFile } from "node:fs/promises";
import { infrai } from "./infrai_storage.js";
import { snapshotRequestSchema } from "./snapshot_contract.js";
import { writeNightlySnapshot } from "./snapshot_service.js";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Pass a snapshot JSON file path");

const input = snapshotRequestSchema.parse(JSON.parse(await readFile(inputPath, "utf8")));
const bucket = process.env.SNAPSHOT_BUCKET ?? "learning-nightly-snapshots";
const result = await writeNightlySnapshot(
  {
    head: infrai.storage.object.head,
    presign: infrai.storage.object.presign,
  },
  bucket,
  input,
);
console.log(JSON.stringify(result, null, 2));
