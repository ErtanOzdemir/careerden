import type { Notification, NotificationRepository } from "@link2cv/domain";
import type { GetOrCreateCurrentProfileUseCase } from "../profiles/get-or-create-current-profile.use-case.js";
import type { AuthenticatedProfileUser } from "../profiles/profile-access.js";

export class ListNotificationsUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">,
  ) {}

  async execute(user: AuthenticatedProfileUser): Promise<Notification[]> {
    const profile = await this.getCurrentProfile.execute(user);
    return this.notifications.listByProfileId(profile.id);
  }
}
