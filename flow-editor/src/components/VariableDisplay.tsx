import React from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import { StepData } from '../types/flow';

interface VariableDisplayProps {
  steps: Record<string, StepData>;
  currentStepId: string;
}

const VariableDisplay: React.FC<VariableDisplayProps> = ({ steps, currentStepId }) => {
  // Function to find the execution path that leads to the current step
  const getExecutionPathToCurrent = () => {
    const executionPath: StepData[] = [];
    const visited = new Set<string>();
    
    // Find the starting step (step with no incoming connections)
    const findStartStep = (): string | null => {
      const allStepIds = Object.keys(steps);
      const targetSteps = new Set<string>();
      
      // Collect all steps that are targets of other steps
      Object.values(steps).forEach(step => {
        if (step.next) targetSteps.add(step.next);
        if (step.branches) {
          Object.values(step.branches).forEach(target => targetSteps.add(target));
        }
        if (step.options) {
          Object.values(step.options).forEach(target => targetSteps.add(target));
        }
      });
      
      // Find steps that are not targets (potential start steps)
      const startCandidates = allStepIds.filter(id => !targetSteps.has(id));
      return startCandidates.length > 0 ? startCandidates[0] : allStepIds[0];
    };
    
    // Traverse from start to current step
    const traverseToStep = (stepId: string, path: StepData[]): boolean => {
      if (visited.has(stepId) || !steps[stepId]) return false;
      
      const step = steps[stepId];
      const newPath = [...path, step];
      
      // If we reached the current step, we found the path
      if (stepId === currentStepId) {
        executionPath.push(...newPath.slice(0, -1)); // Exclude current step
        return true;
      }
      
      visited.add(stepId);
      
      // Try following the next step
      if (step.next && traverseToStep(step.next, newPath)) {
        return true;
      }
      
      // Try following branches/options
      if (step.branches) {
        for (const target of Object.values(step.branches)) {
          if (traverseToStep(target, newPath)) {
            return true;
          }
        }
      }
      
      if (step.options) {
        for (const target of Object.values(step.options)) {
          if (traverseToStep(target, newPath)) {
            return true;
          }
        }
      }
      
      visited.delete(stepId);
      return false;
    };
    
    const startStep = findStartStep();
    if (startStep) {
      traverseToStep(startStep, []);
    }
    
    return executionPath;
  };

  // פונקציה מושלמת לקבלת משתנים זמינים - ניתוח מדויק של הזרימה עם תמיכה ב-date steps
  const getAvailableVariables = () => {
    // משתנים בסיסיים שתמיד זמינים מהסשן
    const variables: Array<{name: string, type: 'basic' | 'collected', description: string}> = [
      {name: 'display_name', type: 'basic', description: 'שם המוצג של הלקוח (תמיד זמין מהסשן)'},
      {name: 'phone', type: 'basic', description: 'מספר הטלפון של הלקוח (תמיד זמין מהסשן)'}
    ];
      
    // פונקציה רקורסיבית למציאת כל השלבים הקודמים בזרימה
    const findAllPredecessors = (targetStepId: string, visited = new Set<string>()): string[] => {
      if (visited.has(targetStepId)) return [];
      visited.add(targetStepId);
      
      const predecessors: string[] = [];
      
      // עבור כל השלבים, בדוק אם הם יכולים להוביל לשלב המטרה
      Object.values(steps).forEach(step => {
        if (step.id === targetStepId || visited.has(step.id)) return;
        
        let canReachTarget = false;
        
        // בדיקת חיבור ישיר
        if (step.next === targetStepId) {
          canReachTarget = true;
        }
        
        // בדיקת branches (לשלבי options)
        if (step.branches) {
          Object.values(step.branches).forEach(branchTarget => {
            if (branchTarget === targetStepId) {
              canReachTarget = true;
          }
          });
        }
        
        // בדיקת options (גם עבור compatbility עם גרסאות ישנות)
        if (step.options) {
          Object.values(step.options).forEach(optionTarget => {
            if (optionTarget === targetStepId) {
              canReachTarget = true;
            }
          });
        }
        
        // בדיקת conditions (לשלבי תנאי)
        if (step.conditions) {
          step.conditions.forEach(condition => {
            if (condition.next === targetStepId) {
              canReachTarget = true;
          }
          });
        }
        
        // בדיקת defaultNext (עבור שלבי תנאי)
        if (step.defaultNext === targetStepId) {
          canReachTarget = true;
        }
        
        if (canReachTarget) {
          predecessors.push(step.id);
          // הוסף גם את כל הקודמים של השלב הזה
          predecessors.push(...findAllPredecessors(step.id, new Set(visited)));
        }
      });
      
      return Array.from(new Set(predecessors));
    };
    
    // מציאת שלב ההתחלה
    const allStepIds = Object.keys(steps);
    const targetSteps = new Set<string>();
    
    // איסוף כל השלבים שהם יעדים של שלבים אחרים
    Object.values(steps).forEach(step => {
      if (step.next) targetSteps.add(step.next);
      if (step.branches) {
        Object.values(step.branches).forEach(target => targetSteps.add(target));
      }
      if (step.options) {
        Object.values(step.options).forEach(target => targetSteps.add(target));
      }
      if (step.conditions) {
        step.conditions.forEach(condition => {
          if (condition.next) targetSteps.add(condition.next);
        });
      }
      if (step.defaultNext) targetSteps.add(step.defaultNext);
    });
    
    // שלבי התחלה = שלבים שאינם יעדים של אף שלב אחר
    const startSteps = allStepIds.filter(id => !targetSteps.has(id));
    const startStep = startSteps.length > 0 ? startSteps[0] : allStepIds[0];
    
    // מציאת כל השלבים שיכולים להגיע לפני השלב הנוכחי
    const allPredecessors = findAllPredecessors(currentStepId);
    const pathSteps = startStep ? [startStep, ...allPredecessors] : allPredecessors;
    
    // איסוף משתנים מכל השלבים הקודמים
    pathSteps.forEach(stepId => {
      const step = steps[stepId];
      if (!step || step.id === currentStepId) return; // אל תכלול את השלב הנוכחי
      
      // איסוף משתנים לפי סוג השלב ורק אם יש key מוגדר
      switch (step.type) {
        case 'question':
          if (step.key && step.key.trim()) {
            let description = '';
            if (step.validation?.type) {
              const validationTypeMap: Record<string, string> = {
                'Name': 'שם מלא',
                'Location': 'מיקום/עיר',
                'Email': 'כתובת אימייל',
                'Age': 'גיל',
                'Date': 'תאריך'
              };
              description = `${validationTypeMap[step.validation.type] || step.validation.type} שנאסף בשלב "${step.id}"`;
            } else {
              description = `תשובת שאלה שנאספה בשלב "${step.id}"`;
            }
            
            variables.push({
              name: step.key.trim(),
              type: 'collected',
              description
            });
          }
          break;
        
        case 'options':
          if (step.key && step.key.trim()) {
            variables.push({
              name: step.key.trim(),
              type: 'collected',
              description: `אפשרות שנבחרה בשלב "${step.id}"`
            });
        }
          break;
        
        case 'date':
          // שלבי תאריך יוצרים מספר משתנים אוטומטיים
          const stepKey = step.key && step.key.trim();
          const stepResolution = step.resolution || 'days';
          
          if (stepResolution === 'days') {
            // שלב בחירת יום - יוצר משתני תאריך
            variables.push({
              name: 'day_date',
              type: 'collected',
              description: `תאריך שנבחר בשלב "${step.id}" (פורמט: DD/MM/YYYY)`
            });
            variables.push({
              name: 'date_and_day',
              type: 'collected',
              description: `תאריך עם יום השבוע בשלב "${step.id}" (פורמט: יום ג', 15/01/2025)`
            });
            
            // אם יש meeting_date - משתנה מיוחד לפגישות
            variables.push({
              name: 'meeting_date',
              type: 'collected',
              description: `תאריך פגישה מבוסס על בחירה בשלב "${step.id}"`
            });
          } else if (stepResolution === 'hours') {
            // שלב בחירת שעה - יוצר משתני זמן
            variables.push({
              name: 'meeting_time',
              type: 'collected',
              description: `שעת פגישה מבוססת על בחירה בשלב "${step.id}"`
            });
          }
          
          // אם יש key מותאם אישית, הוסף גם אותו
          if (stepKey) {
            const resolutionMap: Record<string, string> = {
              'days': 'תאריך (יום)',
              'hours': 'שעה',
              'weeks': 'שבוע',
              'months': 'חודש'
            };
            const resolutionText = resolutionMap[stepResolution] || 'תאריך/שעה';
            
            variables.push({
              name: stepKey,
              type: 'collected',
              description: `${resolutionText} מותאם אישית בשלב "${step.id}"`
            });
    }
          break;
        
        case 'message':
        case 'condition':
          // שלבי הודעה ותנאי לא יוצרים משתנים חדשים
          break;
      }
    });
    
    // החזרת רשימה ייחודית ומסודרת
    const uniqueVariables = variables.filter((variable, index, self) => 
      index === self.findIndex(v => v.name === variable.name)
    );
    
    // סידור: משתנים בסיסיים קודם, אחר כך לפי ABC
    return uniqueVariables.sort((a, b) => {
      if (a.type === 'basic' && b.type !== 'basic') return -1;
      if (a.type !== 'basic' && b.type === 'basic') return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const getVariableDescription = (variable: string): string => {
    const variableData = getAvailableVariables().find(v => v.name === variable);
    return variableData?.description || `משתנה "${variable}"`;
  };

  const getVariableColor = (variable: string): 'primary' | 'secondary' | 'success' | 'warning' => {
    if (['full_name', 'city_name', 'mobility'].includes(variable)) return 'primary';
    if (['meeting_date', 'meeting_time'].includes(variable)) return 'success';
    if (['day_date', 'date_and_day'].includes(variable)) return 'warning';
    if (['phone', 'user_id'].includes(variable)) return 'secondary';
    return 'primary';
  };

  const handleVariableClick = (variable: string) => {
    const textToCopy = `{${variable}}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      console.log(`📋 Copied to clipboard: ${textToCopy}`);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  };

  const availableVariables = getAvailableVariables();

  if (availableVariables.length === 0) {
    return (
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          אין משתנים זמינים בשלב זה
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
        📊 משתנים זמינים לשימוש
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        ניתן להשתמש במשתנים הבאים בטקסט ההודעה עם סוגריים מסולסלים: {'{variable_name}'}
      </Typography>
      
      <Divider sx={{ my: 1 }} />
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {availableVariables.map((variable) => (
          <Chip
            key={variable.name}
            label={`{${variable.name}}`}
            size="small"
            color={getVariableColor(variable.name)}
            variant="outlined"
            title={getVariableDescription(variable.name)}
            onClick={() => handleVariableClick(variable.name)}
            sx={{ 
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'primary.light',
                color: 'white'
              }
            }}
          />
        ))}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        💡 לחץ על משתנה כדי להעתיק אותו ללוח
      </Typography>
    </Box>
  );
};

export default VariableDisplay; 