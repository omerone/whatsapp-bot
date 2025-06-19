const fs = require('fs').promises;
const path = require('path');

class DateStep {
    static async process(step, session, input, flowEngine) {
        try {
            // Check if this resolution is enabled in the global config
            const dateResolutionConfig = flowEngine.flow.rules?.dateResolutionConfig;
            if (dateResolutionConfig) {
                const currentResolution = step.resolution;
                const resolutionConfig = dateResolutionConfig[currentResolution + 's']; // adding 's' for plural (days, weeks, months)
                
                if (resolutionConfig && !resolutionConfig.enabled && step.skipIfDisabled) {
                    // If this resolution is disabled, skip to the next enabled step
                    session.currentStep = step.skipIfDisabled;
                    return flowEngine.processStepInternal(session.userId, null);
                }

                // Override limit from global config if available
                if (resolutionConfig?.limit) {
                    step.limit = resolutionConfig.limit;
                }
            }

            if (input) {
                const validationResult = await this.validateDateChoice(input, session, step, flowEngine);
                if (!validationResult.valid) {
                    return {
                        messages: [validationResult.error],
                        waitForUser: true
                    };
                }
                if (validationResult.action === 'navigate') {
                    session.currentStep = validationResult.targetStep;
                    if (validationResult.targetStep === "show_available_dates") {
                        delete session.selectedWeek;
                        delete session.selectedDate;
                        delete session.selectedTime;
                    } else if (validationResult.targetStep === "show_available_weeks") {
                        delete session.selectedDate;
                        delete session.selectedTime;
                    } else if (validationResult.targetStep === "show_available_days") {
                        delete session.selectedTime;
                    }
                    return flowEngine.processStepInternal(session.userId, null);
                }
                
                // For hours resolution, continue to next step normally
                if (step.resolution === 'hours' && step.next) {
                    session.currentStep = step.next;
                    return flowEngine.processStepInternal(session.userId, null);
                }
                
                if (step.next) {
                    session.currentStep = step.next;
                    return flowEngine.processStepInternal(session.userId, null);
                }
            }

            const availabilityPath = path.join(__dirname, '../../data/availability.json');
            const data = await fs.readFile(availabilityPath, 'utf8');
            const availability = JSON.parse(data);

            const availableDates = Object.entries(availability)
                .filter(([_, times]) => times.length > 0)
                .map(([date]) => date)
                .sort((a, b) => {
                    const [dayA, monthA, yearA] = a.split('/');
                    const [dayB, monthB, yearB] = b.split('/');
                    return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
                });

            if (availableDates.length === 0 && step.resolution !== 'hours') {
                return {
                    messages: ['אין תאריכים זמינים כרגע. אנא נסה שוב מאוחר יותר.'],
                    waitForUser: false
                };
            }

            const limit = step.limit;
            const startFromToday = step.startFromToday !== false; // Default true, unless explicitly set to false
            const resolution = step.resolution || 'days';

            const filteredDates = resolution === 'days' ? 
                this.filterDatesFromToday(availableDates, startFromToday) : 
                availableDates;

            if (filteredDates.length === 0 && step.resolution !== 'hours') {
                return {
                    messages: ['אין תאריכים זמינים בטווח המבוקש. אנא נסה שוב מאוחר יותר.'],
                    waitForUser: false
                };
            }

            const { datesToShow, formattedDates } = await this.handleResolution(resolution, filteredDates, limit, session, availability, flowEngine);

            if (datesToShow.length === 0) {
                if (resolution === 'days' && session.selectedWeek && session.selectedMonth) {
                    return {
                        messages: [
                            `מצטערים, אין ימים זמינים בשבוע שבחרת (${session.selectedWeek}) עבור חודש ${this.formatMonthForDisplay(session.selectedMonth)}. אנא נסה לבחור שבוע אחר או חודש אחר.`,
                            'לשינוי חודש, הקלד "תפריט" ובחר מחדש.'
                        ],
                        waitForUser: false
                    };
                } else if (resolution === 'hours' && session.selectedDate) {
                    return {
                        messages: [
                            `מצטערים, אין שעות זמינות ביום ${session.selectedDate}. אנא נסה לבחור יום אחר.`,
                            step.footerMessage || ''
                        ],
                        waitForUser: true
                    };
                }
                return {
                    messages: ['אין אפשרויות זמינות כרגע. אנא נסה שוב מאוחר יותר.'],
                    waitForUser: false
                };
            }

            session.availableDates = datesToShow;
            session.currentResolution = resolution;

            let dynamicHeader = step.messageHeader;

            if (resolution === 'weeks' && session.selectedMonth) {
                const monthName = this.formatMonthForDisplay(session.selectedMonth);
                dynamicHeader = `📅 *בחר שבוע לפגישה מתוך חודש ${monthName}:*`;
            } else if (resolution === 'days' && session.selectedWeek) {
                dynamicHeader = `📅 *בחר יום לפגישה מתוך שבוע ${session.selectedWeek}:*`;
            } else if (resolution === 'hours' && session.selectedDate) {
                const [day, month, year] = session.selectedDate.split('/');
                const dateObj = new Date(year, month - 1, day);
                const dayName = dateObj.toLocaleDateString('he-IL', { weekday: 'long' });
                dynamicHeader = `📅 *בחר שעה לפגישה ביום ${dayName} ${session.selectedDate}:*`;
            }

            // פונקציית עזר להחלפת placeholders
            const replacePlaceholders = (text, data) => {
                let processedText = text;
                if (processedText && data) {
                    for (const keyInSession in data) {
                        if (data.hasOwnProperty(keyInSession)) {
                            const placeholder = `{${keyInSession}}`;
                            processedText = processedText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]]/g, '\\$&'), 'g'), data[keyInSession]);
                        }
                    }
                }
                return processedText;
            };

            // החלפת placeholders בכותרת ובפוטר
            let processedHeader = replacePlaceholders(dynamicHeader, session.data);
            let processedFooter = replacePlaceholders(step.footerMessage || '', session.data);

            const optionsRangeMessage = `(שלח מספר בין 1 ל-${datesToShow.length})`;
            // הרכבת הפוטר הסופי עם טווח האופציות, לאחר החלפת placeholders בפוטר המקורי
            const finalProcessedFooterMessage = `${optionsRangeMessage}${processedFooter}`;

            return {
                messages: [
                    processedHeader,
                    formattedDates.join('\n'),
                    finalProcessedFooterMessage
                ],
                waitForUser: true
            };
        } catch (error) {
            console.error('Error in DateStep:', error);
            return {
                messages: ['מצטערים, אירעה שגיאה בטעינת התאריכים. אנא נסה שוב מאוחר יותר.'],
                waitForUser: false
            };
        }
    }

    static filterDatesFromToday(dates, startFromToday) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return dates.filter(dateStr => {
            const [day, month, year] = dateStr.split('/');
            const date = new Date(year, month - 1, day);
            date.setHours(0, 0, 0, 0);
            
            if (!startFromToday && date.getTime() === today.getTime()) {
                return false;
            }
            return date >= today;
        });
    }

    static async handleResolution(resolution, dates, limit, session, availability, flowEngine) {
        switch (resolution) {
            case 'months':
                return this.handleMonthsResolution(dates, limit, session);
            case 'weeks':
                return this.handleWeeksResolution(dates, limit, session);
            case 'days':
                return this.handleDaysResolution(dates, limit, session);
            case 'hours':
                return await this.handleHoursResolution(dates, limit, session, availability, flowEngine);
            default:
                throw new Error(`Unknown resolution: ${resolution}`);
        }
    }

    static handleMonthsResolution(dates, limit, session) {
        session.monthGroups = session.monthGroups || {};
        const monthGroups = new Map();
        dates.forEach(dateStr => {
            const [_, month, year] = dateStr.split('/');
            const key = `${month}/${year}`;
            if (!monthGroups.has(key)) {
                monthGroups.set(key, []);
            }
            monthGroups.get(key).push(dateStr);
        });

        const sortedMonths = Array.from(monthGroups.entries())
            .sort(([keyA], [keyB]) => {
                const [monthA, yearA] = keyA.split('/');
                const [monthB, yearB] = keyB.split('/');
                return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
            })
            .slice(0, limit);

        const datesToShow = sortedMonths.map(([key]) => key);
        const formattedDates = sortedMonths.map(([key], index) => {
            const [month, year] = key.split('/');
            const date = new Date(year, month - 1);
            const monthName = date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
            return `*${index + 1}* - ${monthName}`;
        });

        session.monthGroups = Object.fromEntries(monthGroups);
        return { datesToShow, formattedDates };
    }

    static handleWeeksResolution(dates, limit, session) {
        session.monthGroups = session.monthGroups || {};
        session.weekGroups = session.weekGroups || {};

        if (!session.selectedMonth || !session.monthGroups[session.selectedMonth]) {
            console.error('Error in handleWeeksResolution: No month selected or month data not found for ', session.selectedMonth);
            throw new Error('No month selected or month data not found in session.monthGroups');
        }
        const availableDaysInMonth = session.monthGroups[session.selectedMonth];
        const [selectedMonthNumber, selectedYearNumber] = session.selectedMonth.split('/').map(Number);

        const firstDayOfSelectedMonth = new Date(selectedYearNumber, selectedMonthNumber - 1, 1);
        const lastDayOfSelectedMonth = new Date(selectedYearNumber, selectedMonthNumber, 0);

        const formatDateComponent = (dt) => `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`;

        const calendarWeeksMap = new Map();
        availableDaysInMonth.forEach(dateStr => {
            const [day, month, year] = dateStr.split('/').map(Number);
            const currentDate = new Date(year, month - 1, day);

            const dayOfWeek = currentDate.getDay();
            const weekStartDate = new Date(currentDate);
            weekStartDate.setDate(currentDate.getDate() - dayOfWeek);
            weekStartDate.setHours(0,0,0,0);

            const weekStartDateKey = weekStartDate.toISOString();

            if (!calendarWeeksMap.has(weekStartDateKey)) {
                calendarWeeksMap.set(weekStartDateKey, []);
            }
            calendarWeeksMap.get(weekStartDateKey).push(currentDate);
        });

        const finalWeekDisplayGroups = new Map();

        for (const weekDays of calendarWeeksMap.values()) {
            if (weekDays.length === 0) continue;

            weekDays.sort((a,b) => a - b);

            let actualDisplayStart = weekDays[0];
            let actualDisplayEnd = weekDays[weekDays.length - 1];

            if (actualDisplayStart < firstDayOfSelectedMonth) {
                actualDisplayStart = firstDayOfSelectedMonth;
            }
            if (actualDisplayEnd > lastDayOfSelectedMonth) {
                actualDisplayEnd = lastDayOfSelectedMonth;
            }
            
            const daysInDisplayRange = weekDays.filter(d => d >= actualDisplayStart && d <= actualDisplayEnd);

            if (daysInDisplayRange.length > 0) {
                const displayKey = `${formatDateComponent(actualDisplayStart)}-${formatDateComponent(actualDisplayEnd)}`;
                
                const dayStringsInDisplayRange = daysInDisplayRange.map(d => formatDateComponent(d));

                if (finalWeekDisplayGroups.has(displayKey)) {
                    const existingDays = finalWeekDisplayGroups.get(displayKey);
                    const newDays = dayStringsInDisplayRange.filter(d => !existingDays.includes(d));
                    finalWeekDisplayGroups.set(displayKey, existingDays.concat(newDays).sort());
                } else {
                    finalWeekDisplayGroups.set(displayKey, dayStringsInDisplayRange);
                }
            }
        }
        
        let sortedWeekEntries = Array.from(finalWeekDisplayGroups.entries())
            .sort(([keyA], [keyB]) => {
                const dateA = new Date(keyA.split('-')[0].split('/')[2], keyA.split('-')[0].split('/')[1] - 1, keyA.split('-')[0].split('/')[0]);
                const dateB = new Date(keyB.split('-')[0].split('/')[2], keyB.split('-')[0].split('/')[1] - 1, keyB.split('-')[0].split('/')[0]);
                return dateA - dateB;
            })
            .slice(0, limit);

        const datesToShow = sortedWeekEntries.map(([key]) => key);
        const formattedDates = sortedWeekEntries.map(([key], index) => {
            return `${key} - *${index + 1}*`;
        });
        
        session.weekGroups = Object.fromEntries(finalWeekDisplayGroups); 
        return { datesToShow, formattedDates };
    }

    static handleDaysResolution(dates, limit, session) {
        session.weekGroups = session.weekGroups || {}; 
        let daysToConsider = [];

        if (session.selectedWeek && session.weekGroups[session.selectedWeek]) {
            daysToConsider = session.weekGroups[session.selectedWeek];
        } else {
            if (session.selectedWeek) {
                console.warn('Warning in handleDaysResolution: selectedWeek is present, but no data found in session.weekGroups for ', session.selectedWeek);
            }
            daysToConsider = dates;
        }

        let filteredDaysToShow = [];

        if (session.selectedMonth) {
            const [selectedMonthNumber, selectedYearNumber] = session.selectedMonth.split('/').map(Number);
            filteredDaysToShow = daysToConsider.filter(dateStr => {
                if (typeof dateStr !== 'string') {
                    console.warn('Warning in handleDaysResolution: non-string found in daysToConsider during month filtering:', dateStr);
                    return false;
                }
                const parts = dateStr.split('/');
                if (parts.length !== 3) {
                    console.warn('Warning in handleDaysResolution: invalid date string format found:', dateStr);
                    return false;
                }
                const [day, month, year] = parts.map(Number);
                return month === selectedMonthNumber && year === selectedYearNumber;
            }).slice(0, limit);
        } else {
            filteredDaysToShow = daysToConsider.slice(0, limit);
        }

        if (filteredDaysToShow.length === 0 && daysToConsider.length > 0 && session.selectedMonth) {
             console.warn('In handleDaysResolution: All days in the considered list were filtered out for the selected month, or the list was empty to begin with.');
        }

        const formattedDates = filteredDaysToShow.map((dateStr, index) => {
            const [day, month, year] = dateStr.split('/');
            const date = new Date(year, month - 1, day);
            const dayName = date.toLocaleDateString('he-IL', { weekday: 'long' });
            return `*${index + 1}* - ${dayName} ${dateStr}`;
        });

        return { datesToShow: filteredDaysToShow, formattedDates };
    }

    static async handleHoursResolution(dates, limit, session, availability, flowEngine) {
        if (!session.selectedDate) {
            throw new Error('No date selected');
        }

        const availableTimes = availability[session.selectedDate] || [];
        if (availableTimes.length === 0) {
            throw new Error('No available times for selected date');
        }

        // Filter times using Google Calendar service if available
        const calendarService = flowEngine?.integrationManager?.services?.calendar;
        const filteredTimes = calendarService 
            ? await calendarService.filterAvailableTimes(session.selectedDate, availableTimes)
            : availableTimes;

        if (filteredTimes.length === 0) {
            throw new Error('No available times after calendar check for selected date');
        }

        const timesToShow = filteredTimes.slice(0, limit);

        const formattedDates = timesToShow.map((time, index) => 
            `${time} - *${index + 1}*`
        );

        return { datesToShow: timesToShow, formattedDates };
    }

    static async validateDateChoice(input, session, step, flowEngine) {
        if (input && input.trim() === 'חזור') {
            if (step && step.options && step.options['חזור']) {
                return { valid: true, action: 'navigate', targetStep: step.options['חזור'] };
            } else {
                console.warn(`"חזור" command received, but no specific back step defined for step ID: ${step ? step.id : 'unknown'}. Defaulting to main_menu or error.`);
                return { valid: false, error: 'אפשרות החזרה אינה מוגדרת כראוי לשלב זה.' };
            }
        }

        if (!session.availableDates || session.availableDates.length === 0) {
            return { valid: false, error: 'אין אפשרויות זמינות לבחירה. נסה לכתוב "תפריט".' };
        }

        let selectedIndex;
        let selectedValue;

        // Handle time selection by actual time value (e.g. "10:00")
        if (session.currentResolution === 'hours' && input.match(/^\d{1,2}:\d{2}$/)) {
            selectedValue = input;
            selectedIndex = session.availableDates.findIndex(time => time === input) + 1;
            if (selectedIndex === 0) { // Not found
                return {
                    valid: false,
                    error: `השעה ${input} אינה זמינה. אנא בחר מספר בין 1 ל-${session.availableDates.length}`
                };
            }
        } else {
            // Handle selection by index
            selectedIndex = parseInt(input);
            if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > session.availableDates.length) {
                return {
                    valid: false,
                    error: `אנא בחר מספר בין 1 ל-${session.availableDates.length}`
                };
            }
            selectedValue = session.availableDates[selectedIndex - 1];
        }

        if (!selectedValue) {
            return { valid: false, error: 'הבחירה אינה זמינה. אנא בחר שוב.' };
        }

        switch (session.currentResolution) {
            case 'months':
                session.selectedMonth = selectedValue;
                session.monthGroups = session.monthGroups || {};
                break;
            case 'weeks':
                session.selectedWeek = selectedValue;
                break;
            case 'days':
                session.selectedDate = selectedValue;
                break;
            case 'hours':
                session.selectedTime = selectedValue;
                session.meeting = {
                    date: session.selectedDate,
                    time: selectedValue
                };
                session.is_schedule = true;

                // Store meeting data in session for later processing
                session.meetingData = {
                    meeting_date: session.selectedDate,
                    meeting_time: session.selectedTime,
                    full_name: session.data?.full_name || '',
                    city_name: session.data?.city_name || '',
                    phone: session.userId.split('@')[0],
                    mobility: session.data?.mobility || ''
                };

                // Update lead data to ensure it's saved
                await flowEngine.leadsManager.updateLeadData(session.userId, {
                    full_name: session.meetingData.full_name,
                    city_name: session.meetingData.city_name,
                    mobility: session.meetingData.mobility
                });

                // Mark as scheduled with meeting details
                await flowEngine.leadsManager.markLeadScheduled(session.userId, {
                    date: session.selectedDate,
                    time: session.selectedTime
                });

                if (step.next) {
                    return { valid: true, action: 'navigate', targetStep: step.next };
                }
                break;
        }
        return { valid: true, value: selectedValue };
    }

    static formatMonthForDisplay(monthYearString) {
        if (!monthYearString || typeof monthYearString !== 'string') return '';
        const [month, year] = monthYearString.split('/');
        if (!month || !year) return monthYearString; // Fallback
        try {
            const date = new Date(year, parseInt(month) - 1);
            return date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
        } catch (e) {
            return monthYearString; // Fallback in case of parsing error
        }
    }
}

module.exports = DateStep;
