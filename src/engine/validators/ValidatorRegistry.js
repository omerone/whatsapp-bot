const NameValidator = require('./NameValidator');
const LocationValidator = require('./LocationValidator');
const EmailValidator = require('./EmailValidator');
const AgeValidator = require('./AgeValidator');
const DateValidator = require('./DateValidator');

/**
 * ValidatorRegistry - רישום מרכזי של כל הולידטורים הזמינים במערכת
 * מאפשר לקבל ולידטור לפי סוג
 */
class ValidatorRegistry {
    /**
     * מפתח כל הולידטורים הזמינים במערכת
     * יש להוסיף כל ולידטור חדש כאן
     */
    static validators = {
        'Name': NameValidator,
        'Location': LocationValidator, 
        'Email': EmailValidator,
        'Age': AgeValidator,
        'Date': DateValidator,
    };

    /**
     * מחזיר ולידטור לפי סוג
     * @param {string} type - סוג הולידטור
     * @returns {Object|null} - הולידטור המבוקש או null אם לא קיים
     */
    static getValidator(type) {
        return this.validators[type] || null;
    }

    /**
     * בודק אם קיים ולידטור מסוג מסוים
     * @param {string} type - סוג הולידטור
     * @returns {boolean} - האם הולידטור קיים
     */
    static hasValidator(type) {
        return type in this.validators;
    }

    /**
     * מחזיר רשימה של כל סוגי הולידטורים הזמינים
     * @returns {string[]} - רשימת סוגי הולידטורים
     */
    static getValidatorTypes() {
        return Object.keys(this.validators);
    }
}

module.exports = ValidatorRegistry; 