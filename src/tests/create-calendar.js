const CreateSharedCalendar = require('../services/google/CreateSharedCalendar');

async function createNewCalendar() {
    try {
        console.log('🗓️ Creating new shared calendar...');
        
        // Replace this with your email
        const userEmail = 'omermaoz1998@gmail.com';
        const calendarName = 'פגישות בוט WhatsApp - משאבים LTD';
        
        const calendarId = await CreateSharedCalendar.create(userEmail, calendarName);
        
        console.log('\n✅ Calendar created successfully!');
        console.log('Calendar ID:', calendarId);
        console.log('\nPlease update your flow.json with this calendar ID');
        console.log('\nYou should receive an email invitation to access this calendar.');
        console.log('Please accept the invitation to start seeing events.');
        
    } catch (error) {
        console.error('❌ Failed to create calendar:', error);
    }
}

createNewCalendar(); 