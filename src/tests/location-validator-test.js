/**
 * בדיקת LocationValidator
 * קובץ זה בודק את פונקציונליות ולידטור המיקום
 */

const { getValidator } = require('../engine/validators/index');
const LocationValidator = require('../engine/validators/LocationValidator');

console.log('=== בדיקת LocationValidator ===');

// קבלת רשימת ערים בשירות
const serviceableCities = LocationValidator.getServiceableCities();
console.log(`מספר ערים בשירות: ${serviceableCities.length}`);
console.log('דוגמאות לערים בשירות:');
console.log(serviceableCities.slice(0, 5));

// קבלת רשימת כל הערים המוכרות
const allCities = LocationValidator.getAllKnownCities();
console.log(`מספר ערים מוכרות: ${allCities.length}`);
console.log('דוגמאות לערים מוכרות:');
console.log(allCities.slice(0, 5));

// בדיקת ולידציה בסיסית
console.log('\n--- בדיקות ולידציה בסיסיות ---');
const testCases = [
    { input: '', expected: false, description: 'קלט ריק' },
    { input: 'תל אביב', expected: true, description: 'עיר תקינה - תל אביב' },
    { input: 'תל-אביב', expected: true, description: 'עיר תקינה עם מקף' },
    { input: 'תא', expected: true, description: 'כינוי לעיר' },
    { input: 'עיר לא קיימת', expected: false, description: 'עיר לא קיימת' },
    { input: 'ירושלים', expected: true, description: 'ירושלים' },
    { input: 'ים', expected: true, description: 'כינוי לירושלים' },
];

for (const testCase of testCases) {
    const result = LocationValidator.validate(testCase.input);
    console.log(`${result.isValid === testCase.expected ? '✅' : '❌'} ${testCase.description}: "${testCase.input}" => ${result.isValid ? 'תקין' : 'לא תקין'}`);
    if (result.isValid) {
        console.log(`   ערך מנורמל: ${result.value}`);
        console.log(`   אופנוע מאופשר: ${result.motoEnabled ? 'כן' : 'לא'}`);
    } else {
        console.log(`   הודעת שגיאה: ${result.message}`);
    }
}

// בדיקת הצעות
console.log('\n--- בדיקת הצעות ---');
const suggestionsTests = [
    { input: 'תלאביב', description: 'הצעה לתל אביב' },
    { input: 'ירושליים', description: 'הצעה לירושלים' },
    { input: 'פתח-תקוה', description: 'הצעה לפתח תקווה' },
    { input: 'רמתגן', description: 'הצעה לרמת גן' },
];

for (const test of suggestionsTests) {
    const result = LocationValidator.validate(test.input);
    console.log(`${test.description}: "${test.input}"`);
    if (result.isValid) {
        console.log(`   ✅ זוהתה כעיר תקינה: ${result.value}`);
    } else if (result.suggestedCity) {
        console.log(`   🔍 הצעה: ${result.suggestedCity}`);
        console.log(`   הודעה: ${result.message}`);
    } else {
        console.log(`   ❌ לא זוהתה: ${result.message}`);
    }
}

// בדיקת אישור הצעה
console.log('\n--- בדיקת אישור הצעה ---');
const pendingSuggestion = 'תל אביב';
const confirmResult = LocationValidator.validate('כן', { pendingSuggestion });
console.log(`אישור הצעה "${pendingSuggestion}": ${confirmResult.isValid ? '✅ אושר' : '❌ לא אושר'}`);
if (confirmResult.isValid) {
    console.log(`   ערך מאושר: ${confirmResult.value}`);
} else {
    console.log(`   הודעת שגיאה: ${confirmResult.message}`);
}

console.log('\n=== סיום בדיקת LocationValidator ==='); 