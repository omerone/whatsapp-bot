const BaseValidator = require('./BaseValidator');

/**
 * AgeValidator - ולידטור לגיל
 */
class AgeValidator extends BaseValidator {
    // הודעות ברירת מחדל
    static defaultMessages = {
        empty: 'אנא הכנס את גילך',
        notNumber: 'אנא הכנס מספר בלבד',
        tooYoung: 'הגיל שהזנת נמוך מדי',
        tooOld: 'הגיל שהזנת גבוה מדי',
        invalidRange: 'הגיל שהזנת אינו בטווח המותר'
    };

    /**
     * בדיקה האם קלט הוא מספר
     * @param {string} input - הקלט לבדיקה
     * @returns {boolean} - האם הקלט הוא מספר
     */
    static isNumber(input) {
        return !isNaN(parseInt(input)) && isFinite(String(input).trim());
    }

    /**
     * מנרמל את הקלט למספר שלם
     * @param {string|number} input - הקלט לנרמול
     * @returns {number} - הקלט לאחר נרמול
     */
    static normalizeAge(input) {
        return parseInt(String(input).trim());
    }

    /**
     * ולידציה לגיל
     * @param {string|number} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות ולידציה
     * @returns {Object} - תוצאת הולידציה
     */
    static validate(input, options = {}) {
        const messages = { ...this.defaultMessages, ...options.messages };
        const config = {
            minAge: 16,
            maxAge: 120,
            ...options
        };

        if (this.isEmpty(input)) {
            return this.createResponse(false, null, messages.empty);
        }

        const normalizedInput = this.normalizeInput(input);

        if (!this.isNumber(normalizedInput)) {
            return this.createResponse(false, null, messages.notNumber);
        }

        const age = this.normalizeAge(normalizedInput);

        // בדיקת טווח גיל
        if (age < config.minAge) {
            return this.createResponse(false, null, messages.tooYoung);
        }

        if (age > config.maxAge) {
            return this.createResponse(false, null, messages.tooOld);
        }

        return this.createResponse(true, age);
    }
}

module.exports = AgeValidator; 