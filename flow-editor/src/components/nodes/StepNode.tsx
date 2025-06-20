import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Paper, Typography, Box, Chip, IconButton } from '@mui/material';
import { StepType } from '../../types/flow';
import VerifiedIcon from '@mui/icons-material/Verified';
import MessageIcon from '@mui/icons-material/Message';
import HelpIcon from '@mui/icons-material/Help';
import ListIcon from '@mui/icons-material/List';
import EventIcon from '@mui/icons-material/Event';
import EditIcon from '@mui/icons-material/Edit';

const getStepColor = (type: StepType) => {
  switch (type) {
    case 'message':
      return {
        bg: '#eff6ff',
        border: '#2563eb',
        text: '#1e40af',
        accent: '#2563eb'
      };
    case 'question':
      return {
        bg: '#f3e8ff',
        border: '#7c3aed',
        text: '#6b21a8',
        accent: '#7c3aed'
      };
    case 'options':
      return {
        bg: '#ecfdf5',
        border: '#10b981',
        text: '#047857',
        accent: '#10b981'
      };
    case 'date':
      return {
        bg: '#fffbeb',
        border: '#f59e0b',
        text: '#b45309',
        accent: '#f59e0b'
      };
    default:
      return {
        bg: '#f8fafc',
        border: '#64748b',
        text: '#475569',
        accent: '#64748b'
      };
  }
};

const getStepIcon = (type: StepType) => {
  switch (type) {
    case 'message':
      return { emoji: '💬', IconComponent: MessageIcon };
    case 'question':
      return { emoji: '❓', IconComponent: HelpIcon };
    case 'options':
      return { emoji: '📋', IconComponent: ListIcon };
    case 'date':
      return { emoji: '📅', IconComponent: EventIcon };
    default:
      return { emoji: '📝', IconComponent: MessageIcon };
  }
};

const StepNode = ({ id, data, selected }: NodeProps) => {
  const { type, label, message, messageHeader, footerMessage, validation, resolution, limit } = data;
  const colors = getStepColor(type as StepType);
  const { emoji, IconComponent } = getStepIcon(type as StepType);
  
  // תצוגת המזהה על הבלוק - הסרת המילה "צעד" והצגת המזהה עצמו
  const displayLabel = id;

  const hasValidation = type === 'question' && validation?.type;
  
  // פונקציה להצגת רזולוציה עבור Date steps
  const getResolutionDisplay = () => {
    if (type !== 'date') return null;
    
    const resolutionMap = {
      'months': '📅 חודשים',
      'weeks': '📆 שבועות', 
      'days': '🗓 ימים',
      'hours': '🕒 שעות'
    };
    
    const resolutionText = resolutionMap[resolution as keyof typeof resolutionMap] || '🗓 ימים';
    const limitText = limit ? ` (${limit})` : '';
    
    return `${resolutionText}${limitText}`;
  };

  // פונקציה להצגת כמות אפשרויות עבור Options steps
  const getOptionsDisplay = () => {
    if (type !== 'options') return null;
    
    // ספירת אפשרויות מ-branches (לא כולל "חזור")
    const branches = data.branches || {};
    const optionsCount = Object.keys(branches).filter(key => !key.includes('חזור')).length;
    
    if (optionsCount === 0) return null;
    
    return `📋 ${optionsCount} אפשרויות`;
  };

  // פונקציה להצגת סוג ולידציה עבור Question steps
  const getValidationDisplay = () => {
    if (type !== 'question' || !validation?.type) return null;
    
    const validationMap = {
      'Name': '👤 שם',
      'Location': '📍 מיקום', 
      'Email': '📧 אימייל',
      'Age': '🎂 גיל',
      'Date': '📅 תאריך'
    };
    
    return validationMap[validation.type as keyof typeof validationMap] || `✅ ${validation.type}`;
  };

  return (
    <Paper
      elevation={selected ? 8 : 2}
      sx={{
        padding: 0,
        minWidth: 240,
        maxWidth: 320,
        backgroundColor: colors.bg,
        border: selected ? `3px solid ${colors.accent}` : `2px solid ${colors.border}40`,
        borderRadius: 4,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: `0 8px 25px -8px ${colors.accent}40`,
          borderColor: colors.accent,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top}
        style={{
          background: colors.accent,
          border: `2px solid ${colors.bg}`,
          width: 12,
          height: 12,
        }}
      />
      
      {/* Header עם אייקון וכותרת */}
      <Box sx={{ 
        p: 2, 
        pb: 1.5,
        background: `linear-gradient(135deg, ${colors.accent}15, ${colors.accent}05)`,
        borderBottom: `1px solid ${colors.border}20`,
        textAlign: 'center'
      }}>
        {/* אייקון במרכז למעלה */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 3,
            backgroundColor: colors.accent + '20',
            color: colors.accent,
            fontSize: '1.5rem',
            margin: '0 auto 1rem auto',
            boxShadow: `0 4px 12px ${colors.accent}20`
          }}
        >
          {emoji}
        </Box>
        
        {/* כותרת במרכז */}
        <Typography variant="h6" sx={{ 
          fontWeight: 700, 
          color: colors.text,
          fontSize: '1.1rem',
          lineHeight: 1.2,
          mb: 1
        }}>
          {displayLabel}
        </Typography>
        
        {/* תגיות */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          {/* תגית סוג ראשית */}
          <Chip 
            label={type} 
            size="small" 
            sx={{ 
              height: 20, 
              fontSize: '0.7rem',
              backgroundColor: colors.accent + '15',
              color: colors.accent,
              fontWeight: 600
            }} 
          />
          
          {/* תגיות משניות בשורה נפרדת */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {type === 'date' && getResolutionDisplay() && (
              <Chip 
                label={getResolutionDisplay()} 
                size="small" 
                sx={{ 
                  height: 18, 
                  fontSize: '0.65rem',
                  backgroundColor: colors.accent + '25',
                  color: colors.text,
                  fontWeight: 500
                }} 
              />
            )}
            
            {type === 'options' && getOptionsDisplay() && (
              <Chip 
                label={getOptionsDisplay()} 
                size="small" 
                sx={{ 
                  height: 18, 
                  fontSize: '0.65rem',
                  backgroundColor: colors.accent + '25',
                  color: colors.text,
                  fontWeight: 500
                }} 
              />
            )}
            
            {type === 'question' && getValidationDisplay() && (
              <Chip 
                size="small" 
                icon={<VerifiedIcon fontSize="small" />} 
                label={getValidationDisplay()}
                sx={{ 
                  height: 18, 
                  fontSize: '0.65rem',
                  backgroundColor: '#10b981' + '15',
                  color: '#10b981',
                  fontWeight: 500
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* תוכן הבלוק */}
      <Box sx={{ p: 2, pt: 1.5 }}>
        {messageHeader && (
          <Typography variant="body2" sx={{ 
            mb: 1.5, 
            color: colors.text, 
            textAlign: 'center',
            fontWeight: 500,
            backgroundColor: colors.accent + '10',
            padding: 1,
            borderRadius: 1,
            border: `1px solid ${colors.accent}20`
          }}>
            {messageHeader}
          </Typography>
        )}

        {message && (
          <Typography variant="body2" sx={{ 
            mb: 1, 
            textAlign: 'center',
            color: 'grey.700',
            lineHeight: 1.4,
            fontSize: '0.85rem'
          }}>
            {message.length > 80 ? `${message.substring(0, 80)}...` : message}
          </Typography>
        )}

        {footerMessage && (
          <Typography variant="caption" sx={{ 
            display: 'block', 
            color: 'grey.500', 
            textAlign: 'center',
            fontSize: '0.75rem',
            fontStyle: 'italic',
            mt: 1,
            pt: 1,
            borderTop: `1px solid ${colors.border}20`
          }}>
            {footerMessage.length > 60 ? `${footerMessage.substring(0, 60)}...` : footerMessage}
          </Typography>
        )}
      </Box>

      <Handle 
        type="source" 
        position={Position.Bottom}
        style={{
          background: colors.accent,
          border: `2px solid ${colors.bg}`,
          width: 12,
          height: 12,
        }}
      />
    </Paper>
  );
};

export default memo(StepNode); 