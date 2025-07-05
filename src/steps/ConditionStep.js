class ConditionStep {
    static async process(step, session, input, flowEngine) {
        console.log(`🔀 בדיקת תנאי: ${step.id}`);
        
        try {
            const lead = await flowEngine.leadsManager.getLead(session.userId);
            if (!lead) {
                console.error(`❌ לא נמצא lead עבור ${session.userId}`);
                // Silent error - go to default or first condition's next
                const conditions = step.conditions || [];
                const fallbackNext = step.defaultNext || (conditions[0] && conditions[0].next);
                if (fallbackNext) {
                    return {
                        messages: [],
                        nextStep: fallbackNext,
                        waitForUser: false
                    };
                }
                return { messages: [], waitForUser: true };
            }

            const conditions = step.conditions || [];
            const defaultNext = step.defaultNext;

            // בדיקת כל תנאי לפי הסדר
            for (const condition of conditions) {
                const result = await ConditionStep.evaluateCondition(condition, lead, session.userId);
                console.log(`🔍 תנאי ${condition.variable} ${condition.operator}: ${result ? '✅ התקיים' : '❌ לא התקיים'}`);
                
                if (result) {
                    console.log(`✅ עובר לשלב: ${condition.next}`);
                    return {
                        messages: [], // שלב תנאי שקט - אין הודעות
                        nextStep: condition.next,
                        waitForUser: false
                    };
                }
            }

            // אם אף תנאי לא התקיים, עבור לשלב ברירת המחדל
            if (defaultNext) {
                console.log(`📋 אף תנאי לא התקיים, עובר לברירת מחדל: ${defaultNext}`);
                return {
                    messages: [], // שלב תנאי שקט - אין הודעות
                    nextStep: defaultNext,
                    waitForUser: false
                };
            }

            // אם אין שלב ברירת מחדל, לוג שגיאה אבל אל תשלח הודעה למשתמש
            console.error(`❌ אין שלב ברירת מחדל מוגדר עבור: ${step.id}`);
            return {
                messages: [], // שקט גם במקרה של שגיאה
                waitForUser: true // עצור את הזרימה
            };

        } catch (error) {
            console.error(`❌ שגיאה בעיבוד תנאי:`, error.message);
            return { 
                messages: [], // שקט גם במקרה של שגיאה
                waitForUser: true 
            };
        }
    }

    // Legacy method for backward compatibility
    async execute(userId, userInput, leadsManager) {
        console.log(`[ConditionStep] 🔀 Executing condition step: ${this.stepData.id}`);
        
        try {
            const lead = await leadsManager.getLead(userId);
            if (!lead) {
                console.error(`[ConditionStep] ❌ No lead found for ${userId}`);
                return { success: false, error: 'No lead found' };
            }

            // בדיקת כל תנאי לפי הסדר
            for (const condition of this.conditions) {
                const result = await this.evaluateCondition(condition, lead, userId);
                console.log(`[ConditionStep] 🔍 Condition ${condition.variable} ${condition.operator} ${condition.value || 'N/A'}: ${result}`);
                
                if (result) {
                    console.log(`[ConditionStep] ✅ Condition matched, moving to step: ${condition.next}`);
                    return {
                        success: true,
                        nextStep: condition.next,
                        messages: [] // שלבי תנאים לא שולחים הודעות
                    };
                }
            }

            // אם אף תנאי לא התקיים, עבור לשלב ברירת המחדל
            if (this.defaultNext) {
                console.log(`[ConditionStep] 📋 No conditions matched, using default: ${this.defaultNext}`);
                return {
                    success: true,
                    nextStep: this.defaultNext,
                    messages: []
                };
            }

            // אם אין שלב ברירת מחדל, חזור שגיאה
            console.error(`[ConditionStep] ❌ No conditions matched and no default step defined`);
            return {
                success: false,
                error: 'No conditions matched and no default step defined'
            };

        } catch (error) {
            console.error(`[ConditionStep] ❌ Error executing condition step:`, error);
            return { success: false, error: error.message };
        }
    }

    static async evaluateCondition(condition, lead, userId) {
        const { variable, operator, value } = condition;
        
        // קבלת הערך של המשתנה
        let variableValue = ConditionStep.getVariableValue(variable, lead, userId);
        
        console.log(`[ConditionStep] 🔎 Evaluating: ${variable} (${variableValue}) ${operator} ${value}`);

        switch (operator) {
            case 'equals':
                return String(variableValue) === String(value);
                
            case 'notEquals':
                return String(variableValue) !== String(value);
                
            case 'contains':
                if (variableValue == null) return false;
                return String(variableValue).toLowerCase().includes(String(value).toLowerCase());
                
            case 'notContains':
                if (variableValue == null) return true;
                return !String(variableValue).toLowerCase().includes(String(value).toLowerCase());
                
            case 'exists':
                return variableValue != null && variableValue !== '';
                
            case 'notExists':
                return variableValue == null || variableValue === '';
                
            case 'greaterThan':
                const numValue1 = parseFloat(variableValue);
                const numValue2 = parseFloat(value);
                return !isNaN(numValue1) && !isNaN(numValue2) && numValue1 > numValue2;
                
            case 'lessThan':
                const numValue3 = parseFloat(variableValue);
                const numValue4 = parseFloat(value);
                return !isNaN(numValue3) && !isNaN(numValue4) && numValue3 < numValue4;
                
            case 'cityGroupMotorcycleEnabled':
                return await ConditionStep.checkCityGroupMotorcycle(lead);
                
            case 'cityGroupMotorcycleDisabled':
                return !(await ConditionStep.checkCityGroupMotorcycle(lead));
                
            case 'cityGroupCarEnabled':
                return await ConditionStep.checkCityGroupCar(lead);
                
            case 'cityGroupCarDisabled':
                return !(await ConditionStep.checkCityGroupCar(lead));
                
            case 'mobilityEquals':
                const mobilityValue = lead.data?.mobility;
                return String(mobilityValue) === String(value);
                
            case 'mobilityNotEquals':
                const mobilityValue2 = lead.data?.mobility;
                return String(mobilityValue2) !== String(value);
                
            default:
                console.warn(`[ConditionStep] ⚠️ Unknown operator: ${operator}`);
                return false;
        }
    }

    static getVariableValue(variable, lead, userId) {
        // משתנים מיוחדים
        switch (variable) {
            case 'display_name':
                return lead.data?.display_name;
                
            case 'phone':
                return userId.split('@')[0];
                
            case 'current_step':
                return lead.current_step;
                
            case 'is_schedule':
                return lead.is_schedule;
                
            case 'blocked':
                return lead.blocked;
                
            case 'relevant':
                return lead.relevant;
                
            default:
                // חיפוש בנתוני השלב
                if (lead.data && lead.data.hasOwnProperty(variable)) {
                    return lead.data[variable];
                }
                
                // חיפוש בנתוני הפגישה
                if (lead.meeting && lead.meeting.hasOwnProperty(variable)) {
                    return lead.meeting[variable];
                }
                
                // חיפוש ברמה העליונה של ה-lead
                if (lead.hasOwnProperty(variable)) {
                    return lead[variable];
                }
                
                console.log(`[ConditionStep] ⚠️ Variable not found: ${variable}`);
                return null;
        }
    }

    static async checkCityGroupMotorcycle(lead) {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            // Read city-groups.json
            const cityGroupsPath = path.join(__dirname, '..', '..', 'data', 'city-groups.json');
            const cityGroupsData = JSON.parse(await fs.readFile(cityGroupsPath, 'utf8'));
            
            const userCity = lead.data?.city_name;
            if (!userCity) {
                console.log(`[ConditionStep] ⚠️ No city found for user`);
                return false;
            }
            
            console.log(`[ConditionStep] 🏙️ Checking motorcycle availability for city: ${userCity}`);
            
            // Check each group to see if the city is included and if motorcycle is enabled
            for (const [groupName, groupData] of Object.entries(cityGroupsData.groups)) {
                if (groupData.cities && Array.isArray(groupData.cities)) {
                    // Check if user's city is in this group (case insensitive and trimmed)
                    const cityFound = groupData.cities.some(city => 
                        city.trim().toLowerCase() === userCity.trim().toLowerCase()
                    );
                    
                    if (cityFound) {
                        console.log(`[ConditionStep] 🏙️ City ${userCity} found in group: ${groupName}, motoEnabled: ${groupData.motoEnabled}`);
                        return groupData.motoEnabled === true;
                    }
                }
            }
            
            console.log(`[ConditionStep] ⚠️ City ${userCity} not found in any group`);
            return false;
            
        } catch (error) {
            console.error(`[ConditionStep] ❌ Error checking city group motorcycle:`, error);
            return false;
        }
    }

    static async checkCityGroupCar(lead) {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            // Read city-groups.json
            const cityGroupsPath = path.join(__dirname, '..', '..', 'data', 'city-groups.json');
            const cityGroupsData = JSON.parse(await fs.readFile(cityGroupsPath, 'utf8'));
            
            const userCity = lead.data?.city_name;
            if (!userCity) {
                console.log(`[ConditionStep] ⚠️ No city found for user`);
                return false;
            }
            
            console.log(`[ConditionStep] 🏙️ Checking car availability for city: ${userCity}`);
            
            // Check each group to see if the city is included and if car is enabled
            for (const [groupName, groupData] of Object.entries(cityGroupsData.groups)) {
                if (groupData.cities && Array.isArray(groupData.cities)) {
                    // Check if user's city is in this group (case insensitive and trimmed)
                    const cityFound = groupData.cities.some(city => 
                        city.trim().toLowerCase() === userCity.trim().toLowerCase()
                    );
                    
                    if (cityFound) {
                        console.log(`[ConditionStep] 🏙️ City ${userCity} found in group: ${groupName}, carEnabled: ${groupData.carEnabled}`);
                        return groupData.carEnabled === true;
                    }
                }
            }
            
            console.log(`[ConditionStep] ⚠️ City ${userCity} not found in any group`);
            return false;
            
        } catch (error) {
            console.error(`[ConditionStep] ❌ Error checking city group car:`, error);
            return false;
        }
    }
}

module.exports = ConditionStep; 