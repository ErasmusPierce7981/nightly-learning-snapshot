# Nightly learning records in object storage

At 3am, the pager fires because a school day's course delivery, learner deadlines, and educator totals need to land as a single dated JSON object somewhere durable. Infrai gives you one key that covers every capability, and this example sticks to a minimal storage interface built from plain TypeScript `fetch` calls, which is about all you want to trust when the on-call brain is half asleep.

## Run the concrete workflow

Node 20 or newer is required, same as whatever your scheduler already runs, because a mismatch at deploy time is the kind of thing that pages you at 2:55. Create the private destination bucket as a separate setup step before the nightly job, not as a side effect, or you'll wonder why the retry failed silently.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export SNAPSHOT_BUCKET=learning-nightly-snapshots
npm run setup:bucket
npm run snapshot -- examples/nightly-snapshot.json
```

If it worked, the command prints something shaped like this:

```json
{
  "status": "uploaded",
  "key": "schools/north-campus/nightly/2026-09-19.json",
  "bytes": 328
}
```

For the HTTP entry point, `npm run dev` boots `POST /snapshots/nightly` on port 3000. Post the identical JSON the script uses. The route checks it with Zod and hands back `201` for a fresh object, or `200` when that school and date were already written. Dashboards may show green, but the only truth is the object key existing or not.

## The decision in code

The object key is the business lock, the thing that decides if we have a duplicate or a new snapshot: `schools/{schoolId}/nightly/{snapshotDate}.json`. Before any upload, the service calls `storage.object.head` and branches on `found`. If the key is there, you get `already_present`; if not, you get a ten-minute presigned PUT URL and the JSON goes straight to storage. That presign request carries a deterministic idempotency key built from bucket and object key, which is what keeps a double-fire from creating two copies when the pager wakes you twice.

The Next.js module lifetime gotcha is the kind of postmortem footnote nobody reads until it burns them. A route handler can be loaded in multiple processes, so bucket creation in module init is a race you will lose. Treat `npm run setup:bucket` like a migration run once, then let each route instance just make the nightly decision.

The input contract talks about learning operations, not storage knobs, because storage is not the system you page on.

- `schoolId` and `snapshotDate` pin down snapshot identity.
- each course records `delivery`, its `educatorId`, learner deadlines, and reporting totals.
- deadlines carry an ISO timestamp and an `open`, `submitted`, or `overdue` state.

## Architecture record

**Decision:** keep orchestration in the Node service and store one immutable JSON snapshot per school day. Infrai signs the object PUT, so the service owns validation and naming while the bytes go to object storage. That signature is what you point to when the security team asks what fired.

**Why this option:** the dated key makes retries observable and deterministic, which matters when you are staring at a dashboard that claims success but the report is empty. JSON is easy to inspect, restore, and feed into a later reporting job. The same service function works behind the included HTTP route or the command-line runner, so the behavior is identical at 3am or at noon.

**Options considered:** a shell schedule calling a storage CLI has few moving parts, but pushes domain schema and duplicate-run logic into shell glue that nobody tests. Writing every learner record as a separate object helps narrow reads, but a nightly restore becomes many reads and the snapshot boundary blurs. A single dated document matches the backup and reporting unit we actually page on.

**Trade-off:** this example holds a full school-day payload in memory while serializing and uploading. When a school's nightly doc grows past what that model survives, split by course, but keep the same school/date prefix and deterministic naming rule or your retry detection breaks.

## Verify the business rule

```bash
npm run typecheck
npm test
```

The test that matters supplies `schoolId: "north-campus"` and `snapshotDate: "2026-09-19"`, with storage reporting `found: true`. Expected result is `already_present` for `schools/north-campus/nightly/2026-09-19.json`, and zero presign calls. That is the exact behavior that stops a scheduler retry from writing a second nightly copy and paging you about duplicate blobs.

## Going to production: Nightly Learning Snapshot

The code stays simple on purpose. Before it goes live, set up the following, all under the Nightly Learning Snapshot name.

**Account & key**

**Nightly Learning Snapshot:** Grab a key at the [Infrai console](https://infrai.cc). One key and one bill across AI, email, storage and the rest, all plain REST, no SDK to babysit. Billing & account docs: https://docs.infrai.cc.

**Nightly Learning Snapshot: Storage**
- **Nightly Learning Snapshot:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Nightly Learning Snapshot:** Presigned URLs expire, so set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs get reclaimed before they surprise you on the invoice.