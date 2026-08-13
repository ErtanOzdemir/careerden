import type { TemplateRenderer } from "@careerden/domain";
import { renderHtmlTemplate } from "@careerden/contracts";

export class HtmlTemplateRenderer implements TemplateRenderer {
  async render(templateId: string, data: Record<string, unknown>): Promise<string> {
    return renderHtmlTemplate(templateId, data);
  }
}
