const { google } = require('googleapis');
const path = require('path');

class CreateSharedCalendar {
    constructor() {
        this.credentialsPath = path.join(__dirname, '../credentials/google-sheets-credentials.json');
    }

    async createSharedCalendar(userEmail, calendarName = 'פגישות בוט WhatsApp - משאבים LTD') {
        try {
            // Create auth client
            const auth = new google.auth.GoogleAuth({
                keyFile: this.credentialsPath,
                scopes: ['https://www.googleapis.com/auth/calendar']
            });

            const authClient = await auth.getClient();
            const calendar = google.calendar({ version: 'v3', auth: authClient });

            console.log('📅 יצירת לוח שנה חדש לפגישות הבוט:');
            console.log('======================================');

            // Create new calendar
            const newCalendar = {
                summary: calendarName,
                description: 'לוח שנה אוטומטי לפגישות שנקבעות דרך בוט WhatsApp של חברת משאבים',
                timeZone: 'Asia/Jerusalem',
                location: 'רחוב הפלד 14, חולון, ישראל'
            };

            console.log('🔨 יוצר לוח שנה חדש...');
            
            const createdCalendar = await calendar.calendars.insert({
                resource: newCalendar
            });

            const calendarId = createdCalendar.data.id;
            
            console.log('✅ לוח השנה נוצר בהצלחה!');
            console.log(`   שם: ${createdCalendar.data.summary}`);
            console.log(`   ID: ${calendarId}`);
            console.log(`   אזור זמן: ${createdCalendar.data.timeZone}`);

            // Share calendar with user
            if (userEmail) {
                console.log('\n📧 משתף לוח השנה עם המשתמש...');
                
                try {
                    const aclRule = {
                        role: 'writer', // נותן הרשאות כתיבה כדי שיוכל גם לערוך
                        scope: {
                            type: 'user',
                            value: userEmail
                        }
                    };

                    await calendar.acl.insert({
                        calendarId: calendarId,
                        resource: aclRule
                    });

                    console.log(`✅ לוח השנה שותף בהצלחה עם: ${userEmail}`);
                    console.log('   הרשאות: כתיבה וקריאה');

                } catch (shareError) {
                    console.log(`⚠️  שגיאה בשיתוף: ${shareError.message}`);
                    console.log('💡 תוכל לשתף ידנית מ-Google Calendar');
                }
            }

            // Create a test event
            console.log('\n🧪 יוצר אירוע טסט...');
            
            const testEvent = {
                summary: '🤖 אירוע טסט - בוט WhatsApp',
                description: 'אירוע טסט לוודא שהלוח השנה עובד\n\nנוצר על ידי: בוט פגישות משאבים LTD',
                start: {
                    dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // מחר
                    timeZone: 'Asia/Jerusalem'
                },
                end: {
                    dateTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // מחר + שעה
                    timeZone: 'Asia/Jerusalem'
                }
            };

            try {
                const testEventResponse = await calendar.events.insert({
                    calendarId: calendarId,
                    resource: testEvent
                });

                console.log('✅ אירוע טסט נוצר בהצלחה!');
                console.log(`   Event ID: ${testEventResponse.data.id}`);
                
            } catch (eventError) {
                console.log(`⚠️  שגיאה ביצירת אירוע טסט: ${eventError.message}`);
            }

            // Display important information
            console.log('\n' + '='.repeat(50));
            console.log('🎉 הגדרה הושלמה בהצלחה!');
            console.log('='.repeat(50));
            console.log(`\n📋 פרטים חשובים:`);
            console.log(`   📅 שם לוח השנה: ${createdCalendar.data.summary}`);
            console.log(`   🆔 Calendar ID: ${calendarId}`);
            console.log(`   🌍 אזור זמן: ${createdCalendar.data.timeZone}`);
            console.log(`   📧 משותף עם: ${userEmail || 'לא צוין'}`);
            
            console.log(`\n🔗 קישורים שימושיים:`);
            console.log(`   📱 Google Calendar (Web): https://calendar.google.com/calendar/u/0/r`);
            console.log(`   🔗 קישור ישיר: https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}`);
            
            console.log(`\n📝 קוד לעדכון ב-flow.json:`);
            console.log(`   "calendarId": "${calendarId}"`);

            return {
                success: true,
                calendarId: calendarId,
                calendarName: createdCalendar.data.summary,
                timeZone: createdCalendar.data.timeZone
            };

        } catch (error) {
            console.error('❌ שגיאה כללית:', error.message);
            if (error.code === 403) {
                console.log('💡 ייתכן שאין הרשאות מספיקות. בדוק שה-Google Calendar API מופעל');
            }
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Static method for easy usage
    static async create(userEmail, calendarName) {
        const creator = new CreateSharedCalendar();
        return await creator.createSharedCalendar(userEmail, calendarName);
    }
}

module.exports = CreateSharedCalendar; 