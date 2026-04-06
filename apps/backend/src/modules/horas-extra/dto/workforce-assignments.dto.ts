import { z } from 'zod';

export const patchSubdivisionAssignmentsBodySchema = z.object({
  division_code: z.string().min(1).max(24),
  subdivision_code: z.string().min(1).max(24),
  supervisor_worker_ids: z.array(z.string().min(1).max(64)).max(80),
  approver_worker_ids: z.array(z.string().min(1).max(64)).max(80),
});

export type PatchSubdivisionAssignmentsBody = z.infer<typeof patchSubdivisionAssignmentsBodySchema>;
