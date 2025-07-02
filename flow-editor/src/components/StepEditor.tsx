import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Delete as DeleteIcon, Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { Step, StepType, StepData, ValidationRule, IntegrationConfig, ConditionRule } from '../types/flow';
import { useFlow } from '../context/FlowContext';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import InfoIcon from '@mui/icons-material/Info';
import VariableDisplay from './VariableDisplay';

interface StepEditorProps {
  stepId: string;
  onClose: () => void;
}

const validationTypes = [
  { value: 'Name', label: 'שם מלא', errorKeys: ['empty', 'tooShort', 'tooLong', 'notEnoughWords', 'tooManyWords', 'invalidCharacters', 'duplicateWords', 'cityName'] },
  { value: 'Location', label: 'מיקום', errorKeys: ['קלט_ריק', 'עיר_לא_זמינה', 'הצעה_עיר_לא_זמינה', 'עיר_לא_מוכרת', 'הוראת_חזרה'] },
  { value: 'Email', label: 'אימייל', errorKeys: ['empty', 'invalid'] },
  { value: 'Age', label: 'גיל', errorKeys: ['empty', 'notNumber', 'tooYoung', 'tooOld', 'invalidRange'] },
  { value: 'Date', label: 'תאריך', errorKeys: ['empty', 'invalid', 'futureOnly', 'pastOnly', 'tooEarly', 'tooLate', 'invalidRange'] },
];

const StepEditor: React.FC<StepEditorProps> = ({ stepId, onClose }) => {
  const { getStep, updateStep, deleteStep, getAllSteps, updateStepId, setStartStep, flow } = useFlow();
  const step = getStep(stepId);
  const [editedStep, setEditedStep] = useState<Partial<StepData>>({
    ...step,
  });

  // עדכון editedStep כאשר הצעד משתנה
  useEffect(() => {
    if (step) {
      setEditedStep({ ...step });
    }
  }, [step]);
  const [newOption, setNewOption] = useState({ key: '', value: '', customValue: '' });
  const [keywordHelperOpen, setKeywordHelperOpen] = useState(false);
  const [editingKeywords, setEditingKeywords] = useState<{
    open: boolean;
    originalKey: string;
    keywords: string[];
    value: string;
  }>({
    open: false,
    originalKey: '',
    keywords: [],
    value: '',
  });

  const [integrationMessageDialog, setIntegrationMessageDialog] = useState<{
    open: boolean;
    type: 'calendar' | 'sheets' | 'notifications' | 'reminders' | 'iplan' | null;
    title: string;
    message: string;
  }>({
    open: false,
    type: null,
    title: '',
    message: '',
  });

  const [remindersConfig, setRemindersConfig] = useState<{
    enabled: boolean;
    reminders: Array<{
      id: string;
      hours: number;
      message: string;
    }>;
  }>({
    enabled: false,
    reminders: []
  });

  // עדכון remindersConfig כאשר הצעד משתנה
  useEffect(() => {
    if (editedStep.integration?.reminders) {
      setRemindersConfig(editedStep.integration.reminders);
    }
  }, [editedStep.integration?.reminders]);

  if (!step) {
    return null;
  }

  const handleChange = (field: keyof StepData, value: any) => {
    setEditedStep((prev) => {
      const updated = { ...prev, [field]: value };
      
      // אם משנים את המזהה, עדכן גם את התווית
      if (field === 'id') {
        updated.label = value;
      }
      
      // אם משנים את הסוג ל-options, נקה את השדה next
      if (field === 'type' && value === 'options') {
        updated.next = '';
      }
      
      return updated;
    });
  };

  const handleDelete = () => {
    deleteStep(stepId);
    onClose();
  };

  const handleSetAsStart = () => {
    setStartStep(stepId);
    // לא סוגרים את הדיאלוג כי המשתמש יכול רוצה לערוך עוד משהו
  };

  const handleAddOption = () => {
    if (newOption.key && newOption.value) {
      // בניית הערך: צעד יעד + ערך מותאם אישית (אם קיים)
      let branchValue = newOption.value;
      if (newOption.customValue && newOption.customValue.trim()) {
        branchValue = `${newOption.value}::${newOption.customValue.trim()}`;
      }
      
      // עדכון branches בלבד - לא צריך יותר options
      const updatedBranches = {
        ...(editedStep.branches || {}),
        [newOption.key]: branchValue,
      };
      
      // עדכון מיידי של ה-state
      setEditedStep(prev => ({
        ...prev,
        branches: updatedBranches
      }));
      
      // ניקוי השדות
      setNewOption({ key: '', value: '', customValue: '' });
      
      console.log('Option added to branches:', {
        key: newOption.key, 
        value: branchValue, 
        branches: updatedBranches
      });
    }
  };

  const handleRemoveOption = (key: string) => {
    // הסרה מbranches בלבד
    if (editedStep.branches) {
      const updatedBranches = { ...editedStep.branches };
      delete updatedBranches[key];
      
      // עדכון מיידי של ה-state
      setEditedStep(prev => ({
        ...prev,
        branches: updatedBranches
      }));
      
      console.log('Option removed from branches:', { key });
    }
  };

  const handleValidationChange = (field: keyof ValidationRule, value: any) => {
    setEditedStep((prev) => ({
      ...prev,
      validation: {
        ...prev.validation,
        [field]: value,
      } as ValidationRule,
    }));
  };

  const allSteps = getAllSteps();
  const availableNextSteps = allSteps
    .filter((s) => s.id !== step.id)
    .map((s) => ({
      id: s.id,
      label: `${s.id} (${s.type})`,
    }));

  const handleSave = () => {
    let stepToUpdate = { ...editedStep };
    
    // אם השלב פעיל (enabled !== false), הסר את השדה enabled כדי לא לזהם את ה-JSON
    if (stepToUpdate.enabled !== false) {
      delete stepToUpdate.enabled;
    }
    
    // הסר את שדה options אם קיים - הבקנד עובד עם branches בלבד
    if (stepToUpdate.options) {
      delete stepToUpdate.options;
    }
    
    // Check if ID changed and handle it specially
    if (stepToUpdate.id && stepToUpdate.id !== stepId) {
      // Update the step ID first (which also updates the label)
      updateStepId(stepId, stepToUpdate.id);
      
      // Remove the ID from edited fields since it's already handled
      const { id, ...otherChanges } = stepToUpdate;
      
      // Update other fields if needed
      if (Object.keys(otherChanges).length > 0) {
        updateStep(stepToUpdate.id, otherChanges);
      }
    } else {
      // Make sure label matches ID
      const finalStep = {
        ...stepToUpdate,
        label: stepToUpdate.id || stepId
      };
      
      // Normal update without ID change
      updateStep(stepId, finalStep);
    }
    
    onClose();
  };

  // פונקציה לפירוק מחרוזת מילות מפתח למערך
  const parseKeywords = (keywordString: string): string[] => {
    if (!keywordString) return [];
    return keywordString.split('||').map(keyword => keyword.trim()).filter(k => k);
  };

  // פונקציה לאיחוד מערך מילות מפתח למחרוזת
  const joinKeywords = (keywords: string[]): string => {
    return keywords.join(' || ');
  };

  // פונקציות לעריכת הודעות אינטגרציה
  const openIntegrationMessageDialog = (type: 'calendar' | 'sheets' | 'notifications' | 'reminders' | 'iplan') => {
    const titles = {
      calendar: 'הודעת אינטגרציית יומן',
      sheets: 'הודעת אינטגרציית גיליונות',
      notifications: 'הודעת התראות',
      reminders: 'הודעת תזכורות',
      iplan: 'הודעת iPlan'
    };

    // טעינת הודעה קיימת אם יש
    const currentMessage = editedStep.integration?.[type]?.message || '';
    
    setIntegrationMessageDialog({
      open: true,
      type,
      title: titles[type],
      message: currentMessage,
    });
  };

  const saveIntegrationMessage = () => {
    if (!integrationMessageDialog.type || !integrationMessageDialog.message.trim()) {
      return;
    }

    // שמירת ההודעה בהגדרות האינטגרציה של הצעד
    const integrationType = integrationMessageDialog.type;
    const message = integrationMessageDialog.message;

    // יצירת או עדכון אובייקט האינטגרציה
    const currentIntegration = editedStep.integration || {};
    const updatedIntegration = {
      ...currentIntegration,
      [integrationType]: {
        ...currentIntegration[integrationType],
        enabled: true,
        message: message
      }
    };

    // עדכון הצעד עם הגדרות האינטגרציה החדשות
    handleChange('integration', updatedIntegration);

    // סגירת הדיאלוג
    setIntegrationMessageDialog({
      open: false,
      type: null,
      title: '',
      message: '',
    });
  };

  // פונקציה לעריכת מילות מפתח
  const openKeywordEditor = (originalKey: string, value: string) => {
    setEditingKeywords({
      open: true,
      originalKey,
      keywords: parseKeywords(originalKey),
      value,
    });
  };

  const handleKeywordEdit = (index: number, newValue: string) => {
    const updatedKeywords = [...editingKeywords.keywords];
    updatedKeywords[index] = newValue;
    setEditingKeywords({
      ...editingKeywords,
      keywords: updatedKeywords,
    });
  };

  const handleAddKeyword = () => {
    setEditingKeywords({
      ...editingKeywords,
      keywords: [...editingKeywords.keywords, ''],
    });
  };

  const handleRemoveKeyword = (index: number) => {
    const updatedKeywords = [...editingKeywords.keywords];
    updatedKeywords.splice(index, 1);
    setEditingKeywords({
      ...editingKeywords,
      keywords: updatedKeywords,
    });
  };

  const saveKeywordChanges = () => {
    // ודא שאין מילות מפתח ריקות
    const filteredKeywords = editingKeywords.keywords.filter(k => k.trim() !== '');
    
    const originalKey = editingKeywords.originalKey;
    const targetValue = editingKeywords.value;

    // עדכן branches - תמיד עדכן, גם אם לא נשארו מילות מפתח
    if (editedStep.branches) {
      const updatedBranches = { ...editedStep.branches };
      
      // שמור על הערך המותאם אישית מהערך המקורי אם קיים
      const originalValue = updatedBranches[originalKey];
      const customValue = typeof originalValue === 'string' && originalValue.includes('::') 
        ? originalValue.split('::')[1] 
        : null;
      
      // מחק את המפתח הישן תמיד
      delete updatedBranches[originalKey];
      
      // הוסף את המפתח החדש רק אם יש מילות מפתח
      if (filteredKeywords.length > 0) {
        const newKeyString = joinKeywords(filteredKeywords);
        // שמור על הערך המותאם אישית אם קיים
        const finalValue = customValue 
          ? `${targetValue.includes('::') ? targetValue.split('::')[0] : targetValue}::${customValue}`
          : targetValue;
        updatedBranches[newKeyString] = finalValue;
      }
      
      // עדכן מיידית ללא סגירת הדיאלוג
      setEditedStep(prev => ({
        ...prev,
        branches: updatedBranches
      }));
    }
    
    // סגירת חלון העריכה
    setEditingKeywords({
      open: false,
      originalKey: '',
      keywords: [],
      value: '',
    });
  };

  // פונקציות לניהול תזכורות
  const handleAddReminder = () => {
    const newReminder = {
      id: Date.now().toString(),
      hours: 1,
      message: 'תזכורת: יש לך פגישה עוד {hours} שעות ב-{meeting_date} ב-{meeting_time}'
    };
    
    const updatedReminders = [...remindersConfig.reminders, newReminder];
    const updatedConfig = { ...remindersConfig, reminders: updatedReminders };
    setRemindersConfig(updatedConfig);
    
    // עדכון הצעד
    handleChange('integration', {
      ...editedStep.integration,
      reminders: updatedConfig
    });
  };

  const handleUpdateReminder = (id: string, field: 'hours' | 'message', value: number | string) => {
    const updatedReminders = remindersConfig.reminders.map(reminder => 
      reminder.id === id ? { ...reminder, [field]: value } : reminder
    );
    const updatedConfig = { ...remindersConfig, reminders: updatedReminders };
    setRemindersConfig(updatedConfig);
    
    // עדכון הצעד
    handleChange('integration', {
      ...editedStep.integration,
      reminders: updatedConfig
    });
  };

  const handleRemoveReminder = (id: string) => {
    const updatedReminders = remindersConfig.reminders.filter(reminder => reminder.id !== id);
    const updatedConfig = { ...remindersConfig, reminders: updatedReminders };
    setRemindersConfig(updatedConfig);
    
    // עדכון הצעד
    handleChange('integration', {
      ...editedStep.integration,
      reminders: updatedConfig
    });
  };

  const handleToggleReminders = (enabled: boolean) => {
    const updatedConfig = { ...remindersConfig, enabled };
    setRemindersConfig(updatedConfig);
    
    // עדכון הצעד
    handleChange('integration', {
      ...editedStep.integration,
      reminders: updatedConfig
    });
  };

  // Get all available variables from the flow - תיקון יסודי
  const getAllAvailableVariables = () => {
    const variables: string[] = [
      'display_name',    // תמיד זמין - שם מוצג (saved_name או full_name)
      'phone'            // תמיד זמין - מספר טלפון
    ];
    
    const allSteps = getAllSteps();
    
    // מיפוי שלבים לפי ID
    const stepsMap: Record<string, any> = allSteps.reduce((acc, step) => ({ ...acc, [step.id]: step }), {});
    
    // מציאת שלב ההתחלה של הזרימה
    const startStep = flow?.start || 'intro';
    
    // פונקציה רקורסיבית למציאת כל השלבים שיכולים להגיע לפני השלב הנוכחי
    const findPossiblePredecessors = (targetStepId: string, visited = new Set()): string[] => {
      if (visited.has(targetStepId)) return [];
      visited.add(targetStepId);
      
      const predecessors: string[] = [];
      
      // עבור כל השלבים, בדוק אם הם מובילים לשלב המטרה
      allSteps.forEach(step => {
        if (step.id === targetStepId) return;
        
        let leadsToTarget = false;
        
        // בדיקת next רגיל
        if (step.next === targetStepId) {
          leadsToTarget = true;
        }
        
        // בדיקת branches
        if (step.branches) {
          const branchTargets = Object.values(step.branches);
          if (branchTargets.includes(targetStepId)) {
            leadsToTarget = true;
          }
        }
        
        // בדיקת options (legacy)
        if (step.options) {
          const optionTargets = Object.values(step.options);
          if (optionTargets.includes(targetStepId)) {
            leadsToTarget = true;
          }
        }
        
        // בדיקת conditions
        if (step.conditions) {
          const conditionTargets = step.conditions.map(c => c.next);
          if (conditionTargets.includes(targetStepId)) {
            leadsToTarget = true;
          }
        }
        
        // בדיקת defaultNext
        if (step.defaultNext === targetStepId) {
          leadsToTarget = true;
        }
        
        if (leadsToTarget) {
          predecessors.push(step.id);
          // הוסף גם את הקודמים של השלב הזה (רקורסיה)
          predecessors.push(...findPossiblePredecessors(step.id, new Set(visited)));
        }
      });
      
      return Array.from(new Set(predecessors));
    };
    
    // מציאת כל השלבים שיכולים להגיע לפני השלב הנוכחי
    const possiblePredecessors = findPossiblePredecessors(stepId);
    
    // הוספת השלבים שבדרך מההתחלה לשלב הנוכחי
    const pathSteps = [startStep, ...possiblePredecessors];
    
    // איסוף משתנים מהשלבים הקודמים
    pathSteps.forEach(stepId => {
      const step = stepsMap[stepId];
      if (!step) return;
      
      // שלבי שאלה - המשתנה הוא key
      if (step.type === 'question' && step.key) {
        variables.push(step.key);
      }
      
      // שלבי תאריך - המשתנה הוא key או ברירת מחדל
      if (step.type === 'date') {
        const dateVar = step.key || 'selected_date';
        variables.push(dateVar);
        
        // הוספת משתנים נוספים לתאריכים
        if (dateVar === 'selected_date') {
          variables.push('date_formatted', 'day_name');
        }
      }
      
      // שלבי אפשרויות - המשתנה הוא key או ברירת מחדל
      if (step.type === 'options' && step.key) {
        variables.push(step.key);
        
        // אם זה בחירת זמן, הוסף משתנה נוסף
        if (step.key === 'selected_time') {
          variables.push('time_formatted');
        }
      }
    });
    
    // הוספת משתנים מיוחדים
    if (variables.includes('selected_date') && variables.includes('selected_time')) {
      variables.push('meeting_datetime', 'appointment_summary');
    }
    
    const uniqueVariables = Array.from(new Set(variables));
    
    return uniqueVariables;
  };

  const renderRetryConfigEditor = () => {
    if (editedStep.type === 'condition') return null; // Condition steps don't need retry config
    
    const retryConfig = editedStep.retryConfig || { enabled: false, maxAttempts: 2, actions: {} } as any;

    const handleRetryConfigChange = (field: string, value: any) => {
      const newConfig = { ...retryConfig } as any;
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newConfig[parent] = { ...newConfig[parent], [child]: value };
      } else {
        newConfig[field] = value;
      }
      handleChange('retryConfig', newConfig);
    };

    return (
      <Paper elevation={0} sx={{ p: 2.5, backgroundColor: '#fff3e0', borderRadius: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'grey.800', display: 'flex', alignItems: 'center', gap: 1 }}>
          🔄 טיפול בשליחות חוזרות של השלב
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={retryConfig.enabled}
              onChange={(e) => handleRetryConfigChange('enabled', e.target.checked)}
            />
          }
          label="הפעל טיפול אוטומטי בשליחות חוזרות"
          sx={{ mb: 2, display: 'block' }}
        />

        {retryConfig.enabled && (
          <Box>
            <TextField
              fullWidth
              type="number"
              label="מספר שליחות חוזרות מקסימלי"
              value={retryConfig.maxAttempts}
              onChange={(e) => handleRetryConfigChange('maxAttempts', parseInt(e.target.value))}
              inputProps={{ min: 2, max: 10 }}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              helperText="כמה פעמים הבוט יכול לשלוח את אותו שלב ברצף לפני הפעלת המערכת"
            />

            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              פעולות לביצוע אחרי מספר השליחות החוזרות:
            </Typography>

            {/* Reset and Delete Section */}
            <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, backgroundColor: '#f8f9fa' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={retryConfig.actions.resetAndDelete || false}
                    onChange={(e) => {
                      const newActions = { ...retryConfig.actions };
                      if (e.target.checked) {
                        newActions.resetAndDelete = true;
                        newActions.resetBot = true; // Always enable resetBot when resetAndDelete is true
                      } else {
                        delete newActions.resetAndDelete;
                        delete newActions.resetBot;
                        delete newActions.resetKeyword;
                      }
                      handleRetryConfigChange('actions', newActions);
                    }}
                  />
                }
                label="🔄🗑️ אפס בוט להתחלה + מחק נתוני לקוח"
                sx={{ display: 'block', mb: 2 }}
              />
              
              {retryConfig.actions.resetAndDelete && (
                <Box sx={{ pl: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    מילות מפתח לאיפוס מוחלט (ללא הודעת התראה):
                  </Typography>
                  <TextField
                    fullWidth
                    label="מילות מפתח לאיפוס מוחלט"
                    value={retryConfig.actions.resetKeyword || 'לאפס, איפוס, רענון, התחלה מחדש, reset, restart'}
                    onChange={(e) => handleRetryConfigChange('actions.resetKeyword', e.target.value)}
                    placeholder="לאפס, איפוס, רענון, התחלה מחדש, reset, restart"
                    sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    helperText="מילים מופרדות בפסיקים - יפעילו איפוס מיידי"
                  />
                </Box>
              )}
            </Box>

            {/* Menu Keywords Section */}
            <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, backgroundColor: '#f0f8ff' }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                📋 מילות מפתח לחזרה לתפריט ראשי:
              </Typography>
              <TextField
                fullWidth
                label="מילות מפתח לתפריט"
                value={retryConfig.actions.menuKeyword || 'תפריט, תפריט ראשי, מה אפשר לעשות, עזרה, help, menu'}
                onChange={(e) => handleRetryConfigChange('actions.menuKeyword', e.target.value)}
                placeholder="תפריט, תפריט ראשי, מה אפשר לעשות, עזרה, help, menu"
                sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                helperText="מילים מופרדות בפסיקים - יחזירו את המשתמש לתפריט הראשי"
              />
            </Box>

            {/* Show Message Section */}
            <Box sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, backgroundColor: '#fff8e1' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={retryConfig.actions.showMessage?.enabled || false}
                    onChange={(e) => {
                      const showMessage = retryConfig.actions.showMessage || {};
                      handleRetryConfigChange('actions.showMessage', { 
                        ...showMessage, 
                        enabled: e.target.checked 
                      });
                    }}
                  />
                }
                label="📝 הצג הודעה מותאמת אישית"
                sx={{ mb: 2, display: 'block' }}
              />

              {retryConfig.actions.showMessage?.enabled && (
                <Box>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    maxRows={10}
                    label="הודעה שתשלח לקליינט"
                    value={retryConfig.actions.showMessage?.message || ''}
                    onChange={(e) => {
                      const showMessage = retryConfig.actions.showMessage || {};
                      handleRetryConfigChange('actions.showMessage', {
                        ...showMessage,
                        message: e.target.value
                      });
                    }}
                    sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    placeholder="נראה שיש קושי עם התהליך הנוכחי. מה תרצה לעשות?"
                    helperText="הודעה זו תשלח לפני הפעלת האיפוס"
                  />
                </Box>
              )}
            </Box>

            {/* Summary Section */}
            <Box sx={{ p: 2, backgroundColor: '#e8f5e8', borderRadius: 2, border: '1px solid #c8e6c9' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#2e7d32' }}>
                📋 סיכום הגדרות:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • מספר ניסיונות מקסימלי: {retryConfig.maxAttempts || 2}
                {retryConfig.actions.resetAndDelete && (
                  <>
                    <br />• איפוס אוטומטי: מופעל
                    <br />• מילות מפתח איפוס: {retryConfig.actions.resetKeyword?.split(',').length || 0} מילים
                  </>
                )}
                {retryConfig.actions.menuKeyword && (
                  <>
                    <br />• מילות מפתח תפריט: {retryConfig.actions.menuKeyword?.split(',').length || 0} מילים
                  </>
                )}
                {retryConfig.actions.showMessage?.enabled && (
                  <>
                    <br />• הודעה מותאמת: מופעלת
                  </>
                )}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>
    );
  };

  const renderConditionsEditor = () => {
    if (editedStep.type !== 'condition') return null;

    const conditions = editedStep.conditions || [];
    const availableVariables = getAllAvailableVariables();

    const addCondition = () => {
      const newConditions = [...conditions, {
        variable: '',
        operator: 'exists' as const,
        value: '',
        next: ''
      }];
      handleChange('conditions', newConditions);
    };

    const updateCondition = (index: number, field: keyof ConditionRule, value: string) => {
      const newConditions = [...conditions];
      newConditions[index] = { ...newConditions[index], [field]: value };
      handleChange('conditions', newConditions);
    };

    const removeCondition = (index: number) => {
      const newConditions = conditions.filter((_, i) => i !== index);
      handleChange('conditions', newConditions);
    };

    const getConditionLabel = (index: number) => {
      if (index === 0) return 'IF';
      return 'ELSE IF';
    };

    return (
      <Paper elevation={0} sx={{ p: 2.5, backgroundColor: 'grey.50', borderRadius: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'grey.800', display: 'flex', alignItems: 'center', gap: 1 }}>
          🔀 תנאים (If / Else If / Else)
        </Typography>
        
        {conditions.map((condition, index) => (
          <Box key={index} sx={{ border: '1px solid #e0e0e0', p: 2, borderRadius: 2, mb: 2, backgroundColor: index === 0 ? '#e3f2fd' : '#fff3e0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 500, color: index === 0 ? '#1976d2' : '#f57c00' }}>
                {getConditionLabel(index)}
              </Typography>
              <IconButton
                onClick={() => removeCondition(index)}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: !['exists', 'notExists'].includes(condition.operator) ? '1fr 120px 120px 1fr' : '1fr 120px 1fr' }, gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>משתנה</InputLabel>
                <Select
                  value={condition.variable}
                  label="משתנה"
                  onChange={(e) => updateCondition(index, 'variable', e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">
                    <em>בחר משתנה...</em>
                  </MenuItem>
                  {availableVariables.map(variable => (
                    <MenuItem key={variable} value={variable}>
                      {variable}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>אופרטור</InputLabel>
                <Select
                  value={condition.operator}
                  label="אופרטור"
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="exists">קיים</MenuItem>
                  <MenuItem value="notExists">לא קיים</MenuItem>
                  <MenuItem value="equals">שווה ל</MenuItem>
                  <MenuItem value="notEquals">לא שווה ל</MenuItem>
                  <MenuItem value="contains">מכיל</MenuItem>
                  <MenuItem value="notContains">לא מכיל</MenuItem>
                  <MenuItem value="greaterThan">גדול מ</MenuItem>
                  <MenuItem value="lessThan">קטן מ</MenuItem>
                </Select>
              </FormControl>
              
              {!['exists', 'notExists'].includes(condition.operator) && (
                <TextField
                  fullWidth
                  label="ערך להשוואה"
                  value={condition.value || ''}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  placeholder="הזן ערך..."
                />
              )}
              
              <FormControl fullWidth>
                <InputLabel>השלב הבא</InputLabel>
                <Select
                  value={condition.next}
                  label="השלב הבא"
                  onChange={(e) => updateCondition(index, 'next', e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">
                    <em>בחר שלב...</em>
                  </MenuItem>
                  {allSteps.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.label || s.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        ))}
        
        <Button
          onClick={addCondition}
          variant="contained"
          startIcon={<AddIcon />}
          fullWidth
          sx={{ mb: 2, borderRadius: 2 }}
        >
          הוסף תנאי (IF / ELSE IF)
        </Button>
        
        <Box sx={{ border: '1px solid #e0e0e0', p: 2, borderRadius: 2, backgroundColor: '#f3e5f5' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2, color: '#7b1fa2' }}>
            ELSE
          </Typography>
          <FormControl fullWidth>
            <InputLabel>השלב הבא אם שום תנאי לא התקיים</InputLabel>
            <Select
              value={editedStep.defaultNext || ''}
              label="השלב הבא אם שום תנאי לא התקיים"
              onChange={(e) => handleChange('defaultNext', e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">
                <em>בחר שלב...</em>
              </MenuItem>
              {allSteps.map(step => (
                <MenuItem key={step.id} value={step.id}>
                  {step.label || step.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>
    );
  };

  return (
    <Paper
      elevation={8}
      sx={{
        p: 0,
        width: 520,
        maxHeight: '92vh',
        overflow: 'hidden',
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'grey.200',
        backgroundColor: 'white',
      }}
    >
      {/* Header מודרני */}
      <Box sx={{ 
        p: 3, 
        background: 'linear-gradient(135deg, #2563eb15, #7c3aed10)',
        borderBottom: '1px solid',
        borderColor: 'grey.200',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            backgroundColor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.2rem'
          }}>
            ⚙️
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'grey.800' }}>
              עריכת צעד
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stepId} ({editedStep.type})
            </Typography>
          </Box>
        </Box>
        <Tooltip title={flow.start === stepId ? "זהו כבר צעד ההתחלה" : "הגדר כצעד התחלה"}>
          <IconButton 
            onClick={handleSetAsStart}
            disabled={flow.start === stepId}
            sx={{
              backgroundColor: flow.start === stepId ? 'warning.main' : 'primary.main',
              color: 'white',
              mr: 1,
              '&:hover': {
                backgroundColor: flow.start === stepId ? 'warning.dark' : 'primary.dark'
              },
              '&:disabled': {
                backgroundColor: 'warning.main',
                color: 'white',
                opacity: 0.7
              }
            }}
          >
            🎯
          </IconButton>
        </Tooltip>
        
        <Tooltip title="מחיקת הצעד">
          <IconButton 
            onClick={handleDelete} 
            sx={{
              backgroundColor: 'error.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'error.dark'
              }
            }}
          >
          <DeleteIcon />
        </IconButton>
        </Tooltip>
      </Box>

      {/* תוכן עם גלילה */}
      <Box sx={{ p: 3, maxHeight: 'calc(92vh - 140px)', overflowY: 'auto' }}>

      <Stack spacing={2}>
        {/* Common Fields */}
        <Paper elevation={0} sx={{ p: 2.5, backgroundColor: 'grey.50', borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'grey.800', display: 'flex', alignItems: 'center', gap: 1 }}>
            📋 מידע בסיסי
          </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>סוג צעד</InputLabel>
          <Select
            value={editedStep.type || ''}
            label="סוג צעד"
            onChange={(e) => handleChange('type', e.target.value as StepType)}
              sx={{ borderRadius: 2 }}
          >
              <MenuItem value="message">💬 הודעה</MenuItem>
              <MenuItem value="question">❓ שאלה</MenuItem>
              <MenuItem value="options">📋 אפשרויות</MenuItem>
              <MenuItem value="date">📅 תאריך</MenuItem>
              <MenuItem value="condition">🔀 תנאי</MenuItem>
          </Select>
        </FormControl>
          <Tooltip title="בחר את סוג הצעד: הודעה - שליחת טקסט בלבד, שאלה - קבלת קלט מהמשתמש עם ולידציה, אפשרויות - תפריט בחירה, תאריך - בחירת תאריך">
            <IconButton size="small" sx={{ ml: 1, mb: 2 }}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <TextField
          fullWidth
          label="מזהה"
          value={editedStep.id || ''}
          onChange={(e) => handleChange('id', e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
          <Tooltip title="מזהה ייחודי לצעד. ישמש לקישור בין צעדים ולהתייחסות בקוד. חובה שיהיה ייחודי">
            <IconButton size="small" sx={{ ml: 1, mb: 2 }}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Hide "Next Step" field for options and condition types - navigation is handled differently */}
        {editedStep.type !== 'options' && editedStep.type !== 'condition' && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0 }}>
          <FormControl fullWidth sx={{ mb: 0 }}>
          <InputLabel>צעד הבא</InputLabel>
          <Select
            value={editedStep.next || ''}
            label="צעד הבא"
            onChange={(e) => handleChange('next', e.target.value as string)}
              sx={{ borderRadius: 2 }}
          >
            <MenuItem value="">
              <em>ללא</em>
            </MenuItem>
            {availableNextSteps.map((nextStep) => (
              <MenuItem key={nextStep.id} value={nextStep.id}>
                {nextStep.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
            <Tooltip title="הצעד שיבוצע לאחר הצעד הנוכחי">
              <IconButton size="small" sx={{ ml: 1 }}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        
        {/* Show explanation for options type */}
        {editedStep.type === 'options' && (
          <Box sx={{ p: 2, backgroundColor: 'info.light', borderRadius: 2, mb: 0 }}>
            <Typography variant="body2" color="info.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" />
              בשלבי אפשרויות, הניווט נקבע דרך האפשרויות עצמן ולא דרך "צעד הבא"
            </Typography>
          </Box>
        )}
        </Paper>

        {/* Message Content - Hide for date and condition steps as they don't need messages */}
        {editedStep.type !== 'date' && editedStep.type !== 'condition' && (
          <Paper elevation={0} sx={{ p: 2.5, backgroundColor: 'grey.50', borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'grey.800', display: 'flex', alignItems: 'center', gap: 1 }}>
              💬 תוכן ההודעה
            </Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <TextField
            fullWidth
            label="כותרת הודעה"
            value={editedStep.messageHeader || ''}
            onChange={(e) => handleChange('messageHeader', e.target.value)}
            multiline
            minRows={1}
            maxRows={6}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
            <Tooltip title="כותרת שתוצג בחלק העליון של ההודעה. אופציונלי - תומך ברב שורות">
              <IconButton size="small" sx={{ ml: 1, mt: 1 }}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <TextField
            fullWidth
            label="הודעה"
            value={editedStep.message || ''}
            onChange={(e) => handleChange('message', e.target.value)}
            multiline
            minRows={4}
            maxRows={12}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Tooltip title="תוכן ההודעה העיקרית. יכול להכיל משתנים כמו {name}, {meeting_date} וכו'">
              <IconButton size="small" sx={{ ml: 1, mt: 1 }}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Variable Display */}
          <VariableDisplay 
            steps={Object.fromEntries(allSteps.map(s => [s.id, s]))} 
            currentStepId={stepId} 
          />

          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
          <TextField
            fullWidth
            label="הודעת תחתית"
            value={editedStep.footerMessage || ''}
            onChange={(e) => handleChange('footerMessage', e.target.value)}
            multiline
            minRows={1}
            maxRows={6}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
            <Tooltip title="הודעה שתוצג בתחתית. מתאים להוראות או מידע נוסף - תומך ברב שורות">
              <IconButton size="small" sx={{ ml: 1, mt: 1 }}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0 }}>
          <TextField
            fullWidth
            label="קובץ הודעה"
            value={editedStep.messageFile || ''}
            onChange={(e) => handleChange('messageFile', e.target.value)}
              sx={{ mb: 0, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
            <Tooltip title="נתיב לקובץ המכיל את תוכן ההודעה. אם מוגדר, יחליף את שדה 'הודעה'">
              <IconButton size="small" sx={{ ml: 1 }}>
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          </Paper>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Options */}
        {editedStep.type === 'options' && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">אפשרויות</Typography>
              <Tooltip title="ניתן להגדיר מספר מילות מפתח לכל אפשרות על ידי הפרדה עם || לדוגמה: 1 || רכב || אוטו">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            
            {/* מפתח שמירה עבור options */}
            <TextField
              fullWidth
              label="מפתח שמירה (אופציונלי)"
              value={editedStep.key || ''}
              onChange={(e) => handleChange('key', e.target.value)}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              helperText="מפתח ייחודי לשמירת הבחירה בלידס (לדוגמה: mobility). אם לא מוגדר, הבחירה לא תישמר"
              placeholder="לדוגמה: mobility"
            />
            <Box sx={{ mb: 2 }}>
              <List>
                {Object.entries(editedStep.branches || {})
                  .filter(([key]) => !key.includes('חזור')) // הסתרת אפשרויות חזור מהתצוגה
                  .map(([key, value]) => {
                    // פירוק הערך לצעד יעד וערך מותאם אישית
                    const valueStr = value as string;
                    const [targetStep, customValue] = valueStr.includes('::') ? valueStr.split('::') : [valueStr, null];
                    
                    return (
                      <ListItem key={key}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            צעד יעד: <strong>{targetStep}</strong>
                            {customValue && (
                              <> | ערך נשמר: <strong style={{ color: '#2563eb' }}>{customValue}</strong></>
                            )}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {parseKeywords(key).map((keyword, idx) => (
                              <Chip 
                                key={idx} 
                                label={keyword} 
                                size="small" 
                                variant="outlined" 
                                color="primary"
                              />
                            ))}
                          </Box>
                        </Box>
                        <ListItemSecondaryAction>
                          <IconButton edge="end" onClick={() => openKeywordEditor(key, value as string)} sx={{ mr: 1 }}>
                            <EditIcon />
                          </IconButton>
                          <IconButton edge="end" onClick={() => handleRemoveOption(key)}>
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
              </List>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
                <TextField
                  label="מילות מפתח (מופרדות ב-||)"
                  value={newOption.key}
                  onChange={(e) => setNewOption({ ...newOption, key: e.target.value })}
                  size="small"
                  fullWidth
                  helperText="לדוגמה: 1 || רכב || אוטו"
                />
                <FormControl fullWidth size="small">
                  <InputLabel>צעד יעד</InputLabel>
                  <Select
                    value={newOption.value}
                    onChange={(e) => setNewOption({ ...newOption, value: e.target.value })}
                    label="צעד יעד"
                  >
                    <MenuItem value="">
                      <em>בחר צעד</em>
                    </MenuItem>
                    {availableNextSteps.map((nextStep) => (
                      <MenuItem key={nextStep.id} value={nextStep.id}>
                        {nextStep.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="ערך לשמירה בלידס (אופציונלי)"
                  value={newOption.customValue}
                  onChange={(e) => setNewOption({ ...newOption, customValue: e.target.value })}
                  size="small"
                  fullWidth
                  helperText="הערך שיישמר בקובץ הלידס עבור השדה הזה (לדוגמה: car, motorcycle)"
                  placeholder="לדוגמה: car"
                />
                <Button
                  variant="outlined"
                  onClick={handleAddOption}
                  disabled={!newOption.key || !newOption.value}
                  startIcon={<AddIcon />}
                  fullWidth
                >
                  הוסף אפשרות
                </Button>
              </Box>
              
              {/* הודעת שגיאה עבור בחירה לא תקינה */}
              <Box sx={{ mt: 2, p: 2, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  הודעת שגיאה מותאמת אישית
                  <Tooltip title="הודעה שתשלח כאשר הקליינט יכתוב משהו שלא מתאים לאפשרויות הזמינות">
                    <IconButton size="small" sx={{ ml: 1 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={8}
                  label="הודעת שגיאה"
                  value={editedStep.noMatchMessage || ''}
                  onChange={(e) => handleChange('noMatchMessage', e.target.value)}
                  placeholder="אנא בחר אחת מהאפשרויות המוצגות..."
                  helperText="הודעה זו תשלח כאשר הקליינט יכתוב משהו שלא מתאים לאפשרויות"
                />
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Question Key Field */}
        {editedStep.type === 'question' && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>הגדרות שאלה</Typography>
            
            <TextField
              fullWidth
              label="מפתח שמירה"
              value={editedStep.key || ''}
              onChange={(e) => handleChange('key', e.target.value)}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              helperText="מפתח ייחודי לשמירת התשובה (לדוגמה: name, email, age)"
              placeholder="לדוגמה: name"
              required
            />
            
            <Typography variant="subtitle1" sx={{ mb: 1 }}>אימות וולידציה</Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>סוג אימות</InputLabel>
              <Select
                value={editedStep.validation?.type || ''}
                label="סוג אימות"
                onChange={(e) => handleValidationChange('type', e.target.value as string)}
              >
                <MenuItem value="">
                  <em>ללא אימות</em>
                </MenuItem>
                {validationTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {editedStep.validation?.type && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>הגדרות אימות</Typography>
                
                {/* הגדרות ספציפיות לכל סוג ולידציה */}
                {editedStep.validation.type === 'Age' && (
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                      type="number"
                      label="גיל מינימלי"
                      value={editedStep.validation.minAge || 16}
                      onChange={(e) => handleValidationChange('minAge', parseInt(e.target.value))}
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="גיל מקסימלי"
                      value={editedStep.validation.maxAge || 120}
                      onChange={(e) => handleValidationChange('maxAge', parseInt(e.target.value))}
                    />
                  </Box>
                )}
                
                {editedStep.validation.type === 'Date' && (
                  <>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
                        type="date"
                        label="תאריך מינימלי"
                        InputLabelProps={{ shrink: true }}
                        value={editedStep.validation.minDate || ''}
                        onChange={(e) => handleValidationChange('minDate', e.target.value)}
                      />
                      <TextField
                        fullWidth
                        type="date"
                        label="תאריך מקסימלי"
                        InputLabelProps={{ shrink: true }}
                        value={editedStep.validation.maxDate || ''}
                        onChange={(e) => handleValidationChange('maxDate', e.target.value)}
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={editedStep.validation.futureOnly || false}
                            onChange={(e) => handleValidationChange('futureOnly', e.target.checked)}
                          />
                        }
                        label="רק תאריכים עתידיים"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={editedStep.validation.pastOnly || false}
                            onChange={(e) => handleValidationChange('pastOnly', e.target.checked)}
                          />
                        }
                        label="רק תאריכים בעבר"
                      />
                    </Box>
                  </>
                )}

                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  הודעות שגיאה מותאמות אישית
                  <Tooltip title="הגדר הודעות שגיאה מותאמות אישית עבור כל מקרה ולידציה">
                    <IconButton size="small" sx={{ ml: 1 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
                
                {/* הודעות שגיאה מותאמות אישית */}
                {editedStep.validation?.type && (
                  <Box sx={{ mb: 2, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 1, p: 2 }}>
                    {validationTypes
                      .find(type => type.value === editedStep.validation?.type)?.errorKeys
                      .map((errorKey) => (
                        <TextField
                          key={errorKey}
                          fullWidth
                          label={`הודעת שגיאה: ${errorKey}`}
                          value={editedStep.validation?.errorMessages?.[errorKey] || ''}
                          onChange={(e) => {
                            // עדכון הודעת השגיאה הספציפית
                            setEditedStep((prev) => ({
                              ...prev,
                              validation: {
                                ...prev.validation,
                                errorMessages: {
                                  ...(prev.validation?.errorMessages || {}),
                                  [errorKey]: e.target.value
                                }
                              } as ValidationRule
                            }));
                          }}
                          sx={{ mb: 1.5 }}
                          helperText={`הודעת שגיאה מותאמת אישית עבור: ${errorKey}`}
                        />
                      ))}
                  </Box>
                )}

            <Divider sx={{ my: 2 }} />
              </>
            )}
          </>
        )}

        {/* Date Settings */}
        {editedStep.type === 'date' && (
          <>
            <Paper elevation={0} sx={{ p: 2.5, backgroundColor: 'grey.50', borderRadius: 3, mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'grey.800', display: 'flex', alignItems: 'center', gap: 1 }}>
                📅 הגדרות תאריך
              </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>רזולוציה</InputLabel>
              <Select
                value={editedStep.resolution || 'days'}
                label="רזולוציה"
                onChange={(e) => handleChange('resolution', e.target.value as string)}
                  sx={{ borderRadius: 2 }}
              >
                  <MenuItem value="months">📅 חודשים</MenuItem>
                  <MenuItem value="weeks">📆 שבועות</MenuItem>
                  <MenuItem value="days">🗓 ימים</MenuItem>
                  <MenuItem value="hours">🕒 שעות</MenuItem>
              </Select>
            </FormControl>

              <TextField
                fullWidth
                type="number"
                label={`כמות ${editedStep.resolution === 'months' ? 'חודשים' : 
                              editedStep.resolution === 'weeks' ? 'שבועות' : 
                              editedStep.resolution === 'days' ? 'ימים' : 
                              editedStep.resolution === 'hours' ? 'שעות' : 'יחידות'} להצגה`}
                value={editedStep.limit || ''}
                onChange={(e) => handleChange('limit', parseInt(e.target.value))}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                helperText={`מספר ${editedStep.resolution === 'months' ? 'החודשים' : 
                                    editedStep.resolution === 'weeks' ? 'השבועות' : 
                                    editedStep.resolution === 'days' ? 'הימים' : 
                                    editedStep.resolution === 'hours' ? 'השעות' : 'היחידות'} שיוצגו לקליינט לבחירה`}
              />

              {editedStep.resolution !== 'hours' && (
            <FormControlLabel
              control={
                <Switch
                  checked={editedStep.startFromToday || false}
                  onChange={(e) => handleChange('startFromToday', e.target.checked)}
                />
              }
                  label={`התחל מ${editedStep.resolution === 'months' ? 'החודש הנוכחי' : 
                                 editedStep.resolution === 'weeks' ? 'השבוע הנוכחי' : 'היום'}`}
              sx={{ mb: 2 }}
            />
              )}

            <TextField
              fullWidth
              label="הודעת אי-התאמה"
              value={editedStep.noMatchMessage || ''}
              onChange={(e) => handleChange('noMatchMessage', e.target.value)}
              multiline
              minRows={2}
              maxRows={6}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                helperText="הודעה שתשלח אם הקליינט יכתוב משהו שלא מתאים לתאריכים - תומך ברב שורות"
              />
            </Paper>

            {/* Date Branches Configuration */}
            <Paper elevation={0} sx={{ p: 2.5, backgroundColor: 'grey.50', borderRadius: 3, mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'grey.800', display: 'flex', alignItems: 'center', gap: 1 }}>
                🔀 הגדרות ניווט נוסף
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                הגדר מילות מפתח שיאפשרו לקליינט לנווט לשלבים אחרים מלבד בחירת תאריך
              </Typography>

              <Box sx={{ mb: 2 }}>
                <List>
                  {Object.entries(editedStep.branches || {}).map(([key, value]) => (
                    <ListItem key={key}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          מילות מפתח שמובילות ל: {value}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {parseKeywords(key).map((keyword, idx) => (
                            <Chip 
                              key={idx} 
                              label={keyword} 
                              size="small" 
                              variant="outlined" 
                              color="primary"
                            />
                          ))}
                        </Box>
                      </Box>
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => openKeywordEditor(key, value as string)} sx={{ mr: 1 }}>
                          <EditIcon />
                        </IconButton>
                        <IconButton edge="end" onClick={() => handleRemoveOption(key)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                
                {/* Add new navigation option for date steps */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
                  <TextField
                    label="מילות מפתח (מופרדות ב-||)"
                    value={newOption.key}
                    onChange={(e) => setNewOption({ ...newOption, key: e.target.value })}
                    size="small"
                    fullWidth
                    helperText="לדוגמה: פגישה || לקבוע פגישה || קביעת פגישה"
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>צעד יעד</InputLabel>
                    <Select
                      value={newOption.value}
                      onChange={(e) => setNewOption({ ...newOption, value: e.target.value })}
                      label="צעד יעד"
                    >
                      <MenuItem value="">
                        <em>בחר צעד</em>
                      </MenuItem>
                      {availableNextSteps.map((nextStep) => (
                        <MenuItem key={nextStep.id} value={nextStep.id}>
                          {nextStep.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    onClick={handleAddOption}
                    disabled={!newOption.key || !newOption.value}
                    startIcon={<AddIcon />}
                    fullWidth
                    sx={{ borderRadius: 2 }}
                  >
                    הוסף ניווט נוסף
                  </Button>
                </Box>
              </Box>

              {/* Custom error message for date steps */}
              <Box sx={{ mt: 2, p: 2, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  הודעת שגיאה מותאמת אישית
                  <Tooltip title="הודעה שתשלח כאשר הקליינט יכתוב משהו שלא מתאים לתאריכים או מילות המפתח">
                    <IconButton size="small" sx={{ ml: 1 }}>
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={8}
                  label="הודעת שגיאה"
                  value={editedStep.noMatchMessage || ''}
                  onChange={(e) => handleChange('noMatchMessage', e.target.value)}
                  placeholder="אנא בחר תאריך מהרשימה או כתב מילת מפתח תקינה..."
                  helperText="הודעה זו תשלח כאשר הקליינט יכתוב משהו שלא מתאים לתאריכים או למילות המפתח"
                />
              </Box>

              <Typography variant="body2" color="warning.main" sx={{ mt: 2, p: 2, backgroundColor: '#fff3e0', borderRadius: 2 }}>
                ⚠️ <strong>שימו לב:</strong> כאשר הקליינט חוזר לשלב קודם ובוחר אפשרות שונה, 
                הערך הקודם יידרס ויוחלף בערך החדש שנבחר.
              </Typography>
            </Paper>

            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Advanced Settings */}
        <Typography variant="subtitle1" sx={{ mb: 1 }}>הגדרות מתקדמות</Typography>
        
        {/* userResponseWaiting - רק עבור message steps */}
        {editedStep.type === 'message' && (
        <FormControlLabel
          control={
            <Switch
              checked={editedStep.userResponseWaiting || false}
              onChange={(e) => handleChange('userResponseWaiting', e.target.checked)}
            />
          }
          label="ממתין לתגובת משתמש"
          sx={{ mb: 1 }}
        />
        )}

        {/* Freeze settings - expanded version */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedStep.freeze)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Enable with default values
                      handleChange('freeze', {
                        enabled: true,
                        duration: 60,
                        messaging: {
                          send_explanation: true,
                          message: "תחזור אלינו בעוד {duration} דקות. תודה על הסבלנות! 🙏"
                        }
                      });
                    } else {
                      // Disable
                      handleChange('freeze', false);
                    }
                  }}
                />
              }
              label="הקפא"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (מומלץ להשתמש בהקפאה במקום בחסימה)
            </Typography>
          </Box>
          
          {/* Expanded freeze settings when enabled */}
          {editedStep.freeze && typeof editedStep.freeze === 'object' && (
            <Box sx={{ ml: 4, mt: 1, mb: 1, borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2 }}>
              <TextField
                fullWidth
                type="number"
                label="משך הקפאה (דקות)"
                value={editedStep.freeze.duration || 60}
                onChange={(e) => {
                  const freezeConfig = typeof editedStep.freeze === 'object' ? 
                    editedStep.freeze : { enabled: true, duration: 60, messaging: { send_explanation: true, message: "" } };
                  handleChange('freeze', {
                    ...freezeConfig,
                    duration: parseInt(e.target.value) || 60
                  });
                }}
                size="small"
                sx={{ mb: 2 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={typeof editedStep.freeze === 'object' ? 
                      editedStep.freeze.messaging?.send_explanation || false : false}
                    onChange={(e) => {
                      const freezeConfig = typeof editedStep.freeze === 'object' ? 
                        editedStep.freeze : { enabled: true, duration: 60, messaging: { send_explanation: true, message: "" } };
                      handleChange('freeze', {
                        ...freezeConfig,
                        messaging: {
                          ...freezeConfig.messaging,
                          send_explanation: e.target.checked
                        }
                      });
                    }}
                  />
                }
                label="שלח הסבר"
              />
              
              {typeof editedStep.freeze === 'object' && editedStep.freeze.messaging?.send_explanation && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={typeof editedStep.freeze === 'object' ? 
                        editedStep.freeze.messaging?.show_once || false : false}
                      onChange={(e) => {
                        const freezeConfig = typeof editedStep.freeze === 'object' ? 
                          editedStep.freeze : { enabled: true, duration: 60, messaging: { send_explanation: true, message: "" } };
                        handleChange('freeze', {
                          ...freezeConfig,
                          messaging: {
                            ...freezeConfig.messaging,
                            show_once: e.target.checked
                          }
                        });
                      }}
                    />
                  }
                  label="הצג הסבר פעם אחת בלבד"
                  sx={{ ml: 2, mt: 1 }}
                />
              )}
              
              {typeof editedStep.freeze === 'object' && editedStep.freeze.messaging?.send_explanation && (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={6}
                  label="הודעת הקפאה"
                  value={typeof editedStep.freeze === 'object' ? 
                    editedStep.freeze.messaging?.message || '' : ''}
                  onChange={(e) => {
                    const freezeConfig = typeof editedStep.freeze === 'object' ? 
                      editedStep.freeze : { enabled: true, duration: 60, messaging: { send_explanation: true, message: "" } };
                    handleChange('freeze', {
                      ...freezeConfig,
                      messaging: {
                        ...freezeConfig.messaging,
                        message: e.target.value
                      }
                    });
                  }}
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          )}
        </Box>

        {/* Block settings - expanded version */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(editedStep.block)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Enable with default values
                      handleChange('block', {
                        enabled: true,
                        messaging: {
                          send_explanation: true,
                          message: "לצערנו אינך יכול להמשיך בתהליך כרגע. תודה על ההבנה."
                        },
                        allow_unblock: false,
                        unblock_keyword: "שחרר"
                      });
                    } else {
                      // Disable
                      handleChange('block', false);
                    }
                  }}
                />
              }
              label="חסום"
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (חסימה קבועה של המשתמש)
            </Typography>
          </Box>
          
          {/* Expanded block settings when enabled */}
          {editedStep.block && typeof editedStep.block === 'object' && (
            <Box sx={{ ml: 4, mt: 1, mb: 1, borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={typeof editedStep.block === 'object' ? 
                      editedStep.block.messaging?.send_explanation || false : false}
                    onChange={(e) => {
                      const blockConfig = typeof editedStep.block === 'object' ? 
                        editedStep.block : { enabled: true, messaging: { send_explanation: true, message: "" }, allow_unblock: false, unblock_keyword: "שחרר" };
                      handleChange('block', {
                        ...blockConfig,
                        messaging: {
                          ...blockConfig.messaging,
                          send_explanation: e.target.checked
                        }
                      });
                    }}
                  />
                }
                label="שלח הסבר"
              />
              
              {typeof editedStep.block === 'object' && editedStep.block.messaging?.send_explanation && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={typeof editedStep.block === 'object' ? 
                        editedStep.block.messaging?.show_once || false : false}
                      onChange={(e) => {
                        const blockConfig = typeof editedStep.block === 'object' ? 
                          editedStep.block : { enabled: true, messaging: { send_explanation: true, message: "" }, allow_unblock: false, unblock_keyword: "שחרר" };
                        handleChange('block', {
                          ...blockConfig,
                          messaging: {
                            ...blockConfig.messaging,
                            show_once: e.target.checked
                          }
                        });
                      }}
                    />
                  }
                  label="הצג הסבר פעם אחת בלבד"
                  sx={{ ml: 2, mt: 1 }}
                />
              )}
              
              {typeof editedStep.block === 'object' && editedStep.block.messaging?.send_explanation && (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={6}
                  label="הודעת חסימה"
                  value={typeof editedStep.block === 'object' ? 
                    editedStep.block.messaging?.message || '' : ''}
                  onChange={(e) => {
                    const blockConfig = typeof editedStep.block === 'object' ? 
                      editedStep.block : { enabled: true, messaging: { send_explanation: true, message: "" }, allow_unblock: false, unblock_keyword: "שחרר" };
                    handleChange('block', {
                      ...blockConfig,
                      messaging: {
                        ...blockConfig.messaging,
                        message: e.target.value
                      }
                    });
                  }}
                  size="small"
                  sx={{ mt: 1, mb: 2 }}
                />
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={typeof editedStep.block === 'object' ? 
                      editedStep.block.allow_unblock || false : false}
                    onChange={(e) => {
                      const blockConfig = typeof editedStep.block === 'object' ? 
                        editedStep.block : { enabled: true, messaging: { send_explanation: true, message: "" }, allow_unblock: false, unblock_keyword: "שחרר" };
                      handleChange('block', {
                        ...blockConfig,
                        allow_unblock: e.target.checked
                      });
                    }}
                  />
                }
                label="אפשר שחרור חסימה"
              />
              
              {typeof editedStep.block === 'object' && editedStep.block.allow_unblock && (
                <TextField
                  fullWidth
                  label="מילת מפתח לשחרור"
                  value={typeof editedStep.block === 'object' ? 
                    editedStep.block.unblock_keyword || 'שחרר' : 'שחרר'}
                  onChange={(e) => {
                    const blockConfig = typeof editedStep.block === 'object' ? 
                      editedStep.block : { enabled: true, messaging: { send_explanation: true, message: "" }, allow_unblock: false, unblock_keyword: "שחרר" };
                    handleChange('block', {
                      ...blockConfig,
                      unblock_keyword: e.target.value
                    });
                  }}
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          )}
        </Box>

                {/* Integration Settings - Only for Message Steps */}
        {editedStep.type === 'message' && (
          <Paper elevation={0} sx={{ p: 2.5, backgroundColor: 'grey.50', borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'grey.800', display: 'flex', alignItems: 'center', gap: 1 }}>
              🔗 אינטגרציות
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editedStep.integrations?.enabled || false}
                                      onChange={(e) => {
                    const config = editedStep.integrations || {} as any;
                    handleChange('integrations', {
                      ...config,
                      enabled: e.target.checked,
                      // Set all integrations to false by default when enabled
                      googleCalendar: config.googleCalendar || false,
                      googleSheets: config.googleSheets || false,
                      notifications: config.notifications || false,
                      reminders: config.reminders || false,
                      iPlan: config.iPlan || false
                    });
                  }}
                  />
                }
                label="🔧 הפעל אינטגרציות"
                sx={{ mb: 2 }}
              />
              <Tooltip title="אינטגרציות מאפשרות לשלוח מידע ליומן גוגל, גיליונות, התראות ותזכורות כאשר הודעה זו נשלחת">
                <IconButton size="small" sx={{ ml: 1, mb: 2 }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

          {editedStep.integrations?.enabled && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                {/* Google Calendar */}
                <Paper elevation={0} sx={{ p: 3, backgroundColor: '#e3f2fd', borderRadius: 2, border: '1px solid #2196f3' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editedStep.integrations?.googleCalendar || false}
                        onChange={(e) => {
                          const config = editedStep.integrations || { enabled: true } as any;
                          handleChange('integrations', {
                            ...config,
                            googleCalendar: e.target.checked
                          });
                        }}
                      />
                    }
                    label="🗓️ הוסף ליומן גוגל"
                    />
                    <Tooltip title="הוסף פגישה ליומן גוגל כאשר הודעה זו נשלחת">
                      <IconButton size="small" sx={{ ml: 1 }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    </Box>
                  
                  {editedStep.integrations?.googleCalendar && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {/* הגדרות בסיסיות */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      fullWidth
                          label="מזהה יומן Google Calendar"
                          value={editedStep.integration?.calendar?.calendarId || ''}
                          onChange={(e) => {
                            const integration = editedStep.integration || {};
                            handleChange('integration', {
                              ...integration,
                              calendar: {
                                ...integration.calendar,
                                enabled: true,
                                calendarId: e.target.value
                              }
                            });
                          }}
                          helperText="מזהה היומן (לרוב כתובת אימייל או 'primary' עבור היומן הראשי)"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        
                        <TextField
                          fullWidth
                          label="נתיב קובץ Credentials"
                          value={editedStep.integration?.calendar?.credentialsPath || ''}
                          onChange={(e) => {
                            const integration = editedStep.integration || {};
                            handleChange('integration', {
                              ...integration,
                              calendar: {
                                ...integration.calendar,
                                enabled: true,
                                credentialsPath: e.target.value
                              }
                            });
                          }}
                          helperText="נתיב לקובץ ה-credentials.json של Google Calendar API"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        
                        <TextField
                          fullWidth
                          label="כותרת האירוע"
                      value={editedStep.integration?.calendar?.title || ''}
                      onChange={(e) => {
                        const integration = editedStep.integration || {};
                        handleChange('integration', {
                          ...integration,
                          calendar: {
                            ...integration.calendar,
                            enabled: true,
                            title: e.target.value
                          }
                        });
                      }}
                          helperText={`כותרת שתופיע ביומן. ניתן להשתמש במשתנים: ${getAllAvailableVariables().map(v => `{${v}}`).join(', ')}`}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                        
                        <TextField
                          fullWidth
                          multiline
                          minRows={3}
                          maxRows={6}
                          label="תיאור האירוע"
                          value={editedStep.integration?.calendar?.description || ''}
                          onChange={(e) => {
                            const integration = editedStep.integration || {};
                            handleChange('integration', {
                              ...integration,
                              calendar: {
                                ...integration.calendar,
                                enabled: true,
                                description: e.target.value
                              }
                            });
                          }}
                          helperText={`תיאור מפורט של האירוע. ניתן להשתמש במשתנים: ${getAllAvailableVariables().map(v => `{${v}}`).join(', ')}`}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        
                        <TextField
                          fullWidth
                          label="מספר משתתפים מקסימלי"
                          type="number"
                          value={editedStep.integration?.calendar?.maxAttendees || 50}
                          onChange={(e) => {
                            const integration = editedStep.integration || {};
                            handleChange('integration', {
                              ...integration,
                              calendar: {
                                ...integration.calendar,
                                enabled: true,
                                maxAttendees: parseInt(e.target.value) || 50
                              }
                            });
                          }}
                          helperText="מספר מקסימלי של משתתפים באירוע (ברירת מחדל: 50)"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Box>
                      
                      {/* הגדרות מתקדמות */}
                      <Box sx={{ 
                        backgroundColor: 'white', 
                        p: 2, 
                        borderRadius: 2, 
                        border: '1px solid #e0e0e0' 
                      }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          ⚙️ הגדרות מתקדמות
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={editedStep.integration?.calendar?.preventDuplicates || false}
                                onChange={(e) => {
                                  const integration = editedStep.integration || {};
                                  handleChange('integration', {
                                    ...integration,
                                    calendar: {
                                      ...integration.calendar,
                                      enabled: true,
                                      preventDuplicates: e.target.checked
                                    }
                                  });
                                }}
                              />
                            }
                            label="מנע יצירת אירועים כפולים"
                          />
                          
                          <FormControlLabel
                            control={
                              <Switch
                                checked={editedStep.integration?.calendar?.sendNotifications || true}
                                onChange={(e) => {
                                  const integration = editedStep.integration || {};
                                  handleChange('integration', {
                                    ...integration,
                                    calendar: {
                                      ...integration.calendar,
                                      enabled: true,
                                      sendNotifications: e.target.checked
                                    }
                                  });
                                }}
                              />
                            }
                            label="שלח התראות ליוצר האירוע"
                          />
                          
                          <FormControlLabel
                            control={
                              <Switch
                                checked={editedStep.integration?.calendar?.useQuickAdd || false}
                                onChange={(e) => {
                                  const integration = editedStep.integration || {};
                                  handleChange('integration', {
                                    ...integration,
                                    calendar: {
                                      ...integration.calendar,
                                      enabled: true,
                                      useQuickAdd: e.target.checked
                                    }
                                  });
                                }}
                              />
                            }
                            label="השתמש ב-Quick Add (יצירה מהירה)"
                          />
                          
                          <TextField
                            fullWidth
                            label="צבע האירוע (מספר 1-11)"
                            type="number"
                            inputProps={{ min: 1, max: 11 }}
                            value={editedStep.integration?.calendar?.colorId || 1}
                            onChange={(e) => {
                              const integration = editedStep.integration || {};
                              handleChange('integration', {
                                ...integration,
                                calendar: {
                                  ...integration.calendar,
                                  enabled: true,
                                  colorId: parseInt(e.target.value) || 1
                                }
                              });
                            }}
                            helperText="מספר הצבע של האירוע ביומן (1=כחול, 2=ירוק, 3=סגול, וכו')"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Paper>
                
                {/* Google Sheets */}
                <Paper elevation={0} sx={{ p: 3, backgroundColor: '#f3e5f5', borderRadius: 2, border: '1px solid #9c27b0' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editedStep.integrations?.googleSheets || false}
                        onChange={(e) => {
                          const config = editedStep.integrations || { enabled: true } as any;
                          handleChange('integrations', {
                            ...config,
                            googleSheets: e.target.checked
                          });
                        }}
                      />
                    }
                    label="📊 הוסף לגוגל שיטס"
                    />
                    <Tooltip title="הוסף נתונים לגיליון גוגל כאשר הודעה זו נשלחת">
                      <IconButton size="small" sx={{ ml: 1 }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    </Box>
                  
                  {editedStep.integrations?.googleSheets && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {/* הגדרות בסיסיות */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      fullWidth
                          label="מזהה גיליון Google Sheets"
                          value={editedStep.integration?.sheets?.sheetId || ''}
                      onChange={(e) => {
                        const integration = editedStep.integration || {};
                        handleChange('integration', {
                          ...integration,
                          sheets: {
                            ...integration.sheets,
                            enabled: true,
                                sheetId: e.target.value
                          }
                        });
                      }}
                          helperText="מזהה הגיליון שניתן לקבל מה-URL של הגיליון"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                        
                        <TextField
                          fullWidth
                          label="נתיב קובץ Credentials"
                          value={editedStep.integration?.sheets?.credentialsPath || ''}
                          onChange={(e) => {
                            const integration = editedStep.integration || {};
                            handleChange('integration', {
                              ...integration,
                              sheets: {
                                ...integration.sheets,
                                enabled: true,
                                credentialsPath: e.target.value
                              }
                            });
                          }}
                          helperText="נתיב לקובץ ה-credentials.json של Google Sheets API"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        
                        <TextField
                          fullWidth
                          label="שם הגיליון (Worksheet)"
                          value={editedStep.integration?.sheets?.worksheetName || 'Sheet1'}
                          onChange={(e) => {
                            const integration = editedStep.integration || {};
                            handleChange('integration', {
                              ...integration,
                              sheets: {
                                ...integration.sheets,
                                enabled: true,
                                worksheetName: e.target.value
                              }
                            });
                          }}
                          helperText="שם הגיליון בתוך הקובץ (ברירת מחדל: Sheet1)"
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Box>
                      
                      {/* הגדרות עמודות */}
                      <Box sx={{ 
                        backgroundColor: 'white', 
                        p: 2, 
                        borderRadius: 2, 
                        border: '1px solid #e0e0e0' 
                      }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          📋 הגדרת עמודות
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                          הגדר איזה ערך יירשם בכל עמודה. העמודות מתחילות מ-A ועוברות ל-B, C וכו'. 
                          ניתן להשתמש במשתנים: {getAllAvailableVariables().map(v => `{${v}}`).join(', ')}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {(() => {
                            const columns = editedStep.integration?.sheets?.columns || [];
                            
                            // Function to generate column letters (A, B, C... Z, AA, AB, AC...)
                            const getColumnLetter = (index) => {
                              let result = '';
                              while (index >= 0) {
                                result = String.fromCharCode(65 + (index % 26)) + result;
                                index = Math.floor(index / 26) - 1;
                              }
                              return result;
                            };
                            
                            // Always show at least 1 column, or as many as we have
                            const maxColumns = Math.max(1, columns.length);
                            const columnElements = [];
                            
                            for (let index = 0; index < maxColumns; index++) {
                              const letter = getColumnLetter(index);
                              columnElements.push(
                              <Box key={letter} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{
                                  minWidth: 40,
                                  height: 40,
                                  borderRadius: 1,
                                  backgroundColor: '#9c27b0',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold'
                                }}>
                                  {letter}
                                </Box>
                                <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
                                  <TextField
                                    fullWidth
                                    label={`עמודה ${letter}`}
                                    value={typeof columns[index] === 'object' ? columns[index]?.value || '' : columns[index] || ''}
                                    onChange={(e) => {
                                      const integration = editedStep.integration || {};
                                      const currentColumns = integration.sheets?.columns || [];
                                      const newColumns = [...currentColumns];
                                      
                                      // Handle existing object structure or create new one
                                      const currentColumn = newColumns[index];
                                      if (typeof currentColumn === 'object') {
                                        newColumns[index] = { ...currentColumn, value: e.target.value };
                                      } else {
                                        newColumns[index] = { value: e.target.value, backgroundColor: '#ffffff' };
                                      }
                                      
                                      handleChange('integration', {
                                        ...integration,
                                        sheets: {
                                          ...integration.sheets,
                                          enabled: true,
                                          columns: newColumns
                                        }
                                      });
                                    }}
                                    placeholder={`ערך לעמודה ${letter}`}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  />
                                  <Box
                                    sx={{
                                      width: 48,
                                      height: 48,
                                      border: '2px solid #ddd',
                                      borderRadius: 1,
                                      backgroundColor: typeof columns[index] === 'object' ? columns[index]?.backgroundColor || '#ffffff' : '#ffffff',
                                      cursor: 'pointer',
                                      position: 'relative',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      '&:hover': {
                                        borderColor: '#999'
                                      }
                                    }}
                                  >
                                    <input
                                      type="color"
                                      value={typeof columns[index] === 'object' ? columns[index]?.backgroundColor || '#ffffff' : '#ffffff'}
                                      onChange={(e) => {
                                        const integration = editedStep.integration || {};
                                        const currentColumns = integration.sheets?.columns || [];
                                        const newColumns = [...currentColumns];
                                        
                                        // Handle existing object structure or create new one
                                        const currentColumn = newColumns[index];
                                        if (typeof currentColumn === 'object') {
                                          newColumns[index] = { ...currentColumn, backgroundColor: e.target.value };
                                        } else {
                                          newColumns[index] = { value: currentColumn || '', backgroundColor: e.target.value };
                                        }
                                        
                                        handleChange('integration', {
                                          ...integration,
                                          sheets: {
                                            ...integration.sheets,
                                            enabled: true,
                                            columns: newColumns
                                          }
                                        });
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        opacity: 0,
                                        cursor: 'pointer'
                                      }}
                                    />
                                    🎨
                                  </Box>
                                </Box>
                                {index > 0 && (
                                  <IconButton
                                    onClick={() => {
                                      const integration = editedStep.integration || {};
                                      const currentColumns = integration.sheets?.columns || [];
                                      const newColumns = currentColumns.filter((_, i) => i !== index);
                                      
                                      handleChange('integration', {
                                        ...integration,
                                        sheets: {
                                          ...integration.sheets,
                                          enabled: true,
                                          columns: newColumns
                                        }
                                      });
                                    }}
                                    size="small"
                                    sx={{ color: 'error.main' }}
                                  >
                                    ❌
                                  </IconButton>
                                )}
                              </Box>
                              );
                            }
                            
                            return columnElements;
                          })()}
                          
                          {/* כפתור הוספת עמודה */}
                          <Button
                            startIcon={<AddIcon />}
                            onClick={() => {
                              const integration = editedStep.integration || {};
                              const currentColumns = integration.sheets?.columns || [];
                              const newColumns = [...currentColumns, '']; // הוסף עמודה ריקה
                              
                              handleChange('integration', {
                                ...integration,
                                sheets: {
                                  ...integration.sheets,
                                  enabled: true,
                                  columns: newColumns
                                }
                              });
                            }}
                            variant="outlined"
                            size="small"
                            sx={{ alignSelf: 'flex-start', mt: 1 }}
                          >
                            הוסף עמודה
                          </Button>
                        </Box>
                      </Box>
                      
                      {/* הגדרות נוספות */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={editedStep.integration?.sheets?.insertToNextRow || true}
                              onChange={(e) => {
                                const integration = editedStep.integration || {};
                                handleChange('integration', {
                                  ...integration,
                                  sheets: {
                                    ...integration.sheets,
                                    enabled: true,
                                    insertToNextRow: e.target.checked
                                  }
                                });
                              }}
                            />
                          }
                          label="הכנס לשורה הבאה הריקה"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={editedStep.integration?.sheets?.preventDuplicates || false}
                              onChange={(e) => {
                                const integration = editedStep.integration || {};
                                handleChange('integration', {
                                  ...integration,
                                  sheets: {
                                    ...integration.sheets,
                                    enabled: true,
                                    preventDuplicates: e.target.checked
                                  }
                                });
                              }}
                            />
                          }
                          label="מנע כפילויות"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={editedStep.integration?.sheets?.updateExistingRows || false}
                              onChange={(e) => {
                                const integration = editedStep.integration || {};
                                handleChange('integration', {
                                  ...integration,
                                  sheets: {
                                    ...integration.sheets,
                                    enabled: true,
                                    updateExistingRows: e.target.checked
                                  }
                                });
                              }}
                            />
                          }
                          label="עדכן שורות קיימות"
                        />
                        
                        {/* הגדרות סינון ומיון */}
                        <Box sx={{ 
                          backgroundColor: '#f5f5f5', 
                          p: 2, 
                          borderRadius: 2, 
                          border: '1px solid #ddd',
                          mt: 2
                        }}>
                          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                            🔀 הגדרות סינון ומיון
                          </Typography>
                          
                          <FormControlLabel
                            control={
                              <Switch
                                checked={editedStep.integration?.sheets?.enableSorting || false}
                                onChange={(e) => {
                                  const integration = editedStep.integration || {};
                                  handleChange('integration', {
                                    ...integration,
                                    sheets: {
                                      ...integration.sheets,
                                      enabled: true,
                                      enableSorting: e.target.checked
                                    }
                                  });
                                }}
                              />
                            }
                            label="אפשר סינון ומיון אוטומטי"
                            sx={{ mb: 2 }}
                          />
                          
                          {editedStep.integration?.sheets?.enableSorting && (
                            <Box sx={{ ml: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ minWidth: 120 }}>
                                  עמודה למיון:
                                </Typography>
                                <TextField
                                  size="small"
                                  type="number"
                                  label="מספר עמודה (1=A, 2=B...)"
                                  value={editedStep.integration?.sheets?.sortColumn || 1}
                                  onChange={(e) => {
                                    const integration = editedStep.integration || {};
                                    handleChange('integration', {
                                      ...integration,
                                      sheets: {
                                        ...integration.sheets,
                                        enabled: true,
                                        sortColumn: parseInt(e.target.value) || 1
                                      }
                                    });
                                  }}
                                  sx={{ flexGrow: 1 }}
                                />
                              </Box>
                              
                              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ minWidth: 120 }}>
                                  סוג המיון:
                                </Typography>
                                <FormControl size="small" sx={{ flexGrow: 1 }}>
                                  <InputLabel>בחר סוג מיון</InputLabel>
                                  <Select
                                    value={editedStep.integration?.sheets?.sortType || 'date'}
                                    label="בחר סוג מיון"
                                    onChange={(e) => {
                                      const integration = editedStep.integration || {};
                                      handleChange('integration', {
                                        ...integration,
                                        sheets: {
                                          ...integration.sheets,
                                          enabled: true,
                                          sortType: e.target.value
                                        }
                                      });
                                    }}
                                  >
                                    <MenuItem value="date">תאריך</MenuItem>
                                    <MenuItem value="time">שעה</MenuItem>
                                    <MenuItem value="datetime">תאריך ושעה</MenuItem>
                                    <MenuItem value="text">טקסט (אלפביתי)</MenuItem>
                                    <MenuItem value="number">מספר</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>
                              
                              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ minWidth: 120 }}>
                                  כיוון המיון:
                                </Typography>
                                <FormControl size="small" sx={{ flexGrow: 1 }}>
                                  <InputLabel>בחר כיוון</InputLabel>
                                  <Select
                                    value={editedStep.integration?.sheets?.sortDirection || 'asc'}
                                    label="בחר כיוון"
                                    onChange={(e) => {
                                      const integration = editedStep.integration || {};
                                      handleChange('integration', {
                                        ...integration,
                                        sheets: {
                                          ...integration.sheets,
                                          enabled: true,
                                          sortDirection: e.target.value
                                        }
                                      });
                                    }}
                                  >
                                    <MenuItem value="asc">עולה (א-ת, 1-9, חדש-ישן)</MenuItem>
                                    <MenuItem value="desc">יורד (ת-א, 9-1, ישן-חדש)</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>
                              
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                💡 הנתונים יוכנסו במקום הנכון על פי הסינון שבחרת. 
                                למשל, אם בחרת מיון לפי תאריך - פגישות חדשות יוכנסו בסדר כרונולוגי.
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Paper>
                
                {/* Notifications */}
                <Paper elevation={0} sx={{ p: 2, backgroundColor: '#fff3e0', borderRadius: 2, border: '1px solid #ff9800' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editedStep.integrations?.notifications || false}
                        onChange={(e) => {
                          const config = editedStep.integrations || { enabled: true } as any;
                          handleChange('integrations', {
                            ...config,
                            notifications: e.target.checked
                          });
                        }}
                      />
                    }
                    label="📢 שלח התראות"
                    />
                    <Tooltip title="שלח התראה למספרי טלפון/קבוצות מוגדרות כאשר הודעה זו נשלחת">
                      <IconButton size="small" sx={{ ml: 1 }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {editedStep.integrations?.notifications && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        fullWidth
                        label="מספרי טלפון / קבוצות לשליחה"
                        value={editedStep.integration?.notifications?.recipients || ''}
                        onChange={(e) => {
                          const integration = editedStep.integration || {};
                          handleChange('integration', {
                            ...integration,
                            notifications: {
                              ...integration.notifications,
                              enabled: true,
                              recipients: e.target.value
                            }
                          });
                        }}
                        helperText="הזן מספרי טלפון או מזהי קבוצות מופרדים בפסיקים (לדוגמה: 972501234567, 972509876543-group)"
                        multiline
                        minRows={2}
                        maxRows={5}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        maxRows={8}
                        label="הודעת התראה"
                        value={editedStep.integration?.notifications?.message || ''}
                        onChange={(e) => {
                          const integration = editedStep.integration || {};
                          handleChange('integration', {
                            ...integration,
                            notifications: {
                              ...integration.notifications,
                              enabled: true,
                              message: e.target.value
                            }
                          });
                        }}
                        helperText={`הודעה שתישלח כהתראה. ניתן להשתמש במשתנים: ${getAllAvailableVariables().map(v => `{${v}}`).join(', ')}`}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Box>
                  )}
                </Paper>
                
                {/* Reminders - Advanced Configuration */}
                <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f3e5f5', borderRadius: 2, border: '1px solid #9c27b0' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                          checked={remindersConfig.enabled || false}
                          onChange={(e) => handleToggleReminders(e.target.checked)}
                      />
                    }
                    label="⏰ הפעל תזכורות"
                    />
                    <Tooltip title="הגדר תזכורות שיישלחו לפני הפגישה">
                      <IconButton size="small" sx={{ ml: 1 }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  
                  {remindersConfig.enabled && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#9c27b0' }}>
                          הגדרות תזכורות
                        </Typography>
                      <Button
                        size="small"
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={handleAddReminder}
                          sx={{ borderRadius: 2, bgcolor: '#9c27b0' }}
                      >
                          הוסף תזכורת
                      </Button>
                      </Box>
                      
                      {remindersConfig.reminders.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                          לא הוגדרו תזכורות. לחץ על "הוסף תזכורת" כדי להתחיל
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {remindersConfig.reminders.map((reminder, index) => (
                            <Paper key={reminder.id} elevation={1} sx={{ p: 2, backgroundColor: 'white', borderRadius: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>
                                  תזכורת #{index + 1}
                                </Typography>
                                <TextField
                                  size="small"
                                  type="number"
                                  label="שעות לפני"
                                  value={reminder.hours}
                                  onChange={(e) => handleUpdateReminder(reminder.id, 'hours', parseInt(e.target.value))}
                                  sx={{ width: 120 }}
                                  inputProps={{ min: 1, max: 168 }}
                                />
                                <IconButton 
                                  color="error" 
                                  size="small"
                                  onClick={() => handleRemoveReminder(reminder.id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                              <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={6}
                                label="הודעת תזכורת"
                                value={reminder.message}
                                onChange={(e) => handleUpdateReminder(reminder.id, 'message', e.target.value)}
                                helperText={`ניתן להשתמש במשתנים: {hours}, ${getAllAvailableVariables().map(v => `{${v}}`).join(', ')}`}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                              />
                            </Paper>
                          ))}
                    </Box>
                  )}
                </Box>
                  )}
                </Paper>
                
                {/* iPlan */}
                <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e8f5e8', borderRadius: 2, border: '1px solid #4caf50' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editedStep.integrations?.iPlan || false}
                        onChange={(e) => {
                          const config = editedStep.integrations || { enabled: true } as any;
                          handleChange('integrations', {
                            ...config,
                            iPlan: e.target.checked
                          });
                        }}
                      />
                    }
                    label="📋 סנכרן עם iPlan"
                  />
                    <Tooltip title="סנכרן נתונים עם מערכת iPlan">
                      <IconButton size="small" sx={{ ml: 1 }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    </Box>
                  {editedStep.integrations?.iPlan && (
                    <TextField
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={6}
                      label="הודעה ל-iPlan"
                      value={editedStep.integration?.iplan?.message || ''}
                      onChange={(e) => {
                        const integration = editedStep.integration || {};
                        handleChange('integration', {
                          ...integration,
                          iplan: {
                            ...integration.iplan,
                            enabled: true,
                            message: e.target.value
                          }
                        });
                      }}
                      helperText={`מידע שיישלח ל-iPlan. ניתן להשתמש במשתנים: ${getAllAvailableVariables().map(v => `{${v}}`).join(', ')}`}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}
                </Paper>
                </Box>
            )}
            </Paper>
          )}

        {/* Conditions Editor */}
        {renderConditionsEditor()}

        {/* Retry Configuration */}
        {renderRetryConfigEditor()}



        {/* Action Buttons */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          justifyContent: 'flex-end', 
          mt: 4,
          pt: 3,
          borderTop: '1px solid',
          borderColor: 'grey.200'
        }}>
          <Button 
            onClick={onClose} 
            variant="outlined"
            sx={{ 
              borderRadius: 2,
              px: 3,
              py: 1,
              fontWeight: 500
            }}
          >
            ביטול
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            color="primary"
            sx={{ 
              borderRadius: 2,
              px: 3,
              py: 1,
              fontWeight: 600,
              boxShadow: 2
            }}
          >
            💾 שמור שינויים
          </Button>
        </Box>
      </Stack>
      </Box>

      {/* Dialog for keyword editing */}
      <Dialog open={editingKeywords.open} onClose={() => setEditingKeywords({...editingKeywords, open: false})}>
        <DialogTitle>עריכת מילות מפתח</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            עריכת מילות מפתח עבור: {editingKeywords.value}
          </Typography>
          {editingKeywords.keywords.map((keyword, index) => (
            <Box key={index} sx={{ display: 'flex', mb: 1, gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={keyword}
                onChange={(e) => handleKeywordEdit(index, e.target.value)}
                placeholder={`מילת מפתח ${index+1}`}
              />
              <IconButton color="error" onClick={() => handleRemoveKeyword(index)}>
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddKeyword}
            sx={{ mt: 1 }}
            variant="outlined"
            fullWidth
          >
            הוסף מילת מפתח
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingKeywords({...editingKeywords, open: false})}>ביטול</Button>
          <Button onClick={saveKeywordChanges} variant="contained" color="primary">
            שמור
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for integration message editing */}
      <Dialog 
        open={integrationMessageDialog.open} 
        onClose={() => setIntegrationMessageDialog({...integrationMessageDialog, open: false})}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{integrationMessageDialog.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            ערוך את ההודעה שתישלח עבור אינטגרציה זו. ניתן להשתמש במשתנים מהרשימה למטה.
          </Typography>
          
          {/* הצגת משתנים זמינים בהקשר הנוכחי */}
          <VariableDisplay steps={getAllSteps().reduce((acc, s) => ({ ...acc, [s.id]: s }), {})} currentStepId={stepId} />
          
          <TextField
            fullWidth
            multiline
            minRows={6}
            maxRows={15}
            value={integrationMessageDialog.message}
            onChange={(e) => setIntegrationMessageDialog({
              ...integrationMessageDialog,
              message: e.target.value
            })}
            placeholder="הכנס את ההודעה כאן..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIntegrationMessageDialog({...integrationMessageDialog, open: false})}>
            ביטול
          </Button>
          <Button onClick={saveIntegrationMessage} variant="contained" color="primary">
            שמור
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default StepEditor; 