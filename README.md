# מדריך מקיף לבניית סקריפט שיחה (flow.json)

## מבנה בסיסי
```json
{
  "metadata": {
    "company_name": "שם החברה",
    "version": "1.0",
    "last_updated": "2024-03-21"
  },
  
  "configuration": {
    "rules": {
      "blockedSources": {
        "ignoreContacts": true,
        "ignoreArchived": true,
        "ignoreGroups": true,
        "ignoreStatus": true
      },
      "activation": {
        "enabled": true,
        "keywords": ["תספורת"],
        "resetAfterHours": 24
      }
    },
    
    "client_management": {
      "freeze": {
        "enabled": true,
        "duration": 60,
        "messaging": {
          "send_explanation": true,
          "message": "תחזור אלינו בעוד {duration} דקות. תודה על הסבלנות! 🙏"
        }
      },
      "reset": {
        "enabled": true,
        "keyword": "תפריט",
        "target_step": "main_menu",
        "options": {
          "unfreeze": true,
          "delete_appointment": true,
          "allow_unblock": true
        }
      }
    }
  },

  "start": "intro",
  
  "steps": {
    "intro": {
      "id": "intro",
      "type": "message",
      "userResponseWaiting": false,
      "next": "main_menu",
      "messageFile": "intro.txt"
    }
  }
}
```

## ניהול סשן מתקדם
```json
{
  "session": {
    "userId": "972501234567@c.us",
    "currentStep": "step_id",
    "data": {},
    "lastInteraction": "2024-03-21T14:00:00.000Z",
    "retryCount": 0,
    "isFirstMessage": true,
    "isNewConversation": true
  }
}
```

### אפשרויות ניהול סשן
- `userId`: מזהה המשתמש בפורמט WhatsApp
- `currentStep`: הצעד הנוכחי בשיחה
- `data`: מידע שנאסף מהמשתמש
- `lastInteraction`: זמן האינטראקציה האחרונה
- `retryCount`: מעקב אחר ניסיונות חוזרים
- `isFirstMessage`: האם זו ההודעה הראשונה בשיחה
- `isNewConversation`: האם זו שיחה חדשה

## אינטגרציות מתקדמות
```json
{
  "integrations": {
    "enabled": true,
    
    "googleWorkspace": {
      "enabled": true,
      "sheets": {
        "enabled": true,
        "sheetId": "YOUR_SHEET_ID",
        "columns": {
          "meeting_date": 1,
          "meeting_time": 2,
          "full_name": 3,
          "city_name": 4,
          "phone": 5,
          "mobility": 6
        },
        "filterByDateTime": true,
        "preventDuplicates": true,
        "updateExistingRows": true
      },
      "calendar": {
        "enabled": true,
        "calendarId": "YOUR_CALENDAR_ID",
        "eventDurationMinutes": 60,
        "timeZone": "Asia/Jerusalem",
        "eventTitle": "פגישה עם {full_name}",
        "eventDescription": "פגישה עם {full_name}\nטלפון: {phone}\nעיר: {city_name}\nניידות: {mobility}",
        "maxParticipantsPerSlot": 3,
        "preventDuplicates": true
      }
    },
    
    "notifications": {
      "enabled": true,
      "meetingScheduled": {
        "enabled": true,
        "recipients": ["120363419789724883@g.us"],
        "messageTemplateFile": "meeting_scheduled_notification.txt"
      }
    },
    
    "reminders": {
      "enabled": true,
      "configurations": [
        {
          "id": "reminder_12h_before",
          "offset": "-12h",
          "timeOfDay": "19:00",
          "messageFile": "reminder_12h_before.txt",
          "source": "google_sheet",
          "enabled": true
        }
      ]
    }
  }
}
```

## ניהול לידים מתקדם

### מבנה ליד
```json
{
  "lead": {
    "current_step": "step_id",
    "data": {
      "full_name": "שם מלא",
      "city_name": "עיר",
      "mobility": "רכב"
    },
    "is_schedule": false,
    "meeting": {
      "date": "2024-03-21",
      "time": "14:00"
    },
    "last_sent_message": "bot",
    "relevant": true,
    "last_interaction": "2024-03-21 14:00:00",
    "date_and_time_conversation_started": "2024-03-21 14:00:00",
    "blocked": false,
    "blocked_reason": null,
    "frozenUntil": null,
    "lastFreezeReason": null,
    "lastFrozenAt": null,
    "lastFreezeMessageSent": null
  }
}
```

### אפשרויות ניהול ליד
- `current_step`: הצעד הנוכחי בשיחה
- `data`: מידע שנאסף מהמשתמש
- `is_schedule`: האם נקבעה פגישה
- `meeting`: פרטי הפגישה
- `last_sent_message`: סוג ההודעה האחרונה
- `relevant`: האם הליד רלוונטי
- `last_interaction`: זמן האינטראקציה האחרונה
- `date_and_time_conversation_started`: זמן ההתחלת השיחה
- `blocked`: האם הליד חסום
- `blocked_reason`: סיבת החסימה
- `frozenUntil`: זמן הקפאה
- `lastFreezeReason`: סיבת הקפאה האחרונה
- `lastFrozenAt`: זמן הקפאה האחרונה
- `lastFreezeMessageSent`: הודעה שנשלחה בזמן הקפאה האחרונה

## כלים נוספים

### ValidatorRegistry
```javascript
// רישום ולידטור מותאם אישית
ValidatorRegistry.registerValidator('custom', {
  validate: (value) => {
    // לוגיקת ולידציה
    return true;
  }
});
```

### RulesManager
```javascript
// הגדרת חוקים
const rules = {
  blockedSources: {
    ignoreContacts: true,
    ignoreArchived: true,
    ignoreGroups: true,
    ignoreStatus: true
  },
  activation: {
    enabled: true,
    keywords: ["תספורת"],
    resetAfterHours: 24
  }
};
```

### WhatsAppManager
```javascript
// ניהול תקשורת WhatsApp
const whatsappManager = new WhatsAppManager(flowEngine);
await whatsappManager.initialize();
```

## טיפים מתקדמים
1. **ניהול סשן**:
   - הגדר זמני timeout מתאימים
   - נקה סשנים לא פעילים באופן קבוע
   - שמור על מעקב אחר ניסיונות חוזרים

2. **אינטגרציות**:
   - בדוק את תקינות ה-API keys
   - הגדר טיפול בשגיאות
   - סנכרן נתונים בין המערכות

3. **ניהול לידים**:
   - שמור על מידע מעודכן
   - נהל חסימות והקפאות
   - מעקב אחר אינטראקציות

4. **ביצועים**:
   - השתמש ב-caching
   - מקסם את זמני התגובה
   - נהל משאבים ביעילות

## טיפים חשובים
1. **חובה לכלול**:
   - שדה `metadata` עם פרטי החברה
   - שדה `configuration` עם הגדרות המערכת
   - שדה `start` עם הצעד הראשון
   - לפחות צעד אחד מסוג `message` בשם `intro`

2. **קבצי הודעות**:
   - כל קובץ הודעה חייב להיות קיים בתיקיית `messages`
   - הקבצים חייבים להיות בפורמט `.txt`
   - הקבצים לא יכולים להיות ריקים

3. **אינטגרציות**:
   - יש להגדיר `enabled: true` ברמת האינטגרציה הראשית
   - יש לספק את כל הפרטים הנדרשים לכל שירות
   - יש לוודא שקובצי תבניות ההודעות קיימים

4. **ניהול לידים**:
   - יש לשמור על כל השדות הנדרשים
   - יש לעדכן את `last_interaction` בכל אינטראקציה
   - יש לנהל נכון את סטטוס החסימה וההקפאה

5. **ביצועים**:
   - השתמש ב-`messageFile` במקום `message` להודעות ארוכות
   - הגדר `userResponseWaiting: false` לצעדים שלא דורשים תגובה
   - השתמש ב-`skipIfDisabled` לצעדים אופציונליים 