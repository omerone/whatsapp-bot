import React, { useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  XYPosition,
  ReactFlowInstance,
  Panel,
  useReactFlow,
  EdgeMouseHandler,
  NodeTypes,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Box, 
  Paper, 
  Typography, 
  IconButton, 
  Drawer, 
  Button, 
  Alert, 
  Snackbar, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import FolderIcon from '@mui/icons-material/Folder';
import { useFlow } from '../context/FlowContext';
import { StepType, StepData, Step } from '../types/flow';
import StepNode from './nodes/StepNode';
import StepEditor from './StepEditor';
import MetadataEditor from './MetadataEditor';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { getLayoutedElements } from '../utils/autoLayout';
import { checkNodeOverlap, findFreeNodePosition } from '../utils/nodeUtils';
import EditorSidebar from './EditorSidebar';

const nodeTypes: NodeTypes = {
  message: StepNode,
  question: StepNode,
  options: StepNode,
  date: StepNode,
};

const FlowEditor: React.FC = () => {
  const { flow, addStep, updateStep, deleteStep, getAllSteps, getStep, importFlow, exportFlow, undo, redo, canUndo, canRedo, createNewFlow, setFlow } = useFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [noSteps, setNoSteps] = useState(true);
  const [noStart, setNoStart] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error'}>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [showFlowsDialog, setShowFlowsDialog] = useState(false);
  const [flowsList, setFlowsList] = useState<string[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [currentFlowName, setCurrentFlowName] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgeLabelInput, setEdgeLabelInput] = useState('');
  const [showEdgeLabelEditor, setShowEdgeLabelEditor] = useState(false);
  const edgeLabelInputRef = useRef<HTMLInputElement>(null);

  // Use ref to track which nodes we've already repositioned to avoid infinite loops
  const repositionedNodeIds = useRef<Set<string>>(new Set());

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance) {
        console.error('React Flow instance not available');
        return;
      }

      // קבלת הסוג מהדאטה טרנספר - פשוט מטקסט רגיל
      const type = event.dataTransfer.getData('text/plain') as StepType;
      
      if (!type || !['message', 'question', 'options', 'date'].includes(type)) {
        console.error('Invalid or missing node type:', type);
        return;
      }

      console.log('Drop event with type:', type);

      // Get the position where the node was dropped
      const dropPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      console.log('Drop position:', dropPosition);
      
      // Get a position that is definitely not (0,0)
      const position = {
        x: dropPosition.x || Math.random() * 300 + 50,
        y: dropPosition.y || Math.random() * 200 + 50,
      };

      // Check if this position is already taken
      const isPositionTaken = nodes.some(
        node => 
          Math.abs(node.position.x - position.x) < 50 && 
          Math.abs(node.position.y - position.y) < 50
      );
      
      // If position is taken, offset it slightly
      if (isPositionTaken) {
        position.x += 150;
        position.y += 150;
      }

      console.log('Final position for new node:', position);

      // Find highest step number and increment by 1
      const stepNumbers = nodes
        .map(node => {
          const match = node.id.match(/^(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => !isNaN(num));
      
      const highestStepNumber = stepNumbers.length > 0 ? Math.max(...stepNumbers) : 0;
      const newNodeId = `${highestStepNumber + 1}`;
      
      const newNode = {
        id: newNodeId,
        type,
        position,
        data: {
          type,
          label: newNodeId,
          messageHeader: '',
          message: '',
          footerMessage: '',
        },
      };

      console.log('New node:', newNode);
      
      // Create the node first
      setNodes((nds) => nds.concat(newNode));
      
      // Then update the flow data
      const stepData: StepData = {
        id: newNodeId,
        type,
        // Label is identical to ID - this will be displayed on the node
        label: newNodeId,
        messageHeader: '',
        message: '',
        footerMessage: '',
        enabled: true,
        userResponseWaiting: type !== 'message',
        position,
      };
      
      console.log('Adding step to flow:', stepData);
      try {
        addStep(stepData);
        setSnackbar({
          open: true,
          message: 'הצעד נוסף בהצלחה',
          severity: 'success'
        });
        setNoSteps(false);
      } catch (error) {
        console.error('Error adding step:', error);
        setSnackbar({
          open: true,
          message: 'שגיאה בהוספת הצעד',
          severity: 'error'
        });
      }
    },
    [nodes, setNodes, addStep, reactFlowInstance]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedStep(node.id);
  }, []);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    // עדכון המיקום של הצעד כאשר גרירה מסתיימת
    const step = getStep(node.id);
    if (step) {
      console.log('Node drag stopped. Updating position for node:', node.id, node.position);
      
      // Verify that the position is valid and not (0,0)
      const position = node.position.x === 0 && node.position.y === 0 
        ? { x: 100, y: 100 } // Give a default position if somehow it was reset to origin
        : node.position;
      
      // Record that this node has been manually positioned
      repositionedNodeIds.current.add(node.id);
      
      // Make sure ReactFlow updates the position in the state
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              position,
            };
          }
          return n;
        })
      );
      
      // עדכן את המיקום של הצעד בלבד, בלי לגרום לסידור אוטומטי
      updateStep(node.id, { 
        ...step,
        position
      }, false); // הוספת פרמטר שאומר לא להפעיל סידור אוטומטי
    }
  }, [getStep, updateStep, setNodes]);

  // פונקציה לעדכון שם התסריט כאשר שם החברה משתנה
  const handleCompanyNameChange = (newName: string) => {
    if (newName && newName.trim() !== '') {
      // עדכון שם הקובץ רק אם שם החברה לא ריק
      const newFileName = `${newName.trim()}.json`;
      setSaveFileName(newFileName);
      
      // אם זה תסריט חדש (שעדיין לא נשמר), עדכן גם את השם הנוכחי
      if (!currentFlowName) {
        setCurrentFlowName(newFileName);
      }
    }
  };

  const handleExport = () => {
    setShowSaveDialog(true);
  };

  const handleSaveFlow = async () => {
    try {
      console.log('Saving flow with current node positions');
      
      // Ensure all nodes have their current positions saved in the flow before export
      const updatedFlow = { ...flow };
      
      nodes.forEach(node => {
        if (node.position && updatedFlow.steps[node.id]) {
          // Update the flow directly to ensure positions are saved
          updatedFlow.steps[node.id] = {
            ...updatedFlow.steps[node.id],
            position: {
              x: node.position.x,
              y: node.position.y
            }
          };
        }
      });
      
      // Update the flow context with the new positions
      setFlow(updatedFlow);
      
      // Small delay to ensure flow state is updated before export
      setTimeout(async () => {
        // Now export the flow with the updated positions
        const flowData = JSON.stringify(updatedFlow, null, 2);
        
        // Save the flow data to the server
        let fileName = saveFileName || 'new_flow.json';
        if (!fileName.endsWith('.json')) {
          fileName += '.json';
        }
        
        const response = await fetch(`/api/flows/${fileName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: flowData,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        setCurrentFlowName(fileName);
        setShowSaveDialog(false);
        setSnackbar({
          open: true,
          message: `התסריט ${fileName} נשמר בהצלחה`,
          severity: 'success'
        });
      }, 100);
    } catch (error) {
      console.error('Error saving flow:', error);
      setSnackbar({
        open: true,
        message: `שגיאה בשמירת התסריט: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        severity: 'error'
      });
    }
  };

  const handleServerSave = async (overwrite: boolean = false) => {
    try {
      // Call handleSaveFlow directly to ensure positions are saved
      await handleSaveFlow();
      setShowSaveDialog(false);
      return;
    } catch (error) {
      console.error('Error saving flow:', error);
      setSnackbar({
        open: true,
        message: `שגיאה בשמירת התסריט: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        severity: 'error'
      });
    }
  };

  const handleLocalSave = async () => {
    try {
      // First ensure all node positions are saved in the flow context
      const updatedFlow = { ...flow };
      
      nodes.forEach(node => {
        if (node.position && updatedFlow.steps[node.id]) {
          // Update the flow directly to ensure positions are saved
          updatedFlow.steps[node.id] = {
            ...updatedFlow.steps[node.id],
            position: {
              x: node.position.x,
              y: node.position.y
            }
          };
        }
      });
      
      // Update the flow context
      setFlow(updatedFlow);
      
      // Small delay to ensure flow state is updated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const json = JSON.stringify(updatedFlow, null, 2);
      
      // בדיקה אם File System Access API זמין בדפדפן
      // @ts-ignore - TS doesn't recognize showSaveFilePicker yet in all environments
      if (window && 'showSaveFilePicker' in window && typeof window.showSaveFilePicker === 'function') {
        try {
          // @ts-ignore - Using the File System Access API
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: saveFileName || 'flow.json',
            types: [{
              description: 'JSON Files',
              accept: {
                'application/json': ['.json'],
              },
            }],
          });
          
          const writable = await fileHandle.createWritable();
          await writable.write(json);
          await writable.close();
          
          // עדכון שם הקובץ הנוכחי
          const fileName = fileHandle.name;
          if (fileName) {
            setCurrentFlowName(fileName);
            setSaveFileName(fileName);
          }
          
          setSnackbar({
            open: true,
            message: 'התסריט נשמר בהצלחה',
            severity: 'success'
          });
          setShowSaveDialog(false);
        } catch (err: unknown) {
          // המשתמש ביטל את הדיאלוג או שיש שגיאה אחרת
          if ((err as { name?: string }).name !== 'AbortError') {
            throw err;
          }
        }
      } else {
        // גישה לגיבוי למקרה שה-API לא נתמך
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = saveFileName || 'flow.json';
        a.click();
        URL.revokeObjectURL(url);
        
        setSnackbar({
          open: true,
          message: 'התסריט נשמר בהצלחה',
          severity: 'success'
        });
        setShowSaveDialog(false);
      }
    } catch (error) {
      console.error('Error exporting flow:', error);
      setSnackbar({
        open: true,
        message: 'שגיאה בשמירת התסריט',
        severity: 'error'
      });
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        try {
          // Reset repositioned nodes tracking for new import
          repositionedNodeIds.current.clear();
          
          // Reset the flag that tracks if we've initialized a flow
          hasInitializedRef.current = false;
          
          // Clear existing nodes before importing
          setNodes([]);
          setEdges([]);
          
          // Parse flow data to check if positions are already defined
          const flowData = e.target.result as string;
          try {
            const flowJson = JSON.parse(flowData);
            const hasDefinedPositions = Object.values(flowJson.steps).some(
              (step: any) => step.position && (step.position.x !== 0 || step.position.y !== 0)
            );
            
            // If positions are already defined, skip auto-layout
            if (hasDefinedPositions) {
              console.log("Flow already has defined positions, skipping auto-layout");
              hasInitializedRef.current = true;
              setIsInitialLoad(false);
            } else {
              // סימון שזו טעינה ראשונית שדורשת סידור
              setIsInitialLoad(true);
            }
          } catch (err) {
            console.error("Error parsing imported flow data", err);
            // Default to using auto-layout
            setIsInitialLoad(true);
          }
          
          // טעינת התסריט
          importFlow(flowData);
          
          // נסה לחלץ את שם הקובץ מהקובץ שנטען
          const fileName = file.name;
          setCurrentFlowName(fileName);
          setSaveFileName(fileName);
          
          setSnackbar({
            open: true,
            message: 'התסריט נטען בהצלחה',
            severity: 'success'
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error importing flow:', error);
          setSnackbar({
            open: true,
            message: 'שגיאה בטעינת התסריט: ' + errorMessage,
            severity: 'error'
          });
          setIsInitialLoad(false);
          hasInitializedRef.current = false;
        }
      }
    };
    reader.readAsText(file);
  };

  const handleShowFlows = async () => {
    try {
      // נשתמש ב-fetch כדי לקבל את רשימת התסריטים מהשרת
      const response = await fetch('/api/flows');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFlowsList(data);
      setShowFlowsDialog(true);
    } catch (error) {
      console.error('Error fetching flows:', error);
      setSnackbar({
        open: true,
        message: 'שגיאה בטעינת רשימת התסריטים',
        severity: 'error'
      });
    }
  };

  const handleLoadFlow = async (flowName: string) => {
    try {
      console.log('Loading flow:', flowName);
      
      const response = await fetch(`/api/flows/${flowName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // קריאת התסריט כטקסט
      const flowData = await response.text();
      
      // ניקוי הצמתים והקשתות הקיימים
      setNodes([]);
      setEdges([]);
      
      try {
        // פענוח התסריט כ-JSON
        const parsedFlow = JSON.parse(flowData);
        console.log('Parsed flow:', parsedFlow);
        
        // עדכון ישיר של ה-Flow בקונטקסט
        setFlow(parsedFlow);
        
        // יצירת צמתים וקשתות מהתסריט
        const stepsArray: StepData[] = [];
        Object.keys(parsedFlow.steps).forEach(stepId => {
          const stepData = parsedFlow.steps[stepId];
          // השתמש ב-stepId כ-id
          const step: StepData = {
            ...stepData,
            id: stepId
          };
          stepsArray.push(step);
        });
        
        console.log('Steps array:', stepsArray);
        
        // בנייה של הצמתים עם המיקומים המוגדרים בתסריט
        const newNodes: Node[] = stepsArray.map(step => {
          // וידוא שהמיקום תקף
          const hasValidPosition = step.position && 
                                typeof step.position.x === 'number' && 
                                typeof step.position.y === 'number';
          
          // שימוש במיקום המוגדר או יצירת מיקום ברירת מחדל
          const position: XYPosition = hasValidPosition ? 
                              { x: step.position!.x, y: step.position!.y } : 
                              { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 };
          
          console.log(`Step ${step.id} position:`, position);
          
          return {
            id: step.id,
            type: step.type,
            position: position,
            data: {
              ...step,
              label: step.id,
              isStartStep: parsedFlow.start === step.id
            }
          };
        });
        
        // יצירת קשתות
        const newEdges: Edge[] = [];
        
        // קישורים בין צמתים
        for (const step of stepsArray) {
          // קישור רגיל בין צעד לצעד הבא
          if (step.next) {
            newEdges.push({
              id: `${step.id}-${step.next}`,
              source: step.id,
              target: step.next,
              animated: true,
            });
          }
          
          // קישורים מסוג branches
          if (step.branches) {
            for (const [key, targetId] of Object.entries(step.branches)) {
              if (targetId) {
                newEdges.push({
                  id: `${step.id}-${targetId}-${key}`,
                  source: step.id,
                  target: targetId as string,
                  animated: true,
                  label: key,
                });
              }
            }
          }
        }
        
        // עדכון הצמתים והקשתות
        setNodes(newNodes);
        setEdges(newEdges);
        
        // סימון שיש צמתים
        setNoSteps(newNodes.length === 0);
        
        // אין צורך בסידור אוטומטי
        hasInitializedRef.current = true;
        setIsInitialLoad(false);
        
      } catch (err) {
        console.error('Error parsing flow data:', err);
        // אם יש שגיאה בפענוח, נשתמש באימפורט הרגיל
        importFlow(flowData);
      }
      
      setCurrentFlowName(flowName);
      setSaveFileName(flowName);
      setShowFlowsDialog(false);
      setSnackbar({
        open: true,
        message: `התסריט ${flowName} נטען בהצלחה`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error loading flow:', error);
      setSnackbar({
        open: true,
        message: `שגיאה בטעינת התסריט: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        severity: 'error'
      });
    }
  };

  const handleCreateNew = () => {
    try {
      createNewFlow();
      setNodes([]);
      setEdges([]);
      setNoSteps(true);
      setNoStart(false);
      // Reset repositioned nodes tracking
      repositionedNodeIds.current.clear();
      
      setSnackbar({
        open: true,
        message: 'תסריט חדש נוצר בהצלחה',
        severity: 'success'
      });
      setCurrentFlowName(null);
      setSaveFileName('');
    } catch (error) {
      console.error('Error creating new flow:', error);
      setSnackbar({
        open: true,
        message: 'שגיאה ביצירת תסריט חדש',
        severity: 'error'
      });
    }
  };

  // Function to manually trigger auto-layout
  const applyAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    
    console.log('Applying auto-layout');
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'TB');
    
    // Reset repositioned nodes tracking since we're doing a full layout
    repositionedNodeIds.current.clear();
    
    // Update the ReactFlow nodes
    setNodes(layoutedNodes as Node[]);
    setEdges(layoutedEdges);
    
    // Update positions in the flow context
    layoutedNodes.forEach(node => {
      const step = getStep(node.id);
      if (step) {
        console.log(`Updating step ${node.id} position to:`, node.position);
        
        // Make sure we have a valid position
        if (node.position && (node.position.x !== 0 || node.position.y !== 0)) {
          updateStep(node.id, {
            ...step,
            position: {
              x: node.position.x,
              y: node.position.y
            }
          }, false); // Don't trigger another layout
          
          // Mark this node as repositioned
          repositionedNodeIds.current.add(node.id);
        }
      }
    });
    
    // Force an immediate export to update the flow context
    setTimeout(() => {
      // Save the current flow state with updated positions
      const updatedFlow = JSON.parse(exportFlow());
      console.log('Updated flow with new positions:', updatedFlow);
    }, 100);
    
    setSnackbar({
      open: true,
      message: 'סידור אוטומטי הושלם בהצלחה',
      severity: 'success'
    });
  }, [nodes, edges, setNodes, setEdges, getStep, updateStep, exportFlow]);

  // A ref to track if we had at least one flow loaded
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    try {
      // Skip empty flows
      if (Object.keys(flow.steps).length === 0) {
        setNoSteps(true);
        setNodes([]);
        setEdges([]);
        return;
      }
      
      const stepsArray = getAllSteps();
      console.log("Current steps:", stepsArray);
      
      // We only want auto-layout to happen on initial load, not when adding nodes
      const needsLayout = isInitialLoad && !hasInitializedRef.current;
      
      console.log("Layout needed?", needsLayout, "isInitialLoad:", isInitialLoad, "hasInitialized:", hasInitializedRef.current);
      
      // בניית nodes ו-edges מתוך ה-flow
      let newNodes: Node[] = stepsArray.map(step => {
        // Use existing node position if it exists (for previously laid out nodes)
        const existingNode = nodes.find(n => n.id === step.id);
        
        // מוודא שהמיקום מהflow קיים ומכיל ערכים תקינים
        const hasValidPosition = step.position && 
                                typeof step.position.x === 'number' && 
                                typeof step.position.y === 'number' && 
                                (step.position.x !== 0 || step.position.y !== 0);
        
        // הגדרת מיקום ברירת מחדל אם אין מיקום תקף
        const defaultPosition: XYPosition = { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 };
        
        // השתמש במיקום שמור או במיקום קיים או במיקום ברירת מחדל
        let position: XYPosition;
        if (hasValidPosition) {
          position = { x: step.position!.x, y: step.position!.y };
        } else if (existingNode?.position) {
          position = existingNode.position;
        } else {
          position = defaultPosition;
        }
        
        console.log(`Node ${step.id} position:`, position, "from step:", hasValidPosition);
        
        return {
          id: step.id,
          type: step.type,
          position: position, // כעת המיקום הוא תמיד XYPosition מוגדר
          data: {
            ...step,
            // הוספת מידע נוסף שעשוי להידרש לתצוגה
            label: step.id, // שימוש במזהה כתווית
            isStartStep: flow.start === step.id,
          },
        };
      });
      
      const newEdges: Edge[] = [];
      // יצירת edges על סמך היחסים בין הצעדים
      for (const step of stepsArray) {
        // קישור רגיל בין צעד לצעד הבא
        if (step.next) {
          newEdges.push({
            id: `${step.id}-${step.next}`,
            source: step.id,
            target: step.next,
            animated: true,
          });
        }
        
        // קישורים על סמך branches (למשל עבור צעדי options)
        if (step.branches) {
          for (const [key, targetId] of Object.entries(step.branches)) {
            if (targetId) {
              newEdges.push({
                id: `${step.id}-${targetId}-${key}`,
                source: step.id,
                target: targetId as string,
                animated: true,
                label: key,
              });
            }
          }
        }
      }
      
      setNoSteps(false);
      setNoStart(!flow.start);
      
      console.log("Layout needed:", needsLayout);
      
      if (needsLayout) {
        console.log("Applying auto-layout on initial load");
        // סידור היררכי רק אם זו טעינה ראשונית
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'TB');
        setNodes(layoutedNodes as Node[]);
        setEdges(layoutedEdges);
        
        // שמירת המיקומים החדשים בflow
        layoutedNodes.forEach(node => {
          const step = getStep(node.id);
          if (step) {
            console.log(`Setting position for step ${node.id} to:`, node.position);
            updateStep(node.id, {
              ...step,
              position: {
                x: node.position.x,
                y: node.position.y
              }
            }, false); // Don't trigger a full update with auto-layout
            
            // Mark as repositioned
            repositionedNodeIds.current.add(node.id);
          }
        });
        
        // Mark that we've done the initial layout
        hasInitializedRef.current = true;
        
        // איפוס הדגל לאחר הטעינה ראשונית
        setIsInitialLoad(false);
      } else {
        // שימוש במיקומים הקיימים או זו פעולה לאחר טעינה ראשונית
        console.log("Using existing positions or operating after initial load");
        
        // Double check that nodes have their positions from the flow context
        newNodes = newNodes.map(node => {
          const step = getStep(node.id);
          if (step && step.position && 
              typeof step.position.x === 'number' && 
              typeof step.position.y === 'number' && 
              (step.position.x !== 0 || step.position.y !== 0)) {
            
            console.log(`Using stored position for ${node.id}:`, step.position);
            return {
              ...node,
              position: {
                x: step.position.x,
                y: step.position.y
              }
            };
          }
          return node;
        });
        
        setNodes(newNodes);
        setEdges(newEdges);
      }
    } catch (err: unknown) {
      console.error('Error updating flow visualization:', err);
      setNoSteps(true);
      setNodes([]);
      setEdges([]);
      setIsInitialLoad(false);
    }
  }, [flow, getAllSteps, getStep, updateStep, setNodes, setEdges, isInitialLoad]);

  const closeSnackbar = () => {
    setSnackbar({...snackbar, open: false});
  };

  // Add grid background
  const gridStyle = {
    backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px)',
    backgroundSize: '100px 100px',
  };

  // Override ReactFlow's default behavior for dragging
  const onNodeDrag = useCallback((event: React.MouseEvent, node: Node, nodes: Node[]) => {
    // Force trigger ReactFlow's internal position update
    const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
    if (nodeElement) {
      // Ensure the node is draggable
      nodeElement.classList.add('selectable');
      nodeElement.classList.remove('nopan');
    }
  }, []);
  
  // Make sure nodes are draggable when flow changes
  useEffect(() => {
    // Give React Flow time to render new nodes
    const timer = setTimeout(() => {
      // Make all nodes draggable
      const nodeElements = document.querySelectorAll('[data-id]');
      nodeElements.forEach(el => {
        el.classList.add('selectable');
        el.classList.remove('nopan');
      });
      
      console.log("Made all nodes draggable:", nodeElements.length);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [nodes]);

  // Force repositioning of nodes if they're at the origin (0,0)
  useEffect(() => {
    if (nodes.length === 0) return;
    
    // Check if any nodes are at (0,0) that we haven't already repositioned
    const nodesAtOrigin = nodes.filter(
      node => (node.position.x === 0 && node.position.y === 0) && 
              !repositionedNodeIds.current.has(node.id)
    );
    
    if (nodesAtOrigin.length > 0) {
      console.log('Found nodes at origin:', nodesAtOrigin.length);
      
      // Generate a grid-based layout for these nodes
      let offsetX = 100;
      let offsetY = 100;
      
      // Update the positions of these nodes
      const updatedNodes = nodes.map(node => {
        if ((node.position.x === 0 && node.position.y === 0) && 
            !repositionedNodeIds.current.has(node.id)) {
          // Mark this node as repositioned
          repositionedNodeIds.current.add(node.id);
          
          const position = { 
            x: offsetX, 
            y: offsetY
          };
          
          // Update the node position in the flow context
          const step = getStep(node.id);
          if (step) {
            updateStep(node.id, {
              ...step,
              position
            }, false);
          }
          
          // Move to the next grid position
          offsetX += 300;
          if (offsetX > 900) {
            offsetX = 100;
            offsetY += 200;
          }
          
          return {
            ...node,
            position
          };
        }
        return node;
      });
      
      setNodes(updatedNodes as Node[]);
    }
  }, [nodes, getStep, updateStep, setNodes]);

  // טיפול בלחיצה על קו - שיפור ממשק עריכת תוויות
  const onEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setEdgeLabelInput(edge.label as string || '');
    setShowEdgeLabelEditor(true);
    
    // מיקום תיבת העריכה באמצע הקו
    const edgeElement = document.querySelector(`[data-id="${edge.id}"]`);
    if (edgeElement) {
      const rect = edgeElement.getBoundingClientRect();
      const editorElement = document.getElementById('edge-label-editor');
      if (editorElement) {
        // מיקום בדיוק באמצע הקו
        editorElement.style.top = `${rect.top + rect.height / 2}px`;
        editorElement.style.left = `${rect.left + rect.width / 2}px`;
      }
    }
    
    // מיקוד מיידי בתיבת הטקסט
    setTimeout(() => {
      if (edgeLabelInputRef.current) {
        edgeLabelInputRef.current.focus();
      }
    }, 100);
  }, []);
  
  // שמירת תווית הקו
  const saveEdgeLabel = useCallback(() => {
    if (selectedEdge) {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === selectedEdge.id) {
            return {
              ...e,
              label: edgeLabelInput,
            };
          }
          return e;
        })
      );
      
      // עדכון במודל הנתונים
      const sourceStep = getStep(selectedEdge.source);
      if (sourceStep && sourceStep.branches) {
        const updatedBranches = { ...sourceStep.branches };
        
        // מצא את המפתח המתאים לקו זה
        const branchKey = Object.entries(updatedBranches).find(
          ([_, targetId]) => targetId === selectedEdge.target
        )?.[0];
        
        if (branchKey) {
          // מחק את הקשר הקיים
          delete updatedBranches[branchKey];
          
          // הוסף קשר חדש עם התווית החדשה
          updatedBranches[edgeLabelInput] = selectedEdge.target;
          
          // עדכן את הצעד
          updateStep(
            selectedEdge.source,
            {
              ...sourceStep,
              branches: updatedBranches,
            },
            false
          );
        }
      }
      
      setShowEdgeLabelEditor(false);
      setSelectedEdge(null);
    }
  }, [selectedEdge, edgeLabelInput, setEdges, getStep, updateStep]);
  
  // ביטול עריכת תווית הקו
  const cancelEdgeLabel = useCallback(() => {
    setShowEdgeLabelEditor(false);
    setSelectedEdge(null);
  }, []);
  
  // טיפול בלחיצה מחוץ לתיבת העריכה
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const editorElement = document.getElementById('edge-label-editor');
      if (editorElement && !editorElement.contains(event.target as HTMLElement)) {
        cancelEdgeLabel();
      }
    };
    
    if (showEdgeLabelEditor) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEdgeLabelEditor, cancelEdgeLabel]);
  
  // טיפול בלחיצה על Enter
  const handleEdgeLabelKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        saveEdgeLabel();
      } else if (event.key === 'Escape') {
        cancelEdgeLabel();
      }
    },
    [saveEdgeLabel, cancelEdgeLabel]
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <EditorSidebar />
      <Box sx={{ flexGrow: 1, height: '100%' }}>
        <Paper
          elevation={3}
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              עורך תסריט שיחה {currentFlowName ? `- ${currentFlowName}` : ''}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={handleCreateNew}
                sx={{ minWidth: 0 }}
              >
                תסריט חדש
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                sx={{ minWidth: 0 }}
              >
                שמור
              </Button>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileIcon />}
                sx={{ minWidth: 0 }}
              >
                טען
                <input type="file" accept="application/json" hidden onChange={handleImport} />
              </Button>
              <Button
                variant="outlined"
                startIcon={<UndoIcon />}
                onClick={undo}
                disabled={!canUndo}
                sx={{ minWidth: 0 }}
              >
                בטל
              </Button>
              <Button
                variant="outlined"
                startIcon={<RedoIcon />}
                onClick={redo}
                disabled={!canRedo}
                sx={{ minWidth: 0 }}
              >
                חזור
              </Button>
              <Button
                variant="outlined"
                startIcon={<AutoFixHighIcon />}
                onClick={applyAutoLayout}
                sx={{ minWidth: 0 }}
              >
                סידור אוטומטי
              </Button>
              <IconButton onClick={handleShowFlows}>
                <FolderIcon />
              </IconButton>
              <IconButton onClick={() => setShowMetadata(true)}>
                <SettingsIcon />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1, position: 'relative' }}>
            <ReactFlow
              key="react-flow"
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onEdgeClick={onEdgeClick}
              nodeTypes={nodeTypes}
              onInit={setReactFlowInstance}
              fitView={false}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              minZoom={0.2}
              maxZoom={4}
              nodesDraggable={true}
              nodesConnectable={true}
              elementsSelectable={true}
              style={{ width: '100%', height: '100%' }}
            >
              <Background />
              <Controls />
            </ReactFlow>
            {noSteps && (
              <Box 
                sx={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: 'gray',
                  zIndex: 10,
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  padding: 2,
                  borderRadius: 2
                }}
              >
                <Typography variant="h6" sx={{ mb: 2 }}>
                  לא קיימים צעדים בתסריט
                </Typography>
                <Typography variant="body1">
                  גרור בלוקים מהסיידבר כדי להתחיל לבנות את התסריט שלך
                </Typography>
              </Box>
            )}
            
            {showEdgeLabelEditor && (
              <Box
                id="edge-label-editor"
                sx={{
                  position: 'absolute',
                  zIndex: 1000,
                  backgroundColor: 'white',
                  padding: 2,
                  borderRadius: 2,
                  boxShadow: 5,
                  transform: 'translate(-50%, -50%)',
                  border: '2px solid #1976d2',
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center', fontWeight: 'bold' }}>
                  ערוך טקסט על הקו
                </Typography>
                <TextField
                  inputRef={edgeLabelInputRef}
                  value={edgeLabelInput}
                  onChange={(e) => setEdgeLabelInput(e.target.value)}
                  onKeyDown={handleEdgeLabelKeyDown}
                  size="small"
                  autoFocus
                  placeholder="הזן טקסט לתצוגה על הקו"
                  sx={{ width: 200 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Button size="small" variant="contained" color="primary" onClick={saveEdgeLabel}>
                    שמור
                  </Button>
                  <Button size="small" variant="outlined" onClick={cancelEdgeLabel}>
                    ביטול
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>

        <Drawer
          anchor="right"
          open={!!selectedStep}
          onClose={() => setSelectedStep(null)}
        >
          {selectedStep && (
            <StepEditor
              stepId={selectedStep}
              onClose={() => setSelectedStep(null)}
            />
          )}
        </Drawer>

        <Drawer
          anchor="right"
          open={showMetadata}
          onClose={() => setShowMetadata(false)}
        >
          <MetadataEditor 
            onClose={() => setShowMetadata(false)} 
            onCompanyNameChange={handleCompanyNameChange}
          />
        </Drawer>
        
        <Dialog
          open={showFlowsDialog}
          onClose={() => setShowFlowsDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>תסריטים זמינים</DialogTitle>
          <DialogContent>
            <List>
              {flowsList.length > 0 ? (
                flowsList.map((flowName) => (
                  <ListItemButton 
                    key={flowName}
                    onClick={() => handleLoadFlow(flowName)}
                  >
                    <ListItemText primary={flowName} />
                  </ListItemButton>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="לא נמצאו תסריטים" />
                </ListItem>
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowFlowsDialog(false)}>סגור</Button>
          </DialogActions>
        </Dialog>
        
        <Dialog
          open={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>שמירת תסריט</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2, mb: 2 }}>
              <TextField
                fullWidth
                label="שם קובץ"
                value={saveFileName}
                onChange={(e) => setSaveFileName(e.target.value)}
                placeholder="flow.json"
                helperText="הזן שם קובץ עם סיומת .json"
                sx={{ mb: 2 }}
              />
              
              <Typography variant="body2" sx={{ mb: 2 }}>
                בחר היכן לשמור את התסריט:
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                  variant="contained" 
                  onClick={handleLocalSave}
                  disabled={!saveFileName}
                >
                  שמור במחשב
                </Button>
                
                <Button 
                  variant="contained" 
                  onClick={handleSaveFlow}
                  disabled={!saveFileName}
                  color="primary"
                >
                  שמור בשרת
                </Button>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSaveDialog(false)}>ביטול</Button>
          </DialogActions>
        </Dialog>
        
        <Snackbar 
          open={snackbar.open} 
          autoHideDuration={6000} 
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default FlowEditor; 