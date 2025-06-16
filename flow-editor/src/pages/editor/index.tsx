import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Dialog, Typography, AppBar, Toolbar, Container, IconButton } from '@mui/material';
import FlowEditor from '../../components/FlowEditor';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import CodeIcon from '@mui/icons-material/Code';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import AddIcon from '@mui/icons-material/Add';
import PreviewIcon from '@mui/icons-material/Preview';
import JsonPreview from '../../components/JsonPreview';
import MetadataEditor from '../../components/MetadataEditor';
import { useFlow } from '../../context/FlowContext';

const EditorPage: React.FC = () => {
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { exportFlow, flow } = useFlow();
  const [currentFlowName, setCurrentFlowName] = useState<string>('');
  const [saveFileName, setSaveFileName] = useState<string>('');

  // פונקציה לעדכון שם התסריט כאשר שם החברה משתנה
  const handleCompanyNameChange = useCallback((newName: string) => {
    if (newName && newName.trim() !== '') {
      // עדכון שם הקובץ רק אם שם החברה לא ריק
      const newFileName = `${newName.trim()}.json`;
      setSaveFileName(newFileName);
      
      // אם זה תסריט חדש (שעדיין לא נשמר), עדכן גם את השם הנוכחי
      if (!currentFlowName) {
        setCurrentFlowName(newFileName);
      }
    }
  }, [currentFlowName]);

  // עדכון שם הקובץ לפי המטה-דאטה בטעינה
  useEffect(() => {
    if (flow.metadata.company_name && flow.metadata.company_name.trim() !== '') {
      const newFileName = `${flow.metadata.company_name.trim()}.json`;
      setSaveFileName(newFileName);
      
      // אם זה תסריט חדש (שעדיין לא נשמר), עדכן גם את השם הנוכחי
      if (!currentFlowName) {
        setCurrentFlowName(newFileName);
      }
    }
  }, [flow.metadata.company_name, currentFlowName]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            עורך תסריטים | {currentFlowName || 'תסריט חדש'}
          </Typography>
          <Button color="inherit" startIcon={<AddIcon />}>
            תסריט חדש
          </Button>
          <Button color="inherit" startIcon={<FileOpenIcon />}>
            פתח תסריט
          </Button>
          <Button color="inherit" startIcon={<SaveIcon />}>
            שמור
          </Button>
          <IconButton color="inherit" onClick={() => setShowJsonPreview(true)}>
            <PreviewIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => setShowSettings(true)}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <FlowEditor />
      </Box>
      
      {/* דיאלוג תצוגת JSON */}
      <Dialog
        fullScreen
        open={showJsonPreview}
        onClose={() => setShowJsonPreview(false)}
      >
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              תצוגת JSON
            </Typography>
            <Button color="inherit" onClick={() => setShowJsonPreview(false)}>
              סגור
            </Button>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl">
          <JsonPreview json={exportFlow()} />
        </Container>
      </Dialog>
      
      {/* דיאלוג הגדרות */}
      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        maxWidth={false}
      >
        <MetadataEditor 
          onClose={() => setShowSettings(false)} 
          onCompanyNameChange={handleCompanyNameChange}
          onSave={() => {
            // שמירת השינויים במטא-דאטה עם השם החדש
            const newFileName = saveFileName || 'new_flow.json';
            
            // שמירת התסריט עם השם החדש - מחיקת הקובץ הישן אם השם השתנה
            if (currentFlowName && currentFlowName !== newFileName && flow.metadata.company_name) {
              // קודם שומרים את הקובץ החדש
              handleSaveFlow().then(() => {
                // אם השמירה הצליחה ושם הקובץ השתנה, מוחקים את הקובץ הישן
                if (currentFlowName !== newFileName) {
                  fetch(`/api/flows/${currentFlowName}`, {
                    method: 'DELETE'
                  }).catch(error => {
                    console.error('Error deleting old file:', error);
                  });
                }
              });
            } else {
              // אם אין שינוי בשם או אין שם קובץ נוכחי, פשוט שומרים
              handleSaveFlow();
            }
            
            setShowSettings(false);
          }}
        />
      </Dialog>
    </Box>
  );
};

export default EditorPage; 