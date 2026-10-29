import type { PersistenceUnitOfWork } from "@careerden/domain";
import { finalizeJobApplicationAnalysisFailure } from "./finalize-job-application-analysis-failure.use-case.js";

export class ExpireStaleCreditReservationsUseCase {
  constructor(
    private readonly unitOfWork: PersistenceUnitOfWork,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(limit = 100): Promise<number> {
    const at = this.now();
    return this.unitOfWork.execute(async (transaction) => {
      const reservations = await transaction.credits.listExpiredReservations({ at, limit });
      for (const reservation of reservations) {
        await finalizeJobApplicationAnalysisFailure(transaction, {
          jobApplicationId: reservation.resourceId,
          analysisAttemptId: reservation.id,
          reason: "AI analysis did not finish within 24 hours.",
          releaseReason: "timeout",
        });
      }
      return reservations.length;
    });
  }
}
