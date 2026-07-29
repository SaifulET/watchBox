import { z } from "zod";

export const updateNotificationPreferencesSchema = z
  .object({
    emailAlerts: z.boolean()
  })
  .strict();

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
