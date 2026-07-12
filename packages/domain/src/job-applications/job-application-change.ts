export type JobApplicationChangeType = "application.changed" | "application.deleted";

export interface JobApplicationChange {
  type: JobApplicationChangeType;
  applicationId: string;
  profileId: string;
  occurredAt: string;
}

export type JobApplicationChangeListener = (change: JobApplicationChange) => void;

export interface JobApplicationChangePublisher {
  publish(change: JobApplicationChange): Promise<void>;
}

export interface JobApplicationChangeRecorder {
  changed(applicationId: string, profileId: string): Promise<void>;
  deleted(applicationId: string, profileId: string): Promise<void>;
}

export interface JobApplicationChangeSubscriber {
  subscribe(profileId: string, listener: JobApplicationChangeListener): Promise<() => void>;
}
