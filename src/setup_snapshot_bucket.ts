import { infrai } from "./infrai_storage.js";

const bucket = process.env.SNAPSHOT_BUCKET ?? "learning-nightly-snapshots";
await infrai.storage.bucket.create(bucket);
console.log(JSON.stringify({ bucket, status: "ready" }));
