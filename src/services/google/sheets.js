const { google } = require('googleapis');
const path = require('path');

class GoogleSheetsService {
    constructor(config) {
        this.config = config;
        this.sheets = null;
        this.initialized = false;
        // Calculate the maximum column index and convert to letter
        this.maxColumn = this._getColumnLetter(Math.max(...Object.values(this.config.columns)));
    }

    _getColumnLetter(columnNumber) {
        let dividend = columnNumber;
        let columnName = '';
        let modulo;

        while (dividend > 0) {
            modulo = (dividend - 1) % 26;
            columnName = String.fromCharCode(65 + modulo) + columnName;
            dividend = Math.floor((dividend - 1) / 26);
        }

        return columnName;
    }

    async initialize() {
        try {
            // Initialize the Google Sheets API client using centralized credentials
            const auth = new google.auth.GoogleAuth({
                keyFile: path.join(__dirname, '..', 'credentials', 'google-sheets-credentials.json'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            const authClient = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: authClient });
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize Google Sheets:', error);
            return false;
        }
    }

    async addRow(data) {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            // Format the data before mapping to columns
            const formattedData = {
                ...data,
                meeting_date: this._formatDate(data.meeting_date),
                meeting_time: this._formatTime(data.meeting_time),
                phone: this._formatPhone(data.phone),
                mobility: this._formatMobility(data.mobility)
            };

            // Check for existing appointment with same phone number
            const existingRowIndex = await this._findExistingPhoneRow(formattedData.phone);
            
            if (existingRowIndex !== -1) {
                // Update existing row instead of adding new one
                console.log(`📋 Google Sheets: עדכון שורה קיימת עבור מספר טלפון ${formattedData.phone}`);
                return await this._updateExistingRow(existingRowIndex, formattedData);
            }

            const values = [];
            const row = new Array(Math.max(...Object.values(this.config.columns))).fill('');

            // Map data to columns
            for (const [key, value] of Object.entries(formattedData)) {
                const columnIndex = this.config.columns[key];
                if (columnIndex !== undefined) {
                    row[columnIndex - 1] = value;
                }
            }

            values.push(row);

            if (this.config.filterByDateTime) {
                await this._insertRowWithDateTimeFilter(values, formattedData);
            } else {
                await this._appendRow(values);
            }

            console.log(`📋 Google Sheets: שורה חדשה נוספה עבור מספר טלפון ${formattedData.phone}`);
            return true;
        } catch (error) {
            console.error('Failed to add row to Google Sheets:', error);
            return false;
        }
    }

    _formatMobility(mobility) {
        const mobilityMap = {
            'car': 'רכב',
            'bike': 'אופנוע',
            'none': 'לא נייד'
        };
        return mobilityMap[mobility] || mobility;
    }

    _formatDate(date) {
        try {
            // אם התאריך כבר בפורמט הנכון (dd/mm/yyyy), נחזיר אותו כמו שהוא
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
                return date;
            }

            // אחרת, ננסה להמיר את התאריך לפורמט הנכון
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            
            return `${day}/${month}/${year}`;
        } catch (error) {
            console.error('Failed to format date:', error);
            return date; // במקרה של שגיאה, נחזיר את הערך המקורי
        }
    }

    _formatTime(time) {
        try {
            // אם השעה כבר בפורמט הנכון (HH:mm), נחזיר אותה כמו שהיא
            if (/^\d{2}:\d{2}$/.test(time)) {
                return time;
            }

            // אחרת, ננסה להמיר את השעה לפורמט הנכון
            const d = new Date(`1970-01-01T${time}`);
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            
            return `${hours}:${minutes}`;
        } catch (error) {
            console.error('Failed to format time:', error);
            return time; // במקרה של שגיאה, נחזיר את הערך המקורי
        }
    }

    _formatPhone(phone) {
        try {
            // מסיר את כל התווים שאינם ספרות
            let cleaned = phone.replace(/\D/g, '');
            
            // מסיר את קידומת המדינה אם קיימת
            if (cleaned.startsWith('972')) {
                cleaned = cleaned.substring(3);
            }
            
            // מסיר את ה-0 המוביל אם קיים
            if (cleaned.startsWith('0')) {
                cleaned = cleaned.substring(1);
            }

            return cleaned;
        } catch (error) {
            console.error('Failed to format phone:', error);
            return phone; // במקרה של שגיאה, נחזיר את הערך המקורי
        }
    }

    async _insertRowWithDateTimeFilter(values, data) {
        try {
            // Get all values from the sheet
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: `A:${this.maxColumn}`
            });

            const existingRows = response.data.values || [];
            if (existingRows.length === 0) {
                // If sheet is empty, just append
                await this._appendRow(values);
                return;
            }

            // Convert dates for comparison
            const newDateTime = this._getDateTimeForSorting(data.meeting_date, data.meeting_time);
            
            // Find insert position (skip header row)
            let insertIndex = 2;
            for (let i = 1; i < existingRows.length; i++) {
                const rowDate = existingRows[i][0];
                const rowTime = existingRows[i][1];
                if (!rowDate || !rowTime) continue;

                const rowDateTime = this._getDateTimeForSorting(rowDate, rowTime);
                if (newDateTime < rowDateTime) {
                    insertIndex = i + 1;
                    break;
                }
                insertIndex = i + 2;
            }

            // Insert empty row
            const request = {
                spreadsheetId: this.config.sheetId,
                resource: {
                    requests: [
                        {
                            insertDimension: {
                                range: {
                                    sheetId: 0,
                                    dimension: 'ROWS',
                                    startIndex: insertIndex - 1,
                                    endIndex: insertIndex
                                },
                                inheritFromBefore: false
                            }
                        }
                    ]
                }
            };

            await this.sheets.spreadsheets.batchUpdate(request);

            // Update the values in the new row
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.config.sheetId,
                range: `A${insertIndex}:${this.maxColumn}${insertIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: values
                }
            });

        } catch (error) {
            console.error('Error in _insertRowWithDateTimeFilter:', error);
            throw error;
        }
    }

    _getDateTimeForSorting(date, time) {
        const [day, month, year] = date.split('/');
        // Remove any extra time information from the time string
        const cleanTime = time.split(' ')[0];
        return new Date(`${year}-${month}-${day}T${cleanTime}`);
    }

    _reverseDateFormat(date) {
        // המרה מ-dd/mm/yyyy ל-yyyy-mm-dd עבור השוואת תאריכים
        const [day, month, year] = date.split('/');
        return `${year}-${month}-${day}`;
    }

    async _appendRow(values) {
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.sheetId,
            range: `A2:${this.maxColumn}2`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: values
            }
        });
    }

    async getScheduledAppointmentsForReminders() {
        if (!this.initialized) {
            console.warn('GoogleSheetsService: Attempted to get appointments but service not initialized.');
            return [];
        }

        try {
            // Assuming data starts from row 2 (row 1 is header)
            // And columns are defined in this.config.columns, e.g., meeting_date: 1, meeting_time: 2, etc.
            // We need to determine the range to read, e.g., 'Sheet1!A2:F' if F is the max column used.
            // this.maxColumn already gives the letter of the maximum configured column (e.g., 'F')
            const rangeToRead = `A2:${this.maxColumn}`;

            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: rangeToRead, // Read from A2 to the max configured column
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                // console.log('GoogleSheetsService: No data found in the specified range.');
                return [];
            }

            const appointments = [];
            const columnMapping = this.config.columns;
            // Create a reverse mapping from column index (0-based) to key name for easier lookup
            const indexToKey = {};
            for (const key in columnMapping) {
                indexToKey[columnMapping[key] - 1] = key; // Column numbers are 1-based
            }

            for (const row of rows) {
                const appointment = {};
                let hasEssentialData = true;
                // Map row data to appointment object based on columnMapping
                for (let i = 0; i < row.length; i++) {
                    const key = indexToKey[i];
                    if (key) {
                        appointment[key] = row[i];
                    }
                }

                // Ensure essential fields for a reminder are present
                if (!appointment.meeting_date || !appointment.meeting_time || !appointment.phone) {
                    // console.warn('GoogleSheetsService: Skipping row due to missing date, time, or phone:', row);
                    hasEssentialData = false; // Skip if essential data for reminder is missing
                }

                if (hasEssentialData) {
                    // Optionally, further process/validate fields here if needed
                    // e.g., ensure phone is not empty after potential formatting by other functions
                    appointments.push(appointment);
                }
            }
            return appointments;
        } catch (error) {
            console.error('GoogleSheetsService: Error fetching appointments for reminders:', error);
            return []; // Return empty array on error to prevent ReminderService from crashing
        }
    }

    async hasScheduledAppointment(phone, checkType = 'futureAndPresent') {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            // Format the phone number
            const formattedPhone = this._formatPhone(phone);

            // Get all values from the sheet
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: `A:${this.maxColumn}`
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) { // If sheet is empty or has only header
                return false;
            }

            // Find the phone number column index from config
            const phoneColumnIndex = this.config.columns['phone'] - 1;
            if (phoneColumnIndex === undefined) {
                return false;
            }

            // Get today's date for comparison
            const today = new Date();
            const todayStr = this._formatDate(today.toISOString());

            // Check each row (skip header)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[phoneColumnIndex]) continue;

                // Check if phone numbers match
                const rowPhone = this._formatPhone(row[phoneColumnIndex]);
                if (rowPhone === formattedPhone) {
                    // Get the date column index
                    const dateColumnIndex = this.config.columns['meeting_date'] - 1;
                    if (dateColumnIndex === undefined || !row[dateColumnIndex]) continue;

                    // Compare dates based on check type
                    const appointmentDate = row[dateColumnIndex];
                    
                    switch (checkType) {
                        case 'futureAndPresent':
                            if (this._isDateAfterOrEqual(appointmentDate, todayStr)) {
                                return true;
                            }
                            break;
                        case 'pastAndPresent':
                            if (this._isDateBeforeOrEqual(appointmentDate, todayStr)) {
                                return true;
                            }
                            break;
                        case 'future':
                            if (this._isDateAfter(appointmentDate, todayStr)) {
                                return true;
                            }
                            break;
                        case 'past':
                            if (this._isDateBefore(appointmentDate, todayStr)) {
                                return true;
                            }
                            break;
                        case 'present':
                            if (this._isDateEqual(appointmentDate, todayStr)) {
                                return true;
                            }
                            break;
                        case 'any':
                            return true; // Has any appointment regardless of date
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Error checking for scheduled appointment:', error);
            return false;
        }
    }

    _isDateAfterOrEqual(date1, date2) {
        try {
            const [day1, month1, year1] = date1.split('/');
            const [day2, month2, year2] = date2.split('/');
            
            const d1 = new Date(year1, month1 - 1, day1);
            const d2 = new Date(year2, month2 - 1, day2);
            
            return d1 >= d2;
        } catch (error) {
            console.error('Error comparing dates:', error);
            return false;
        }
    }

    _isDateBeforeOrEqual(date1, date2) {
        try {
            const [day1, month1, year1] = date1.split('/');
            const [day2, month2, year2] = date2.split('/');
            
            const d1 = new Date(year1, month1 - 1, day1);
            const d2 = new Date(year2, month2 - 1, day2);
            
            return d1 <= d2;
        } catch (error) {
            console.error('Error comparing dates:', error);
            return false;
        }
    }

    _isDateAfter(date1, date2) {
        try {
            const [day1, month1, year1] = date1.split('/');
            const [day2, month2, year2] = date2.split('/');
            
            const d1 = new Date(year1, month1 - 1, day1);
            const d2 = new Date(year2, month2 - 1, day2);
            
            return d1 > d2;
        } catch (error) {
            console.error('Error comparing dates:', error);
            return false;
        }
    }

    _isDateBefore(date1, date2) {
        try {
            const [day1, month1, year1] = date1.split('/');
            const [day2, month2, year2] = date2.split('/');
            
            const d1 = new Date(year1, month1 - 1, day1);
            const d2 = new Date(year2, month2 - 1, day2);
            
            return d1 < d2;
        } catch (error) {
            console.error('Error comparing dates:', error);
            return false;
        }
    }

    _isDateEqual(date1, date2) {
        try {
            const [day1, month1, year1] = date1.split('/');
            const [day2, month2, year2] = date2.split('/');
            
            const d1 = new Date(year1, month1 - 1, day1);
            const d2 = new Date(year2, month2 - 1, day2);
            
            return d1.getTime() === d2.getTime();
        } catch (error) {
            console.error('Error comparing dates:', error);
            return false;
        }
    }

    async deleteAppointment(phone) {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            // Format the phone number
            const formattedPhone = this._formatPhone(phone);

            // Get all values from the sheet
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: `A:${this.maxColumn}`
            });

            const rows = response.data.values || [];
            
            if (rows.length <= 1) { // If sheet is empty or has only header
                return false;
            }

            // Find the phone number column index from config
            const phoneColumnIndex = this.config.columns['phone'] - 1;
            if (phoneColumnIndex === undefined) {
                return false;
            }

            // Find rows to delete (skip header)
            const rowsToDelete = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                // Skip empty rows
                if (!row || row.every(cell => !cell)) {
                    continue;
                }
                
                if (!row[phoneColumnIndex]) {
                    continue;
                }

                // Check if phone numbers match
                const rowPhone = this._formatPhone(row[phoneColumnIndex]);
                if (rowPhone === formattedPhone) {
                    rowsToDelete.push(i);
                }
            }

            // Delete rows if found (in reverse order to maintain indices)
            if (rowsToDelete.length > 0) {
                // First get the sheet ID
                const sheetsResponse = await this.sheets.spreadsheets.get({
                    spreadsheetId: this.config.sheetId
                });
                
                const sheetId = sheetsResponse.data.sheets[0].properties.sheetId;

                const requests = rowsToDelete.reverse().map(rowIndex => ({
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex,
                            endIndex: rowIndex + 1
                        }
                    }
                }));

                // Also find and delete any empty rows
                const emptyRowsToDelete = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.every(cell => !cell || cell.trim() === '')) {
                        emptyRowsToDelete.push(i);
                    }
                }

                if (emptyRowsToDelete.length > 0) {
                    requests.push(...emptyRowsToDelete.reverse().map(rowIndex => ({
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            }
                        }
                    })));
                }

                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.config.sheetId,
                    resource: {
                        requests
                    }
                });

                return true;
            }

            return false;
        } catch (error) {
            console.error('Error deleting appointment:', error);
            return false;
        }
    }

    async _findExistingPhoneRow(phone) {
        if (!this.initialized || !this.config.enabled) {
            return -1;
        }

        try {
            // Get all values from the sheet
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: `A:${this.maxColumn}`
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) { // If sheet is empty or has only header
                return -1;
            }

            // Find the phone number column index from config
            const phoneColumnIndex = this.config.columns['phone'] - 1;
            if (phoneColumnIndex === undefined) {
                return -1;
            }

            // Check each row (skip header)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[phoneColumnIndex]) continue;

                // Check if phone numbers match
                const rowPhone = this._formatPhone(row[phoneColumnIndex]);
                if (rowPhone === phone) {
                    return i;
                }
            }

            return -1;
        } catch (error) {
            console.error('Error finding existing phone row:', error);
            return -1;
        }
    }

    async _updateExistingRow(rowIndex, data) {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            // Get all values from the sheet
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: `A:${this.maxColumn}`
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) { // If sheet is empty or has only header
                return false;
            }

            // Find the phone number column index from config
            const phoneColumnIndex = this.config.columns['phone'] - 1;
            if (phoneColumnIndex === undefined) {
                return false;
            }

            // Find the row to update
            const row = rows[rowIndex];
            if (!row || row.every(cell => !cell)) {
                return false;
            }

            // Update the values in the row
            for (const [key, value] of Object.entries(data)) {
                const columnIndex = this.config.columns[key];
                if (columnIndex !== undefined) {
                    row[columnIndex - 1] = value;
                }
            }

            // Update the sheet
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.config.sheetId,
                range: `A${rowIndex + 1}:${this.maxColumn}${rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [row]
                }
            });

            return true;
        } catch (error) {
            console.error('Error updating existing row:', error);
            return false;
        }
    }
}

module.exports = GoogleSheetsService; 