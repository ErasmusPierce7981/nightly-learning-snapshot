import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const snapshotRequestSchema = z.object({
  schoolId: z.string().min(1).regex(/^[a-z0-9-]+$/),
  snapshotDate: z.string().regex(isoDate),
  courses: z.array(
    z.object({
      courseId: z.string().min(1),
      title: z.string().min(1),
      delivery: z.enum(["live", "self_paced", "blended"]),
      educatorId: z.string().min(1),
      learnerDeadlines: z.array(
        z.object({
          learnerId: z.string().min(1),
          dueAt: z.string().datetime(),
          status: z.enum(["open", "submitted", "overdue"]),
        }),
      ),
      reporting: z.object({
        enrolled: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative(),
      }),
    }),
  ),
});

export type SnapshotRequest = z.infer<typeof snapshotRequestSchema>;

export function snapshotKey(input: SnapshotRequest): string {
  return `schools/${input.schoolId}/nightly/${input.snapshotDate}.json`;
}
