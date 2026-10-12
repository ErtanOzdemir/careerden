import type { CreditActivity, CreditActivityReader } from "../../domain/billing/credit-activity.js";

export const creditActivityLimit = 50;

export class ListCreditActivityUseCase {
  constructor(private readonly reader: CreditActivityReader) {}

  async execute(userId: string): Promise<CreditActivity[]> {
    return this.reader.listRecent(userId, creditActivityLimit);
  }
}
