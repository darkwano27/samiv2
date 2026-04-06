import { z } from 'zod';

/** `worker_id` = código SAP (`pernr`), igual que en sesión. */
export const assignWorkerRoleBodySchema = z.object({
  worker_id: z.string().min(1),
  role_id: z.string().uuid(),
});

export type AssignWorkerRoleBody = z.infer<typeof assignWorkerRoleBodySchema>;
