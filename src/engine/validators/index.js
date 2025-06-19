/**
 * Validators index - מרכז את כל הולידטורים במערכת
 * מחליף את ValidatorRegistry ו-ValidationHandler
 */

// Import all validators
const NameValidator = require('./NameValidator');
const EmailValidator = require('./EmailValidator');
const AgeValidator = require('./AgeValidator');
const DateValidator = require('./DateValidator');
const LocationValidator = require('./LocationValidator');

// Map of validator types to their implementations
const validators = {
    'Name': NameValidator,
    'FullName': NameValidator,
    'Email': EmailValidator,
    'Age': AgeValidator,
    'Date': DateValidator,
    'Location': LocationValidator,
    'City': LocationValidator,
    'Area': LocationValidator
};

/**
 * Get a validator by type
 * @param {string} type - The validator type
 * @returns {Object} - The validator object
 */
function getValidator(type) {
    const validator = validators[type];
    if (!validator) {
        throw new Error(`Validator type '${type}' not found`);
    }
    return validator;
}

/**
 * Validate input based on step configuration
 * @param {string} input - User input
 * @param {Object} step - Step configuration
 * @returns {Object} - Validation result
 */
function validate(input, step) {
    // If no validation rules, input is valid
    if (!step.validation || !step.validation.type) {
        return { isValid: true, value: input };
    }

    const validatorType = step.validation.type;
    const validator = getValidator(validatorType);

    // If no validator found for this type, input is valid
    if (!validator) {
        console.warn(`Validation: No validator found for type ${validatorType}`);
        return { isValid: true, value: input };
    }

    // Build options for validator based on step configuration
    const options = {
        ...step.validation,
        messages: step.validation.errorMessages || {}
    };

    // Perform validation
    try {
        return validator.validate(input, options);
    } catch (error) {
        console.error(`Validation: Error validating with ${validatorType}:`, error);
        return { 
            isValid: false, 
            message: `שגיאה בבדיקת הקלט. אנא נסה שנית.`
        };
    }
}

module.exports = {
    getValidator,
    validate,
    validators
}; 