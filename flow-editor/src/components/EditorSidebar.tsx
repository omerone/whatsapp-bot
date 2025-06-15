import React from 'react';
import { Box, Paper, Typography, Divider } from '@mui/material';
import { StepType } from '../types/flow';

const stepTypes: { type: StepType; label: string; description: string; icon: string }[] = [
  {
    type: 'message',
    label: 'הודעה',
    description: 'הודעה פשוטה למשתמש',
    icon: '💬'
  },
  {
    type: 'question',
    label: 'שאלה',
    description: 'שאלה פתוחה למשתמש',
    icon: '❓'
  },
  {
    type: 'options',
    label: 'אפשרויות',
    description: 'בחירה מרשימת אפשרויות',
    icon: '📋'
  },
  {
    type: 'date',
    label: 'תאריך',
    description: 'בחירת תאריך או זמן',
    icon: '📅'
  }
];

const EditorSidebar: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: StepType) => {
    event.stopPropagation();
    
    console.log('Starting drag with type:', nodeType);
    
    event.dataTransfer.setData('text/plain', nodeType);
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
          draggable={true}
          onDragStart={(e) => onDragStart(e, step.type)}
          sx={{
            p: 2,
            border: '1px solid #e0e0e0',
            borderRadius: 1,
            cursor: 'grab',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            '&:hover': {
              backgroundColor: '#f5f5f5',
              borderColor: '#1976d2'
            },
            '&:active': {
              cursor: 'grabbing',
              backgroundColor: '#e3f2fd'
            }
          }}
        >
          <Typography variant="h6" sx={{ fontSize: '1.5rem' }}>
            {step.icon}
          </Typography>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              {step.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {step.description}
            </Typography>
          </Box>
        </Box>
      ))}
    </Paper>
  );
};

export default EditorSidebar; 