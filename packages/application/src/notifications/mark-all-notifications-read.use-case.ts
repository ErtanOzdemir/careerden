import type { NotificationRepository } from "@link2cv/domain";
import type { GetOrCreateCurrentProfileUseCase } from "../profiles/get-or-create-current-profile.use-case.js";
import type { AuthenticatedProfileUser } from "../profiles/profile-access.js";

export class MarkAllNotificationsReadUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">,
  ) {}

  async execute(user: AuthenticatedProfileUser): Promise<void> {
    const profile = await this.getCurrentProfile.execute(user);
    await this.notifications.markAllRead(profile.id);
  }
}
