import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Typography, Box } from '@mui/material';
import { StepType } from '../../types/flow';

const getStepColor = (type: StepType) => {
  switch (type) {
    case 'message':
      return '#e3f2fd';
    case 'question':
      return '#f3e5f5';
    case 'options':
      return '#e8f5e9';
    case 'date':
      return '#fff3e0';
    default:
      return '#f5f5f5';
  }
};

const getStepIcon = (type: StepType) => {
  switch (type) {
    case 'message':
      return '💬';
    case 'question':
      return '❓';
    case 'options':
      return '📋';
    case 'date':
      return '📅';
    default:
      return '📝';
  }
};

const StepNode = ({ data }: NodeProps) => {
  const { type, message, messageHeader, footerMessage } = data;
  const backgroundColor = getStepColor(type as StepType);
  const icon = getStepIcon(type as StepType);

  return (
    <Paper
      elevation={3}
      sx={{
        padding: 2,
        minWidth: 200,
        backgroundColor,
        border: '1px solid #ccc',
        borderRadius: 2,
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>
          {icon} {type}
        </Typography>
      </Box>

      {messageHeader && (
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
          {messageHeader}
        </Typography>
      )}

      {message && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          {message}
        </Typography>
      )}

      {footerMessage && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {footerMessage}
        </Typography>
      )}

      <Handle type="source" position={Position.Bottom} />
    </Paper>
  );
};

export default memo(StepNode); 