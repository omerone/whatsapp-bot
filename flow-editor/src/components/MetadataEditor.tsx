import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useFlow } from '../context/FlowContext';

interface MetadataEditorProps {
  onClose: () => void;
}

const MetadataEditor: React.FC<MetadataEditorProps> = ({ onClose }) => {
  const { flow, updateMetadata, updateConfiguration, updateIntegrations } = useFlow();
  const [expandedSection, setExpandedSection] = useState<string | false>('metadata');

  const handleMetadataChange = (field: keyof typeof flow.metadata, value: string) => {
    updateMetadata({ [field]: value });
  };

  const handleConfigurationChange = (
    section: string,
    subsection: string | null,
    field: string,
    value: any
  ) => {
    if (subsection) {
      updateConfiguration({
        [section]: {
          ...flow.configuration[section],
          [subsection]: {
            ...flow.configuration[section][subsection],
            [field]: value,
          },
        },
      });
    } else {
      updateConfiguration({
        [section]: {
          ...flow.configuration[section],
          [field]: value,
        },
      });
    }
  };

  const handleIntegrationsChange = (
    section: string,
    subsection: string | null,
    field: string,
    value: any
  ) => {
    if (subsection) {
      updateIntegrations({
        [section]: {
          ...flow.integrations?.[section],
          [subsection]: {
            ...flow.integrations?.[section]?.[subsection],
            [field]: value,
          },
        },
      });
    } else {
      updateIntegrations({
        [section]: {
          ...flow.integrations?.[section],
          [field]: value,
        },
      });
    }
  };

  const handleAddKeyword = () => {
    const keywords = flow.configuration.rules.activation?.keywords || [];
    handleConfigurationChange('rules', 'activation', 'keywords', [...keywords, '']);
  };

  const handleUpdateKeyword = (index: number, value: string) => {
    const keywords = [...(flow.configuration.rules.activation?.keywords || [])];
    keywords[index] = value;
    handleConfigurationChange('rules', 'activation', 'keywords', keywords);
  };

  const handleRemoveKeyword = (index: number) => {
    const keywords = [...(flow.configuration.rules.activation?.keywords || [])];
    keywords.splice(index, 1);
    handleConfigurationChange('rules', 'activation', 'keywords', keywords);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        width: 600,
        maxHeight: '90vh',
        overflow: 'auto',
      }}
    >
      <Typography variant="h5" sx={{ mb: 3 }}>
        הגדרות תסריט
      </Typography>

      {/* Metadata Section */}
      <Accordion
        expanded={expandedSection === 'metadata'}
        onChange={() => setExpandedSection(expandedSection === 'metadata' ? false : 'metadata')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">מטא-דאטה</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="שם החברה"
              value={flow.metadata.company_name}
              onChange={(e) => handleMetadataChange('company_name', e.target.value)}
            />
            <TextField
              fullWidth
              label="גרסה"
              value={flow.metadata.version}
              onChange={(e) => handleMetadataChange('version', e.target.value)}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Rules Section */}
      <Accordion
        expanded={expandedSection === 'rules'}
        onChange={() => setExpandedSection(expandedSection === 'rules' ? false : 'rules')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">הגדרות כללים</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Blocked Sources */}
            <Typography variant="subtitle1" sx={{ mt: 2 }}>מקורות חסומים</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={flow.configuration.rules.blockedSources?.ignoreContacts || false}
                  onChange={(e) => handleConfigurationChange('rules', 'blockedSources', 'ignoreContacts', e.target.checked)}
                />
              }
              label="התעלם מאנשי קשר"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={flow.configuration.rules.blockedSources?.ignoreArchived || false}
                  onChange={(e) => handleConfigurationChange('rules', 'blockedSources', 'ignoreArchived', e.target.checked)}
                />
              }
              label="התעלם מארכיון"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={flow.configuration.rules.blockedSources?.ignoreGroups || false}
                  onChange={(e) => handleConfigurationChange('rules', 'blockedSources', 'ignoreGroups', e.target.checked)}
                />
              }
              label="התעלם מקבוצות"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={flow.configuration.rules.blockedSources?.ignoreStatus || false}
                  onChange={(e) => handleConfigurationChange('rules', 'blockedSources', 'ignoreStatus', e.target.checked)}
                />
              }
              label="התעלם מסטטוס"
            />

            {/* Activation */}
            <Typography variant="subtitle1" sx={{ mt: 2 }}>הפעלה</Typography>
            <Box sx={{ ml: 3, mb: 2, borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>הגדרות הפעלה</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.configuration.rules.activation?.enabled || false}
                    onChange={(e) => handleConfigurationChange('rules', 'activation', 'enabled', e.target.checked)}
                  />
                }
                label="אפשר הפעלה"
              />
              
              {flow.configuration.rules.activation?.enabled && (
                <Box sx={{ ml: 2, mt: 1 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>מילות מפתח להפעלה</Typography>
                  <List dense>
                    {(flow.configuration.rules.activation?.keywords || []).map((keyword, index) => (
                      <ListItem key={index} dense sx={{ py: 0.5 }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={keyword}
                          onChange={(e) => handleUpdateKeyword(index, e.target.value)}
                          sx={{ mr: 1 }}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" size="small" onClick={() => handleRemoveKeyword(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={handleAddKeyword}
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    הוסף מילת מפתח
                  </Button>
                  
                  <TextField
                    fullWidth
                    type="number"
                    label="איפוס אחרי (שעות)"
                    value={flow.configuration.rules.activation?.resetAfterHours || 24}
                    onChange={(e) => handleConfigurationChange('rules', 'activation', 'resetAfterHours', parseInt(e.target.value))}
                    sx={{ mt: 2 }}
                    size="small"
                  />
                </Box>
              )}
            </Box>

            {/* General Rules */}
            <Typography variant="subtitle1" sx={{ mt: 2 }}>כללים כלליים</Typography>
            <TextField
              fullWidth
              type="number"
              label="זמן פג תוקף סשן (שניות)"
              value={flow.configuration.rules.session_timeout || 3600}
              onChange={(e) => handleConfigurationChange('rules', null, 'session_timeout', parseInt(e.target.value))}
            />
            <TextField
              fullWidth
              type="number"
              label="מספר ניסיונות מקסימלי"
              value={flow.configuration.rules.max_retries || 3}
              onChange={(e) => handleConfigurationChange('rules', null, 'max_retries', parseInt(e.target.value))}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Client Management Section */}
      <Accordion
        expanded={expandedSection === 'client_management'}
        onChange={() => setExpandedSection(expandedSection === 'client_management' ? false : 'client_management')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6">ניהול לקוחות</Typography>
            {(flow.configuration.client_management.freeze?.enabled || 
              flow.configuration.client_management.reset?.enabled ||
              flow.configuration.client_management.blockScheduledClients?.enabled) && (
              <Chip 
                size="small" 
                label="פעיל" 
                color="primary" 
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Freeze Settings */}
            <Box sx={{ borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>הגדרות הקפאה</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.configuration.client_management.freeze?.enabled || false}
                    onChange={(e) => handleConfigurationChange('client_management', 'freeze', 'enabled', e.target.checked)}
                  />
                }
                label="אפשר הקפאה"
              />
              
              {flow.configuration.client_management.freeze?.enabled && (
                <Box sx={{ ml: 2, mt: 1 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="משך הקפאה (דקות)"
                    value={flow.configuration.client_management.freeze?.duration || 60}
                    onChange={(e) => handleConfigurationChange('client_management', 'freeze', 'duration', parseInt(e.target.value))}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={flow.configuration.client_management.freeze?.messaging?.send_explanation || false}
                        onChange={(e) => handleConfigurationChange('client_management', 'freeze', 'messaging', { 
                          ...flow.configuration.client_management.freeze?.messaging,
                          send_explanation: e.target.checked 
                        })}
                      />
                    }
                    label="שלח הסבר"
                  />
                  
                  {flow.configuration.client_management.freeze?.messaging?.send_explanation && (
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="הודעת הקפאה"
                      value={flow.configuration.client_management.freeze?.messaging?.message || ''}
                      onChange={(e) => handleConfigurationChange('client_management', 'freeze', 'messaging', {
                        ...flow.configuration.client_management.freeze?.messaging,
                        message: e.target.value
                      })}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              )}
            </Box>

            {/* Reset Settings */}
            <Box sx={{ borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>הגדרות איפוס</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.configuration.client_management.reset?.enabled || false}
                    onChange={(e) => handleConfigurationChange('client_management', 'reset', 'enabled', e.target.checked)}
                  />
                }
                label="אפשר איפוס"
              />
              
              {flow.configuration.client_management.reset?.enabled && (
                <Box sx={{ ml: 2, mt: 1 }}>
                  <TextField
                    fullWidth
                    label="מילת מפתח לאיפוס"
                    value={flow.configuration.client_management.reset?.keyword || ''}
                    onChange={(e) => handleConfigurationChange('client_management', 'reset', 'keyword', e.target.value)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="צעד יעד"
                    value={flow.configuration.client_management.reset?.target_step || ''}
                    onChange={(e) => handleConfigurationChange('client_management', 'reset', 'target_step', e.target.value)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  
                  <Typography variant="body2" sx={{ mb: 1 }}>אפשרויות איפוס</Typography>
                  <Box sx={{ ml: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={flow.configuration.client_management.reset?.options?.unfreeze || false}
                          onChange={(e) => handleConfigurationChange('client_management', 'reset', 'options', {
                            ...flow.configuration.client_management.reset?.options,
                            unfreeze: e.target.checked
                          })}
                        />
                      }
                      label="בטל הקפאה"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={flow.configuration.client_management.reset?.options?.delete_appointment || false}
                          onChange={(e) => handleConfigurationChange('client_management', 'reset', 'options', {
                            ...flow.configuration.client_management.reset?.options,
                            delete_appointment: e.target.checked
                          })}
                        />
                      }
                      label="מחק פגישה"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={flow.configuration.client_management.reset?.options?.allow_unblock || false}
                          onChange={(e) => handleConfigurationChange('client_management', 'reset', 'options', {
                            ...flow.configuration.client_management.reset?.options,
                            allow_unblock: e.target.checked
                          })}
                        />
                      }
                      label="אפשר ביטול חסימה"
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Integrations Section */}
      <Accordion
        expanded={expandedSection === 'integrations'}
        onChange={() => setExpandedSection(expandedSection === 'integrations' ? false : 'integrations')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">אינטגרציות</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={flow.integrations?.enabled || false}
                  onChange={(e) => handleIntegrationsChange('enabled', null, '', e.target.checked)}
                />
              }
              label="אפשר אינטגרציות"
            />

            {/* Google Workspace */}
            <Typography variant="subtitle1">Google Workspace</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={flow.integrations?.googleWorkspace?.enabled || false}
                  onChange={(e) => handleIntegrationsChange('googleWorkspace', null, 'enabled', e.target.checked)}
                />
              }
              label="אפשר Google Workspace"
            />

            {/* Google Sheets */}
            <Box sx={{ ml: 2 }}>
              <Typography variant="subtitle2">Google Sheets</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.integrations?.googleWorkspace?.sheets?.enabled || false}
                    onChange={(e) => handleIntegrationsChange('googleWorkspace', 'sheets', 'enabled', e.target.checked)}
                  />
                }
                label="אפשר Google Sheets"
              />
              <TextField
                fullWidth
                label="מזהה גיליון"
                value={flow.integrations?.googleWorkspace?.sheets?.sheetId || ''}
                onChange={(e) => handleIntegrationsChange('googleWorkspace', 'sheets', 'sheetId', e.target.value)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.integrations?.googleWorkspace?.sheets?.filterByDateTime || false}
                    onChange={(e) => handleIntegrationsChange('googleWorkspace', 'sheets', 'filterByDateTime', e.target.checked)}
                  />
                }
                label="סנן לפי תאריך ושעה"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.integrations?.googleWorkspace?.sheets?.preventDuplicates || false}
                    onChange={(e) => handleIntegrationsChange('googleWorkspace', 'sheets', 'preventDuplicates', e.target.checked)}
                  />
                }
                label="מנע כפילויות"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.integrations?.googleWorkspace?.sheets?.updateExistingRows || false}
                    onChange={(e) => handleIntegrationsChange('googleWorkspace', 'sheets', 'updateExistingRows', e.target.checked)}
                  />
                }
                label="עדכן שורות קיימות"
              />
            </Box>

            {/* Google Calendar */}
            <Box sx={{ ml: 2 }}>
              <Typography variant="subtitle2">Google Calendar</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.integrations?.googleWorkspace?.calendar?.enabled || false}
                    onChange={(e) => handleIntegrationsChange('googleWorkspace', 'calendar', 'enabled', e.target.checked)}
                  />
                }
                label="אפשר Google Calendar"
              />
              <TextField
                fullWidth
                label="מזהה יומן"
                value={flow.integrations?.googleWorkspace?.calendar?.calendarId || ''}
                onChange={(e) => handleIntegrationsChange('googleWorkspace', 'calendar', 'calendarId', e.target.value)}
              />
              <TextField
                fullWidth
                type="number"
                label="משך אירוע (דקות)"
                value={flow.integrations?.googleWorkspace?.calendar?.eventDurationMinutes || 60}
                onChange={(e) => handleIntegrationsChange('googleWorkspace', 'calendar', 'eventDurationMinutes', parseInt(e.target.value))}
              />
              <TextField
                fullWidth
                label="אזור זמן"
                value={flow.integrations?.googleWorkspace?.calendar?.timeZone || 'Asia/Jerusalem'}
                onChange={(e) => handleIntegrationsChange('googleWorkspace', 'calendar', 'timeZone', e.target.value)}
              />
              <TextField
                fullWidth
                label="כותרת אירוע"
                value={flow.integrations?.googleWorkspace?.calendar?.eventTitle || ''}
                onChange={(e) => handleIntegrationsChange('googleWorkspace', 'calendar', 'eventTitle', e.target.value)}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="תיאור אירוע"
                value={flow.integrations?.googleWorkspace?.calendar?.eventDescription || ''}
                onChange={(e) => handleIntegrationsChange('googleWorkspace', 'calendar', 'eventDescription', e.target.value)}
              />
              <TextField
                fullWidth
                type="number"
                label="מספר משתתפים מקסימלי"
                value={flow.integrations?.googleWorkspace?.calendar?.maxParticipantsPerSlot || 1}
                onChange={(e) => handleIntegrationsChange('googleWorkspace', 'calendar', 'maxParticipantsPerSlot', parseInt(e.target.value))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.integrations?.googleWorkspace?.calendar?.preventDuplicates || false}
                    onChange={(e) => handleIntegrationsChange('googleWorkspace', 'calendar', 'preventDuplicates', e.target.checked)}
                  />
                }
                label="מנע כפילויות"
              />
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          סגור
        </Button>
      </Box>
    </Paper>
  );
};

export default MetadataEditor; 