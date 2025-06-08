/**
 * BaseValidator - מחלקת בסיס לכל הולידטורים
 * מספקת interface אחיד ופונקציונליות בסיסית לכל הולידטורים
 */
class BaseValidator {
    /**
     * מבצע ולידציה על הקלט
     * @param {string} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות נוספות לולידציה
     * @returns {Object} - תוצאת הולידציה
     */
    static validate(input, options = {}) {
        throw new Error('validate method must be implemented by subclass');
    }

    /**
     * ניקוי והכנת הקלט לבדיקה
     * @param {string} input - הקלט הגולמי
     * @returns {string} - קלט מנוקה
     */
    static normalizeInput(input) {
        if (typeof input !== 'string') {
            return String(input).trim();
        }
        return input.trim().replace(/\s+/g, ' ');
    }

    /**
     * יצירת תגובה אחידה לולידציה
     * @param {boolean} isValid - האם הקלט תקין
     * @param {string|null} value - הערך המנוקה (אם תקין)
     * @param {string|null} message - הודעת שגיאה (אם לא תקין)
     * @param {Object} additionalData - נתונים נוספים
     * @returns {Object} - תגובת ולידציה אחידה
     */
    static createResponse(isValid, value = null, message = null, additionalData = {}) {
        const response = {
            isValid,
            ...(isValid ? { value } : { message }),
            ...additionalData
        };
        return response;
    }

    /**
     * בדיקה אם הקלט ריק
     * @param {string} input - הקלט לבדיקה
     * @returns {boolean} - האם הקלט ריק
     */
    static isEmpty(input) {
        return !input || input.trim().length === 0;
    }

    /**
     * בדיקת תווים מותרים
     * @param {string} input - הקלט לבדיקה
     * @param {RegExp} allowedPattern - ביטוי רגולרי של תווים מותרים
     * @returns {boolean} - האם הקלט מכיל רק תווים מותרים
     */
    static hasOnlyAllowedCharacters(input, allowedPattern) {
        return allowedPattern.test(input);
    }

    /**
     * ספירת מילים בקלט
     * @param {string} input - הקלט לבדיקה
     * @returns {number} - מספר המילים
     */
    static countWords(input) {
        return input.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * בדיקת מינימום מילים
     * @param {string} input - הקלט לבדיקה
     * @param {number} minWords - מספר מילים מינימלי
     * @returns {boolean} - האם יש מספר מילים מינימלי
     */
    static hasMinimumWords(input, minWords) {
        return this.countWords(input) >= minWords;
    }

    /**
     * בדיקת מקסימום מילים
     * @param {string} input - הקלט לבדיקה
     * @param {number} maxWords - מספר מילים מקסימלי
     * @returns {boolean} - האם המספר מילים לא עולה על המקסימום
     */
    static hasMaximumWords(input, maxWords) {
        return this.countWords(input) <= maxWords;
    }

    /**
     * בדיקת אורך מינימלי
     * @param {string} input - הקלט לבדיקה
     * @param {number} minLength - אורך מינימלי
     * @returns {boolean} - האם האורך מינימלי
     */
    static hasMinimumLength(input, minLength) {
        return input.length >= minLength;
    }

    /**
     * בדיקת אורך מקסימלי
     * @param {string} input - הקלט לבדיקה
     * @param {number} maxLength - אורך מקסימלי
     * @returns {boolean} - האם האורך לא עולה על המקסימום
     */
    static hasMaximumLength(input, maxLength) {
        return input.length <= maxLength;
    }
}

module.exports = BaseValidator; 