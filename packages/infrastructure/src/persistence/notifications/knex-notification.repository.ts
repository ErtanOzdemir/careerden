import type { Knex } from "knex";
import type {
  CreateNotificationInput,
  Notification,
  NotificationRepository,
} from "@careerden/domain";
import { randomUUID } from "node:crypto";
import { toNotification } from "../mappers.js";

export class KnexNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Knex) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const [row] = await this.db("notifications")
      .insert({
        id: randomUUID(),
        profile_id: input.profileId,
        job_application_id: input.jobApplicationId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
      })
      .returning("*");

    return toNotification(row);
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await this.db("notifications").where({ id }).first();
    return row ? toNotification(row) : null;
  }

  async listByProfileId(profileId: string): Promise<Notification[]> {
    const rows = await this.db("notifications")
      .where({ profile_id: profileId })
      .orderBy("created_at", "desc")
      .limit(50);

    return rows.map(toNotification);
  }

  async countUnreadByProfileId(profileId: string): Promise<number> {
    const row = await this.db("notifications")
      .where({ profile_id: profileId })
      .whereNull("read_at")
      .count<{ count: string | number }>({ count: "*" })
      .first();

    return Number(row?.count ?? 0);
  }

  async markRead(id: string): Promise<Notification | null> {
    const [row] = await this.db("notifications")
      .where({ id })
      .update({ read_at: this.db.fn.now() })
      .returning("*");

    return row ? toNotification(row) : null;
  }

  async markAllRead(profileId: string): Promise<void> {
    await this.db("notifications")
      .where({ profile_id: profileId })
      .whereNull("read_at")
      .update({ read_at: this.db.fn.now() });
  }
}
