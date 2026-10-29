// Whether AI analysis can run right now, for runtimes where the user supplies the provider key.
export interface AiAvailability {
  isConfigured(): Promise<boolean>;
}
