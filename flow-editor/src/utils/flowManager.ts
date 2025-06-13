import { Flow, Step } from '../types/flow';
import fs from 'fs/promises';
import path from 'path';

export class FlowManager {
  private readonly flowsDir = path.join(process.cwd(), 'data', 'flows');

  async listFlows(): Promise<string[]> {
    try {
      await fs.mkdir(this.flowsDir, { recursive: true });
      const files = await fs.readdir(this.flowsDir);
      return files.filter(file => file.endsWith('.json'));
    } catch (error) {
      console.error('Error listing flows:', error);
      return [];
    }
  }

  async loadFlow(filename: string): Promise<Flow | null> {
    try {
      const filePath = path.join(this.flowsDir, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error loading flow ${filename}:`, error);
      return null;
    }
  }

  async saveFlow(flow: Flow, filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.flowsDir, filename);
      await fs.writeFile(filePath, JSON.stringify(flow, null, 2));
      return true;
    } catch (error) {
      console.error(`Error saving flow ${filename}:`, error);
      return false;
    }
  }

  async deleteFlow(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.flowsDir, filename);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting flow ${filename}:`, error);
      return false;
    }
  }

  async duplicateFlow(sourceFilename: string, targetFilename: string): Promise<boolean> {
    try {
      const flow = await this.loadFlow(sourceFilename);
      if (!flow) return false;
      
      // Update metadata for the duplicate
      flow.metadata = {
        ...flow.metadata,
        version: '1.0.0',
        last_updated: new Date().toISOString(),
      };
      
      return await this.saveFlow(flow, targetFilename);
    } catch (error) {
      console.error(`Error duplicating flow ${sourceFilename}:`, error);
      return false;
    }
  }

  private _flow: Flow;

  constructor(initialFlow?: Flow) {
    this._flow = initialFlow || this.createEmptyFlow();
  }

  public createEmptyFlow(): Flow {
    return {
      metadata: {
        company_name: '',
        version: '1.0.0',
        last_updated: new Date().toISOString(),
      },
      configuration: {
        rules: {
          blockedSources: {
            ignoreContacts: true,
            ignoreArchived: true,
            ignoreGroups: true,
            ignoreStatus: true,
          },
          activation: {
            enabled: true,
            keywords: [],
            resetAfterHours: 24,
          },
        },
        client_management: {
          freeze: {
            enabled: true,
            duration: 60,
            messaging: {
              send_explanation: true,
              message: 'תחזור אלינו בעוד {duration} דקות. תודה על הסבלנות! 🙏',
            },
          },
          reset: {
            enabled: true,
            keyword: 'תפריט',
            target_step: 'main_menu',
            options: {
              unfreeze: true,
              delete_appointment: true,
              allow_unblock: true,
            },
          },
          blockScheduledClients: {
            enabled: true,
            blockPastAndPresent: true,
            blockFutureAndPresent: false,
            allowRescheduling: true,
            rescheduleOnlyFuture: true,
          },
        },
      },
      integrations: {
        enabled: true,
        googleWorkspace: {
          enabled: false,
          sheets: {
            enabled: false,
            sheetId: '',
            columns: {},
            filterByDateTime: true,
            preventDuplicates: true,
            updateExistingRows: true,
          },
          calendar: {
            enabled: false,
            calendarId: '',
            eventDurationMinutes: 60,
            timeZone: 'Asia/Jerusalem',
            eventTitle: 'פגישה עם {full_name}',
            eventDescription: 'פגישה עם {full_name}\nטלפון: {phone}\nעיר: {city_name}\nניידות: {mobility}',
            maxParticipantsPerSlot: 3,
            preventDuplicates: true,
          },
        },
      },
      start: '',
      steps: {},
    };
  }

  getFlow = (): Flow => {
    return this._flow;
  };

  updateMetadata = (metadata: Partial<Flow['metadata']>): void => {
    this._flow.metadata = {
      ...this._flow.metadata,
      ...metadata,
      last_updated: new Date().toISOString(),
    };
  };

  updateConfiguration = (configuration: Partial<Flow['configuration']>): void => {
    this._flow.configuration = {
      ...this._flow.configuration,
      ...configuration,
    };
  };

  updateIntegrations = (integrations: Partial<Flow['integrations']>): void => {
    this._flow.integrations = {
      ...this._flow.integrations,
      ...integrations,
    };
  };

  addStep = (step: Step): void => {
    this._flow.steps[step.id] = step;
    if (!this._flow.start) {
      this._flow.start = step.id;
    }
  };

  updateStep = (id: string, step: Partial<Step>): void => {
    if (this._flow.steps[id]) {
      this._flow.steps[id] = {
        ...this._flow.steps[id],
        ...step,
      };
    }
  };

  deleteStep = (id: string): void => {
    if (this._flow.steps[id]) {
      delete this._flow.steps[id];
      if (this._flow.start === id) {
        const remainingSteps = Object.keys(this._flow.steps);
        this._flow.start = remainingSteps[0] || '';
      }
      // Update any steps that reference the deleted step
      Object.values(this._flow.steps).forEach((step) => {
        if (step.next === id) {
          step.next = undefined;
        }
        if (step.branches) {
          Object.entries(step.branches).forEach(([key, value]) => {
            if (value === id) {
              delete step.branches![key];
            }
          });
        }
      });
    }
  };

  getStep = (id: string): Step | undefined => {
    return this._flow.steps[id];
  };

  getAllSteps = (): Step[] => {
    return Object.values(this._flow.steps);
  };

  exportFlow = (): string => {
    return JSON.stringify(this._flow, null, 2);
  };

  importFlow = (flowJson: string): void => {
    try {
      const parsedFlow = JSON.parse(flowJson) as Flow;
      this.validateFlow(parsedFlow);
      this._flow = parsedFlow;
    } catch (error) {
      console.error('Error importing flow:', error);
      throw new Error('Invalid flow JSON');
    }
  };

  private validateFlow(flow: Flow): void {
    if (!flow.metadata || !flow.configuration || !flow.steps) {
      throw new Error('Invalid flow structure: missing required fields');
    }

    if (flow.start && !flow.steps[flow.start]) {
      throw new Error('Start step not found in steps');
    }

    Object.entries(flow.steps).forEach(([id, step]) => {
      if (!step.type) {
        throw new Error(`Step ${id} missing type`);
      }
      if (step.next && !flow.steps[step.next]) {
        throw new Error(`Next step "${step.next}" not found for step "${id}"`);
      }
      if (step.branches) {
        Object.entries(step.branches).forEach(([key, target]) => {
          if (!flow.steps[target]) {
            throw new Error(`Branch target "${target}" not found for step "${id}" branch "${key}"`);
          }
        });
      }
    });
  }
} 