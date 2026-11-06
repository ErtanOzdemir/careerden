import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

const historySchema = z.object({ exits: z.array(z.number().finite()).max(100) });

export interface RestartLoopGuardOptions {
  // Survives the relaunch, which starts a new main process.
  statePath: string;
  maxExits?: number;
  windowMs?: number;
  now?: () => number;
}

// Decides whether an unexpected local backend exit should relaunch the app. The third exit
// within two minutes stops relaunching, because a backend that keeps stopping will not recover
// by itself and the user would otherwise only ever see the restart notice.
export class RestartLoopGuard {
  private readonly maxExits: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(private readonly options: RestartLoopGuardOptions) {
    this.maxExits = options.maxExits ?? 3;
    this.windowMs = options.windowMs ?? 2 * 60_000;
    this.now = options.now ?? Date.now;
  }

  // Records an exit and returns whether the app should relaunch, plus how many exits are recent.
  async recordUnexpectedExit(): Promise<{ restart: boolean; recentExits: number }> {
    const now = this.now();
    const exits = [...(await this.read()), now].filter((time) => now - time < this.windowMs);
    const recorded = await this.write(exits).then(
      () => true,
      (error: unknown) => {
        console.error("Could not record the local backend restart", error);
        return false;
      },
    );
    // Without the history the next launch could not see a loop, so stop it here instead.
    return { restart: recorded && exits.length < this.maxExits, recentExits: exits.length };
  }

  async reset(): Promise<void> {
    await rm(this.options.statePath, { force: true });
  }

  private async read(): Promise<number[]> {
    try {
      const parsed = historySchema.safeParse(
        JSON.parse(await readFile(this.options.statePath, "utf8")),
      );
      return parsed.success ? parsed.data.exits : [];
    } catch {
      return [];
    }
  }

  private async write(exits: number[]): Promise<void> {
    await mkdir(dirname(this.options.statePath), { recursive: true });
    await writeFile(this.options.statePath, `${JSON.stringify({ exits })}\n`, "utf8");
  }
}
