import React, { useState } from 'react';
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
      // עדכון האפשרויות
      const updatedOptions = {
        ...(step.options || {}),
        [newOption.key]: newOption.value,
      };
      handleChange('options', updatedOptions);
      
      // עדכון branches כדי שהקווים יופיעו בדיאגרמה
      const updatedBranches = {
        ...(step.branches || {}),
        [newOption.key]: newOption.value,
      };
      handleChange('branches', updatedBranches);
      
      // ניקוי השדות
      setNewOption({ key: '', value: '' });
      
      console.log('Option added with branches:', {
        key: newOption.key, 
        value: newOption.value, 
        branches: updatedBranches
      });
    }
  };

  const handleRemoveOption = (key: string) => {
    // הסרה מאפשרויות
    const updatedOptions = { ...step.options };
    delete updatedOptions[key];
    handleChange('options', updatedOptions);
    
    // הסרה גם מbranches כדי להסיר את הקו מהדיאגרמה
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
    // סנכרון options עם branches לפני השמירה
    let stepToUpdate = { ...editedStep };
    
    if (stepToUpdate.type === 'options' && stepToUpdate.options) {
      // העתקת כל הoptions לbranches כדי שהקווים יוצגו בדיאגרמה
      stepToUpdate.branches = { ...stepToUpdate.options };
      console.log('Synced options to branches:', stepToUpdate.branches);
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
      calendar: 'עריכת הודעת יומן גוגל',
      sheets: 'עריכת הודעת גוגל שיטס', 
      notifications: 'עריכת הודעת התראות',
      reminders: 'עריכת הודעת תזכורות',
      iplan: 'עריכת הודעת iPlan'
    };

    // TODO: קבל את ההודעה הנוכחית מההגדרות הגלובליות
    const currentMessage = ''; // יש לטעון מההגדרות
    
    setIntegrationMessageDialog({
      open: true,
      type,
      title: titles[type],
      message: currentMessage,
    });
  };

  const saveIntegrationMessage = () => {
    // TODO: שמור את ההודעה להגדרות הגלובליות
    console.log('Saving integration message:', integrationMessageDialog);
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

      // עדכן options
      if (editedStep.options) {
        const updatedOptions = { ...editedStep.options };
        delete updatedOptions[originalKey];
        updatedOptions[newKeyString] = targetValue;
        handleChange('options', updatedOptions);
      }

      // עדכן branches
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

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        width: 500,
        maxHeight: '90vh',
        overflow: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">עריכת צעד</Typography>
        <IconButton onClick={handleDelete} color="error">
          <DeleteIcon />
        </IconButton>
      </Box>

      <Stack spacing={2}>
        {/* Common Fields */}
        <Typography variant="subtitle1" sx={{ mb: 1 }}>מידע בסיסי</Typography>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>סוג צעד</InputLabel>
          <Select
            value={editedStep.type || ''}
            label="סוג צעד"
            onChange={(e) => handleChange('type', e.target.value as StepType)}
          >
            <MenuItem value="message">הודעה</MenuItem>
            <MenuItem value="question">שאלה</MenuItem>
            <MenuItem value="options">אפשרויות</MenuItem>
            <MenuItem value="date">תאריך</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="מזהה"
          value={editedStep.id || ''}
          onChange={(e) => handleChange('id', e.target.value)}
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>צעד הבא</InputLabel>
          <Select
            value={editedStep.next || ''}
            label="צעד הבא"
            onChange={(e) => handleChange('next', e.target.value as string)}
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

        <Divider sx={{ my: 2 }} />

        {/* Message Content */}
        <Typography variant="subtitle1" sx={{ mb: 1 }}>תוכן ההודעה</Typography>
        <TextField
          fullWidth
          label="כותרת הודעה"
          value={editedStep.messageHeader || ''}
          onChange={(e) => handleChange('messageHeader', e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="הודעה"
          value={editedStep.message || ''}
          onChange={(e) => handleChange('message', e.target.value)}
          multiline
          rows={4}
          sx={{ mb: 2 }}
        />

        {/* Variable Display */}
        <VariableDisplay 
          steps={Object.fromEntries(allSteps.map(s => [s.id, s]))} 
          currentStepId={stepId} 
        />

        <TextField
          fullWidth
          label="הודעת תחתית"
          value={editedStep.footerMessage || ''}
          onChange={(e) => handleChange('footerMessage', e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="קובץ הודעה"
          value={editedStep.messageFile || ''}
          onChange={(e) => handleChange('messageFile', e.target.value)}
          sx={{ mb: 2 }}
        />

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
                {Object.entries(editedStep.options || {}).map(([key, value]) => (
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
            <Typography variant="subtitle1" sx={{ mb: 1 }}>הגדרות תאריך</Typography>
            <TextField
              fullWidth
              type="number"
              label="מגבלת זמן"
              value={editedStep.limit || ''}
              onChange={(e) => handleChange('limit', parseInt(e.target.value))}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>רזולוציה</InputLabel>
              <Select
                value={editedStep.resolution || 'days'}
                label="רזולוציה"
                onChange={(e) => handleChange('resolution', e.target.value as string)}
              >
                <MenuItem value="months">חודשים</MenuItem>
                <MenuItem value="weeks">שבועות</MenuItem>
                <MenuItem value="days">ימים</MenuItem>
                <MenuItem value="hours">שעות</MenuItem>
              </Select>
            </FormControl>

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
              sx={{ mb: 2 }}
            />

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

        {/* Integration settings */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>הגדרות אינטגרציות</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            קבע אילו אינטגרציות יתבצעו כשמגיעים לשלב זה
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={editedStep.integrations?.enabled || false}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleChange('integrations', {
                      enabled: true,
                      googleCalendar: false,
                      googleSheets: false,
                      notifications: false,
                      reminders: false,
                      iPlan: false
                    });
                  } else {
                    handleChange('integrations', undefined);
                  }
                }}
              />
            }
            label="הפעל אינטגרציות"
            sx={{ mb: 1 }}
          />

          {editedStep.integrations?.enabled && (
            <Box sx={{ ml: 4, borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
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
                {editedStep.integrations?.googleCalendar && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => openIntegrationMessageDialog('calendar')}
                  >
                    ערוך הודעה
                  </Button>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
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
                {editedStep.integrations?.googleSheets && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => openIntegrationMessageDialog('sheets')}
                  >
                    ערוך הודעה
                  </Button>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
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
                {editedStep.integrations?.notifications && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => openIntegrationMessageDialog('notifications')}
                  >
                    ערוך הודעה
                  </Button>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editedStep.integrations?.reminders || false}
                      onChange={(e) => {
                        const config = editedStep.integrations || { enabled: true };
                        handleChange('integrations', {
                          ...config,
                          reminders: e.target.checked
                        });
                      }}
                    />
                  }
                  label="⏰ הפעל תזכורות"
                />
                {editedStep.integrations?.reminders && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => openIntegrationMessageDialog('reminders')}
                  >
                    ערוך הודעה
                  </Button>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
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
                {editedStep.integrations?.iPlan && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => openIntegrationMessageDialog('iplan')}
                  >
                    ערוך הודעה
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={editedStep.enabled || false}
              onChange={(e) => handleChange('enabled', e.target.checked)}
            />
          }
          label="מופעל"
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="דלג אם מושבת"
          value={editedStep.skipIfDisabled || ''}
          onChange={(e) => handleChange('skipIfDisabled', e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          <Button onClick={onClose} variant="outlined">
            ביטול
          </Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            שמור
          </Button>
        </Box>
      </Stack>

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