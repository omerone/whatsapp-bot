export interface FlowMetadata {
  company_name: string;
  version: string;
  last_updated: string;
}

export interface FlowConfiguration {
  rules: {
    blockedSources: {
      ignoreContacts: boolean;
      ignoreArchived: boolean;
      ignoreGroups: boolean;
      ignoreStatus: boolean;
    };
    activation: {
      enabled: boolean;
      keywords: string[];
      resetAfterHours: number;
    };
    session_timeout: number;
    max_retries: number;
  };
  client_management: {
    freeze: {
      enabled: boolean;
      duration: number;
      messaging: {
        send_explanation: boolean;
        message: string;
      };
    };
    reset: {
      enabled: boolean;
      keyword: string;
      target_step: string;
      options: {
        unfreeze: boolean;
        delete_appointment: boolean;
        allow_unblock: boolean;
      };
    };
    blockScheduledClients: {
      enabled: boolean;
      blockPastAndPresent: boolean;
      blockFutureAndPresent: boolean;
      allowRescheduling: boolean;
      rescheduleOnlyFuture: boolean;
    };
    freeze_duration: number;
    block_duration: number;
  };
}

export type StepType = 'message' | 'question' | 'options' | 'date';

export interface ValidationRule {
  type: 'text' | 'number' | 'email' | 'phone' | 'custom';
  pattern?: string;
  errorMessage?: string;
  min?: number;
  max?: number;
}

export interface Step {
  id: string;
  type: StepType;
  message?: string;
  messageHeader?: string;
  footerMessage?: string;
  enabled: boolean;
  userResponseWaiting: boolean;
  next?: string | null;
  options?: { [key: string]: string };
  branches?: { [key: string]: string };
  messageFile?: string | null;
  block?: boolean;
  freeze?: boolean;
}

export interface Flow {
  metadata: {
    company_name: string;
    version: string;
    last_updated: string;
  };
  configuration: {
    rules: {
      blockedSources: {
        ignoreContacts: boolean;
        ignoreArchived: boolean;
        ignoreGroups: boolean;
        ignoreStatus: boolean;
      };
      activation: {
        enabled: boolean;
        keywords: string[];
        resetAfterHours: number;
      };
    };
    client_management: {
      freeze: {
        enabled: boolean;
        duration: number;
        messaging: {
          send_explanation: boolean;
          message: string;
        };
      };
      reset: {
        enabled: boolean;
        keyword: string;
        target_step: string;
        options: {
          unfreeze: boolean;
          delete_appointment: boolean;
          allow_unblock: boolean;
        };
      };
    };
  };
  integrations?: {
    google_workspace?: {
      enabled?: boolean;
      credentials?: string;
    };
    google_sheets?: {
      enabled?: boolean;
      spreadsheet_id?: string;
      options?: {
        sort_by_date?: boolean;
        prevent_duplicates?: boolean;
      };
    };
    google_calendar?: {
      enabled?: boolean;
      calendar_id?: string;
      timezone?: string;
      event_template?: {
        title?: string;
        description?: string;
        max_participants?: number;
      };
    };
  };
  start: string;
  steps: { [key: string]: Step };
}

export interface FlowFile {
  id: string;
  name: string;
  metadata: Flow['metadata'];
} 