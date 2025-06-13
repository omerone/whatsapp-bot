import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Message as MessageIcon,
  QuestionAnswer as QuestionIcon,
  List as OptionsIcon,
  CalendarToday as DateIcon,
} from '@mui/icons-material';

const stepTypes = [
  { type: 'message', label: 'הודעה', icon: MessageIcon },
  { type: 'question', label: 'שאלה', icon: QuestionIcon },
  { type: 'options', label: 'אפשרויות', icon: OptionsIcon },
  { type: 'date', label: 'תאריך', icon: DateIcon },
];

export const EditorSidebar: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [stepData, setStepData] = useState({
    id: '',
    label: '',
    messageHeader: '',
    message: '',
    footerMessage: '',
  });

  const handleAddStep = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedType('');
    setStepData({
      id: '',
      label: '',
      messageHeader: '',
      message: '',
      footerMessage: '',
    });
  };

  const handleSaveStep = () => {
    // TODO: Implement step saving logic
    handleCloseDialog();
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        צעדי שיחה
      </Typography>

      <List>
        {stepTypes.map(({ type, label, icon: Icon }) => (
          <ListItem
            key={type}
            button
            onClick={() => {
              setSelectedType(type);
              setIsDialogOpen(true);
            }}
          >
            <ListItemIcon>
              <Icon />
            </ListItemIcon>
            <ListItemText primary={label} />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      <Button
        variant="contained"
        color="primary"
        fullWidth
        onClick={handleAddStep}
      >
        הוסף צעד חדש
      </Button>

      <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>הוסף צעד חדש</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>סוג הצעד</InputLabel>
              <Select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                label="סוג הצעד"
              >
                {stepTypes.map(({ type, label }) => (
                  <MenuItem key={type} value={type}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="מזהה"
              value={stepData.id}
              onChange={(e) => setStepData({ ...stepData, id: e.target.value })}
              fullWidth
            />

            <TextField
              label="כותרת"
              value={stepData.label}
              onChange={(e) => setStepData({ ...stepData, label: e.target.value })}
              fullWidth
            />

            <TextField
              label="כותרת הודעה"
              value={stepData.messageHeader}
              onChange={(e) => setStepData({ ...stepData, messageHeader: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />

            <TextField
              label="הודעה"
              value={stepData.message}
              onChange={(e) => setStepData({ ...stepData, message: e.target.value })}
              fullWidth
              multiline
              rows={4}
            />

            <TextField
              label="הודעת תחתית"
              value={stepData.footerMessage}
              onChange={(e) => setStepData({ ...stepData, footerMessage: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>ביטול</Button>
          <Button onClick={handleSaveStep} variant="contained" color="primary">
            שמור
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 