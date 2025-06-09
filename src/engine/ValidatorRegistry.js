/**
 * ValidatorRegistry - מערכת ניהול ולידטורים מודולרית ופשוטה
 * מאפשרת רישום, ניהול ושימוש קל בולידטורים הנחוצים בלבד
 * תומכת בשמות קצרים (City) ובשמות קבצים (LocationValidator.js)
 */
class ValidatorRegistry {
    static validators = new Map();
    static aliases = new Map();
    static fileNames = new Map(); // מיפוי שמות קבצים לולידטורים

    /**
     * רישום ולידטור במערכת
     * @param {string} name - שם הולידטור
     * @param {Object} validatorClass - מחלקת הולידטור
     * @param {Array} aliases - כינויים נוספים (אופציונלי)
     * @param {string} fileName - שם הקובץ (אופציונלי)
     */
    static register(name, validatorClass, aliases = [], fileName = null) {
        this.validators.set(name.toLowerCase(), validatorClass);
        
        // רישום כינויים
        aliases.forEach(alias => {
            this.aliases.set(alias.toLowerCase(), name.toLowerCase());
        });

        // רישום שם קובץ אם סופק
        if (fileName) {
            this.fileNames.set(fileName.toLowerCase(), name.toLowerCase());
            // תמיכה גם בגרסה ללא .js
            const fileNameWithoutExt = fileName.replace(/\.js$/i, '');
            this.fileNames.set(fileNameWithoutExt.toLowerCase(), name.toLowerCase());
        }
    }

    /**
     * קבלת ולידטור לפי שם, כינוי או שם קובץ
     * @param {string} name - שם הולידטור, כינוי או שם קובץ
     * @returns {Object|null} - מחלקת הולידטור או null
     */
    static getValidator(name) {
        const normalizedName = name.toLowerCase();
        
        // בדיקה ישירה
        if (this.validators.has(normalizedName)) {
            return this.validators.get(normalizedName);
        }

        // בדיקה בכינויים
        if (this.aliases.has(normalizedName)) {
            const actualName = this.aliases.get(normalizedName);
            return this.validators.get(actualName);
        }

        // בדיקה בשמות קבצים
        if (this.fileNames.has(normalizedName)) {
            const actualName = this.fileNames.get(normalizedName);
            return this.validators.get(actualName);
        }

        return null;
    }

    /**
     * ביצוע ולידציה עם שם ולידטור
     * @param {string} validatorName - שם הולידטור
     * @param {string} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות ולידציה
     * @returns {Object} - תוצאת ולידציה
     */
    static validate(validatorName, input, options = {}) {
        const validatorClass = this.getValidator(validatorName);
        
        if (!validatorClass) {
            return {
                isValid: false,
                message: `Validator '${validatorName}' not found`,
                error: 'VALIDATOR_NOT_FOUND'
            };
        }

        try {
            return validatorClass.validate(input, options);
        } catch (error) {
            console.error(`Error in validator '${validatorName}':`, error);
            return {
                isValid: false,
                message: 'שגיאה בבדיקת הקלט',
                error: 'VALIDATION_ERROR',
                details: error.message
            };
        }
    }

    /**
     * רישום אוטומטי של כל הולידטורים הנחוצים
     */
    static registerStandardValidators() {
        try {
            // רישום הולידטורים הנחוצים בלבד
            const BaseValidator = require('./validators/BaseValidator');
            const LocationValidator = require('./validators/LocationValidator');
            const NameValidator = require('./validators/NameValidator');

            // רישום עם כינויים נפוצים ושמות קבצים
            this.register('Location', LocationValidator, ['City', 'Area', 'Place'], 'LocationValidator.js');
            this.register('Name', NameValidator, ['FullName', 'FirstName'], 'NameValidator.js');

        } catch (error) {
            console.error('Error registering standard validators:', error);
        }
    }

    /**
     * רישום ולידטור מותאם אישית
     * @param {string} name - שם הולידטור
     * @param {Object} config - הגדרות הולידטור
     */
    static registerCustomValidator(name, config) {
        const CustomValidator = class extends (require('./validators/BaseValidator')) {
            static validate(input, options = {}) {
                const mergedConfig = { ...config, ...options };
                
                if (this.isEmpty(input)) {
                    return this.createResponse(false, null, mergedConfig.emptyMessage || 'שדה חובה');
                }

                const normalizedInput = this.normalizeInput(input);

                // בדיקות בסיסיות
                if (mergedConfig.minLength && !this.hasMinimumLength(normalizedInput, mergedConfig.minLength)) {
                    return this.createResponse(false, null, mergedConfig.tooShortMessage || 'טקסט קצר מדי');
                }

                if (mergedConfig.maxLength && !this.hasMaximumLength(normalizedInput, mergedConfig.maxLength)) {
                    return this.createResponse(false, null, mergedConfig.tooLongMessage || 'טקסט ארוך מדי');
                }

                if (mergedConfig.pattern && !mergedConfig.pattern.test(normalizedInput)) {
                    return this.createResponse(false, null, mergedConfig.patternMessage || 'פורמט לא תקין');
                }

                // בדיקה מותאמת אישית
                if (mergedConfig.customCheck && typeof mergedConfig.customCheck === 'function') {
                    const customResult = mergedConfig.customCheck(normalizedInput);
                    if (!customResult.isValid) {
                        return this.createResponse(false, null, customResult.message);
                    }
                }

                return this.createResponse(true, normalizedInput);
            }
        };

        this.register(name, CustomValidator, config.aliases || []);
    }

    /**
     * קבלת רשימת כל הולידטורים הרשומים
     * @returns {Array} - מערך של שמות ולידטורים
     */
    static getAllValidators() {
        return Array.from(this.validators.keys());
    }

    /**
     * קבלת רשימת כל הכינויים
     * @returns {Array} - מערך של כינויים
     */
    static getAllAliases() {
        return Array.from(this.aliases.keys());
    }

    /**
     * בדיקה אם ולידטור קיים
     * @param {string} name - שם הולידטור
     * @returns {boolean} - האם קיים
     */
    static exists(name) {
        return this.getValidator(name) !== null;
    }

    /**
     * הסרת ולידטור
     * @param {string} name - שם הולידטור להסרה
     */
    static unregister(name) {
        const normalizedName = name.toLowerCase();
        this.validators.delete(normalizedName);
        
        // הסרת כינויים
        for (const [alias, target] of this.aliases) {
            if (target === normalizedName) {
                this.aliases.delete(alias);
            }
        }
    }

    /**
     * קבלת רשימת כל שמות הקבצים הרשומים
     * @returns {Array} - מערך של שמות קבצים
     */
    static getAllFileNames() {
        return Array.from(this.fileNames.keys());
    }

    /**
     * קבלת מידע מפורט על ולידטור (שם, כינויים, קובץ)
     * @param {string} name - שם הולידטור
     * @returns {Object|null} - מידע מפורט או null
     */
    static getValidatorInfo(name) {
        const validator = this.getValidator(name);
        if (!validator) return null;

        const normalizedName = name.toLowerCase();
        let actualName = null;

        // מציאת השם האמיתי
        if (this.validators.has(normalizedName)) {
            actualName = normalizedName;
        } else if (this.aliases.has(normalizedName)) {
            actualName = this.aliases.get(normalizedName);
        } else if (this.fileNames.has(normalizedName)) {
            actualName = this.fileNames.get(normalizedName);
        }

        if (!actualName) return null;

        // איסוף כינויים
        const aliases = [];
        for (const [alias, target] of this.aliases) {
            if (target === actualName) {
                aliases.push(alias);
            }
        }

        // איסוף שמות קבצים
        const fileNames = [];
        for (const [fileName, target] of this.fileNames) {
            if (target === actualName) {
                fileNames.push(fileName);
            }
        }

        return {
            name: actualName,
            aliases: aliases,
            fileNames: fileNames,
            validator: validator
        };
    }
}

// רישום אוטומטי של הולידטורים הנחוצים
ValidatorRegistry.registerStandardValidators();

module.exports = ValidatorRegistry; 