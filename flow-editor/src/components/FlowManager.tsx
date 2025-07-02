import React, { useState, useEffect, useCallback } from 'react';
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

export const FlowManager: React.FC = () => {
  const [flows, setFlows] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; oldName: string; newName: string }>({
    open: false,
    oldName: '',
    newName: ''
  });
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [isNewFlowDialogOpen, setIsNewFlowDialogOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const loadFlows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/flows');
      if (response.ok) {
        const flowList = await response.json();
        
        // הוסף flow.json אם הוא לא קיים ברשימה
        if (!flowList.includes('flow.json')) {
          flowList.unshift('flow.json'); // הוסף בתחילת הרשימה
        }
        
        setFlows(flowList);
      }
    } catch (error) {
      console.error('Error loading flows:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load flows from data directory
    loadFlows();
  }, [loadFlows]);

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
    setFlows(flows.filter(flow => flow !== flowId));
    if (selectedFlow === flowId) {
      setSelectedFlow(null);
      setIsEditorOpen(false);
    }
  };

  const handleDuplicateFlow = (flow: string) => {
    const newFlow: string = `${flow} (עותק)`;
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
                key={flow}
                sx={{
                  mb: 1,
                  borderRadius: 1,
                  bgcolor: selectedFlow === flow ? 'primary.light' : 'background.paper',
                  '&:hover': {
                    bgcolor: selectedFlow === flow ? 'primary.light' : 'action.hover',
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
                      onClick={() => handleDeleteFlow(flow)}
                      title="מחק תסריט"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemButton onClick={() => handleEditFlow(flow)}>
                  <ListItemText
                    primary={flow}
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