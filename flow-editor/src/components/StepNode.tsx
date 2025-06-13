import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  minWidth: 200,
  backgroundColor: '#fff',
  border: '1px solid #ccc',
  borderRadius: theme.spacing(1),
}));

const StepNode: React.FC<NodeProps> = ({ data }) => {
  const getStepColor = (type: string) => {
    switch (type) {
      case 'message':
        return '#4CAF50';
      case 'question':
        return '#2196F3';
      case 'options':
        return '#FF9800';
      case 'date':
        return '#9C27B0';
      default:
        return '#757575';
    }
  };

  return (
    <StyledPaper>
      <Handle type="target" position={Position.Top} />
      
      <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {data.type}
        </Typography>
        <Typography variant="h6" sx={{ color: getStepColor(data.type) }}>
          {data.label}
        </Typography>
      </Box>

      {data.messageHeader && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          כותרת: {data.messageHeader}
        </Typography>
      )}

      {data.message && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          {data.message}
        </Typography>
      )}

      {data.footerMessage && (
        <Typography variant="body2" color="text.secondary">
          תחתית: {data.footerMessage}
        </Typography>
      )}

      <Handle type="source" position={Position.Bottom} />
    </StyledPaper>
  );
};

export default memo(StepNode); 