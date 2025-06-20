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
  type: string;
  pattern?: string;
  min?: number;
  max?: number;
  errorMessages?: {
    [key: string]: string;
  };
  minDate?: string;
  maxDate?: string;
  futureOnly?: boolean;
  pastOnly?: boolean;
  minAge?: number;
  maxAge?: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface FreezeConfig {
  enabled: boolean;
  duration: number;
  messaging: {
    send_explanation: boolean;
    message: string;
  };
}

export interface BlockConfig {
  enabled: boolean;
  messaging: {
    send_explanation: boolean;
    message: string;
  };
  allow_unblock: boolean;
  unblock_keyword: string;
}

export interface IntegrationConfig {
  enabled: boolean;
  googleCalendar?: boolean;
  googleSheets?: boolean;
  notifications?: boolean;
  reminders?: boolean;
  iPlan?: boolean;
}

export interface StepData {
  id: string;
  type: StepType;
  label?: string;
  messageHeader?: string;
  message?: string;
  footerMessage?: string;
  next?: string;
  branches?: Record<string, string>;
  options?: Record<string, string>;
  validation?: ValidationRule;
  enabled?: boolean;
  userResponseWaiting?: boolean;
  block?: boolean | BlockConfig;
  freeze?: boolean | FreezeConfig;
  integrations?: IntegrationConfig;
  skipIfDisabled?: string;
  position?: Position;
  noMatchMessage?: string;
}

export interface Step extends StepData {
  enabled: boolean;
  userResponseWaiting: boolean;
}

export interface Flow {
  metadata: {
    company_name: string;
    version: string;
    last_updated: string;
    [key: string]: any;
  };
  configuration: {
    rules?: Record<string, any>;
    client_management?: Record<string, any>;
    [key: string]: any;
  };
  integrations?: Record<string, any>;
  start: string;
  steps: Record<string, Step>;
}

export interface FlowFile {
  id: string;
  name: string;
  metadata: Flow['metadata'];
}

export interface FlowData {
  id: string;
  name: string;
  description?: string;
  steps: Record<string, StepData>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

export interface FlowContextType {
  flow: Flow;
  addStep: (step: StepData) => void;
  updateStep: (id: string, changes: Partial<StepData>, triggerFullUpdate?: boolean) => void;
  deleteStep: (id: string) => void;
  getStep: (id: string) => Step | undefined;
  getAllSteps: () => Step[];
  importFlow: (json: string) => void;
  exportFlow: () => string;
  updateMetadata: (metadata: Partial<Flow['metadata']>) => void;
  updateConfiguration: (config: Partial<Flow['configuration']>) => void;
  updateIntegrations: (integrations: Record<string, any>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  createNewFlow: () => Flow;
  setFlow: (flow: Flow) => void;
} 