const fs = require('fs');
const path = require('path');

// נתיבים לקבצים
const sourceFilePath = '/Users/omermaoz/whatssapp-bot/data/flows/demo.json';
const targetFilePath = '/Users/omermaoz/whatssapp-bot/data/flow.json';

// קריאת הקבצים
try {
  // קריאת קובץ המקור (demo.json)
  const sourceData = JSON.parse(fs.readFileSync(sourceFilePath, 'utf8'));
  
  // קריאת קובץ היעד (flow.json)
  const targetData = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));
  
  // מעבר על כל הצעדים בקובץ המקור
  let positionsUpdated = 0;
  const sourceSteps = sourceData.steps || {};
  const targetSteps = targetData.steps || {};
  
  // רשימת צעדים שלא נמצאו בקובץ היעד
  const missingSteps = [];
  
  console.log('מעתיק ערכי מיקום מ-demo.json ל-flow.json...');
  
  // מעבר על כל הצעדים בקובץ המקור
  for (const stepId in sourceSteps) {
    const sourceStep = sourceSteps[stepId];
    
    // בדיקה אם הצעד קיים בקובץ היעד
    if (targetSteps[stepId]) {
      // בדיקה אם יש ערכי position בצעד המקור
      if (sourceStep.position && typeof sourceStep.position.x === 'number' && typeof sourceStep.position.y === 'number') {
        // העתקת ערכי position לצעד היעד
        targetSteps[stepId].position = {
          x: sourceStep.position.x,
          y: sourceStep.position.y
        };
        
        positionsUpdated++;
        console.log(`עודכן מיקום לצעד ${stepId}: x=${sourceStep.position.x}, y=${sourceStep.position.y}`);
      }
    } else {
      // הצעד לא נמצא בקובץ היעד
      missingSteps.push(stepId);
    }
  }
  
  // שמירת הקובץ המעודכן
  fs.writeFileSync(targetFilePath, JSON.stringify(targetData, null, 2), 'utf8');
  
  console.log(`\nסיכום:`);
  console.log(`עודכנו ${positionsUpdated} צעדים עם ערכי מיקום.`);
  
  if (missingSteps.length > 0) {
    console.log(`\nהצעדים הבאים נמצאו ב-demo.json אך לא נמצאו ב-flow.json:`);
    missingSteps.forEach(stepId => console.log(`- ${stepId}`));
  }
  
  console.log(`\nהקובץ ${targetFilePath} עודכן בהצלחה!`);
  
} catch (error) {
  console.error('שגיאה בעיבוד הקבצים:', error);
} 