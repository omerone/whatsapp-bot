import React, { createContext, useContext, useState, useCallback } from 'react';
import { Flow, StepData } from '../types/flow';

interface HistoryState {
  flow: Flow;
  timestamp: number;
}

interface FlowContextType {
  flow: Flow;
  addStep: (step: StepData) => void;
  updateStep: (id: string, changes: Partial<StepData>) => void;
  deleteStep: (id: string) => void;
  getStep: (id: string) => StepData | undefined;
  getAllSteps: () => StepData[];
  importFlow: (json: string) => void;
  exportFlow: () => string;
  updateMetadata: (changes: Partial<Flow['metadata']>) => void;
  updateConfiguration: (changes: Partial<Flow['configuration']>) => void;
  updateIntegrations: (changes: Partial<Flow['integrations']>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  createNewFlow: () => void;
}

const FlowContext = createContext<FlowContextType | undefined>(undefined);

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flow, setFlow] = useState<Flow>({
    metadata: {
      company_name: '',
      version: '1.0.0',
      last_updated: new Date().toISOString(),
    },
    configuration: {
      rules: {},
      client_management: {},
    },
    start: '',
    steps: {},
  });

  const [history, setHistory] = useState<HistoryState[]>([
    { flow, timestamp: Date.now() },
  ]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  const pushHistory = useCallback((newFlow: Flow) => {
    const newHistory = history.slice(0, currentHistoryIndex + 1);
    newHistory.push({
      flow: JSON.parse(JSON.stringify(newFlow)), // Deep clone
      timestamp: Date.now(),
    });
    
    // Keep only last 50 states to prevent memory issues
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  }, [history, currentHistoryIndex]);

  const updateFlow = useCallback((newFlow: Flow) => {
    setFlow(newFlow);
    pushHistory(newFlow);
  }, [pushHistory]);

  const addStep = useCallback((step: StepData) => {
    const newFlow = {
      ...flow,
      steps: {
        ...flow.steps,
        [step.id]: step,
      },
    };
    if (!flow.start) {
      newFlow.start = step.id;
    }
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  const updateStep = useCallback((id: string, changes: Partial<StepData>) => {
    if (!flow.steps[id]) return;
    const newFlow = {
      ...flow,
      steps: {
        ...flow.steps,
        [id]: {
          ...flow.steps[id],
          ...changes,
        },
      },
    };
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  const deleteStep = useCallback((id: string) => {
    if (!flow.steps[id]) return;
    const newSteps = { ...flow.steps };
    delete newSteps[id];
    
    // Update any references to this step
    Object.values(newSteps).forEach(step => {
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
    
    const newFlow = {
      ...flow,
      steps: newSteps,
      start: flow.start === id ? Object.keys(newSteps)[0] || '' : flow.start,
    };
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  const getStep = useCallback((id: string) => flow.steps[id], [flow]);

  const getAllSteps = useCallback(() => Object.values(flow.steps), [flow]);

  const importFlow = useCallback((json: string) => {
    try {
      const newFlow = JSON.parse(json);
      // Validate flow structure here
      updateFlow(newFlow);
    } catch (error) {
      console.error('Error importing flow:', error);
      throw new Error('Invalid flow JSON');
    }
  }, [updateFlow]);

  const exportFlow = useCallback(() => {
    return JSON.stringify(flow, null, 2);
  }, [flow]);

  const updateMetadata = useCallback((changes: Partial<Flow['metadata']>) => {
    const newFlow = {
      ...flow,
      metadata: {
        ...flow.metadata,
        ...changes,
        last_updated: new Date().toISOString(),
      },
    };
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  const updateConfiguration = useCallback((changes: Partial<Flow['configuration']>) => {
    const newFlow = {
      ...flow,
      configuration: {
        ...flow.configuration,
        ...changes,
      },
    };
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  const updateIntegrations = useCallback((changes: Partial<Flow['integrations']>) => {
    const newFlow = {
      ...flow,
      integrations: {
        ...flow.integrations,
        ...changes,
      },
    };
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  const undo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      setFlow(history[newIndex].flow);
    }
  }, [currentHistoryIndex, history]);

  const redo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      setFlow(history[newIndex].flow);
    }
  }, [currentHistoryIndex, history]);

  const createNewFlow = useCallback(() => {
    const newFlow: Flow = {
      metadata: {
        company_name: '',
        version: '1.0.0',
        last_updated: new Date().toISOString(),
      },
      configuration: {
        rules: {},
        client_management: {},
      },
      start: '',
      steps: {},
    };
    updateFlow(newFlow);
  }, [updateFlow]);

  const value = {
    flow,
    addStep,
    updateStep,
    deleteStep,
    getStep,
    getAllSteps,
    importFlow,
    exportFlow,
    updateMetadata,
    updateConfiguration,
    updateIntegrations,
    undo,
    redo,
    canUndo: currentHistoryIndex > 0,
    canRedo: currentHistoryIndex < history.length - 1,
    createNewFlow,
  };

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
};

export const useFlow = () => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error('useFlow must be used within a FlowProvider');
  }
  return context;
}; 