/**
 * בדיקת מערכת הולידציה החדשה
 * קובץ זה בודק את כל סוגי הולידטורים ומוודא שהם עובדים כראוי
 */

const { getValidator, validate, validators } = require('../engine/validators/index');
const fs = require('fs');
const path = require('path');

// טעינת דוגמת תסריט לבדיקה
const exampleFlowPath = path.join(__dirname, '../../data/flows/validation-example.json');
const flow = JSON.parse(fs.readFileSync(exampleFlowPath, 'utf8'));

console.log('✅ טעינת תסריט מוצלחת');

// פונקציית דיבאג עבור בדיקות ולידציה
function debugValidationTest(step, input) {
    console.log('\n--- DEBUG INFO ---');
    console.log(`Step: ${step.id}`);
    console.log(`Input: "${input}"`);
    console.log(`Validation type: ${step.validation.type}`);
    console.log(`Validation config:`, JSON.stringify(step.validation, null, 2));
    
    const validator = getValidator(step.validation.type);
    if (validator) {
        console.log(`Direct validator test:`);
        try {
            const options = { 
                ...step.validation,
                messages: step.validation.errorMessages || {}
            };
            const result = validator.validate(input, options);
            console.log(`Result:`, JSON.stringify(result, null, 2));
        } catch (e) {
            console.log(`Error:`, e.message);
        }
    }
    
    console.log('--- END DEBUG ---\n');
}

// רשימת הבדיקות
const tests = [
    // בדיקת ולידציית שם
    {
        step: flow.steps.ask_name,
        inputs: [
            { input: '', expected: false, message: 'קלט ריק' },
            { input: 'אבי', expected: false, message: 'שם קצר מדי' },
            { input: 'ישראל ישראלי', expected: true, message: 'שם מלא תקין' },
            { input: 'ישראל ישראלי הישראלי', expected: true, message: 'שם מלא עם שם נוסף' },
            { input: 'תל אביב', expected: false, message: 'שם עיר' }
        ]
    },
    
    // בדיקת ולידציית אימייל
    {
        step: flow.steps.ask_email,
        inputs: [
            { input: '', expected: false, message: 'קלט ריק' },
            { input: 'test', expected: false, message: 'אימייל לא תקין' },
            { input: 'test@', expected: false, message: 'אימייל לא תקין' },
            { input: 'test@example', expected: false, message: 'אימייל לא תקין' },
            { input: 'test@example.com', expected: true, message: 'אימייל תקין' }
        ]
    },

    // בדיקת ולידציית גיל
    {
        step: flow.steps.ask_age,
        inputs: [
            { input: '', expected: false, message: 'קלט ריק' },
            { input: 'abc', expected: false, message: 'לא מספר' },
            { input: '17', expected: false, message: 'מתחת למינימום' },
            { input: '121', expected: false, message: 'מעל המקסימום' },
            { input: '35', expected: true, message: 'גיל תקין' }
        ]
    },

    // בדיקת ולידציית תאריך
    {
        step: flow.steps.ask_birth_date,
        inputs: [
            { input: '', expected: false, message: 'קלט ריק' },
            { input: 'abc', expected: false, message: 'לא תאריך' },
            { input: '30/13/2000', expected: false, message: 'תאריך לא תקין' },
            { 
                // בדיקת תאריך עתידי - שנה מהיום
                input: (() => {
                    const futureDate = new Date();
                    futureDate.setFullYear(futureDate.getFullYear() + 1);
                    return `${futureDate.getDate().toString().padStart(2, '0')}/${(futureDate.getMonth()+1).toString().padStart(2, '0')}/${futureDate.getFullYear()}`;
                })(), 
                expected: false, 
                message: 'תאריך עתידי (לא מתאים לפסטאונלי)',
                debug: true
            },
            { input: '01/01/2000', expected: true, message: 'תאריך תקין' },
            { input: '2000-01-01', expected: true, message: 'תאריך תקין בפורמט אחר' },
            { input: '1.1.2000', expected: true, message: 'תאריך תקין בפורמט אחר' }
        ]
    }
];

// מעבר על כל הבדיקות
console.log('\n=== מתחיל בדיקות מערכת הולידציה ===\n');
let totalTests = 0;
let passedTests = 0;

for (const testCase of tests) {
    console.log(`\n----- בדיקת ולידטור: ${testCase.step.validation.type} -----`);
    
    for (const test of testCase.inputs) {
        totalTests++;
        
        // הפעלת דיבאג אם נדרש
        if (test.debug) {
            debugValidationTest(testCase.step, test.input);
        }
        
        // בדיקת הולידציה באמצעות validate
        const result = validate(test.input, testCase.step);
        
        // הדפסת תוצאות
        const passed = result.isValid === test.expected;
        console.log(
            `${passed ? '✅' : '❌'} ${test.message}: "${test.input}" => ` +
            `${result.isValid ? 'תקין' : 'לא תקין'}, ` +
            `הודעה: ${result.isValid ? result.value : result.message}`
        );
        
        if (passed) {
            passedTests++;
        }
    }
}

// סיכום הבדיקות
console.log(`\n=== סיכום הבדיקות: ${passedTests}/${totalTests} עברו בהצלחה ===`);

if (passedTests === totalTests) {
    console.log('🎉 כל הבדיקות עברו בהצלחה! מערכת הולידציה עובדת כהלכה.');
} else {
    console.log('⚠️ חלק מהבדיקות נכשלו. יש לבדוק את הולידטורים או את הגדרות הבדיקה.');
} 