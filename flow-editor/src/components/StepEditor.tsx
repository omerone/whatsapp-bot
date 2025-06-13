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
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { Step, StepType, StepData, ValidationRule } from '../types/flow';
import { useFlow } from '../context/FlowContext';

interface StepEditorProps {
  stepId: string;
  onClose: () => void;
}

const validationTypes = [
  { value: 'text', label: 'טקסט' },
  { value: 'number', label: 'מספר' },
  { value: 'email', label: 'אימייל' },
  { value: 'phone', label: 'טלפון' },
  { value: 'date', label: 'תאריך' },
  { value: 'regex', label: 'ביטוי רגולרי' },
];

const StepEditor: React.FC<StepEditorProps> = ({ stepId, onClose }) => {
  const { getStep, updateStep, deleteStep, getAllSteps } = useFlow();
  const step = getStep(stepId);
  const [editedStep, setEditedStep] = useState<Partial<StepData>>({
    ...step,
  });
  const [newOption, setNewOption] = useState({ key: '', value: '' });

  if (!step) {
    return null;
  }

  const handleChange = (field: keyof StepData, value: any) => {
    setEditedStep((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDelete = () => {
    deleteStep(stepId);
    onClose();
  };

  const handleAddOption = () => {
    if (newOption.key && newOption.value) {
      const updatedOptions = {
        ...(step.options || {}),
        [newOption.key]: newOption.value,
      };
      handleChange('options', updatedOptions);
      setNewOption({ key: '', value: '' });
    }
  };

  const handleRemoveOption = (key: string) => {
    const updatedOptions = { ...step.options };
    delete updatedOptions[key];
    handleChange('options', updatedOptions);
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
    updateStep(stepId, editedStep);
    onClose();
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
            <Typography variant="subtitle1" sx={{ mb: 1 }}>אפשרויות</Typography>
            <Box sx={{ mb: 2 }}>
              <List>
                {Object.entries(editedStep.options || {}).map(([key, value]) => (
                  <ListItem key={key}>
                    <ListItemText primary={`${key} → ${value}`} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleRemoveOption(key)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  label="מפתח"
                  value={newOption.key}
                  onChange={(e) => setNewOption({ ...newOption, key: e.target.value })}
                  size="small"
                />
                <TextField
                  label="ערך"
                  value={newOption.value}
                  onChange={(e) => setNewOption({ ...newOption, value: e.target.value })}
                  size="small"
                />
                <Button
                  variant="outlined"
                  onClick={handleAddOption}
                  disabled={!newOption.key || !newOption.value}
                  startIcon={<AddIcon />}
                >
                  הוסף
                </Button>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* Validation */}
        {(editedStep.type === 'question' || editedStep.type === 'options' || editedStep.type === 'date') && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>אימות</Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>סוג אימות</InputLabel>
              <Select
                value={editedStep.validation?.type || ''}
                label="סוג אימות"
                onChange={(e) => handleValidationChange('type', e.target.value as string)}
              >
                <MenuItem value="">
                  <em>ללא</em>
                </MenuItem>
                {validationTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {editedStep.validation?.type === 'regex' && (
              <TextField
                fullWidth
                label="תבנית (Regex)"
                value={editedStep.validation?.pattern || ''}
                onChange={(e) => handleValidationChange('pattern', e.target.value)}
                sx={{ mb: 2 }}
              />
            )}

            <TextField
              fullWidth
              label="הודעת שגיאה"
              value={editedStep.validation?.errorMessage || ''}
              onChange={(e) => handleValidationChange('errorMessage', e.target.value)}
              sx={{ mb: 2 }}
            />

            <Divider sx={{ my: 2 }} />
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

        <FormControlLabel
          control={
            <Switch
              checked={editedStep.block || false}
              onChange={(e) => handleChange('block', e.target.checked)}
            />
          }
          label="חסום"
          sx={{ mb: 1 }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={editedStep.freeze || false}
              onChange={(e) => handleChange('freeze', e.target.checked)}
            />
          }
          label="הקפא"
          sx={{ mb: 1 }}
        />

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
    </Paper>
  );
};

export default StepEditor; 