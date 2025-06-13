import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Paper, Typography, IconButton, Drawer, Button } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { useFlow } from '../context/FlowContext';
import { StepType, Step } from '../types/flow';
import StepNode from './nodes/StepNode';
import StepEditor from './StepEditor';
import MetadataEditor from './MetadataEditor';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import { getLayoutedElements } from '../utils/autoLayout';

const nodeTypes = {
  message: StepNode,
  question: StepNode,
  options: StepNode,
  date: StepNode,
};

const FlowEditor: React.FC = () => {
  const { flow, addStep, updateStep, deleteStep, getAllSteps, importFlow, exportFlow, undo, redo, canUndo, canRedo, createNewFlow } = useFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [noSteps, setNoSteps] = useState(false);
  const [noStart, setNoStart] = useState(false);

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

      const type = event.dataTransfer.getData('application/reactflow') as StepType;
      if (!type) return;

      const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      // Calculate grid position
      const gridSize = 100; // Size of each grid cell
      const position = {
        x: Math.round((event.clientX - reactFlowBounds.left) / gridSize) * gridSize,
        y: Math.round((event.clientY - reactFlowBounds.top) / gridSize) * gridSize,
      };

      // Check for overlapping nodes
      const overlappingNode = nodes.find(node => 
        Math.abs(node.position.x - position.x) < gridSize && 
        Math.abs(node.position.y - position.y) < gridSize
      );

      if (overlappingNode) {
        // If there's an overlap, move the new node to the next available grid position
        position.y = overlappingNode.position.y + gridSize;
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { 
          id: `${type}-${Date.now()}`,
          type,
          message: `צעד ${type} חדש`,
          enabled: true,
          userResponseWaiting: false,
          next: null,
          options: {},
          branches: {},
          messageFile: null,
          messageHeader: null,
          footerMessage: null
        },
      };

      setNodes((nds) => nds.concat(newNode));
      addStep(newNode.data);
    },
    [nodes, setNodes, addStep]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedStep(node.id);
  }, []);

  const handleExport = () => {
    const json = exportFlow ? exportFlow() : '';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        try {
          importFlow?.(e.target.result as string);
          window.alert('הקובץ נטען בהצלחה!');
        } catch (err: any) {
          console.error('Error importing flow:', err);
          window.alert('שגיאה בטעינת קובץ: ' + (err?.message || err));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleCreateNew = () => {
    try {
      createNewFlow();
      window.alert('נוצר תסריט חדש בהצלחה!');
    } catch (err: any) {
      console.error('Error creating new flow:', err);
      window.alert('שגיאה ביצירת תסריט חדש: ' + (err?.message || err));
    }
  };

  useEffect(() => {
    if (!flow) {
      setNoSteps(true);
      setNoStart(false);
      setNodes([]);
      setEdges([]);
      return;
    }

    try {
      const steps = getAllSteps();
      if (!steps || steps.length === 0) {
        setNoSteps(true);
        setNoStart(false);
        setNodes([]);
        setEdges([]);
        return;
      }
      
      setNoSteps(false);
      let startId = flow.start;
      if (!startId && steps.length > 0) {
        startId = steps[0].id;
      }
      
      if (!startId) {
        setNoStart(true);
        setNodes([]);
        setEdges([]);
        return;
      }
      
      setNoStart(false);
      // יצירת nodes ו-edges בסיסיים
      const newNodes = steps.map((step, idx) => ({
        id: step.id,
        type: step.type,
        data: { label: step.id, message: step.message, messageHeader: step.messageHeader, footerMessage: step.footerMessage, options: step.options },
        position: { x: 0, y: 0 }, // dagre יקבע מיקום
      }));
      const newEdges: Edge[] = [];
      steps.forEach((step) => {
        if (step.next) {
          newEdges.push({ id: `${step.id}->${step.next}`, source: step.id, target: step.next });
        }
        if (step.branches) {
          Object.values(step.branches).forEach((target: string) => {
            newEdges.push({ id: `${step.id}->${target}`, source: step.id, target });
          });
        }
      });
      // סידור היררכי
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'TB');
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err) {
      console.error('Error updating flow visualization:', err);
      setNoSteps(true);
      setNodes([]);
      setEdges([]);
    }
  }, [flow, getAllSteps, setNodes, setEdges]);

  // Add grid background
  const gridStyle = {
    backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px)',
    backgroundSize: '100px 100px',
  };

  return (
    <Box sx={{ width: '100%', height: '100vh' }}>
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
          <Typography variant="h6">עורך תסריט שיחה</Typography>
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
            <IconButton onClick={() => setShowMetadata(true)}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1, position: 'relative' }}>
          {noSteps ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'gray' }}>
              לא קיימים צעדים בתסריט. נסה לטעון קובץ תקין או להוסיף צעד ראשון.
            </Box>
          ) : noStart ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'gray' }}>
              לא מוגדר צעד התחלה (start) בתסריט. ודא שיש שדה start או הוסף צעד ראשון.
            </Box>
          ) : nodes.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'gray' }}>
              <Typography>יש צעדים אך לא מוצגת דיאגרמה. Debug:</Typography>
              <ul>
                {getAllSteps().map((s) => (
                  <li key={s.id}>{s.id} ({s.type})</li>
                ))}
              </ul>
            </Box>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              style={gridStyle}
            >
              <Background />
              <Controls />
              <Panel position="top-right">
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {Object.keys(nodeTypes).map((type) => (
                    <Box
                      key={type}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', type);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      sx={{
                        p: 1,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        cursor: 'grab',
                      }}
                    >
                      {type}
                    </Box>
                  ))}
                </Box>
              </Panel>
            </ReactFlow>
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
        <MetadataEditor onClose={() => setShowMetadata(false)} />
      </Drawer>
    </Box>
  );
};

export default FlowEditor; 