const { google } = require('googleapis');
const path = require('path');

class CreateSharedCalendar {
    constructor() {
        this.calendar = null;
    }

    async createSharedCalendar(userEmail, calendarName = 'פגישות בוט WhatsApp - משאבים LTD') {
        try {
            // Load credentials
            const credentialsPath = path.join(__dirname, '..', 'credentials', 'google-calendar-credentials.json');
            
            // Initialize calendar client
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/calendar']
            });

            this.calendar = google.calendar({ version: 'v3', auth });

            // Create new calendar
            console.log('Creating new calendar...');
            const calendarResponse = await this.calendar.calendars.insert({
                requestBody: {
                    summary: calendarName,
                    timeZone: 'Asia/Jerusalem'
                }
            });

            const calendarId = calendarResponse.data.id;
            console.log(`Calendar created with ID: ${calendarId}`);

            // Share calendar with service account
            console.log(`Sharing calendar with ${userEmail}...`);
            await this.calendar.acl.insert({
                calendarId: calendarId,
                requestBody: {
                    role: 'writer',
                    scope: {
                        type: 'user',
                        value: userEmail
                    }
                }
            });

            console.log('Calendar shared successfully!');
            console.log('\nPlease update your flow.json with this calendar ID:');
            console.log(JSON.stringify({
                calendarId: calendarId
            }, null, 2));

            return calendarId;

        } catch (error) {
            console.error('Error creating shared calendar:', error.message);
            throw error;
        }
    }

    static async create(userEmail, calendarName) {
        const creator = new CreateSharedCalendar();
        return await creator.createSharedCalendar(userEmail, calendarName);
    }
}

// If running directly, create calendar
if (require.main === module) {
    const serviceAccountEmail = 'whatsapp-bot-calendar@whatsapp-bot-automate.iam.gserviceaccount.com';
    CreateSharedCalendar.create(serviceAccountEmail)
        .then(calendarId => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = CreateSharedCalendar; 