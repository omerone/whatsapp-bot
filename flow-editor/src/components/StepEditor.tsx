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
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import { Step, StepType, StepData, ValidationRule, IntegrationConfig } from '../types/flow';
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
  const { getStep, updateStep, deleteStep, getAllSteps, updateStepId } = useFlow();
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
  const [newOption, setNewOption] = useState({ key: '', value: '' });
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
      
      return updated;
    });
  };

  const handleDelete = () => {
    deleteStep(stepId);
    onClose();
  };

  const handleAddOption = () => {
    if (newOption.key && newOption.value) {
      // עדכון branches בלבד - לא צריך יותר options
      const updatedBranches = {
        ...(step.branches || {}),
        [newOption.key]: newOption.value,
      };
      handleChange('branches', updatedBranches);
      
      // ניקוי השדות
      setNewOption({ key: '', value: '' });
      
      console.log('Option added to branches:', {
        key: newOption.key, 
        value: newOption.value, 
        branches: updatedBranches
      });
    }
  };

  const handleRemoveOption = (key: string) => {
    // הסרה מbranches בלבד
    if (step.branches) {
      const updatedBranches = { ...step.branches };
      delete updatedBranches[key];
      handleChange('branches', updatedBranches);
      
      console.log('Option removed from branches:', { key });
    }
  };

  const handleValidationChange = (field: keyof ValidationRule, value: any) => {
    setEditedStep((prev) => ({
      ...prev,
      validation: {
        ...prev.validation,
        [field]: value,
      },
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
    
    // הסר את options אם קיים - אנחנו משתמשים רק ב-branches עכשיו
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
    
    if (filteredKeywords.length > 0) {
      const newKeyString = joinKeywords(filteredKeywords);
      const originalKey = editingKeywords.originalKey;
      const targetValue = editingKeywords.value;

      // עדכן branches בלבד
      if (editedStep.branches) {
        const updatedBranches = { ...editedStep.branches };
        delete updatedBranches[originalKey];
        updatedBranches[newKeyString] = targetValue;
        handleChange('branches', updatedBranches);
      }
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
          <Tooltip title="הצעד שיבוצע לאחר הצעד הנוכחי. עבור צעדי אפשרויות, הקישור נקבע באפשרויות עצמן">
            <IconButton size="small" sx={{ ml: 1 }}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        </Paper>

        {/* Message Content */}
        <Paper elevation={0} sx={{ p: 2.5, backgroundColor: 'grey.50', borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'grey.800', display: 'flex', alignItems: 'center', gap: 1 }}>
            💬 תוכן ההודעה
          </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <TextField
            fullWidth
            label="כותרת הודעה"
            value={editedStep.messageHeader || ''}
            onChange={(e) => handleChange('messageHeader', e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Tooltip title="כותרת שתוצג בחלק העליון של ההודעה. אופציונלי">
            <IconButton size="small" sx={{ ml: 1, mb: 2 }}>
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
            rows={4}
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

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <TextField
            fullWidth
            label="הודעת תחתית"
            value={editedStep.footerMessage || ''}
            onChange={(e) => handleChange('footerMessage', e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Tooltip title="הודעה שתוצג בתחתית. מתאים להוראות או מידע נוסף">
            <IconButton size="small" sx={{ ml: 1, mb: 2 }}>
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

        <Divider sx={{ my: 2 }} />

        {/* Options */}
        {editedStep.type === 'options' && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1">אפשרויות</Typography>
              <Tooltip title="ניתן להגדיר מספר מילות מפתח לכל אפשרות על ידי הפרדה עם || לדוגמה: פגישה || לקבוע פגישה || קביעת פגישה">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ mb: 2 }}>
              <List>
                {Object.entries(editedStep.branches || {})
                  .filter(([key]) => !key.includes('חזור')) // הסתרת אפשרויות חזור מהתצוגה
                  .map(([key, value]) => (
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
                      <IconButton edge="end" onClick={() => handleRemoveOption(key)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
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
                  rows={3}
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

        {/* Validation */}
        {editedStep.type === 'question' && (
          <>
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
                              }
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
                              editedStep.resolution === 'days' ? 'ימים' : 'שעות'} להצגה`}
                value={editedStep.limit || ''}
                onChange={(e) => handleChange('limit', parseInt(e.target.value))}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                helperText={`מספר ${editedStep.resolution === 'months' ? 'החודשים' : 
                                    editedStep.resolution === 'weeks' ? 'השבועות' : 
                                    editedStep.resolution === 'days' ? 'הימים' : 'השעות'} שיוצגו לקליינט לבחירה`}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={editedStep.startFromToday || false}
                    onChange={(e) => handleChange('startFromToday', e.target.checked)}
                  />
                }
                label="התחל מהיום"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="הודעת אי-התאמה"
                value={editedStep.noMatchMessage || ''}
                onChange={(e) => handleChange('noMatchMessage', e.target.value)}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                helperText="הודעה שתשלח אם הקליינט יכתוב משהו שלא מתאים לתאריכים"
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
                
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddOption}
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 2, borderRadius: 2 }}
                >
                  הוסף ניווט נוסף
                </Button>
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
                <TextField
                  fullWidth
                  multiline
                  rows={2}
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
                <TextField
                  fullWidth
                  multiline
                  rows={2}
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
                      const config = editedStep.integrations || {};
                      handleChange('integrations', {
                        ...config,
                        enabled: e.target.checked
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
                <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e3f2fd', borderRadius: 2, border: '1px solid #2196f3' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editedStep.integrations?.googleCalendar || false}
                          onChange={(e) => {
                            const config = editedStep.integrations || { enabled: true };
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
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="הודעה ליומן גוגל"
                      value={editedStep.integration?.calendar?.message || ''}
                      onChange={(e) => {
                        const integration = editedStep.integration || {};
                        handleChange('integration', {
                          ...integration,
                          calendar: {
                            ...integration.calendar,
                            enabled: true,
                            message: e.target.value
                          }
                        });
                      }}
                      helperText="הודעה שתוצג בפגישה ביומן. ניתן להשתמש במשתנים: {name}, {meeting_date}, {meeting_time}"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}
                </Paper>

                {/* Google Sheets */}
                <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f3e5f5', borderRadius: 2, border: '1px solid #9c27b0' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editedStep.integrations?.googleSheets || false}
                          onChange={(e) => {
                            const config = editedStep.integrations || { enabled: true };
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
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="הודעה לגוגל שיטס"
                      value={editedStep.integration?.sheets?.message || ''}
                      onChange={(e) => {
                        const integration = editedStep.integration || {};
                        handleChange('integration', {
                          ...integration,
                          sheets: {
                            ...integration.sheets,
                            enabled: true,
                            message: e.target.value
                          }
                        });
                      }}
                      helperText="מידע שיירשם בגיליון. ניתן להשתמש במשתנים: {name}, {meeting_date}, {meeting_time}"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
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
                            const config = editedStep.integrations || { enabled: true };
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
                        helperText="הזן מספרי טלפון או מזהי קבוצות מופרדים בפסיקים (לדוגמה: 972501234567, 972509876543@g.us)"
                        multiline
                        rows={2}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
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
                        helperText="הודעה שתישלח כהתראה. ניתן להשתמש במשתנים: {name}, {meeting_date}, {meeting_time}"
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
                                rows={2}
                                label="הודעת תזכורת"
                                value={reminder.message}
                                onChange={(e) => handleUpdateReminder(reminder.id, 'message', e.target.value)}
                                helperText="ניתן להשתמש במשתנים: {hours}, {meeting_date}, {meeting_time}, {name}"
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
                            const config = editedStep.integrations || { enabled: true };
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
                      rows={2}
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
                      helperText="מידע שיישלח ל-iPlan. ניתן להשתמש במשתנים: {name}, {meeting_date}, {meeting_time}"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                  )}
                </Paper>
              </Box>
            )}
          </Paper>
        )}

        {/* Step Status Section */}
        <Paper elevation={1} sx={{ p: 3, mb: 3, backgroundColor: '#f8f9fa' }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            ⚙️ הגדרות שלב
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={editedStep.enabled !== false}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
            }
            label="🟢 השלב פעיל (אם לא מסומן, השלב יהיה מושבת)"
            sx={{ mb: 2, display: 'block' }}
          />
          
          {editedStep.enabled === false && (
            <TextField
              fullWidth
              label="🔄 מעבר לשלב (אם השלב מושבת)"
              value={editedStep.skipIfDisabled || ''}
              onChange={(e) => handleChange('skipIfDisabled', e.target.value)}
              placeholder="הכנס מספר שלב למעבר (לדוגמה: 5)"
              helperText="כאשר השלב מושבת, המערכת תעבור לשלב שצוין כאן"
              sx={{ mb: 2 }}
            />
          )}
        </Paper>

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
            rows={6}
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