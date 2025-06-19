/**
 * Test file for validation flow
 */

const validators = require('../engine/validators/index');
const QuestionStep = require('../steps/QuestionStep');

// Mock flow engine
const mockFlowEngine = {
    processStepInternal: (userId) => {
        return { messages: ['Processed next step'], waitForUser: true };
    }
};

// Helper function to safely log messages
function logResult(result) {
    if (!result || !result.messages || result.messages.length === 0) {
        console.log('Result: No message returned');
    } else {
        console.log('Result:', result.messages[0] || 'Empty message');
    }
}

// Test name validation
async function testNameValidation() {
    console.log('\n--- Testing Name Validation ---');
    
    const step = {
        id: 'ask_name',
        type: 'question',
        message: 'מה שמך המלא?',
        key: 'full_name',
        validation: {
            type: 'Name',
            errorMessages: {
                empty: 'אנא הכנס שם',
                tooShort: 'השם קצר מדי',
                notEnoughWords: 'אנא הכנס שם מלא',
                tooManyWords: 'יותר מדי מילים',
                invalidCharacters: 'תווים לא חוקיים',
                duplicateWords: 'מילים כפולות',
                cityName: 'שם של עיר'
            }
        },
        next: 'next_step'
    };
    
    const session = { userId: '123', data: {}, currentStep: 'ask_name' };
    
    // Test case 1: Empty input
    console.log('Test case 1: Empty input');
    const result1 = await QuestionStep.process(step, { ...session }, '', mockFlowEngine);
    logResult(result1);
    
    // Test case 2: Too short
    console.log('\nTest case 2: Too short');
    const result2 = await QuestionStep.process(step, { ...session }, 'דן', mockFlowEngine);
    logResult(result2);
    
    // Test case 3: Not enough words
    console.log('\nTest case 3: Not enough words');
    const result3 = await QuestionStep.process(step, { ...session }, 'דניאל', mockFlowEngine);
    logResult(result3);
    
    // Test case 4: Valid input
    console.log('\nTest case 4: Valid input');
    const result4 = await QuestionStep.process(step, { ...session }, 'דניאל כהן', mockFlowEngine);
    logResult(result4);
}

// Test location validation
async function testLocationValidation() {
    console.log('\n--- Testing Location Validation ---');
    
    const step = {
        id: 'ask_city',
        type: 'question',
        message: 'מהי עיר מגוריך?',
        key: 'city_name',
        validation: {
            type: 'Location'
        },
        cityValidationConfig: {
            messages: {
                קלט_ריק: 'לא הזנת עיר',
                עיר_לא_זמינה: 'איננו פועלים ב{cityName}',
                SUGGESTION_SERVICEABLE: 'האם התכוונת ל{suggestedCity}?',
                עיר_לא_מוכרת: 'לא הכרנו את העיר {originalInput}'
            }
        },
        options: {
            'כן': 'confirm_suggestion'
        },
        branches: {
            'confirm_suggestion': 'next_step'
        },
        next: 'next_step'
    };
    
    const session = { userId: '123', data: {}, currentStep: 'ask_city' };
    
    // Mock validation results for location
    const originalValidate = validators.validate;
    validators.validate = (input, stepConfig) => {
        if (input === '') {
            return { isValid: false, status: 'קלט_ריק', message: 'לא הזנת עיר' };
        } else if (input === 'אילת') {
            return { isValid: false, status: 'עיר_לא_זמינה', cityName: 'אילת', message: 'איננו פועלים באילת' };
        } else if (input === 'תא') {
            return { isValid: false, status: 'SUGGESTION_SERVICEABLE', suggestedCity: 'תל אביב', message: 'האם התכוונת לתל אביב?' };
        } else if (input === 'כן' && session.pendingSuggestion) {
            return { isValid: true, value: session.pendingSuggestion };
        } else if (input === 'תל אביב') {
            return { isValid: true, value: 'תל אביב' };
        } else {
            return { isValid: false, status: 'עיר_לא_מוכרת', originalInput: input, message: `לא הכרנו את העיר ${input}` };
        }
    };
    
    // Test case 1: Empty input
    console.log('Test case 1: Empty input');
    const result1 = await QuestionStep.process(step, { ...session }, '', mockFlowEngine);
    logResult(result1);
    
    // Test case 2: City not available
    console.log('\nTest case 2: City not available');
    const result2 = await QuestionStep.process(step, { ...session }, 'אילת', mockFlowEngine);
    logResult(result2);
    
    // Test case 3: City suggestion
    console.log('\nTest case 3: City suggestion');
    const sessionWithSuggestion = { ...session };
    const result3 = await QuestionStep.process(step, sessionWithSuggestion, 'תא', mockFlowEngine);
    logResult(result3);
    console.log('Pending suggestion:', sessionWithSuggestion.pendingSuggestion);
    
    // Test case 4: Confirm suggestion
    console.log('\nTest case 4: Confirm suggestion');
    const result4 = await QuestionStep.process(step, sessionWithSuggestion, 'כן', mockFlowEngine);
    logResult(result4);
    
    // Test case 5: Valid city
    console.log('\nTest case 5: Valid city');
    const result5 = await QuestionStep.process(step, { ...session }, 'תל אביב', mockFlowEngine);
    logResult(result5);
    
    // Restore original validate function
    validators.validate = originalValidate;
}

// Run tests
async function runTests() {
    try {
        await testNameValidation();
        await testLocationValidation();
        console.log('\nAll tests completed');
    } catch (error) {
        console.error('Test error:', error);
    }
}

runTests(); 