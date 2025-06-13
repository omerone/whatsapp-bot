import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Typography, Paper } from '@mui/material';
import { StepType } from '../../types/flow';

const StepNode: React.FC<NodeProps> = ({ id, data }) => {
  const getNodeColor = (type: StepType) => {
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

  const getNodeTitle = (type: StepType) => {
    switch (type) {
      case 'message':
        return 'הודעה';
      case 'question':
        return 'שאלה';
      case 'options':
        return 'אפשרויות';
      case 'date':
        return 'תאריך';
      default:
        return type;
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        padding: 2,
        minWidth: 220,
        backgroundColor: getNodeColor(data.type),
        border: '2px solid #1976d2',
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.08)',
        direction: 'rtl',
        margin: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Box sx={{ mb: 1, width: '100%' }}>
        <Box
          sx={{
            backgroundColor: '#1976d2',
            color: '#fff',
            borderRadius: '6px',
            px: 1.5,
            py: 0.5,
            display: 'inline-block',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            mb: 0.5,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.10)'
          }}
        >
          ID: {id}
        </Box>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 'bold', mt: 0.5, textAlign: 'right' }}>
          {getNodeTitle(data.type)}
        </Typography>
      </Box>

      <Box sx={{ mb: 1, width: '100%' }}>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', textAlign: 'right' }}>
          {data.message || data.messageHeader || 'ללא תוכן'}
        </Typography>
      </Box>

      {data.footerMessage && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #ccc', width: '100%' }}>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', display: 'block' }}>
            {data.footerMessage}
          </Typography>
        </Box>
      )}

      <Handle type="source" position={Position.Bottom} />
    </Paper>
  );
};

export default memo(StepNode); 