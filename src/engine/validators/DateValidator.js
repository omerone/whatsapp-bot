const BaseValidator = require('./BaseValidator');

/**
 * DateValidator - ולידטור לתאריכים
 */
class DateValidator extends BaseValidator {
    // תבניות תאריך נתמכות
    static datePatterns = {
        // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
        israeliFormat: /^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2}|\d{4})$/,
        // YYYY/MM/DD or YYYY.MM.DD or YYYY-MM-DD
        standardFormat: /^(\d{4}|\d{2})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/
    };

    // הודעות ברירת מחדל
    static defaultMessages = {
        empty: 'אנא הכנס תאריך',
        invalid: 'התאריך שהזנת אינו תקין',
        futureOnly: 'אנא הכנס תאריך עתידי',
        pastOnly: 'אנא הכנס תאריך בעבר',
        tooEarly: 'התאריך מוקדם מדי',
        tooLate: 'התאריך מאוחר מדי',
        invalidRange: 'התאריך אינו בטווח המותר'
    };

    /**
     * מנסה לפרסר תאריך לפי פורמטים שונים
     * @param {string} input - תאריך כטקסט
     * @returns {Date|null} - אובייקט Date או null אם לא תקין
     */
    static parseDate(input) {
        // Check for DD/MM/YYYY format (Israeli format)
        const israeliMatch = input.match(this.datePatterns.israeliFormat);
        if (israeliMatch) {
            const [_, day, month, year] = israeliMatch;
            
            // Basic validation of components
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year.length === 2 ? '20' + year : year, 10);
            
            if (monthNum < 1 || monthNum > 12) {
                return null;
            }
            
            // Create date with explicit year, month, day values
            const date = new Date(yearNum, monthNum - 1, dayNum);
            
            // Additional validation: JS Date will auto-correct invalid dates
            // Check if the month and day were not changed by the auto-correction
            if (date.getFullYear() !== yearNum || 
                date.getMonth() !== monthNum - 1 || 
                date.getDate() !== dayNum) {
                return null;
            }
            
            return date;
        }

        // Check for YYYY/MM/DD format (standard format)
        const standardMatch = input.match(this.datePatterns.standardFormat);
        if (standardMatch) {
            const [_, year, month, day] = standardMatch;
            
            // Basic validation of components
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year.length === 2 ? '20' + year : year, 10);
            
            if (monthNum < 1 || monthNum > 12) {
                return null;
            }
            
            // Create date with explicit year, month, day values
            const date = new Date(yearNum, monthNum - 1, dayNum);
            
            // Additional validation: JS Date will auto-correct invalid dates
            // Check if the month and day were not changed by the auto-correction
            if (date.getFullYear() !== yearNum || 
                date.getMonth() !== monthNum - 1 || 
                date.getDate() !== dayNum) {
                return null;
            }
            
            return date;
        }

        // Try direct parsing as last resort
        try {
            const directDate = new Date(input);
            if (!isNaN(directDate.getTime())) {
                return directDate;
            }
        } catch (e) {
            // Silent fail on parsing error
        }

        return null;
    }

    /**
     * בדיקה האם תאריך הוא עתידי
     * @param {Date} date - התאריך לבדיקה
     * @returns {boolean} - האם התאריך עתידי
     */
    static isFutureDate(date) {
        const now = new Date();
        return date > now;
    }

    /**
     * בדיקה האם תאריך הוא בעבר
     * @param {Date} date - התאריך לבדיקה
     * @returns {boolean} - האם התאריך בעבר
     */
    static isPastDate(date) {
        const now = new Date();
        return date < now;
    }

    /**
     * ולידציה לתאריך
     * @param {string} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות ולידציה
     * @returns {Object} - תוצאת הולידציה
     */
    static validate(input, options = {}) {
        const messages = { ...this.defaultMessages, ...options.messages };
        const config = {
            minDate: null,
            maxDate: null,
            futureOnly: false,
            pastOnly: false,
            ...options
        };

        // Replace errorMessages with messages if provided
        if (options.errorMessages) {
            Object.assign(messages, options.errorMessages);
        }

        if (this.isEmpty(input)) {
            return this.createResponse(false, null, messages.empty);
        }

        const normalizedInput = this.normalizeInput(input);
        const parsedDate = this.parseDate(normalizedInput);

        if (!parsedDate) {
            return this.createResponse(false, null, messages.invalid);
        }
        
        // בדיקת תאריך - עתידי או עבר
        if (config.pastOnly === true) {
            const isPast = this.isPastDate(parsedDate);
            if (!isPast) {
                return this.createResponse(false, null, messages.pastOnly);
            }
        } else if (config.futureOnly === true) {
            const isFuture = this.isFutureDate(parsedDate);
            if (!isFuture) {
                return this.createResponse(false, null, messages.futureOnly);
            }
        }

        // בדיקת תאריך מינימלי
        if (config.minDate && parsedDate < new Date(config.minDate)) {
            return this.createResponse(false, null, messages.tooEarly);
        }

        // בדיקת תאריך מקסימלי
        if (config.maxDate && parsedDate > new Date(config.maxDate)) {
            return this.createResponse(false, null, messages.tooLate);
        }

        return this.createResponse(true, parsedDate);
    }
}

module.exports = DateValidator; 