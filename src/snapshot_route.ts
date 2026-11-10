import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, infrai } from "./infrai_storage.js";
import { snapshotRequestSchema } from "./snapshot_contract.js";
import { writeNightlySnapshot } from "./snapshot_service.js";

const bucket = process.env.SNAPSHOT_BUCKET ?? "learning-nightly-snapshots";

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/snapshots/nightly") {
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = snapshotRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await writeNightlySnapshot(
      {
        head: infrai.storage.object.head,
        presign: infrai.storage.object.presign,
      },
      bucket,
      input,
    );
    response.writeHead(result.status === "uploaded" ? 201 : 200, {
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof ZodError ? 400 : error instanceof InfraiError && error.status < 500 ? error.status : 500;
    const body = error instanceof ZodError
      ? { error: "invalid_snapshot", issues: error.issues }
      : error instanceof InfraiError
        ? { error: error.code }
        : { error: "snapshot_failed" };
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log("Snapshot route listening on http://localhost:3000/snapshots/nightly");
});
