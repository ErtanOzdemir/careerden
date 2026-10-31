import type {
  UserProfile,
  UserProfileAccountRepository,
  UserProfileOnboardingInput,
} from "@careerden/domain";
import { ApplicationError } from "@careerden/application";
import { getAccessibleProfile } from "./profile-access.js";

export interface UpdateOnboardingStateCommand {
  completed?: boolean;
  checklistDismissed?: boolean;
}

export class UpdateOnboardingStateUseCase {
  constructor(
    private readonly profiles: UserProfileAccountRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    id: string,
    userId: string,
    command: UpdateOnboardingStateCommand,
  ): Promise<UserProfile> {
    await getAccessibleProfile(this.profiles, id, userId);
    const timestamp = this.now();
    const input: UserProfileOnboardingInput = {};

    if (command.completed !== undefined) {
      input.onboardingCompletedAt = command.completed ? timestamp : null;
    }
    if (command.checklistDismissed !== undefined) {
      input.onboardingChecklistDismissedAt = command.checklistDismissed ? timestamp : null;
    }

    const profile = await this.profiles.update(id, input);

    if (!profile) {
      throw new ApplicationError("not_found", "Profile not found");
    }

    return profile;
  }
}
