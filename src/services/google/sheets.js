const { google } = require('googleapis');
const path = require('path');

class GoogleSheetsService {
    constructor(config) {
        this.config = config;
        this.sheets = null;
        this.initialized = false;
        
        // Check if config and columns exist before processing
        if (!this.config || !this.config.columns || typeof this.config.columns !== 'object') {
            console.error('❌ GoogleSheetsService: Invalid config or missing columns configuration');
            this.maxColumn = 'F'; // Default fallback
            return;
        }
        
        // Calculate the maximum column index and convert to letter
        const columnValues = Object.values(this.config.columns);
        if (columnValues.length === 0) {
            console.error('❌ GoogleSheetsService: No columns defined in configuration');
            this.maxColumn = 'F'; // Default fallback
            return;
        }
        
        this.maxColumn = this._getColumnLetter(Math.max(...columnValues));
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
        // Check if config is valid before attempting to initialize
        if (!this.config || !this.config.columns) {
            console.error('❌ GoogleSheetsService: Cannot initialize - invalid configuration');
            return false;
        }
        
        try {
            console.log('🔍 GoogleSheetsService: Attempting to initialize with config:', {
                enabled: this.config.enabled,
                hasSheetId: !!this.config.sheetId,
                hasColumns: !!this.config.columns,
                maxColumn: this.maxColumn
            });
            
            // Initialize the Google Sheets API client using configured credentials path
            const credentialsPath = this.config.credentialsPath || path.join(__dirname, '..', 'credentials', 'google-sheets-credentials.json');
            console.log('🔍 GoogleSheetsService: Using credentials path:', credentialsPath);
            
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            const authClient = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: authClient });
            this.initialized = true;
            console.log('✅ GoogleSheetsService: Successfully initialized');
            return true;
        } catch (error) {
            console.error('❌ GoogleSheetsService: Failed to initialize:', error.message);
            return false;
        }
    }

    async addRow(data, columnColors = []) {
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

            // Check for existing appointment with same phone number if prevent duplicates is enabled
            if (this.config.preventDuplicates) {
                const existingRowIndex = await this._findExistingPhoneRow(formattedData.phone);
                
                if (existingRowIndex !== -1) {
                    console.log(`📋 Google Sheets: נמצאה שורה קיימת עבור מספר טלפון ${formattedData.phone} בשורה ${existingRowIndex + 1}`);
                    
                    if (this.config.updateExistingRows) {
                        console.log(`📋 Google Sheets: עדכון שורה קיימת עבור מספר טלפון ${formattedData.phone}`);
                        return await this._updateExistingRow(existingRowIndex, formattedData);
                    } else {
                        console.log(`📋 Google Sheets: מניעת כפילויות פעילה - עוצר הוספת שורה עבור מספר טלפון ${formattedData.phone}`);
                        return true; // Consider it successful but don't add duplicate
                    }
                }
            }

            console.log(`📋 Google Sheets: מוסיף שורה חדשה עבור מספר טלפון ${formattedData.phone}`);

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

            let insertedRowIndex = null;

            // Check if sorting/filtering is enabled
            if (this.config.enableSorting) {
                console.log('📋 Google Sheets: מבצע הכנסה עם מיון אוטומטי');
                insertedRowIndex = await this._insertRowWithSorting(values, formattedData);
            } else if (this.config.insertToNextRow !== false) {
                console.log('📋 Google Sheets: מבצע הכנסה לשורה הבאה הריקה');
                insertedRowIndex = await this._insertToNextEmptyRow(values);
            } else {
                console.log('📋 Google Sheets: מבצע הוספה רגילה בסוף');
                insertedRowIndex = await this._appendRow(values);
            }

            // Apply colors if provided and row was inserted
            if (columnColors && columnColors.length > 0 && insertedRowIndex) {
                console.log(`🎨 Google Sheets: מחיל צבעים לשורה ${insertedRowIndex}`);
                await this._applyRowColors(insertedRowIndex, columnColors);
            }

            console.log(`📋 Google Sheets: שורה חדשה נוספה עבור מספר טלפון ${formattedData.phone || 'לא זמין'}`);
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
        if (!phone || typeof phone !== 'string') {
            console.log('⚠️ GoogleSheetsService: Phone is undefined or not a string:', phone);
            return '';
        }
        
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
        // Get current row count first
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.sheetId,
            range: `A:A`
        });
        
        const existingRows = response.data.values || [];
        const newRowNumber = existingRows.length + 1; // Next available row
        
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.sheetId,
            range: `A2:${this.maxColumn}2`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: values
            }
        });
        
        return newRowNumber;
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
            console.log('GoogleSheetsService: Service not initialized or disabled');
            return false;
        }

        if (!phone) {
            console.log('GoogleSheetsService: No phone number provided for deletion');
            return false;
        }

        try {
            // Format the phone number
            const formattedPhone = this._formatPhone(phone);
            if (!formattedPhone) {
                console.log('GoogleSheetsService: Invalid phone number format');
                return false;
            }

            console.log(`GoogleSheetsService: Attempting to delete appointment for phone: ${formattedPhone}`);

            // Get all values from the sheet
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: `A:${this.maxColumn}`
            });

            const rows = response.data.values || [];
            
            if (rows.length <= 1) { // If sheet is empty or has only header
                console.log('GoogleSheetsService: Sheet is empty or has only header');
                return false;
            }

            // Find the phone number column index from config
            const phoneColumnIndex = this.config.columns['phone'] - 1;
            if (phoneColumnIndex === undefined) {
                console.error('GoogleSheetsService: Phone column not found in configuration');
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
                    console.log(`GoogleSheetsService: Found matching row at index ${i}`);
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
                    console.log(`GoogleSheetsService: Found ${emptyRowsToDelete.length} empty rows to clean up`);
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

                try {
                    await this.sheets.spreadsheets.batchUpdate({
                        spreadsheetId: this.config.sheetId,
                        resource: {
                            requests
                        }
                    });
                    console.log(`GoogleSheetsService: Successfully deleted ${rowsToDelete.length} rows and ${emptyRowsToDelete.length} empty rows`);
                    return true;
                } catch (deleteError) {
                    console.error('GoogleSheetsService: Error deleting rows:', deleteError);
                    return false;
                }
            } else {
                console.log(`GoogleSheetsService: No matching rows found for phone ${formattedPhone}`);
                return false;
            }

        } catch (error) {
            console.error('GoogleSheetsService: Error in deleteAppointment:', error);
            return false;
        }
    }

    async deleteRow(rowId) {
        if (!this.initialized || !this.config.enabled) {
            return false;
        }

        try {
            // rowId should be the actual row number (1-based)
            const rowIndex = parseInt(rowId);
            if (isNaN(rowIndex) || rowIndex <= 1) { // Don't delete header row
                console.error('Invalid row ID for deletion:', rowId);
                return false;
            }

            // First get the sheet ID
            const sheetsResponse = await this.sheets.spreadsheets.get({
                spreadsheetId: this.config.sheetId
            });
            
            const sheetId = sheetsResponse.data.sheets[0].properties.sheetId;

            // Delete the specific row (convert to 0-based index for API)
            const request = {
                spreadsheetId: this.config.sheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1, // Convert to 0-based
                                endIndex: rowIndex
                            }
                        }
                    }]
                }
            };

            await this.sheets.spreadsheets.batchUpdate(request);
            console.log(`GoogleSheetsService: Row ${rowId} deleted successfully`);
            return true;

        } catch (error) {
            console.error('Error deleting row:', error);
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

    async _insertToNextEmptyRow(values) {
        try {
            console.log('📋 Google Sheets: מחפש שורה ריקה הבאה...');
            
            // Get more comprehensive data from the sheet to find truly empty rows
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: `A:${this.maxColumn}`
            });

            const existingRows = response.data.values || [];
            console.log(`📋 Google Sheets: נמצאו ${existingRows.length} שורות בגיליון`);
            
            let targetRow = 2; // Start from row 2 (skip header)
            
            // Method 1: Look for truly empty rows by checking if the row exists and has content
            for (let i = 1; i < 1000; i++) { // Check up to row 1000
                const rowIndex = i; // 0-based index
                const rowNumber = i + 1; // 1-based row number
                
                // Check if this row exists in our data
                if (rowIndex >= existingRows.length) {
                    // Row doesn't exist in data, so it's empty
                    targetRow = rowNumber;
                    break;
                } else {
                    const row = existingRows[rowIndex];
                    // Check if row is empty (either undefined, null, or all cells are empty)
                    const isEmpty = !row || row.length === 0 || row.every(cell => !cell || cell.toString().trim() === '');
                    
                    if (isEmpty) {
                        targetRow = rowNumber;
                        break;
                    }
                }
            }

            console.log(`📋 Google Sheets: מכניס לשורה ${targetRow} (השורה הריקה הבאה)`);

            // Insert the values in the target row
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.config.sheetId,
                range: `A${targetRow}:${this.maxColumn}${targetRow}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: values
                }
            });

            return targetRow; // Return the row number where data was inserted

        } catch (error) {
            console.error('Error in _insertToNextEmptyRow:', error);
            throw error;
        }
    }

    async _insertRowWithSorting(values, data) {
        try {
            console.log('📋 Google Sheets: מבצע הכנסה עם סינון ומיון');
            
            // Step 1: First insert to next empty row
            const insertedRow = await this._insertToNextEmptyRow(values);
            
            // Step 2: Then sort the entire sheet based on the configuration
            await this._sortSheet();
            
            // Note: After sorting, the row number might change, but we return the original insertion point
            return insertedRow;
            
        } catch (error) {
            console.error('Error in _insertRowWithSorting:', error);
            throw error;
        }
    }

    async _sortSheet() {
        try {
            console.log('📋 Google Sheets: מבצע מיון של כל הגיליון');
            
            // Get sorting configuration
            const sortColumn = (this.config.sortColumn || 1) - 1; // Convert to 0-based index
            const sortType = this.config.sortType || 'date';
            const sortDirection = this.config.sortDirection || 'asc';
            
            console.log(`📋 Google Sheets: מיון לפי עמודה ${sortColumn + 1} (${sortType}, ${sortDirection})`);

            // Get sheet information
            const sheetsResponse = await this.sheets.spreadsheets.get({
                spreadsheetId: this.config.sheetId
            });
            
            const sheetId = sheetsResponse.data.sheets[0].properties.sheetId;
            
            // Get all data to determine the range
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.sheetId,
                range: `A:${this.maxColumn}`
            });

            const existingRows = response.data.values || [];
            if (existingRows.length <= 1) {
                console.log('📋 Google Sheets: אין מספיק נתונים למיון');
                return;
            }

            // Find the last row with data
            let lastRowWithData = 1; // Start from 1 (header)
            for (let i = existingRows.length - 1; i >= 1; i--) {
                const row = existingRows[i];
                if (row && row.some(cell => cell && cell.toString().trim() !== '')) {
                    lastRowWithData = i + 1; // Convert to 1-based
                    break;
                }
            }

            if (lastRowWithData <= 1) {
                console.log('📋 Google Sheets: לא נמצאו נתונים למיון');
                return;
            }

            console.log(`📋 Google Sheets: ממיין שורות 2-${lastRowWithData}`);

            // Create sort request
            const sortOrder = sortDirection === 'asc' ? 'ASCENDING' : 'DESCENDING';
            
            const request = {
                spreadsheetId: this.config.sheetId,
                resource: {
                    requests: [
                        {
                            sortRange: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: 1, // Start from row 2 (0-based, so index 1)
                                    endRowIndex: lastRowWithData, // End at last row with data
                                    startColumnIndex: 0, // Start from column A
                                    endColumnIndex: Object.keys(this.config.columns).length || 10 // End at last configured column or default to 10
                                },
                                sortSpecs: [
                                    {
                                        dimensionIndex: sortColumn,
                                        sortOrder: sortOrder
                                    }
                                ]
                            }
                        }
                    ]
                }
            };

            await this.sheets.spreadsheets.batchUpdate(request);
            console.log('📋 Google Sheets: ✅ מיון הושלם בהצלחה');

        } catch (error) {
            console.error('Error in _sortSheet:', error);
            throw error;
        }
    }

    async _insertEmptyRowAt(position) {
        try {
            const request = {
                spreadsheetId: this.config.sheetId,
                resource: {
                    requests: [
                        {
                            insertDimension: {
                                range: {
                                    sheetId: 0,
                                    dimension: 'ROWS',
                                    startIndex: position - 1, // Convert to 0-based
                                    endIndex: position
                                },
                                inheritFromBefore: false
                            }
                        }
                    ]
                }
            };

            await this.sheets.spreadsheets.batchUpdate(request);
        } catch (error) {
            console.error('Error inserting empty row:', error);
            throw error;
        }
    }

    _shouldInsertBefore(newValue, existingValue, sortType, sortDirection) {
        let comparison = 0;

        switch (sortType) {
            case 'date':
                comparison = this._compareDates(newValue, existingValue);
                break;
            case 'time':
                comparison = this._compareTimes(newValue, existingValue);
                break;
            case 'datetime':
                comparison = this._compareDateTimes(newValue, existingValue);
                break;
            case 'number':
                comparison = this._compareNumbers(newValue, existingValue);
                break;
            case 'text':
            default:
                comparison = this._compareText(newValue, existingValue);
                break;
        }

        // Return true if new value should come before existing value
        return sortDirection === 'asc' ? comparison < 0 : comparison > 0;
    }

    _compareDates(date1, date2) {
        try {
            // Try to parse dates in various formats
            const d1 = this._parseDate(date1);
            const d2 = this._parseDate(date2);
            
            if (d1 && d2) {
                return d1.getTime() - d2.getTime();
            }
            
            // Fallback to string comparison
            return date1.localeCompare(date2);
        } catch (error) {
            return date1.localeCompare(date2);
        }
    }

    _compareTimes(time1, time2) {
        try {
            // Parse times (HH:MM format)
            const t1 = this._parseTime(time1);
            const t2 = this._parseTime(time2);
            
            if (t1 && t2) {
                return t1 - t2;
            }
            
            return time1.localeCompare(time2);
        } catch (error) {
            return time1.localeCompare(time2);
        }
    }

    _compareDateTimes(dt1, dt2) {
        // Combine date and time comparison
        const dateComp = this._compareDates(dt1, dt2);
        if (dateComp !== 0) return dateComp;
        
        return this._compareTimes(dt1, dt2);
    }

    _compareNumbers(num1, num2) {
        const n1 = parseFloat(num1);
        const n2 = parseFloat(num2);
        
        if (!isNaN(n1) && !isNaN(n2)) {
            return n1 - n2;
        }
        
        // Fallback to string comparison
        return num1.localeCompare(num2);
    }

    _compareText(text1, text2) {
        return text1.localeCompare(text2, 'he'); // Hebrew locale for proper sorting
    }

    _parseDate(dateString) {
        if (!dateString) return null;
        
        // Try different date formats
        const formats = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                if (format.source.startsWith('^(\\d{4})')) {
                    // YYYY-MM-DD format
                    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
                } else {
                    // DD/MM/YYYY or DD-MM-YYYY format
                    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
                }
            }
        }

        // Try parsing as is
        const parsed = new Date(dateString);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    _parseTime(timeString) {
        if (!timeString) return null;
        
        const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            return hours * 60 + minutes; // Convert to minutes for easy comparison
        }
        
        return null;
    }

    async _applyRowColors(rowIndex, columnColors) {
        try {
            if (!rowIndex || !columnColors || columnColors.length === 0) {
                return;
            }

            // Get sheet ID
            const sheetsResponse = await this.sheets.spreadsheets.get({
                spreadsheetId: this.config.sheetId
            });
            
            const sheetId = sheetsResponse.data.sheets[0].properties.sheetId;

            // Prepare color requests
            const requests = [];
            
            for (let i = 0; i < columnColors.length; i++) {
                if (columnColors[i] && columnColors[i] !== '#ffffff') {
                    // Convert hex color to RGB values
                    const hex = columnColors[i].replace('#', '');
                    const r = parseInt(hex.substr(0, 2), 16) / 255;
                    const g = parseInt(hex.substr(2, 2), 16) / 255;
                    const b = parseInt(hex.substr(4, 2), 16) / 255;

                    requests.push({
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: rowIndex - 1, // 0-based indexing
                                endRowIndex: rowIndex,
                                startColumnIndex: i,
                                endColumnIndex: i + 1
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: {
                                        red: r,
                                        green: g,
                                        blue: b
                                    }
                                }
                            },
                            fields: 'userEnteredFormat.backgroundColor'
                        }
                    });
                }
            }

            // Apply colors if we have requests
            if (requests.length > 0) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.config.sheetId,
                    resource: {
                        requests: requests
                    }
                });

                console.log(`🎨 Google Sheets: צבעים הוחלו בהצלחה על שורה ${rowIndex}`);
            }

        } catch (error) {
            console.error('Error applying row colors:', error);
        }
    }
}

module.exports = GoogleSheetsService; 