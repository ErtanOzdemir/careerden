import type { AppPathProvider } from "@link2cv/domain";

export class GetAppPathUseCase {
  constructor(private readonly appPathProvider: AppPathProvider) {}

  execute(name: string): string {
    return this.appPathProvider.getPath(name);
  }
}
