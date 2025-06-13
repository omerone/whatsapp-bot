import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Drawer,
  ListItemButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  FileCopy as DuplicateIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import FlowEditor from './FlowEditor';

interface FlowFile {
  id: string;
  name: string;
  metadata: {
    company_name: string;
    version: string;
    last_updated: string;
  };
}

const FlowManager: React.FC = () => {
  const [flows, setFlows] = useState<FlowFile[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [isNewFlowDialogOpen, setIsNewFlowDialogOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    // Load flows from data directory
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      const response = await fetch('/api/flows');
      if (!response.ok) {
        throw new Error('Failed to load flows');
      }
      const flows = await response.json();
      setFlows(flows);
    } catch (error) {
      console.error('Error loading flows:', error);
    }
  };

  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) return;

    try {
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFlowName,
          metadata: {
            company_name: '',
            version: '1.0.0',
            last_updated: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create flow');
      }

      const newFlow = await response.json();
      setFlows([...flows, newFlow]);
      setNewFlowName('');
      setIsNewFlowDialogOpen(false);
    } catch (error) {
      console.error('Error creating flow:', error);
      alert('שגיאה ביצירת תסריט חדש');
    }
  };

  const handleDeleteFlow = (flowId: string) => {
    setFlows(flows.filter(flow => flow.id !== flowId));
    if (selectedFlow === flowId) {
      setSelectedFlow(null);
      setIsEditorOpen(false);
    }
  };

  const handleDuplicateFlow = (flow: FlowFile) => {
    const newFlow: FlowFile = {
      ...flow,
      id: `flow-${Date.now()}`,
      name: `${flow.name} (עותק)`,
      metadata: {
        ...flow.metadata,
        last_updated: new Date().toISOString(),
      },
    };
    setFlows([...flows, newFlow]);
  };

  const handleEditFlow = (flowId: string) => {
    setSelectedFlow(flowId);
    setIsEditorOpen(true);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex' }}>
      {/* Flows List */}
      <Box
        sx={{
          width: 300,
          borderRight: 1,
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">תסריטים</Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setIsNewFlowDialogOpen(true)}
            variant="contained"
            size="small"
          >
            חדש
          </Button>
        </Box>

        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '4px',
          },
        }}>
          <List>
            {flows.map((flow) => (
              <ListItem
                key={flow.id}
                sx={{
                  mb: 1,
                  borderRadius: 1,
                  bgcolor: selectedFlow === flow.id ? 'primary.light' : 'background.paper',
                  '&:hover': {
                    bgcolor: selectedFlow === flow.id ? 'primary.light' : 'action.hover',
                  },
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDuplicateFlow(flow)}
                      title="שכפל תסריט"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDeleteFlow(flow.id)}
                      title="מחק תסריט"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemButton onClick={() => handleEditFlow(flow.id)}>
                  <ListItemText
                    primary={flow.name}
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {new Date(flow.metadata.last_updated).toLocaleDateString('he-IL')}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>

      {/* Flow Editor */}
      <Drawer
        anchor="right"
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        variant="persistent"
        sx={{
          width: 'calc(100% - 300px)',
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 'calc(100% - 300px)',
            boxSizing: 'border-box',
            position: 'relative',
          },
        }}
      >
        {selectedFlow && <FlowEditor flowId={selectedFlow} onClose={() => setIsEditorOpen(false)} />}
      </Drawer>

      {/* New Flow Dialog */}
      <Dialog open={isNewFlowDialogOpen} onClose={() => setIsNewFlowDialogOpen(false)}>
        <DialogTitle>תסריט חדש</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="שם התסריט"
            fullWidth
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsNewFlowDialogOpen(false)}>ביטול</Button>
          <Button onClick={handleCreateFlow} variant="contained">
            צור
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FlowManager; 