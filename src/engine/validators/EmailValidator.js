const BaseValidator = require('./BaseValidator');

/**
 * EmailValidator - ולידטור לכתובות דואר אלקטרוני
 */
class EmailValidator extends BaseValidator {
    // תבנית לולידציה של אימייל
    static emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // הודעות ברירת מחדל
    static defaultMessages = {
        empty: 'אנא הכנס כתובת אימייל',
        invalid: 'כתובת האימייל שהזנת אינה תקינה'
    };

    /**
     * בדיקת תקינות כתובת אימייל
     * @param {string} email - כתובת האימייל לבדיקה
     * @returns {boolean} - האם כתובת האימייל תקינה
     */
    static isValidEmail(email) {
        return this.emailPattern.test(email);
    }

    /**
     * ולידציה לכתובת אימייל
     * @param {string} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות נוספות לולידציה
     * @returns {Object} - תוצאת הולידציה
     */
    static validate(input, options = {}) {
        const messages = { ...this.defaultMessages, ...options.messages };

        if (this.isEmpty(input)) {
            return this.createResponse(false, null, messages.empty);
        }

        const normalizedInput = this.normalizeInput(input);

        if (!this.isValidEmail(normalizedInput)) {
            return this.createResponse(false, null, messages.invalid);
        }

        return this.createResponse(true, normalizedInput);
    }
}

module.exports = EmailValidator; 