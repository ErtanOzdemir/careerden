import type { NotificationRepository } from "@careerden/domain";
import type { GetOrCreateCurrentProfileUseCase } from "../profiles/get-or-create-current-profile.use-case.js";
import type { AuthenticatedProfileUser } from "../profiles/profile-access.js";

export class CountUnreadNotificationsUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly getCurrentProfile: Pick<GetOrCreateCurrentProfileUseCase, "execute">,
  ) {}

  async execute(user: AuthenticatedProfileUser): Promise<number> {
    const profile = await this.getCurrentProfile.execute(user);
    return this.notifications.countUnreadByProfileId(profile.id);
  }
}
