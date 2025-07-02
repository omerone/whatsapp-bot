import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Button, Dialog, Typography, AppBar, Toolbar, Container, IconButton } from '@mui/material';
import FlowEditor, { FlowEditorHandle } from '../../components/FlowEditor';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import CodeIcon from '@mui/icons-material/Code';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import AddIcon from '@mui/icons-material/Add';
import PreviewIcon from '@mui/icons-material/Preview';
// import JsonPreview from '../../components/JsonPreview'; // Component doesn't exist
import MetadataEditor from '../../components/MetadataEditor';
import { useFlow } from '../../context/FlowContext';

const EditorPage: React.FC = () => {
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { exportFlow, flow } = useFlow();
  const [currentFlowName, setCurrentFlowName] = useState<string>('');
  const [saveFileName, setSaveFileName] = useState<string>('');
  const flowEditorRef = useRef<FlowEditorHandle>(null);

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
  
  // פונקציית שמירה שמשתמשת ב-FlowEditor לשמירה בפועל
  const handleSaveFlow = async () => {
    if (flowEditorRef.current?.handleSaveFlow) {
      return flowEditorRef.current.handleSaveFlow();
    } else {
      // שמירה ישירה דרך ה-API אם אין גישה לפונקציית FlowEditor
      try {
        const flowData = JSON.stringify(flow, null, 2);
        const fileName = saveFileName || 'new_flow.json';
        
        const response = await fetch(`/api/flows/${fileName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: flowData,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        setCurrentFlowName(fileName);
        return true;
      } catch (error) {
        console.error('Error saving flow:', error);
        return false;
      }
    }
  };

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
        <Container maxWidth="xl" sx={{ mt: 2 }}>
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            overflow: 'auto', 
            maxHeight: '80vh',
            backgroundColor: '#f5f5f5',
            padding: '16px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            {exportFlow()}
          </pre>
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
            const oldFileName = currentFlowName;
            
            // בדיקה האם יש צורך בשינוי שם הקובץ
            if (oldFileName && oldFileName !== newFileName && oldFileName.trim() !== '') {
              console.log(`שינוי שם הקובץ מ-${oldFileName} ל-${newFileName}`);
              
              // קודם שומרים את השינויים בתוכן הקובץ
              handleSaveFlow().then((success) => {
                if (success) {
                  // לאחר שמירת התוכן, שינוי שם הקובץ באמצעות ה-API
                  fetch(`/api/flows/${oldFileName}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      oldName: oldFileName,
                      newName: newFileName
                    })
                  })
                  .then(response => {
                    if (response.ok) {
                      console.log(`הקובץ שונה בהצלחה מ-${oldFileName} ל-${newFileName}`);
                      setCurrentFlowName(newFileName);
                    } else {
                      console.error('שגיאה בשינוי שם הקובץ:', response.statusText);
                      // אם שינוי השם נכשל, נשמור כקובץ חדש
                      fetch(`/api/flows/${newFileName}`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(flow)
                      })
                      .then(() => {
                        console.log(`נשמר כקובץ חדש: ${newFileName}`);
                        setCurrentFlowName(newFileName);
                      })
                      .catch(error => console.error('שגיאה בשמירת הקובץ החדש:', error));
                    }
                  })
                  .catch(error => {
                    console.error('שגיאה בשינוי שם הקובץ:', error);
                  });
                }
              });
            } else {
              // אם אין צורך בשינוי שם, פשוט שומרים את התוכן
              handleSaveFlow().then((success) => {
                if (success) {
                  setCurrentFlowName(newFileName);
                }
              });
            }
            
            setShowSettings(false);
          }}
        />
      </Dialog>
    </Box>
  );
};

export default EditorPage; 