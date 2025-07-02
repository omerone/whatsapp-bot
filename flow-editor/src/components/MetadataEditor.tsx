import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useFlow } from '../context/FlowContext';

interface MetadataEditorProps {
  onClose: () => void;
  onCompanyNameChange?: (newName: string) => void;
  onSave?: () => void;
}

const MetadataEditor: React.FC<MetadataEditorProps> = ({ onClose, onCompanyNameChange, onSave }) => {
  const { flow, updateMetadata, updateConfiguration, updateIntegrations, getAllSteps } = useFlow();
  const [expandedSection, setExpandedSection] = useState<string | false>('metadata');

  const handleMetadataChange = (field: string, value: any) => {
    updateMetadata({ [field]: value });
    
    if (field === 'company_name' && onCompanyNameChange) {
      onCompanyNameChange(value);
    }
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
    const currentIntegrations = flow.integrations || {};
    
    if (subsection) {
      // אם זה כיבוי של אינטגרציה, נמחק את כל הסקציה
      if (field === 'enabled' && value === false) {
        const updatedSection = { ...currentIntegrations[section] };
        delete updatedSection[subsection];
        
        updateIntegrations({
          ...currentIntegrations,
          [section]: Object.keys(updatedSection).length > 0 ? updatedSection : undefined,
        });
      } else {
      updateIntegrations({
          ...currentIntegrations,
        [section]: {
            ...currentIntegrations[section],
          [subsection]: {
              ...currentIntegrations[section]?.[subsection],
            [field]: value,
          },
        },
      });
      }
    } else {
      // אם זה כיבוי של אינטגרציה ברמה הראשית, נמחק את כל הסקציה
      if (field === 'enabled' && value === false) {
        const updatedIntegrations = { ...currentIntegrations };
        delete updatedIntegrations[section];
        
        updateIntegrations(updatedIntegrations);
    } else {
      updateIntegrations({
          ...currentIntegrations,
        [section]: {
            ...currentIntegrations[section],
          [field]: value,
        },
      });
      }
    }
  };

  const handleAddKeyword = () => {
    const keywords = flow.configuration.rules?.activation?.keywords || [];
    handleConfigurationChange('rules', 'activation', 'keywords', [...keywords, '']);
  };

  const handleUpdateKeyword = (index: number, value: string) => {
    const keywords = [...(flow.configuration.rules?.activation?.keywords || [])];
    keywords[index] = value;
    handleConfigurationChange('rules', 'activation', 'keywords', keywords);
  };

  const handleRemoveKeyword = (index: number) => {
    const keywords = [...(flow.configuration.rules?.activation?.keywords || [])];
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
              value={flow.metadata.company_name || ''}
              onChange={(e) => handleMetadataChange('company_name', e.target.value)}
              sx={{ mb: 2 }}
              helperText="שם החברה ישמש גם כשם הקובץ"
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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              הגדר מאילו מקורות להתעלם או לקבל הודעות. כאשר הסוויץ' דלוק = מתעלם, כאשר כבוי = מתייחס.
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">אנשי קשר</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {flow.configuration.rules?.blockedSources?.ignoreContacts ? 'מתעלם' : 'מתייחס'}
                  </Typography>
                  <Switch
                    checked={flow.configuration.rules?.blockedSources?.ignoreContacts || false}
                    onChange={(e) => handleConfigurationChange('rules', 'blockedSources', 'ignoreContacts', e.target.checked)}
                    size="small"
                  />
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">ארכיון</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {flow.configuration.rules?.blockedSources?.ignoreArchived ? 'מתעלם' : 'מתייחס'}
                  </Typography>
                  <Switch
                    checked={flow.configuration.rules?.blockedSources?.ignoreArchived || false}
                    onChange={(e) => handleConfigurationChange('rules', 'blockedSources', 'ignoreArchived', e.target.checked)}
                    size="small"
                  />
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">קבוצות</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {flow.configuration.rules?.blockedSources?.ignoreGroups ? 'מתעלם' : 'מתייחס'}
                  </Typography>
                  <Switch
                    checked={flow.configuration.rules?.blockedSources?.ignoreGroups || false}
                    onChange={(e) => handleConfigurationChange('rules', 'blockedSources', 'ignoreGroups', e.target.checked)}
                    size="small"
                  />
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2">סטטוסים</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {flow.configuration.rules?.blockedSources?.ignoreStatus ? 'מתעלם' : 'מתייחס'}
                  </Typography>
                  <Switch
                    checked={flow.configuration.rules?.blockedSources?.ignoreStatus || false}
                    onChange={(e) => handleConfigurationChange('rules', 'blockedSources', 'ignoreStatus', e.target.checked)}
                    size="small"
                  />
                </Box>
              </Box>
            </Box>

            {/* Activation */}
            <Typography variant="subtitle1" sx={{ mt: 2 }}>הפעלה</Typography>
            <Box sx={{ ml: 3, mb: 2, borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>הגדרות הפעלה</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.configuration.rules?.activation?.enabled || false}
                    onChange={(e) => handleConfigurationChange('rules', 'activation', 'enabled', e.target.checked)}
                  />
                }
                label="אפשר הפעלה"
              />
              
              {flow.configuration.rules?.activation?.enabled && (
                <Box sx={{ ml: 2, mt: 1 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>מילות מפתח להפעלה</Typography>
                  <List dense>
                    {(flow.configuration.rules?.activation?.keywords || []).map((keyword: string, index: number) => (
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
                    value={flow.configuration.rules?.activation?.resetAfterHours || 24}
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
              value={flow.configuration.rules?.session_timeout || 3600}
              onChange={(e) => handleConfigurationChange('rules', null, 'session_timeout', parseInt(e.target.value))}
            />
            <TextField
              fullWidth
              type="number"
              label="מספר ניסיונות מקסימלי"
              value={flow.configuration.rules?.max_retries || 3}
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
            {(flow.configuration.client_management?.freeze?.enabled || 
              flow.configuration.client_management?.reset?.enabled ||
              flow.configuration.client_management?.blockScheduledClients?.enabled) && (
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
            {/* הערה על הסרת הגדרות ההקפאה הגלובליות */}
            <Box sx={{ borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>הגדרות הקפאה</Typography>
              <Typography variant="body2" color="text.secondary">
                הגדרות ההקפאה הועברו לרמת הצעד הבודד. 
                ניתן להגדיר הקפאה עבור כל צעד בנפרד על-ידי עריכת הצעד והפעלת אפשרות ההקפאה.
              </Typography>
            </Box>

            {/* Block Settings */}
            <Box sx={{ borderLeft: '2px solid rgba(0, 0, 0, 0.1)', pl: 2, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>הגדרות חסימה כלליות</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                הגדרות אלו משפיעות על התנהגות החסימה בכל התסריט.
              </Typography>
              
              <TextField
                fullWidth
                type="number"
                label="משך חסימה (דקות, 0 = לצמיתות)"
                value={flow.configuration.client_management?.block_duration || 0}
                onChange={(e) => handleConfigurationChange('client_management', null, 'block_duration', parseInt(e.target.value) || 0)}
                size="small"
                sx={{ mb: 2 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.configuration.client_management?.blockScheduledClients?.enabled || false}
                    onChange={(e) => handleConfigurationChange('client_management', 'blockScheduledClients', 'enabled', e.target.checked)}
                  />
                }
                label="חסום לקוחות עם פגישות"
                sx={{ mb: 1 }}
              />
              
                              {flow.configuration.client_management?.blockScheduledClients?.enabled && (
                <Box sx={{ ml: 3, mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={flow.configuration.client_management?.blockScheduledClients?.blockPastAndPresent || false}
                        onChange={(e) => handleConfigurationChange('client_management', 'blockScheduledClients', 'blockPastAndPresent', e.target.checked)}
                      />
                    }
                    label="חסום פגישות עבר והווה"
                    sx={{ mb: 1 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={flow.configuration.client_management?.blockScheduledClients?.blockFutureAndPresent || false}
                        onChange={(e) => handleConfigurationChange('client_management', 'blockScheduledClients', 'blockFutureAndPresent', e.target.checked)}
                      />
                    }
                    label="חסום פגישות עתיד והווה"
                    sx={{ mb: 1 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={flow.configuration.client_management?.blockScheduledClients?.allowRescheduling || false}
                        onChange={(e) => handleConfigurationChange('client_management', 'blockScheduledClients', 'allowRescheduling', e.target.checked)}
                      />
                    }
                    label="אפשר קביעת פגישה חדשה"
                    sx={{ mb: 1 }}
                  />
                  
                  {flow.configuration.client_management?.blockScheduledClients?.allowRescheduling && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={flow.configuration.client_management?.blockScheduledClients?.rescheduleOnlyFuture || false}
                          onChange={(e) => handleConfigurationChange('client_management', 'blockScheduledClients', 'rescheduleOnlyFuture', e.target.checked)}
                        />
                      }
                      label="קבע פגישה חדשה רק לעתיד"
                      sx={{ ml: 2 }}
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
                    checked={flow.configuration.client_management?.reset?.enabled || false}
                    onChange={(e) => handleConfigurationChange('client_management', 'reset', 'enabled', e.target.checked)}
                  />
                }
                label="אפשר איפוס"
              />
              
              {flow.configuration.client_management?.reset?.enabled && (
                <Box sx={{ ml: 2, mt: 1 }}>
                  <TextField
                    fullWidth
                    label="מילת מפתח לאיפוס"
                    value={flow.configuration.client_management?.reset?.keyword || ''}
                    onChange={(e) => handleConfigurationChange('client_management', 'reset', 'keyword', e.target.value)}
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>צעד יעד</InputLabel>
                    <Select
                      value={flow.configuration.client_management?.reset?.target_step || ''}
                      label="צעד יעד"
                      onChange={(e) => handleConfigurationChange('client_management', 'reset', 'target_step', e.target.value)}
                    >
                      <MenuItem value="">
                        <em>בחר צעד יעד</em>
                      </MenuItem>
                      {getAllSteps().map((step) => (
                        <MenuItem key={step.id} value={step.id}>
                          {step.id} - {step.type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <Typography variant="body2" sx={{ mb: 1 }}>אפשרויות איפוס</Typography>
                  <Box sx={{ ml: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={flow.configuration.client_management?.reset?.options?.unfreeze || false}
                          onChange={(e) => handleConfigurationChange('client_management', 'reset', 'options', {
                            ...flow.configuration.client_management?.reset?.options,
                            unfreeze: e.target.checked
                          })}
                        />
                      }
                      label="בטל הקפאה"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={flow.configuration.client_management?.reset?.options?.delete_appointment || false}
                          onChange={(e) => handleConfigurationChange('client_management', 'reset', 'options', {
                            ...flow.configuration.client_management?.reset?.options,
                            delete_appointment: e.target.checked
                          })}
                        />
                      }
                      label="מחק פגישה"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={flow.configuration.client_management?.reset?.options?.allow_unblock || false}
                          onChange={(e) => handleConfigurationChange('client_management', 'reset', 'options', {
                            ...flow.configuration.client_management?.reset?.options,
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* הפעלה כללית */}
            <Paper elevation={0} sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={flow.integrations?.enabled || false}
                    onChange={(e) => handleIntegrationsChange('enabled', null, '', e.target.checked)}
                  />
                }
                label="🔗 אפשר אינטגרציות"
                sx={{ fontWeight: 600 }}
              />
            </Paper>



            {/* iPlan */}
            {flow.integrations?.enabled && (
              <Paper elevation={0} sx={{ p: 3, backgroundColor: '#e8f5e8', borderRadius: 3, border: '1px solid #4caf50' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    backgroundColor: '#4caf50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.2rem'
                  }}>
                    📋
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#4caf50' }}>
                    iPlan
                  </Typography>
                </Box>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={flow.integrations?.iPlan?.enabled || false}
                      onChange={(e) => handleIntegrationsChange('iPlan', null, 'enabled', e.target.checked)}
                    />
                  }
                  label="אפשר סנכרון עם iPlan"
                  sx={{ mb: 2 }}
                />

                {flow.integrations?.iPlan?.enabled && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, ml: 3 }}>
                    <TextField
                      fullWidth
                      label="API URL"
                      value={flow.integrations?.iPlan?.apiUrl || ''}
                      onChange={(e) => handleIntegrationsChange('iPlan', null, 'apiUrl', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    
                    <TextField
                      fullWidth
                      label="API Key"
                      type="password"
                      value={flow.integrations?.iPlan?.apiKey || ''}
                      onChange={(e) => handleIntegrationsChange('iPlan', null, 'apiKey', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    
                    <TextField
                      fullWidth
                      label="מזהה חברה"
                      value={flow.integrations?.iPlan?.companyId || ''}
                      onChange={(e) => handleIntegrationsChange('iPlan', null, 'companyId', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={flow.integrations?.iPlan?.syncMeetings || false}
                            onChange={(e) => handleIntegrationsChange('iPlan', null, 'syncMeetings', e.target.checked)}
                          />
                        }
                        label="סנכרן פגישות"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={flow.integrations?.iPlan?.syncContacts || false}
                            onChange={(e) => handleIntegrationsChange('iPlan', null, 'syncContacts', e.target.checked)}
                          />
                        }
                        label="סנכרן אנשי קשר"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={flow.integrations?.iPlan?.syncTasks || false}
                            onChange={(e) => handleIntegrationsChange('iPlan', null, 'syncTasks', e.target.checked)}
                          />
                        }
                        label="סנכרן משימות"
                      />
                    </Box>
                  </Box>
                )}
              </Paper>
            )}


          </Box>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        {onSave && (
          <Button variant="contained" color="primary" onClick={onSave}>
            שמור שינויים
          </Button>
        )}
        <Button variant="outlined" onClick={onClose}>
          סגור
        </Button>
      </Box>
    </Paper>
  );
};

export default MetadataEditor; 