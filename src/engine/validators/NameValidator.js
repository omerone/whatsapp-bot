const BaseValidator = require('./BaseValidator');

/**
 * NameValidator - ולידטור לשמות עם תמיכה בשמות פרטיים ומלאים
 */
class NameValidator extends BaseValidator {
    // תבניות טקסט רגולריות
    static patterns = {
        hebrewAndEnglish: /^[\u0590-\u05FF\w\s]+$/,
        onlyHebrew: /^[\u0590-\u05FF\s]+$/,
        onlyEnglish: /^[a-zA-Z\s]+$/,
        numbersAndSpecial: /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/
    };

    // הודעות ברירת מחדל
    static defaultMessages = {
        empty: 'אנא הכנס שם',
        tooShort: 'השם קצר מדי',
        tooLong: 'השם ארוך מדי',
        notEnoughWords: 'אנא הכנס שם מלא (שם פרטי ושם משפחה)',
        tooManyWords: 'נראה ששלחת יותר מדי מילים',
        invalidCharacters: 'השם יכול להכיל רק אותיות בעברית ובאנגלית',
        duplicateWords: 'נראה שחזרת על אותה מילה. אנא בדוק שוב',
        cityName: 'נראה שהזנת שם של עיר. אנא הכנס את שמך'
    };

    /**
     * בדיקה אם הקלט הוא שם של עיר
     * @param {string} input - הקלט לבדיקה
     * @returns {boolean} - האם זה שם עיר
     */
    static isCityName(input) {
        try {
            const citiesData = require('../../../data/cities-israel.json');
            if (!Array.isArray(citiesData)) return false;
            
            const inputLower = input.toLowerCase();
            return citiesData.some(city => 
                String(city).trim().toLowerCase() === inputLower
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * בדיקת מילים כפולות
     * @param {string} input - הקלט לבדיקה
     * @returns {boolean} - האם יש מילים כפולות
     */
    static hasDuplicateWords(input) {
        const words = input.trim().split(/\s+/).map(w => w.toLowerCase());
        const uniqueWords = new Set(words);
        return uniqueWords.size !== words.length;
    }

    /**
     * ולידציה לשם פרטי (מילה אחת)
     * @param {string} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות ולידציה
     * @returns {Object} - תוצאת ולידציה
     */
    static validateFirstName(input, options = {}) {
        const messages = { ...this.defaultMessages, ...options.messages };
        const config = {
            minLength: 2,
            maxLength: 20,
            minWords: 1,
            maxWords: 1,
            allowEnglish: true,
            allowHebrew: true,
            ...options
        };

        if (this.isEmpty(input)) {
            return this.createResponse(false, null, messages.empty);
        }

        const normalizedInput = this.normalizeInput(input);

        // בדיקת אורך
        if (!this.hasMinimumLength(normalizedInput, config.minLength)) {
            return this.createResponse(false, null, messages.tooShort);
        }

        if (!this.hasMaximumLength(normalizedInput, config.maxLength)) {
            return this.createResponse(false, null, messages.tooLong);
        }

        // בדיקת מספר מילים
        if (!this.hasMinimumWords(normalizedInput, config.minWords)) {
            return this.createResponse(false, null, messages.notEnoughWords);
        }

        if (!this.hasMaximumWords(normalizedInput, config.maxWords)) {
            return this.createResponse(false, null, messages.tooManyWords);
        }

        // בדיקת תווים מותרים
        let allowedPattern;
        if (config.allowHebrew && config.allowEnglish) {
            allowedPattern = this.patterns.hebrewAndEnglish;
        } else if (config.allowHebrew) {
            allowedPattern = this.patterns.onlyHebrew;
        } else if (config.allowEnglish) {
            allowedPattern = this.patterns.onlyEnglish;
        }

        if (allowedPattern && !this.hasOnlyAllowedCharacters(normalizedInput, allowedPattern)) {
            return this.createResponse(false, null, messages.invalidCharacters);
        }

        return this.createResponse(true, normalizedInput);
    }

    /**
     * ולידציה לשם מלא (שם פרטי + משפחה)
     * @param {string} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות ולידציה
     * @returns {Object} - תוצאת ולידציה
     */
    static validateFullName(input, options = {}) {
        const messages = { ...this.defaultMessages, ...options.messages };
        const config = {
            minLength: 4,
            maxLength: 50,
            minWords: 2,
            maxWords: 4,
            allowEnglish: true,
            allowHebrew: true,
            checkForCityNames: true,
            checkForDuplicates: true,
            ...options
        };

        if (this.isEmpty(input)) {
            return this.createResponse(false, null, messages.empty);
        }

        const normalizedInput = this.normalizeInput(input);

        // בדיקת אורך
        if (!this.hasMinimumLength(normalizedInput, config.minLength)) {
            return this.createResponse(false, null, messages.tooShort);
        }

        if (!this.hasMaximumLength(normalizedInput, config.maxLength)) {
            return this.createResponse(false, null, messages.tooLong);
        }

        // בדיקת מספר מילים
        if (!this.hasMinimumWords(normalizedInput, config.minWords)) {
            return this.createResponse(false, null, messages.notEnoughWords);
        }

        if (!this.hasMaximumWords(normalizedInput, config.maxWords)) {
            return this.createResponse(false, null, messages.tooManyWords);
        }

        // בדיקת תווים מותרים
        let allowedPattern;
        if (config.allowHebrew && config.allowEnglish) {
            allowedPattern = this.patterns.hebrewAndEnglish;
        } else if (config.allowHebrew) {
            allowedPattern = this.patterns.onlyHebrew;
        } else if (config.allowEnglish) {
            allowedPattern = this.patterns.onlyEnglish;
        }

        if (allowedPattern && !this.hasOnlyAllowedCharacters(normalizedInput, allowedPattern)) {
            return this.createResponse(false, null, messages.invalidCharacters);
        }

        // בדיקת מילים כפולות
        if (config.checkForDuplicates && this.hasDuplicateWords(normalizedInput)) {
            return this.createResponse(false, null, messages.duplicateWords);
        }

        // בדיקה אם זה שם עיר
        if (config.checkForCityNames && this.isCityName(normalizedInput)) {
            return this.createResponse(false, null, messages.cityName);
        }

        return this.createResponse(true, normalizedInput);
    }

    /**
     * ולידציה ראשית - מזהה אוטומטית את סוג השם
     * @param {string} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות ולידציה
     * @returns {Object} - תוצאת ולידציה
     */
    static validate(input, options = {}) {
        const config = {
            type: 'fullName', // 'fullName' או 'firstName'
            ...options
        };

        if (config.type === 'firstName') {
            return this.validateFirstName(input, options);
        } else {
            return this.validateFullName(input, options);
        }
    }
}

module.exports = NameValidator; 