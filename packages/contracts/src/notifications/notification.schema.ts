import { z } from "zod";

export const notificationTypeSchema = z.enum(["follow_up_reminder"]);

export const notificationSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  jobApplicationId: z.string().min(1).optional(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1).optional(),
  readAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
});

export const notificationChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("notification.created"),
    notification: notificationSchema,
    summary: z.string().min(1),
  }),
]);

export type NotificationDto = z.infer<typeof notificationSchema>;
export type NotificationChangeDto = z.infer<typeof notificationChangeSchema>;
