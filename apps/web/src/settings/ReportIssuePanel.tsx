import type { MouseEvent } from "react";
import { Bug, ExternalLink } from "lucide-react";
import { Panel } from "../components/careerden/panel.js";
import { buttonVariants } from "../components/ui/button.js";

export const bugReportUrl =
  "https://github.com/ErtanOzdemir/careerden/issues/new?template=bug_report.yml";

export function ReportIssuePanel() {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // The desktop app opens validated https links in the system browser.
    const openExternal = window.electronAPI?.openExternal;
    if (!openExternal) return;
    event.preventDefault();
    void openExternal(bugReportUrl);
  }

  return (
    <Panel>
      <div className="flex items-center gap-2.5 px-5 py-4">
        <Bug className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Help</h2>
      </div>
      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Found a bug? Report it on GitHub. Leave out profile information, CV content, and API keys.
        </p>
        <a
          href={bugReportUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Report an issue
          <ExternalLink />
        </a>
      </div>
    </Panel>
  );
}
