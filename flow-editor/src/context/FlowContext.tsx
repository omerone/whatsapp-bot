import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Flow, StepData, Step } from '../types/flow';

interface HistoryState {
  flow: Flow;
  timestamp: number;
}

interface FlowContextType {
  flow: Flow;
  addStep: (step: StepData) => void;
  updateStep: (id: string, changes: Partial<StepData>, triggerFullUpdate?: boolean) => void;
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
  updateStepId: (oldId: string, newId: string) => void;
  setFlow: (newFlow: Flow) => void;
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

  // Debug log
  useEffect(() => {
    console.log('Flow updated:', flow);
    console.log('Steps count:', Object.keys(flow.steps).length);
  }, [flow]);

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
    console.log('Updating flow:', newFlow);
    setFlow(newFlow);
    pushHistory(newFlow);
  }, [pushHistory]);

  const addStep = useCallback((step: StepData) => {
    console.log('Adding step to flow context:', step);
    
    // וידוא שיש כל השדות הנדרשים
    const stepToAdd: Step = {
      ...step,
      // רק מוסיפים enabled אם הוא מוגדר במפורש (כלומר false)
      ...(step.enabled !== undefined && { enabled: step.enabled }),
      userResponseWaiting: step.userResponseWaiting !== undefined ? step.userResponseWaiting : step.type !== 'message',
    };
    
    const newFlow = {
      ...flow,
      steps: {
        ...flow.steps,
        [step.id]: stepToAdd,
      },
    };
    
    // אם אין צעד התחלה, הגדר את הצעד הנוכחי כצעד התחלה
    if (!flow.start) {
      newFlow.start = step.id;
    }
    
    console.log('Updated flow with new step:', newFlow);
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  const updateStep = useCallback((id: string, changes: Partial<StepData>, triggerFullUpdate: boolean = true) => {
    console.log('Updating step:', id, changes);
    if (!flow.steps[id]) {
      console.error('Step not found:', id);
      return;
    }
    
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
    
    console.log('Flow after step update:', newFlow);
    if (triggerFullUpdate) {
      updateFlow(newFlow);
    } else {
      // Only update the flow state without triggering the full update process
      setFlow(newFlow);
    }
  }, [flow, updateFlow]);

  const deleteStep = useCallback((id: string) => {
    console.log('Deleting step:', id);
    if (!flow.steps[id]) {
      console.error('Step not found:', id);
      return;
    }
    
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
    
    console.log('Flow after step deletion:', newFlow);
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  // Add a function to update a step's ID
  const updateStepId = useCallback((oldId: string, newId: string) => {
    console.log(`Updating step ID from ${oldId} to ${newId}`);
    
    if (!flow.steps[oldId]) {
      console.error('Step not found:', oldId);
      return;
    }
    
    if (oldId === newId) {
      console.log('Old ID and new ID are the same, no change needed');
      return;
    }
    
    if (flow.steps[newId]) {
      console.error('A step with the new ID already exists:', newId);
      return;
    }
    
    // Create a copy of the flow with the new step ID
    const newSteps = { ...flow.steps };
    
    // Copy the old step to the new ID
    newSteps[newId] = {
      ...newSteps[oldId],
      id: newId,
      label: newId, // Update label to match new ID
    };
    
    // Remove the old step
    delete newSteps[oldId];
    
    // Update any references to this step
    Object.values(newSteps).forEach(step => {
      // Update next references
      if (step.next === oldId) {
        step.next = newId;
      }
      
      // Update branches references
      if (step.branches) {
        Object.entries(step.branches).forEach(([key, value]) => {
          if (value === oldId) {
            step.branches![key] = newId;
          }
        });
      }
    });
    
    // Update start step if needed
    const newFlow = {
      ...flow,
      steps: newSteps,
      start: flow.start === oldId ? newId : flow.start,
    };
    
    console.log('Flow after step ID update:', newFlow);
    updateFlow(newFlow);
  }, [flow, updateFlow]);

  const getStep = useCallback((id: string): StepData | undefined => {
    const step = flow.steps[id];
    if (!step) {
      console.error('Step not found:', id);
      return undefined;
    }
    return step;
  }, [flow]);

  const getAllSteps = useCallback((): StepData[] => {
    return Object.entries(flow.steps).map(([id, step]) => ({
      ...step,
      id,
    }));
  }, [flow]);

  const importFlow = useCallback((json: string) => {
    try {
      const newFlow = JSON.parse(json);
      // בדיקות תקינות בסיסיות
      if (!newFlow || typeof newFlow !== 'object') {
        throw new Error('Invalid flow structure');
      }
      
      // וידוא שיש את השדות הנדרשים
      if (!newFlow.metadata) {
        newFlow.metadata = {
          company_name: '',
          version: '1.0.0',
          last_updated: new Date().toISOString(),
        };
      }
      
      if (!newFlow.configuration) {
        newFlow.configuration = {
          rules: {},
          client_management: {},
        };
      }
      
      if (!newFlow.steps) {
        newFlow.steps = {};
      }
      
      console.log('Importing flow:', newFlow);
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
    console.log('Creating new flow in context');
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
    
    // עדכון הסטייט ישירות ללא שימוש ב-updateFlow
    // כדי למנוע בעיות עם ההיסטוריה
    setFlow(newFlow);
    
    // איפוס ההיסטוריה
    setHistory([{ flow: newFlow, timestamp: Date.now() }]);
    setCurrentHistoryIndex(0);
    
    console.log('New flow created:', newFlow);
    return newFlow;
  }, []);

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
    updateStepId,
    setFlow,
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