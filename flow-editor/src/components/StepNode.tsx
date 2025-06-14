import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Paper, Typography, IconButton } from '@mui/material';
import {
  Message as MessageIcon,
  QuestionAnswer as QuestionIcon,
  List as OptionsIcon,
  CalendarToday as DateIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { StepType } from '../types/flow';

const getStepIcon = (type: StepType) => {
  switch (type) {
    case 'message':
      return <MessageIcon />;
    case 'question':
      return <QuestionIcon />;
    case 'options':
      return <OptionsIcon />;
    case 'date':
      return <DateIcon />;
    default:
      return <MessageIcon />;
  }
};

const StepNode: React.FC<NodeProps> = ({ data }) => {
  const { type, label, messageHeader, message, footerMessage } = data;

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        minWidth: 200,
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 2,
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        {getStepIcon(type)}
        <Typography variant="subtitle1" sx={{ ml: 1, flexGrow: 1 }}>
          {label}
        </Typography>
        <IconButton size="small">
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {messageHeader && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {messageHeader}
        </Typography>
      )}

      <Typography variant="body1" sx={{ mb: 1 }}>
        {message || 'הודעה ריקה'}
      </Typography>

      {footerMessage && (
        <Typography variant="body2" color="text.secondary">
          {footerMessage}
        </Typography>
      )}

      <Handle type="source" position={Position.Bottom} />
    </Paper>
  );
};

export default memo(StepNode); 