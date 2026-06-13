export interface TemplateRenderer {
  render(templateId: string, data: Record<string, unknown>): Promise<string | Buffer>;
}
