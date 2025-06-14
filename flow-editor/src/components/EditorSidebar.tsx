import React from 'react';
import { Box, Paper, Typography, Divider } from '@mui/material';
import { StepType } from '../types/flow';

const stepTypes: { type: StepType; label: string; description: string }[] = [
  {
    type: 'message',
    label: 'הודעה',
    description: 'הודעה פשוטה למשתמש'
  },
  {
    type: 'question',
    label: 'שאלה',
    description: 'שאלה פתוחה למשתמש'
  },
  {
    type: 'options',
    label: 'אפשרויות',
    description: 'בחירה מרשימת אפשרויות'
  },
  {
    type: 'date',
    label: 'תאריך',
    description: 'בחירת תאריך או זמן'
  }
];

const EditorSidebar: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: StepType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Paper
      elevation={3}
      sx={{
        width: 250,
        height: '100%',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto'
      }}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>
        בלוקים זמינים
      </Typography>
      <Divider />
      
      {stepTypes.map((step) => (
        <Box
          key={step.type}
          draggable
          onDragStart={(e) => onDragStart(e, step.type)}
          sx={{
            p: 2,
            border: '1px solid #e0e0e0',
            borderRadius: 1,
            cursor: 'grab',
            '&:hover': {
              backgroundColor: '#f5f5f5',
              borderColor: '#1976d2'
            }
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            {step.label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {step.description}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};

export default EditorSidebar; 