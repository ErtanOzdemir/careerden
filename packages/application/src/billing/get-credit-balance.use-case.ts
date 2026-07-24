import type { CreditBalance, PersistenceUnitOfWork } from "@careerden/domain";
import { ensureCurrentMonthlyCredits } from "./ensure-current-monthly-credits.js";

export class GetCreditBalanceUseCase {
  constructor(
    private readonly unitOfWork: PersistenceUnitOfWork,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string): Promise<CreditBalance> {
    const now = this.now();

    return this.unitOfWork.execute(async ({ credits }) => {
      await ensureCurrentMonthlyCredits(credits, userId, now);
      return credits.getBalance(userId, now);
    });
  }
}
