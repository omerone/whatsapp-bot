import React from 'react';
import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import { StepType } from '../types/flow';
import MessageIcon from '@mui/icons-material/Message';
import HelpIcon from '@mui/icons-material/Help';
import ListIcon from '@mui/icons-material/List';
import EventIcon from '@mui/icons-material/Event';
import CallSplitIcon from '@mui/icons-material/CallSplit';

const stepTypes: { 
  type: StepType; 
  label: string; 
  description: string; 
  icon: string;
  color: string;
  bgColor: string;
  IconComponent: React.ComponentType;
}[] = [
  {
    type: 'message',
    label: 'הודעה',
    description: 'הודעה פשוטה למשתמש',
    icon: '💬',
    color: '#2563eb',
    bgColor: '#eff6ff',
    IconComponent: MessageIcon
  },
  {
    type: 'question',
    label: 'שאלה',
    description: 'שאלה פתוחה למשתמש',
    icon: '❓',
    color: '#7c3aed',
    bgColor: '#f3e8ff',
    IconComponent: HelpIcon
  },
  {
    type: 'options',
    label: 'אפשרויות',
    description: 'בחירה מרשימת אפשרויות',
    icon: '📋',
    color: '#10b981',
    bgColor: '#ecfdf5',
    IconComponent: ListIcon
  },
  {
    type: 'date',
    label: 'תאריך',
    description: 'בחירת תאריך או זמן',
    icon: '📅',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    IconComponent: EventIcon
  },
  {
    type: 'condition',
    label: 'תנאי',
    description: 'בדיקת תנאים והפניה לשלבים שונים',
    icon: '🔀',
    color: '#e11d48',
    bgColor: '#fef2f2',
    IconComponent: CallSplitIcon
  }
];

const EditorSidebar: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: StepType) => {
    event.stopPropagation();
    
    console.log('Starting drag with type:', nodeType);
    
    event.dataTransfer.setData('text/plain', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    
    // שמירה על הצבע המקורי במהלך הגרירה - שיפור משמעותי
    const target = event.currentTarget as HTMLElement;
    const stepData = stepTypes.find(step => step.type === nodeType);
    
    if (stepData && target) {
      // יצירת drag preview מותאם אישית
      const dragPreview = document.createElement('div');
      dragPreview.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        width: 260px;
        height: 80px;
        background-color: ${stepData.bgColor};
        border: 2px solid ${stepData.color};
        border-radius: 12px;
        display: flex;
        align-items: center;
        padding: 12px;
        gap: 12px;
        opacity: 0.9;
        font-family: 'Roboto', sans-serif;
        box-shadow: 0 8px 25px -8px ${stepData.color}40;
        z-index: 1000;
      `;
      
      // יצירת האייקון
      const iconDiv = document.createElement('div');
      iconDiv.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 8px;
        background-color: ${stepData.color}20;
        color: ${stepData.color};
        font-size: 1.5rem;
        flex-shrink: 0;
      `;
      iconDiv.textContent = stepData.icon;
      
      // יצירת הטקסט
      const textDiv = document.createElement('div');
      textDiv.style.cssText = `
        flex: 1;
        min-width: 0;
      `;
      textDiv.innerHTML = `
        <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">
          ${stepData.label}
        </div>
        <div style="font-size: 0.875rem; color: #6b7280; line-height: 1.3;">
          ${stepData.description}
        </div>
      `;
      
      dragPreview.appendChild(iconDiv);
      dragPreview.appendChild(textDiv);
      document.body.appendChild(dragPreview);
      
      // הגדרת הdrag image
      event.dataTransfer.setDragImage(dragPreview, 130, 40);
      
      // הסרת הelement הזמני
      setTimeout(() => {
        if (document.body.contains(dragPreview)) {
          document.body.removeChild(dragPreview);
        }
      }, 0);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: 280,
        height: '100%',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        overflowY: 'auto',
        backgroundColor: 'grey.50',
        borderLeft: '1px solid',
        borderColor: 'grey.200'
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'grey.800', mb: 1 }}>
        בלוקים זמינים
      </Typography>
        <Typography variant="body2" color="text.secondary">
          גרור בלוק לקנבס ליצירת צעד חדש
        </Typography>
      </Box>
      
      <Divider sx={{ borderColor: 'grey.300' }} />
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {stepTypes.map((step) => (
          <Paper
          key={step.type}
          draggable={true}
          onDragStart={(e) => onDragStart(e, step.type)}
            elevation={0}
          sx={{
              p: 2.5,
              border: '2px solid',
              borderColor: 'transparent',
              borderRadius: 3,
            cursor: 'grab',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
              gap: 2,
              backgroundColor: step.bgColor,
              transition: 'all 0.2s ease-in-out',
            '&:hover': {
                borderColor: step.color,
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 25px -8px ${step.color}40`,
            },
            '&:active': {
              cursor: 'grabbing',
                transform: 'translateY(0px)',
                boxShadow: `0 4px 15px -4px ${step.color}60`,
              }
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 2,
                backgroundColor: step.color + '20',
                color: step.color,
                fontSize: '1.5rem',
                flexShrink: 0
              }}
            >
            {step.icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'grey.800' }}>
              {step.label}
            </Typography>
                <Chip 
                  label={step.type} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.7rem',
                    backgroundColor: step.color + '15',
                    color: step.color,
                    fontWeight: 500
                  }} 
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {step.description}
            </Typography>
          </Box>
          </Paper>
        ))}
      </Box>
      
      <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid', borderColor: 'grey.200' }}>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
          💡 טיפ: לחץ על בלוק כדי לערוך את המאפיינים שלו
        </Typography>
        </Box>
    </Paper>
  );
};

export default EditorSidebar; 