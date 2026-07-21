import type { Notification, NotificationRepository } from "@careerden/domain";
import { ApplicationError } from "../application-error.js";
import type { GetOrCreateCurrentProfileUseCase } from "../profiles/get-or-create-current-profile.use-case.js";
import type { AuthenticatedProfileUser } from "../profiles/profile-access.js";

export class MarkNotificationReadUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">,
  ) {}

  async execute(notificationId: string, user: AuthenticatedProfileUser): Promise<Notification> {
    const profile = await this.getCurrentProfile.execute(user);
    const notification = await this.notifications.findById(notificationId);

    if (!notification || notification.profileId !== profile.id) {
      throw new ApplicationError("not_found", "Notification not found");
    }

    const updated = await this.notifications.markRead(notificationId);

    if (!updated) {
      throw new ApplicationError("not_found", "Notification not found");
    }

    return updated;
  }
}
