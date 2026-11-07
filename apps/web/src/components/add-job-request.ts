import { openAddJobEventName } from "../onboarding/OnboardingGate.js";

/** Fields that open the add-job dialog's manual entry form already filled in. */
export interface ManualJobPrefill {
  companyName?: string;
  jobUrl?: string;
  roleTitle?: string;
}

export interface AddJobRequestDetail {
  manual?: ManualJobPrefill;
}

/** Opens the add-job dialog on manual entry, for example after a LinkedIn import failed. */
export function requestManualJobEntry(prefill: ManualJobPrefill): void {
  window.dispatchEvent(
    new CustomEvent<AddJobRequestDetail>(openAddJobEventName, { detail: { manual: prefill } }),
  );
}

export function readAddJobRequest(event: Event): AddJobRequestDetail {
  const detail = event instanceof CustomEvent ? (event.detail as unknown) : undefined;
  return typeof detail === "object" && detail !== null ? (detail as AddJobRequestDetail) : {};
}
