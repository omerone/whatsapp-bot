import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Paper, Typography, IconButton, Chip } from '@mui/material';
import {
  Message as MessageIcon,
  QuestionAnswer as QuestionIcon,
  List as OptionsIcon,
  CalendarToday as DateIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AcUnit as FreezeIcon,
  Block as BlockIcon,
  AccountTree as ConditionIcon,
  Flag as StartIcon
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
    case 'condition':
      return <ConditionIcon />;
    default:
      return <MessageIcon />;
  }
};

const StepNode: React.FC<NodeProps> = ({ data }) => {
  const { type, label, messageHeader, message, footerMessage, freeze, block, conditions, defaultNext, onEdit, onDelete, onSetAsStart, isStartStep } = data;

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        minWidth: 200,
        backgroundColor: type === 'condition' ? '#f3e5f5' : '#fff',
        border: type === 'condition' ? '2px solid #9c27b0' : '1px solid #e0e0e0',
        borderRadius: 2,
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        {getStepIcon(type)}
        <Typography variant="subtitle1" sx={{ ml: 1, flexGrow: 1 }}>
          {label}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }}>
          {freeze && (
            <Chip 
              icon={<FreezeIcon fontSize="small" />} 
              label="הקפאה" 
              size="small" 
              color="info" 
              sx={{ height: 24 }}
            />
          )}
          {block && (
            <Chip 
              icon={<BlockIcon fontSize="small" />} 
              label="חסימה" 
              size="small" 
              color="error" 
              sx={{ height: 24 }}
            />
          )}
        </Box>
        
        <IconButton 
          size="small"
          onClick={onSetAsStart}
          disabled={isStartStep}
          sx={{ 
            borderRadius: '50%',
            backgroundColor: isStartStep ? 'warning.main' : 'primary.main',
            color: 'white',
            width: 32,
            height: 32,
            '&:hover': {
              backgroundColor: isStartStep ? 'warning.dark' : 'primary.dark'
            },
            '&:disabled': {
              backgroundColor: 'warning.main',
              color: 'white',
              opacity: 0.7
            }
          }}
        >
          <StartIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" onClick={onDelete}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {messageHeader && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {messageHeader}
        </Typography>
      )}

      {type === 'condition' ? (
        <Box>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 600, mb: 1 }}>
            If / Else Logic
          </Typography>
          {conditions && conditions.length > 0 && (
            <Box sx={{ mb: 1 }}>
              {conditions.map((condition: any, index: number) => (
                <Typography key={index} variant="caption" display="block" color="text.secondary">
                  {index === 0 ? 'IF' : 'ELSE IF'}: {condition.variable} {condition.operator}
                </Typography>
              ))}
            </Box>
          )}
          {defaultNext && (
            <Typography variant="caption" display="block" color="text.secondary">
              ELSE: → {defaultNext}
            </Typography>
          )}
        </Box>
      ) : (
        <>
      <Typography variant="body1" sx={{ mb: 1 }}>
        {message || 'הודעה ריקה'}
      </Typography>

      {footerMessage && (
        <Typography variant="body2" color="text.secondary">
          {footerMessage}
        </Typography>
          )}
        </>
      )}

      <Handle type="source" position={Position.Bottom} />
    </Paper>
  );
};

export default memo(StepNode); 