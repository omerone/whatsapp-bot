import React, { useState, useCallback, useEffect } from 'react';
import { Box, Container, Paper, Typography, Button, Drawer, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import ReactFlow, { 
  Node, 
  Edge, 
  Controls, 
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  EdgeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';
import MenuIcon from '@mui/icons-material/Menu';
import { EditorSidebar } from '@/components/EditorSidebar';
import { StepNode } from '@/components/StepNode';
import { useRouter } from 'next/router';
import { getLayoutedElements } from '@/utils/autoLayout';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: 'calc(100vh - 100px)',
  position: 'relative',
}));

const nodeTypes = {
  step: StepNode,
};

const EditorPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // סידור אוטומטי היררכי בכל טעינה/שינוי nodes/edges
  useEffect(() => {
    if (nodes.length === 0) return;
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  return (
    <Container maxWidth={false} sx={{ height: '100vh', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={toggleSidebar} sx={{ mr: 2 }}>
          <MenuIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          עורך תסריט שיחה
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, height: 'calc(100% - 80px)' }}>
        <Drawer
          variant="persistent"
          anchor="right"
          open={isSidebarOpen}
          sx={{
            width: 300,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 300,
              boxSizing: 'border-box',
            },
          }}
        >
          <EditorSidebar />
        </Drawer>

        <StyledPaper elevation={3}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </StyledPaper>
      </Box>
    </Container>
  );
};

export default EditorPage; 