const BaseValidator = require('./BaseValidator');
const citiesData = require('../../../data/cities-israel.json');
const cityGroups = require('../../../data/city-groups.json');
const stringSimilarity = require('string-similarity');

/**
 * LocationValidator - ולידטור מאוחד לערים ואזורים
 * מחליף את CityValidator ו-AreaValidator במחלקה אחת מודולרית
 */
class LocationValidator extends BaseValidator {
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

        return String(input).trim();
    }

    /**
     * חיפוש עיר דומה
     * @param {string} input - הקלט מהמשתמש
     * @returns {string|null} - עיר דומה או null
     */
    static findSimilarCity(input, threshold = 0.6) {
        this._initialize();
        
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
     * ולידציה פשוטה - בדיקה אם עיר נמצאת באזור שירות
     * @param {string} input - הקלט מהמשתמש
     * @returns {Object} - תוצאת ולידציה
     */
    static validateSimple(input) {
        this._initialize();
        
        if (this.isEmpty(input)) {
            return this.createResponse(false, null, 'לא הזנת עיר. אנא נסה שנית.');
        }

        const normalizedInput = this.normalizeInput(input);
        const canonicalCity = this._getCanonicalCity(normalizedInput);

        if (this._serviceableCities.has(canonicalCity)) {
            return this.createResponse(true, canonicalCity, null, {
                motoEnabled: this.isMotoEnabled(canonicalCity)
            });
        }

        return this.createResponse(false, null, '❌ איננו פועלים באזור זה כרגע.');
    }

    /**
     * ולידציה מתקדמת - עם הצעות והודעות מותאמות אישית
     * @param {string} input - הקלט מהמשתמש  
     * @param {string|null} pendingSuggestion - הצעה מחכה לאישור
     * @returns {Object} - תוצאת ולידציה מפורטת
     */
    static validateAdvanced(input, pendingSuggestion = null) {
        this._initialize();
        
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
                    motoEnabled: this.isMotoEnabled(pendingSuggestion) 
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
                motoEnabled: this.isMotoEnabled(inputCanonical) 
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
        // אם יש הגדרות הודעות, נשתמש בולידציה מתקדמת
        if (options.messages || options.pendingSuggestion !== undefined) {
            return this.validateAdvanced(input, options.pendingSuggestion);
        }
        
        // אחרת נשתמש בולידציה פשוטה
        return this.validateSimple(input);
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