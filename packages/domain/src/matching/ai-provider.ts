import type { ZodType } from "zod";

export interface AiGenerateParams<T> {
  system: string;
  prompt: string;
  outputSchema: ZodType<T>;
}

export interface AiProvider {
  generate<T>(params: AiGenerateParams<T>): Promise<T>;
}
