import React, { useCallback, useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
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
  Position,
  EdgeTypes
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
  Tooltip,
  Divider,
  Chip
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
  condition: StepNode,
};

// סוגי קווים מותאמים אישית - עם אזור שקוף לתוויות
const edgeTypes: EdgeTypes = {
  smoothstep: ({ id, sourceX, sourceY, targetX, targetY, style = {}, animated = false, label, labelStyle }) => {
    // חישוב נקודות לקו מדורג חלק
    const deltaX = targetX - sourceX;
    const deltaY = targetY - sourceY;
    
    // יצירת path עם זויות חלקות
    const midY = sourceY + deltaY * 0.5;
    const edgePath = `M${sourceX},${sourceY} L${sourceX},${midY} L${targetX},${midY} L${targetX},${targetY}`;
    
    // חישוב מיקום התווית
    const labelX = (sourceX + targetX) / 2;
    const labelY = midY;
    
    return (
      <g>
        {/* קו רקע לשיפור הנראות */}
        <path
          d={edgePath}
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* הקו העיקרי */}
        <path
          id={id}
          style={style}
          className={animated ? 'react-flow__edge-path animated' : 'react-flow__edge-path'}
          d={edgePath}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* אזור שקוף מסביב לתווית */}
        {label && (
          <>
            {/* אזור שקוף מעל הקו */}
            <circle
              cx={labelX}
              cy={labelY}
              r="25"
              fill="rgba(255,255,255,0.95)"
              stroke="none"
            />
            
            {/* רקע לתווית */}
            <rect
              x={labelX - 30}
              y={labelY - 10}
              width="60"
              height="20"
              rx="10"
              ry="10"
              fill={String(labelStyle?.background || 'rgba(255,255,255,0.95)')}
              stroke={labelStyle?.border?.toString().replace('1px solid ', '') || (style?.stroke + '40')}
              strokeWidth="1"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
            />
            
            {/* התווית */}
            <text
              x={labelX}
              y={labelY + 4}
              textAnchor="middle"
              fontSize={labelStyle?.fontSize || "12px"}
              fontWeight={labelStyle?.fontWeight || "500"}
              fill={labelStyle?.color || style?.stroke || '#666'}
              className="react-flow__edge-text"
            >
              {label}
            </text>
          </>
        )}
        
        {/* חץ בסוף הקו */}
        <defs>
          <marker
            id={`arrowhead-${id}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={style?.stroke || '#666'}
            />
          </marker>
        </defs>
        
        <path
          d={edgePath}
          stroke="transparent"
          strokeWidth="1"
          fill="none"
          markerEnd={`url(#arrowhead-${id})`}
        />
      </g>
    );
  }
};

// מערך צבעים מודרניים לשימוש בקווים
const EDGE_COLORS = [
  '#2563eb', // כחול מודרני
  '#7c3aed', // סגול מודרני
  '#10b981', // ירוק מודרני
  '#f59e0b', // כתום מודרני
  '#ef4444', // אדום מודרני
  '#06b6d4', // טורקיז מודרני
  '#8b5cf6', // סגול בהיר
  '#14b8a6', // ירוק-טורקיז
  '#f97316', // כתום בהיר
  '#ec4899', // ורוד מודרני
];

// מיפוי צבעים לפי סוג צעד - מותאם לנושא החדש
const STEP_TYPE_COLORS = {
  message: '#2563eb', // כחול מודרני
  question: '#7c3aed', // סגול מודרני
  options: '#10b981', // ירוק מודרני
  date: '#f59e0b', // כתום מודרני
  condition: '#ef4444', // אדום מודרני לתנאים
};

// פונקציה להגדרת צבע קו לפי סוג החיבור
const getEdgeColor = (edge: Edge, nodes: Node[] | any[]) => {
  // מצא את הצומת המקור
  const sourceNode = nodes.find(node => node.id === edge.source);
  if (!sourceNode) return '#999'; // צבע ברירת מחדל אפור

  // קבל את סוג הצומת המקור
  const sourceType = sourceNode.type || 'message';
  
  // אם זה צומת מסוג שאלה או הודעה, השתמש בצבע לפי סוג הצומת
  if (sourceType === 'question' || sourceType === 'message' || sourceType === 'date') {
    return STEP_TYPE_COLORS[sourceType as keyof typeof STEP_TYPE_COLORS] || '#999';
  }
  
  // אם זה צומת אפשרויות ויש תווית לקו, השתמש בצבע לפי האינדקס של התווית
  if (sourceType === 'options' && edge.label) {
    // חישוב האינדקס לפי התווית
    const labelHash = Array.from(edge.label.toString()).reduce(
      (acc, char) => acc + char.charCodeAt(0), 0
    );
    return EDGE_COLORS[labelHash % EDGE_COLORS.length];
  }

  // אחרת השתמש בצבע לפי סוג הצומת
  return STEP_TYPE_COLORS[sourceType as keyof typeof STEP_TYPE_COLORS] || '#999';
};

// פונקציה שמחזירה סגנון קו לפי סוג החיבור - קווים מלאים תמיד
const getEdgeStyle = (edge: Edge, nodes: Node[] | any[]) => {
  const color = getEdgeColor(edge, nodes);
  
  return {
    stroke: color,
    strokeWidth: 3,
    strokeDasharray: 'none', // תמיד קו מלא - לא מקווקו
  };
};

// הוספת טייפינג לאקספוז של הפונקציות דרך ה-ref
export interface FlowEditorHandle {
  handleSaveFlow: () => Promise<boolean>;
}

interface FlowEditorProps {
  flowId?: string;
  onClose?: () => void;
}

const FlowEditor: React.FC<FlowEditorProps> = forwardRef<FlowEditorHandle, FlowEditorProps>((props, ref) => {
  const { flow, addStep, updateStep, deleteStep, getAllSteps, getStep, importFlow, exportFlow, undo, redo, canUndo, canRedo, createNewFlow, setFlow, setStartStep } = useFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Custom handler for node changes that saves positions to flow context
  const handleNodesChange = useCallback((changes: any[]) => {
    // Apply the changes to nodes first
    onNodesChange(changes);
    
    // Check if any changes are position updates (when dragging ends)
    const positionChanges = changes.filter(change => 
      change.type === 'position' && change.position && change.dragging === false
    );
    
    if (positionChanges.length > 0) {
      console.log('Position changes detected (drag ended):', positionChanges.map(c => ({
        id: c.id,
        position: c.position,
        dragging: c.dragging
      })));
      
      // Use setTimeout to ensure the nodes state is updated before we save positions
      setTimeout(() => {
        // Update the flow directly to ensure positions are saved
        const updatedFlow = { ...flow };
        let hasChanges = false;
        
        positionChanges.forEach(change => {
          if (updatedFlow.steps[change.id] && change.position) {
            const newPosition = {
              x: Math.round(change.position.x),
              y: Math.round(change.position.y)
            };
            
            const currentPosition = updatedFlow.steps[change.id].position;
            
            // Only update if position actually changed
            if (!currentPosition || 
                currentPosition.x !== newPosition.x || 
                currentPosition.y !== newPosition.y) {
              
              console.log(`Updating position for step ${change.id} from`, currentPosition, 'to', newPosition);
              updatedFlow.steps[change.id] = {
                ...updatedFlow.steps[change.id],
                position: newPosition
              };
              hasChanges = true;
            }
          }
        });
        
        if (hasChanges) {
          // Update the flow context directly
          setFlow(updatedFlow);
          console.log('Flow updated with new positions');
          
          // שמירה אוטומטית לאחר שינוי מיקום
          setTimeout(() => {
            handleAutoSave();
          }, 1000);
        }
      }, 100); // Small delay to ensure nodes state is updated
    }
  }, [onNodesChange, flow, setFlow]);
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
    (params: Connection) => {
      // יצירת זיהוי ייחודי לקו
      const edgeId = `${params.source}-${params.target}`;
      
      // הוספת הקו עם סגנון מותאם - בלי אנימציה
      setEdges((eds) => 
        addEdge({
          ...params,
          id: edgeId,
          animated: false, // קווים מלאים ללא אנימציה
          style: getEdgeStyle({ ...params, id: edgeId } as Edge, nodes)
        }, eds)
      );
    },
    [setEdges, nodes]
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
      
      if (!type || !['message', 'question', 'options', 'date', 'condition'].includes(type)) {
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
      
      // Special handling for different step types
      const nodeData = type === 'date' 
        ? {
            type,
            label: newNodeId,
          }
        : type === 'condition'
        ? {
            type,
            label: newNodeId,
          }
        : {
            type,
            label: newNodeId,
            messageHeader: '',
            message: '',
            footerMessage: '',
          };
      
      const stepData: StepData = type === 'date'
        ? {
            id: newNodeId,
            type,
            label: newNodeId,
            position,
          }
        : type === 'condition'
        ? {
            id: newNodeId,
            type,
            label: newNodeId,
            conditions: [],
            defaultNext: '',
            position,
          }
        : {
            id: newNodeId,
            type,
            label: newNodeId,
            messageHeader: '',
            message: '',
            footerMessage: '',
            ...(type === 'message' && { userResponseWaiting: false }),
            position,
          };

      const newNode = {
        id: newNodeId,
        type,
        position,
        data: nodeData,
      };

      console.log('New node:', newNode);
      
      // Create the node first
      setNodes((nds) => nds.concat(newNode));
      
      // Then update the flow data
      
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
      
      // עדכן את המיקום של הצעד ושמור בהיסטוריה
      updateStep(node.id, { 
        ...step,
        position
      }, true); // שמור בהיסטוריה כדי לאפשר undo/redo
    }
  }, [getStep, updateStep, setNodes]);

  // פונקציה לעדכון שם התסריט כאשר שם החברה משתנה
  const handleCompanyNameChange = (newName: string) => {
    if (newName && newName.trim() !== '') {
      // עדכון שם הקובץ רק אם שם החברה לא ריק
      const newFileName = `${newName.trim()}.json`;
      setSaveFileName(newFileName);
      
      // מעדכן את השם הנוכחי בכל מקרה, כדי להתאים לשם החברה
      // אבל לא משנה את שם הקובץ בפועל עד שהמשתמש לוחץ על שמור
      
      // מציג הודעה למשתמש
      setSnackbar({
        open: true,
        message: `שם הקובץ יעודכן ל-${newFileName} לאחר השמירה`,
        severity: 'success'
      });
    }
  };

  const handleExport = () => {
    setShowSaveDialog(true);
  };

  // שמירה אוטומטית לתסריט הנוכחי
  const handleAutoSave = async () => {
    if (!currentFlowName) {
      // אם אין תסריט פתוח, פתח דיאלוג שמירה
      setShowSaveDialog(true);
      return;
    }

    try {
      console.log('Auto-saving current flow:', currentFlowName);
      
      // עדכון המיקומים הנוכחיים של הצמתים
      const updatedFlow = { ...flow };
      
      nodes.forEach(node => {
        if (node.position && updatedFlow.steps[node.id]) {
          updatedFlow.steps[node.id] = {
            ...updatedFlow.steps[node.id],
            position: {
              x: node.position.x,
              y: node.position.y
            }
          };
        }
      });
      
      // עדכון הקונטקסט
      setFlow(updatedFlow);
      
      // שמירה לשרת
      const flowData = JSON.stringify(updatedFlow, null, 2);
      const response = await fetch(`/api/flows/${currentFlowName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: flowData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setSnackbar({
        open: true,
        message: `התסריט ${currentFlowName} נשמר בהצלחה`,
        severity: 'success'
      });
      
    } catch (error) {
      console.error('Error auto-saving flow:', error);
      setSnackbar({
        open: true,
        message: `שגיאה בשמירת התסריט: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        severity: 'error'
      });
    }
  };

  const handleSaveFlow = async () => {
    try {
      console.log('Saving flow with current node positions');
      console.log('Current nodes positions:', nodes.map(n => ({ id: n.id, position: n.position })));
      
      // Ensure all nodes have their current positions saved in the flow before export
      const updatedFlow = { ...flow };
      let hasPositionUpdates = false;
      
      nodes.forEach(node => {
        if (node.position && updatedFlow.steps[node.id]) {
          const roundedPosition = {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y)
          };
          
          // Check if position actually changed
          const currentPosition = updatedFlow.steps[node.id].position;
          if (!currentPosition || 
              currentPosition.x !== roundedPosition.x || 
              currentPosition.y !== roundedPosition.y) {
            
            console.log(`Updating position for ${node.id} from`, currentPosition, 'to', roundedPosition);
            
          // Update the flow directly to ensure positions are saved
          updatedFlow.steps[node.id] = {
            ...updatedFlow.steps[node.id],
              position: roundedPosition
          };
            hasPositionUpdates = true;
          }
        }
      });
      
      // Update the flow context with the new positions if there were changes
      if (hasPositionUpdates) {
      setFlow(updatedFlow);
        console.log('Updated flow context with new positions');
      }
      
      // Small delay to ensure flow state is updated before export
      return new Promise<void>((resolve, reject) => {
        setTimeout(async () => {
          try {
            // Now export the flow with the updated positions
            const flowData = JSON.stringify(updatedFlow, null, 2);
            
            // בדיקה אם שם החברה שונה משם הקובץ הנוכחי והאם צריך לעדכן
            const companyName = updatedFlow.metadata.company_name;
            let fileName = 'new_flow.json';
            
            if (companyName && companyName.trim() !== '') {
              // השתמש בשם החברה לשם הקובץ
              fileName = `${companyName.trim()}.json`;
              setSaveFileName(fileName);
            } else if (saveFileName) {
              // אם אין שם חברה, השתמש בשם שהוגדר בדיאלוג השמירה אם קיים
              fileName = saveFileName;
            }
            
            // וודא שיש סיומת .json
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
            
            resolve();
          } catch (error) {
            console.error('Error saving flow:', error);
            setSnackbar({
              open: true,
              message: `שגיאה בשמירת התסריט: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
              severity: 'error'
            });
            reject(error);
          }
        }, 100);
      });
    } catch (error) {
      console.error('Error saving flow:', error);
      setSnackbar({
        open: true,
        message: `שגיאה בשמירת התסריט: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        severity: 'error'
      });
      return Promise.reject(error);
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
      console.log('Local save: ensuring all node positions are saved');
      
      // First ensure all node positions are saved in the flow context
      const updatedFlow = { ...flow };
      let hasPositionUpdates = false;
      
      nodes.forEach(node => {
        if (node.position && updatedFlow.steps[node.id]) {
          const roundedPosition = {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y)
          };
          
          // Check if position actually changed
          const currentPosition = updatedFlow.steps[node.id].position;
          if (!currentPosition || 
              currentPosition.x !== roundedPosition.x || 
              currentPosition.y !== roundedPosition.y) {
            
          // Update the flow directly to ensure positions are saved
          updatedFlow.steps[node.id] = {
            ...updatedFlow.steps[node.id],
              position: roundedPosition
          };
            hasPositionUpdates = true;
          }
        }
      });
      
      // Update the flow context if there were changes
      if (hasPositionUpdates) {
      setFlow(updatedFlow);
        console.log('Updated flow context with positions for local save');
      }
      
      // Small delay to ensure flow state is updated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const json = JSON.stringify(updatedFlow, null, 2);
      
      // בדיקה אם שם החברה יכול לשמש כשם הקובץ
      const companyName = updatedFlow.metadata.company_name;
      let suggestedFileName = 'flow.json';
      
      if (companyName && companyName.trim() !== '') {
        // השתמש בשם החברה לשם הקובץ
        suggestedFileName = `${companyName.trim()}.json`;
        setSaveFileName(suggestedFileName);
      } else if (saveFileName) {
        // אם אין שם חברה, השתמש בשם שהוגדר בדיאלוג השמירה אם קיים
        suggestedFileName = saveFileName;
      }
      
      // בדיקה אם File System Access API זמין בדפדפן
      // @ts-ignore - TS doesn't recognize showSaveFilePicker yet in all environments
      if (window && 'showSaveFilePicker' in window && typeof window.showSaveFilePicker === 'function') {
        try {
          // @ts-ignore - Using the File System Access API
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: suggestedFileName,
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
        a.download = suggestedFileName;
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
      const response = await fetch(`/api/flows/${flowName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // קריאת התסריט כטקסט
      const flowText = await response.text();
      const flowData = JSON.parse(flowText);
      
      // שמירת שם הקובץ הנוכחי
      setCurrentFlowName(flowName);
      
      // בדיקה אם יש שם חברה במטא-דאטה ועדכון שם הקובץ בהתאם
      const companyName = flowData.metadata?.company_name;
      if (companyName && companyName.trim() !== '') {
        const newFileName = `${companyName.trim()}.json`;
        setSaveFileName(newFileName);
      } else {
        // אם אין שם חברה, השתמש בשם הקובץ הקיים
        setSaveFileName(flowName);
      }
      
      // ניקוי הצמתים והקשתות הקיימים לפני יצירת חדשים
      setNodes([]);
      setEdges([]);
      
      try {
        // המרת הצעדים לצמתים ראשוניים בשביל הסידור האוטומטי
        const initialNodes: Node[] = Object.entries(flowData.steps).map(([stepId, stepData]: [string, any]) => {
          // בדיקה אם יש מיקום מוגדר בצעד
          const position = stepData.position || { x: 0, y: 0 };
          console.log(`Loading step ${stepId} with position:`, position);
          
          return {
            id: stepId,
            type: stepData.type,
            position,
            data: {
              ...stepData,
              label: stepData.label || stepId,
              isStartStep: flowData.start === stepId
            }
          };
        });
        
        // יצירת קשתות ראשוניות
        const initialEdges: Edge[] = [];
        
        // הוספת קשתות רגילות (next)
        Object.entries(flowData.steps).forEach(([stepId, stepData]: [string, any]) => {
          if (stepData.next) {
            initialEdges.push({
              id: `${stepId}-${stepData.next}`,
              source: stepId,
              target: stepData.next,
              animated: false // קווים מלאים ללא אנימציה
            });
          }
          
          // הוספת קשתות מסוג branches
          if (stepData.branches) {
            Object.entries(stepData.branches).forEach(([branchKey, targetId]: [string, any]) => {
              if (targetId) {
                // הסרת קווים שמכילות "חזור" מהויזואליזציה לגמרי
                if (!branchKey.includes('חזור')) {
                initialEdges.push({
                  id: `${stepId}-${targetId}-${branchKey}`,
                  source: stepId,
                  target: targetId,
                  animated: false, // קווים מלאים ללא אנימציה
                  label: branchKey
                });
                }
              }
            });
          }
        });
        
        // יצירת צמתים וקשתות מהתסריט עם מיקומים אוטומטיים
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
        
        // הוספת סגנון צבעים לקווים - תמיד מלאים
        const styledEdges = layoutedEdges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          animated: false,
          style: getEdgeStyle(edge as Edge, layoutedNodes),
          label: edge.label,
          type: edge.type || 'default'
        } as Edge));
        
        // בדיקה אם הצמתים המקוריים כבר היה להם מיקומים תקפים
        const nodesWithPositions = initialNodes.filter(node => 
          node.position && (node.position.x !== 0 || node.position.y !== 0)
        );
        
        // אם יש צמתים עם מיקומים, השתמש בהם; אחרת, השתמש בצמתים עם מיקום אוטומטי
        if (nodesWithPositions.length > 0 && nodesWithPositions.length === initialNodes.length) {
          // כל הצמתים יש להם מיקומים תקפים - השתמש בהם עם עיצוב נכון
          console.log('Using existing positions for all nodes');
          setNodes(initialNodes as Node[]);
        } else {
          // יש צמתים ללא מיקומים או שזה קובץ חדש - השתמש במיקום אוטומטי
          console.log('Using auto-layout for nodes');
          setNodes(layoutedNodes as Node[]);
        }
        
        setEdges(styledEdges);
      } catch (error) {
        console.error('Error creating nodes and edges:', error);
        // במקרה של שגיאה, פשוט טען את התסריט ללא מיקום צמתים
      }
      
      // יצירת אובייקט Flow חדש
      importFlow(flowText);
      
      // סגירת הדיאלוג
      setShowFlowsDialog(false);
      
      setSnackbar({
        open: true,
        message: `התסריט ${flowName} נטען בהצלחה`,
        severity: 'success'
      });
      
      // סימון שזה לא טעינה ראשונית
      setIsInitialLoad(false);
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
      setSelectedStep(null);
      setShowMetadata(false);
      setIsInitialLoad(false);
      
      // Reset repositioned nodes tracking
      repositionedNodeIds.current.clear();
      
      setSnackbar({
        open: true,
        message: 'תסריט חדש נוצר בהצלחה. כעת תוכל לגרור בלוקים מהסיידבר',
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



    // Function to manually trigger auto-layout - שמירה מיידית של המיקומים
  const applyAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    
    console.log('🎯 מתחיל סידור אוטומטי מושלם');
    
    // סידור היררכי מושלם של הצמתים והקשתות
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'TB');
    
    // עדכון הצמתים והקשתות
    setNodes(layoutedNodes as Node[]);
    setEdges(layoutedEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: false,
      style: getEdgeStyle(edge as Edge, layoutedNodes),
      label: edge.label,
      type: edge.type || 'default'
    } as Edge)));
    
    // שמירת המיקומים החדשים ב-flow context מיידית
    const updatedFlow = { ...flow };
    let hasUpdates = false;
    
    layoutedNodes.forEach(node => {
      if (updatedFlow.steps[node.id] && node.position) {
        updatedFlow.steps[node.id] = {
          ...updatedFlow.steps[node.id],
          position: {
            x: Math.round(node.position.x),
            y: Math.round(node.position.y)
          }
        };
        hasUpdates = true;
        console.log(`💾 שמור מיקום עבור ${node.id}:`, node.position);
      }
    });
    
    if (hasUpdates) {
    setFlow(updatedFlow);
      console.log('✅ כל המיקומים נשמרו ב-flow context');
    }
    
    console.log('✅ סידור אוטומטי הושלם ונשמר');
    
    // דיווח על השינוי
    setSnackbar({
      open: true,
      message: '🎯 סידור אוטומטי הושלם ונשמר בהצלחה!',
      severity: 'success'
    });
  }, [nodes, edges, setNodes, setEdges, flow, setFlow]);

  // פונקציות לטיפול בפעולות צומת
  const handleDeleteStep = useCallback((stepId: string) => {
    try {
      deleteStep(stepId);
      setSnackbar({
        open: true,
        message: `השלב ${stepId} נמחק בהצלחה`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting step:', error);
      setSnackbar({
        open: true,
        message: 'שגיאה במחיקת השלב',
        severity: 'error'
      });
    }
  }, [deleteStep]);

  const handleSetAsStart = useCallback((stepId: string) => {
    try {
      setStartStep(stepId);
      setSnackbar({
        open: true,
        message: `השלב ${stepId} הוגדר כנקודת התחלה`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error setting start step:', error);
      setSnackbar({
        open: true,
        message: 'שגיאה בהגדרת נקודת התחלה',
        severity: 'error'
      });
    }
  }, [setStartStep]);



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
                                !isNaN(step.position.x) && 
                                !isNaN(step.position.y);
        
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
            onEdit: () => setSelectedStep(step.id),
            onDelete: () => handleDeleteStep(step.id),
            onSetAsStart: () => handleSetAsStart(step.id),
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
            animated: false, // קווים מלאים ללא אנימציה
            type: 'default', // קווים בסיסיים
          });
        }
        
        // קישורים על סמך branches (למשל עבור צעדי options)
        if (step.branches) {
          for (const [key, targetValue] of Object.entries(step.branches)) {
            if (targetValue) {
              // פירוק הערך במקרה של פורמט חדש "step::value"
              const targetId = typeof targetValue === 'string' && targetValue.includes('::') 
                ? targetValue.split('::')[0] 
                : targetValue;
              
              // הסרת קווים שמכילות "חזור" או "תפריט" מהויזואליזציה לגמרי
              if (!key.includes('חזור') && !key.includes('תפריט') && !key.includes('ראשי')) {
              newEdges.push({
                id: `${step.id}-${targetId}-${key}`,
                source: step.id,
                target: targetId as string,
                animated: false, // קווים מלאים ללא אנימציה
                label: key,
                type: 'default', // קווים בסיסיים
              });
              }
            }
          }
        }

        // קישורים עבור condition steps
        if (step.type === 'condition') {
          // קישורים עבור תנאים
          if (step.conditions) {
            step.conditions.forEach((condition, index) => {
              if (condition.next) {
                const label = index === 0 ? 'IF' : 'ELSE IF';
                newEdges.push({
                  id: `${step.id}-${condition.next}-condition-${index}`,
                  source: step.id,
                  target: condition.next,
                  animated: false, // קווים מלאים ללא אנימציה
                  label: `${label}: ${condition.variable} ${condition.operator}`,
                  style: { stroke: index === 0 ? '#2196f3' : '#ff9800' },
                  type: 'default', // קווים בסיסיים
                });
              }
            });
          }
          
          // קישור עבור defaultNext (ELSE)
          if (step.defaultNext) {
            newEdges.push({
              id: `${step.id}-${step.defaultNext}-default`,
              source: step.id,
              target: step.defaultNext,
              animated: false, // קווים מלאים ללא אנימציה
              label: 'ELSE',
              style: { stroke: '#9c27b0' },
              type: 'default', // קווים בסיסיים
            });
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
        // וידוא שכל הedges מהסידור האוטומטי מלאים ולא מקווקווים
        const finalLayoutedEdges = layoutedEdges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          animated: false,
          style: getEdgeStyle(edge as Edge, layoutedNodes),
          label: edge.label,
          type: edge.type || 'default'
        } as Edge));
        setEdges(finalLayoutedEdges);
        
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
              typeof step.position.y === 'number') {
            
            console.log(`Using stored position for ${node.id}:`, step.position);
            return {
              ...node,
              position: {
                x: step.position.x,
                y: step.position.y
              }
            };
          } else {
            console.log(`No valid position found for ${node.id}, using current:`, node.position);
          }
          return node;
        });
        
        setNodes(newNodes);
        // וידוא שכל הedges מלאים ולא מקווקווים
        const finalStyledEdges = newEdges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          animated: false,
          style: getEdgeStyle(edge as Edge, newNodes),
          label: edge.label,
          type: edge.type || 'default'
        } as Edge));
        setEdges(finalStyledEdges);
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
        
        // מצא את המפתח המתאים לקו זה - תוך התחשבות בפורמט החדש
        const branchKey = Object.entries(updatedBranches).find(
          ([_, targetValue]) => {
            const targetId = typeof targetValue === 'string' && targetValue.includes('::') 
              ? targetValue.split('::')[0] 
              : targetValue;
            return targetId === selectedEdge.target;
          }
        )?.[0];
        
        if (branchKey) {
          // שמור על הערך המותאם אישית אם קיים
          const originalValue = updatedBranches[branchKey];
          const customValue = typeof originalValue === 'string' && originalValue.includes('::') 
            ? originalValue.split('::')[1] 
            : null;
          
          // מחק את הקשר הקיים
          delete updatedBranches[branchKey];
          
          // הוסף קשר חדש עם התווית החדשה, תוך שמירה על הערך המותאם אישית
          const newValue = customValue 
            ? `${selectedEdge.target}::${customValue}`
            : selectedEdge.target;
          updatedBranches[edgeLabelInput] = newValue;
          
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

  // הוספת פונקציית המחיקה
  const handleDeleteFlow = async (flowName: string) => {
    try {
      // מוודאים שהמשתמש אכן רוצה למחוק את הקובץ
      if (!window.confirm(`האם אתה בטוח שברצונך למחוק את התסריט "${flowName}"?`)) {
        return;
      }

      const response = await fetch(`/api/flows/${flowName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // רענון רשימת התסריטים
      const updatedFlowsResponse = await fetch('/api/flows');
      if (updatedFlowsResponse.ok) {
        const updatedFlows = await updatedFlowsResponse.json();
        setFlowsList(updatedFlows);
      }

      setSnackbar({
        open: true,
        message: `התסריט ${flowName} נמחק בהצלחה`,
        severity: 'success'
      });
      
      // אם התסריט הנוכחי נמחק, נאפס אותו
      if (currentFlowName === flowName) {
        createNewFlow();
        setNodes([]);
        setEdges([]);
        setCurrentFlowName(null);
      }
    } catch (error) {
      console.error(`Error deleting flow ${flowName}:`, error);
      setSnackbar({
        open: true,
        message: `שגיאה במחיקת התסריט: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        severity: 'error'
      });
    }
  };

  // הוספת פונקציית שכפול תסריט
  const handleDuplicateFlow = async (flowName: string) => {
    try {
      // קריאת התסריט המקורי
      const response = await fetch(`/api/flows/${flowName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const flowData = await response.text();
      
      // יצירת שם חדש לתסריט המשוכפל
      const nameParts = flowName.split('.');
      const baseName = nameParts[0];
      const extension = nameParts.length > 1 ? '.' + nameParts.pop() : '.json';
      
      // יצירת שם חדש בפורמט: copy_of_name.json או copy_2_of_name.json וכו'
      let newFlowName = `copy_of_${baseName}${extension}`;
      
      // בדיקה אם כבר קיים תסריט בשם זה
      let copyNumber = 1;
      let flowExists = flowsList.includes(newFlowName);
      
      while (flowExists) {
        copyNumber++;
        newFlowName = `copy_${copyNumber}_of_${baseName}${extension}`;
        flowExists = flowsList.includes(newFlowName);
      }
      
      // שמירת התסריט החדש
      const saveResponse = await fetch(`/api/flows/${newFlowName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: flowData,
      });
      
      if (!saveResponse.ok) {
        throw new Error(`HTTP error! status: ${saveResponse.status}`);
      }
      
      // רענון רשימת התסריטים
      const updatedFlowsResponse = await fetch('/api/flows');
      if (updatedFlowsResponse.ok) {
        const updatedFlows = await updatedFlowsResponse.json();
        setFlowsList(updatedFlows);
      }
      
      setSnackbar({
        open: true,
        message: `התסריט ${flowName} שוכפל בהצלחה ל-${newFlowName}`,
        severity: 'success'
      });
      
    } catch (error) {
      console.error(`Error duplicating flow ${flowName}:`, error);
      setSnackbar({
        open: true,
        message: `שגיאה בשכפול התסריט: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`,
        severity: 'error'
      });
    }
  };

  // עדכון הסגנון של כל הקווים בכל פעם שהצמתים או הקווים משתנים
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        style: getEdgeStyle(edge, nodes),
      }))
    );
  }, [nodes, setEdges]);

  // חשיפת הפונקציות לשימוש דרך ה-ref
  useImperativeHandle(ref, () => ({
    handleSaveFlow: async () => {
      try {
        await handleSaveFlow();
        return true;
      } catch (error) {
        console.error("Error in exposed handleSaveFlow:", error);
        return false;
      }
    }
  }));

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
          {/* Header מודרני ומשופר */}
          <Box sx={{ 
            p: 3, 
            background: 'linear-gradient(135deg, #2563eb10, #7c3aed05)',
            borderBottom: '1px solid',
            borderColor: 'grey.200',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <Box>
              <Typography variant="h4" sx={{ 
                fontWeight: 700,
                color: 'grey.800',
                mb: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                🎯 עורך תסריט שיחה
            </Typography>
              {currentFlowName && (
                <Typography variant="subtitle1" sx={{ 
                  color: 'primary.main',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  📋 {currentFlowName}
                </Typography>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Tooltip title="יצירת תסריט חדש">
              <Button
                  variant="contained"
                onClick={handleCreateNew}
                  sx={{ 
                    minWidth: 0,
                    borderRadius: 2,
                    px: 2.5,
                    py: 1,
                    fontWeight: 600
                  }}
              >
                  ➕ תסריט חדש
              </Button>
              </Tooltip>
              
                            <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="שמירת התסריט">
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => setShowSaveDialog(true)}
                    sx={{ borderRadius: 2 }}
                  >
                    שמור
                  </Button>
                </Tooltip>
                
                <Tooltip title="טעינת תסריט">
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadFileIcon />}
                    sx={{ borderRadius: 2 }}
                  >
                    טען
                    <input type="file" accept="application/json" hidden onChange={handleImport} />
                  </Button>
                </Tooltip>
              </Box>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 40 }} />
              
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="בטל פעולה אחרונה">
                  <IconButton
                onClick={undo}
                disabled={!canUndo}
                    sx={{ 
                      borderRadius: 2,
                      backgroundColor: canUndo ? 'action.hover' : 'transparent'
                    }}
              >
                    <UndoIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="חזור על פעולה">
                  <IconButton
                onClick={redo}
                disabled={!canRedo}
                    sx={{ 
                      borderRadius: 2,
                      backgroundColor: canRedo ? 'action.hover' : 'transparent'
                    }}
              >
                    <RedoIcon />
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="סידור אוטומטי של הבלוקים">
                  <IconButton
                onClick={applyAutoLayout}
                    sx={{ borderRadius: 2 }}
              >
                    <AutoFixHighIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              
              <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 40 }} />
              
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="רשימת תסריטים">
                  <IconButton 
                    onClick={handleShowFlows}
                    sx={{ 
                      borderRadius: 2,
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark'
                      }
                    }}
                  >
                <FolderIcon />
              </IconButton>
                </Tooltip>
                
                <Tooltip title="הגדרות מטא-דאטה">
                  <IconButton 
                    onClick={() => setShowMetadata(true)}
                    sx={{ 
                      borderRadius: 2,
                      backgroundColor: 'secondary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'secondary.dark'
                      }
                    }}
                  >
                <SettingsIcon />
              </IconButton>
                </Tooltip>
                

              </Box>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1, position: 'relative' }}>
            <ReactFlow
              key="react-flow"
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onEdgeClick={onEdgeClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
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
              <Background 
                color="#e2e8f0" 
                gap={20} 
                size={1}
              />
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
                  zIndex: 10,
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  padding: 4,
                  borderRadius: 4,
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  maxWidth: 400,
                  backdropFilter: 'blur(8px)'
                }}
              >
                <Typography variant="h3" sx={{ mb: 1, fontSize: '3rem' }}>
                  🎯
                </Typography>
                <Typography variant="h5" sx={{ 
                  mb: 2,
                  fontWeight: 600,
                  color: 'grey.700'
                }}>
                  התחל לבנות את התסריט שלך
                </Typography>
                <Typography variant="body1" sx={{ 
                  color: 'grey.600',
                  lineHeight: 1.6,
                  mb: 3
                }}>
                  גרור בלוקים מהסיידבר השמאלי כדי להתחיל לבנות את תסריט השיחה שלך
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: 2,
                  flexWrap: 'wrap'
                }}>
                  <Chip 
                    label="💬 הודעה" 
                    variant="outlined" 
                    sx={{ 
                      borderColor: '#2563eb40',
                      color: '#2563eb',
                      fontWeight: 500
                    }} 
                  />
                  <Chip 
                    label="❓ שאלה" 
                    variant="outlined" 
                    sx={{ 
                      borderColor: '#7c3aed40',
                      color: '#7c3aed',
                      fontWeight: 500
                    }} 
                  />
                  <Chip 
                    label="📋 אפשרויות" 
                    variant="outlined" 
                    sx={{ 
                      borderColor: '#10b98140',
                      color: '#10b981',
                      fontWeight: 500
                    }} 
                  />
                  <Chip 
                    label="📅 תאריך" 
                    variant="outlined" 
                    sx={{ 
                      borderColor: '#f59e0b40',
                      color: '#f59e0b',
                      fontWeight: 500
                    }} 
                  />
                </Box>
              </Box>
            )}
            
            {/* Warning for no start step when there are steps */}
            {!noSteps && !flow.start && (
              <Box 
                sx={{ 
                  position: 'absolute', 
                  top: '20px', 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  zIndex: 10,
                  backgroundColor: 'rgba(255, 243, 205, 0.95)',
                  padding: 2,
                  borderRadius: 3,
                  border: '2px solid #ffc107',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)'
                }}
              >
                <Typography variant="h6" sx={{ 
                  mb: 1,
                  fontWeight: 600,
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}>
                  ⚠️ לא מוגדר צעד התחלה!
                </Typography>
                <Typography variant="body2" sx={{ 
                  color: '#b45309',
                  lineHeight: 1.4
                }}>
                  לחץ על בלוק ובחר "🎯 הגדר כצעד התחלה" כדי להגדיר איפה התסריט מתחיל
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
            onSave={handleExport}
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
                  <ListItem 
                    key={flowName}
                    secondaryAction={
                      <Box sx={{ display: 'flex' }}>
                        <IconButton 
                          edge="end" 
                          color="primary" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateFlow(flowName);
                          }}
                          sx={{ mr: 1 }}
                          title="שכפל תסריט"
                        >
                          <ContentCopyIcon />
                        </IconButton>
                        <IconButton 
                          edge="end" 
                          color="error" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFlow(flowName);
                          }}
                          title="מחק תסריט"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    }
                    disablePadding
                  >
                    <ListItemButton onClick={() => handleLoadFlow(flowName)}>
                      <ListItemText primary={flowName} />
                    </ListItemButton>
                  </ListItem>
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
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ 
            background: 'linear-gradient(135deg, #2563eb15, #7c3aed10)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              backgroundColor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '1.2rem'
            }}>
              💾
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              שמירת תסריט
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* אפשרות 1: שמירה לתסריט הנוכחי */}
              {currentFlowName && (
                <Paper elevation={0} sx={{ p: 3, backgroundColor: 'success.light' + '10', borderRadius: 3, border: '2px solid', borderColor: 'success.main' + '30' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 2,
                      backgroundColor: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '1rem'
                    }}>
                      ✅
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.dark' }}>
                      שמור לתסריט הנוכחי
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                    שמור את השינויים לתסריט הפתוח: <strong>{currentFlowName}</strong>
                  </Typography>
                  <Button 
                    variant="contained" 
                    color="success"
                    onClick={handleAutoSave}
                    sx={{ borderRadius: 2, fontWeight: 600 }}
                    fullWidth
                  >
                    💾 שמור שינויים
                  </Button>
                </Paper>
              )}
              
              {/* אפשרות 2: שמירה כקובץ חדש */}
              <Paper elevation={0} sx={{ p: 3, backgroundColor: 'primary.light' + '10', borderRadius: 3, border: '2px solid', borderColor: 'primary.main' + '30' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 2,
                    backgroundColor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1rem'
                  }}>
                    📄
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.dark' }}>
                    שמור כתסריט חדש
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  שמור את התסריט כקובץ חדש עם שם חדש
                </Typography>
                
                <TextField
                  fullWidth
                  label="שם התסריט החדש"
                  value={saveFileName}
                  onChange={(e) => setSaveFileName(e.target.value)}
                  placeholder={flow.metadata?.company_name || "תסריט_חדש.json"}
                  helperText="הזן שם לתסריט החדש (ללא סיומת .json)"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                
                  <Button 
                    variant="contained" 
                    onClick={handleLocalSave}
                    disabled={!saveFileName}
                  sx={{ borderRadius: 2 }}
                  fullWidth
                  >
                    💻 שמור במחשב
                  </Button>
              </Paper>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button 
              onClick={() => setShowSaveDialog(false)}
              sx={{ borderRadius: 2, px: 3 }}
            >
              ביטול
            </Button>
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
});

FlowEditor.displayName = 'FlowEditor';

export default FlowEditor; 