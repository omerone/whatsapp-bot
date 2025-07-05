const BaseValidator = require('./BaseValidator');
const citiesData = require('../../../data/cities-israel.json');
const cityGroups = require('../../../data/city-groups.json');
const stringSimilarity = require('string-similarity');

/**
 * LocationValidator - ולידטור למיקומים וערים
 */
class LocationValidator extends BaseValidator {
    // הודעות ברירת מחדל
    static defaultMessages = {
        'קלט_ריק': 'לא הזנת עיר. אנא נסה שנית.',
        'עיר_לא_זמינה': 'כתבת את העיר {cityName}, אך לצערנו איננו פועלים בה כרגע. \n במידה וזו טעות הזן את עיר מגוריך.',
        'הצעה_עיר_לא_זמינה': 'זיהינו את העיר *{suggestedCity}*, אך איננו פועלים בה כרגע. \nבמידה וזו טעות הזן את עיר מגוריך.',
        'עיר_לא_מוכרת': 'לא הצלחנו לזהות את העיר שהזנת ({originalInput}). אנא נסה/י שנית או הקש/י שם עיר מוכרת.',
        'הוראת_חזרה': 'לחזרה להתחלה שלח את המילה ״תפריט״',
        'SUGGESTION_SERVICEABLE': 'האם התכוונת ל*{suggestedCity}*?\nהשב כן לאישור או הקלד את שם העיר הנכון.'
    };

    // כינויים לערים
    static cityAliases = {
        'תל אביב': ['תל אביב יפו', 'תא', 'תל-אביב', 'תל אביב-יפו', 'תל אביב יפו'],
        'ראשון לציון': ['ראשלצ', 'ראשל״צ', 'ראשלץ', 'ראשון', 'ראשלצ'],
        'פתח תקווה': ['פתח תקוה', 'פת', 'פתח-תקווה', 'פתח-תקוה', 'פתח תקוה'],
        'אור יהודה': ['אור-יהודה', 'אור יהודא'],
        'רמת גן': ['רמת-גן', 'רג', 'רמתגן'],
        'באר שבע': ['באר-שבע', 'בש', 'ב״ש', 'בש'],
        'כפר סבא': ['כפר-סבא', 'כס', 'כפרסבא'],
        'רמת השרון': ['רמת-השרון', 'רמהש', 'רמת השרון'],
        'הוד השרון': ['הוד-השרון', 'הוד השרון'],
        'נס ציונה': ['נס-ציונה', 'נס ציונה'],
        'קרית אונו': ['קריית אונו', 'קרית-אונו', 'קריית-אונו', 'קרית אונו'],
        'ירושלים': ['ירושליים', 'ירושלם', 'י-ם', 'ים']
    };

    // מטמונים פנימיים
    static _allKnownCities = new Set();
    static _serviceableCities = new Set();
    static _citiesForSimilarity = [];
    static _initialized = false;

    /**
     * אתחול המטמונים (מתבצע פעם אחת בלבד)
     */
    static _initialize() {
        if (this._initialized) return;

        const allCitiesForSim = new Set();

        // טעינת ערים מקובץ cities-israel.json
        if (Array.isArray(citiesData)) {
            citiesData.forEach(city => {
                const trimmedCity = String(city).trim();
                if (trimmedCity) {
                    this._allKnownCities.add(trimmedCity);
                    allCitiesForSim.add(trimmedCity);
                }
            });
        }

        // טעינת ערים מקבוצות אזורים
        if (cityGroups?.groups) {
            for (const groupName in cityGroups.groups) {
                const group = cityGroups.groups[groupName];
                if (group?.cities && Array.isArray(group.cities)) {
                    group.cities.forEach(city => {
                        const trimmedCity = String(city).trim();
                        if (trimmedCity) {
                            this._allKnownCities.add(trimmedCity);
                            allCitiesForSim.add(trimmedCity);
                            if (group.selected) {
                                this._serviceableCities.add(trimmedCity);
                            }
                        }
                    });
                }
            }
        }

        // הוספת כינויים
        for (const canonicalCity in this.cityAliases) {
            const trimmedCanonical = canonicalCity.trim();
            if (trimmedCanonical) {
                this._allKnownCities.add(trimmedCanonical);
                allCitiesForSim.add(trimmedCanonical);
            }
        }

        this._citiesForSimilarity = Array.from(allCitiesForSim);
        this._initialized = true;
    }

    /**
     * המרת קלט לשם עיר קנוני
     * @param {string} input - הקלט מהמשתמש
     * @returns {string} - שם עיר קנוני
     */
    static _getCanonicalCity(input) {
        if (!input) {
            return '';
        }
        
        const normalized = String(input).trim().toLowerCase().replace(/['"״׳]/g, '');
        
        // בדיקה בכינויים
        for (const [canonical, aliases] of Object.entries(this.cityAliases)) {
            if (canonical.toLowerCase() === normalized || 
                aliases.some(alias => alias.toLowerCase().trim() === normalized)) {
                return canonical;
            }
        }

        // בדיקה ברשימת ערים ידועות
        for (const knownCity of this._allKnownCities) {
            if (knownCity.toLowerCase() === normalized) {
                return knownCity;
            }
        }

        return String(input || '').trim();
    }

    /**
     * חיפוש עיר דומה
     * @param {string} input - הקלט מהמשתמש
     * @returns {string|null} - עיר דומה או null
     */
    static findSimilarCity(input, threshold = 0.6) {
        this._initialize();
        
        if (!input) {
            return null;
        }
        
        const normalizedInput = String(input).trim().toLowerCase().replace(/['"״׳]/g, '');
        if (!normalizedInput || this._citiesForSimilarity.length === 0) {
            return null;
        }

        const matches = stringSimilarity.findBestMatch(normalizedInput, this._citiesForSimilarity);
        if (matches.bestMatch.rating > threshold) {
            return matches.bestMatch.target;
        }
        
        return null;
    }

    /**
     * בדיקה אם עיר מאפשרת שירותי אופנוע
     * @param {string} cityName - שם העיר
     * @returns {boolean} - האם אופנוע מאופשר
     */
    static isMotoEnabled(cityName) {
        this._initialize();
        
        const canonicalCity = this._getCanonicalCity(cityName);
        if (!this._serviceableCities.has(canonicalCity)) {
            return false;
        }

        if (!cityGroups?.groups) return false;

        for (const groupName in cityGroups.groups) {
            const group = cityGroups.groups[groupName];
            if (group.selected && group.cities && Array.isArray(group.cities)) {
                if (group.cities.some(cityInGroup => 
                    this._getCanonicalCity(cityInGroup) === canonicalCity)) {
                    return group.motoEnabled || false;
                }
            }
        }
        
        return false;
    }

    /**
     * בדיקה אם עיר מאפשרת שירותי רכב
     * @param {string} cityName - שם העיר
     * @returns {boolean} - האם רכב מאופשר
     */
    static isCarEnabled(cityName) {
        this._initialize();
        
        const canonicalCity = this._getCanonicalCity(cityName);
        if (!this._serviceableCities.has(canonicalCity)) {
            return false;
        }

        if (!cityGroups?.groups) return false;

        for (const groupName in cityGroups.groups) {
            const group = cityGroups.groups[groupName];
            if (group.selected && group.cities && Array.isArray(group.cities)) {
                if (group.cities.some(cityInGroup => 
                    this._getCanonicalCity(cityInGroup) === canonicalCity)) {
                    // If carEnabled is not defined, default to true for backward compatibility
                    return group.carEnabled !== undefined ? group.carEnabled : true;
                }
            }
        }
        
        return false;
    }

    /**
     * ולידציה פשוטה - בדיקה אם עיר נמצאת באזור שירות
     * @param {string} input - הקלט מהמשתמש
     * @returns {Object} - תוצאת ולידציה
     */
    static validateSimple(input) {
        this._initialize();
        
        if (!input || this.isEmpty(input)) {
            return this.createResponse(false, null, 'לא הזנת עיר. אנא נסה שנית.');
        }

        try {
            const normalizedInput = this.normalizeInput(input);
            const canonicalCity = this._getCanonicalCity(normalizedInput);

            if (this._serviceableCities.has(canonicalCity)) {
                return this.createResponse(true, canonicalCity, null, {
                    motoEnabled: this.isMotoEnabled(canonicalCity),
                    carEnabled: this.isCarEnabled(canonicalCity)
                });
            }

            return this.createResponse(false, null, '❌ איננו פועלים באזור זה כרגע.');
        } catch (error) {
            console.error('LocationValidator validateSimple error:', error);
            return this.createResponse(false, null, 'שגיאה בבדיקת העיר. אנא נסה שנית.');
        }
    }

    /**
     * ולידציה מתקדמת - עם הצעות והודעות מותאמות אישית
     * @param {string} input - הקלט מהמשתמש  
     * @param {string|null} pendingSuggestion - הצעה מחכה לאישור
     * @returns {Object} - תוצאת ולידציה מפורטת
     */
    static validateAdvanced(input, pendingSuggestion = null) {
        this._initialize();
        
        // בדיקת קלט לא תקין
        if (input === undefined || input === null) {
            return { status: 'קלט_ריק' };
        }
        
        const normalizedInput = String(input).trim().toLowerCase();
        const originalTrimmedInput = String(input).trim();

        if (!normalizedInput) {
            return { status: 'קלט_ריק' };
        }

        // בדיקת אישור הצעה
        if (pendingSuggestion && normalizedInput === 'כן') {
            if (this._serviceableCities.has(pendingSuggestion)) {
                return { 
                    status: 'CONFIRMED_VALID_SUGGESTION', 
                    value: pendingSuggestion, 
                    motoEnabled: this.isMotoEnabled(pendingSuggestion),
                    carEnabled: this.isCarEnabled(pendingSuggestion)
                };
            } else {
                return { 
                    status: 'עיר_לא_זמינה', 
                    cityName: pendingSuggestion 
                };
            }
        }

        const inputCanonical = this._getCanonicalCity(originalTrimmedInput);

        // עיר תקינה ובשירות
        if (this._serviceableCities.has(inputCanonical)) {
            return { 
                status: 'VALID', 
                value: inputCanonical, 
                motoEnabled: this.isMotoEnabled(inputCanonical),
                carEnabled: this.isCarEnabled(inputCanonical)
            };
        }

        // עיר מוכרת אבל לא בשירות
        if (this._allKnownCities.has(inputCanonical)) {
            return { 
                status: 'עיר_לא_זמינה', 
                cityName: inputCanonical 
            };
        }

        // חיפוש עיר דומה
        const suggestedCity = this.findSimilarCity(originalTrimmedInput);
        if (suggestedCity) {
            if (this._serviceableCities.has(suggestedCity)) {
                return { 
                    status: 'SUGGESTION_SERVICEABLE', 
                    suggestedCity: suggestedCity 
                };
            } else {
                return { 
                    status: 'הצעה_עיר_לא_זמינה', 
                    suggestedCity: suggestedCity 
                };
            }
        }

        return { 
            status: 'עיר_לא_מוכרת', 
            originalInput: originalTrimmedInput 
        };
    }

    /**
     * ולידציה ראשית - אוטומטית לפי סוג הקלט
     * @param {string} input - הקלט מהמשתמש
     * @param {Object} options - אפשרויות ולידציה
     * @returns {Object} - תוצאת ולידציה
     */
    static validate(input, options = {}) {
        this._initialize();
        const messages = { ...this.defaultMessages, ...options.messages };
        
        if (this.isEmpty(input)) {
            return this.createResponse(false, null, messages['קלט_ריק']);
        }

        const normalizedInput = this.normalizeInput(input);
        
        // Use the advanced validation method
        const result = this.validateAdvanced(normalizedInput, options.pendingSuggestion);
        
        // Convert the advanced result to the standard format
        switch (result.status) {
            case 'VALID':
                return this.createResponse(true, result.value, null, { 
                    motoEnabled: result.motoEnabled,
                    carEnabled: result.carEnabled
                });
                
            case 'CONFIRMED_VALID_SUGGESTION':
                return this.createResponse(true, result.value, null, { 
                    motoEnabled: result.motoEnabled,
                    carEnabled: result.carEnabled
                });
                
            case 'SUGGESTION_SERVICEABLE':
                return this.createResponse(false, null, 
                    messages['SUGGESTION_SERVICEABLE']?.replace('{suggestedCity}', result.suggestedCity) || 
                    `האם התכוונת ל*${result.suggestedCity}*?\nהשב כן לאישור או הקלד את שם העיר הנכון.`, 
                    { 
                        suggestedCity: result.suggestedCity,
                        pendingSuggestion: result.suggestedCity
                    }
                );
                
            case 'עיר_לא_זמינה':
                return this.createResponse(false, null, 
                    messages['עיר_לא_זמינה']?.replace('{cityName}', result.cityName) || 
                    `כתבת את העיר ${result.cityName}, אך לצערנו איננו פועלים בה כרגע.`
                );
                
            case 'הצעה_עיר_לא_זמינה':
                return this.createResponse(false, null, 
                    messages['הצעה_עיר_לא_זמינה']?.replace('{suggestedCity}', result.suggestedCity) || 
                    `זיהינו את העיר *${result.suggestedCity}*, אך איננו פועלים בה כרגע.`
                );
                
            case 'עיר_לא_מוכרת':
                return this.createResponse(false, null, 
                    messages['עיר_לא_מוכרת']?.replace('{originalInput}', result.originalInput) || 
                    `לא הצלחנו לזהות את העיר שהזנת (${result.originalInput}). אנא נסה/י שנית.`
                );
                
            case 'קלט_ריק':
            default:
                return this.createResponse(false, null, messages['קלט_ריק']);
        }
    }

    /**
     * קבלת רשימת ערים בשירות
     * @returns {Array} - מערך ערים בשירות
     */
    static getServiceableCities() {
        this._initialize();
        return Array.from(this._serviceableCities);
    }

    /**
     * קבלת רשימת כל הערים המוכרות
     * @returns {Array} - מערך כל הערים
     */
    static getAllKnownCities() {
        this._initialize();
        return Array.from(this._allKnownCities);
    }
}

module.exports = LocationValidator; 