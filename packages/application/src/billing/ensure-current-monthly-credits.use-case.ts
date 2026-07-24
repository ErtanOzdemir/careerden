import type { EnsureCreditGrantResult, PersistenceUnitOfWork } from "@careerden/domain";
import { ensureCurrentMonthlyCredits } from "./ensure-current-monthly-credits.js";

export class EnsureCurrentMonthlyCreditsUseCase {
  constructor(
    private readonly unitOfWork: PersistenceUnitOfWork,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string): Promise<EnsureCreditGrantResult> {
    const now = this.now();

    return this.unitOfWork.execute(({ credits }) =>
      ensureCurrentMonthlyCredits(credits, userId, now),
    );
  }
}
