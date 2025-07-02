# WhatsApp Bot - תיעוד מקיף של הפרויקט

## 📝 סקירה כללית
בוט WhatsApp מתקדם המיועד לקביעת פגישות וניהול לקוחות. הבוט מטפל בכל התהליך מהיכרות ראשונית ועד אישור הפגישה, תוך אינטגרציה עם Google Calendar, Google Sheets ושליחת התראות לקבוצות WhatsApp.

## 🏗️ ארכיטקטורה

### רכיבי הליבה

#### 1. מנוע הזרימה - FlowEngine (`src/engine/FlowEngine.js`)
- מנהל את זרימת השיחה והמצב
- מטפל במעברים בין שלבים
- מעבד קלטי משתמשים
- מנהל סשנים של משתמשים

#### 2. מנהל הלידים - LeadsManager (`src/engine/LeadsManager.js`)
- מנהל שמירת נתוני לקוחות
- מטפל בעדכוני סטטוס לידים
- עוקב אחר היסטוריית שיחות
- מנהל פונקציונליות חסימה והקפאה

#### 3. מנהל הכללים - RulesManager (`src/engine/RulesManager.js`)
- שולט בכללי עיבוד הודעות
- מטפל בחסימה/הקפאה של לקוחות
- מנהל מילות מפתח להפעלה
- שולט בסינון צ'אטים (קבוצות, אנשי קשר וכו')

#### 4. מערכת הוולידציה - Validators (`src/engine/validators/`)
- ניהול וולידציות מרכזי
- תמיכה בוולידציית שמות ומיקומים
- מערכת וולידציה הניתנת להרחבה

### סוגי שלבים (Step Types)

#### 1. Message Step
- הצגת הודעה פשוטה
- אינטגרציות ברמת השלב (חדש!)
- תזכורות מתקדמות (חדש!)
- לא דורש קלט מהמשתמש
- תומך בהמשך אוטומטי

#### 2. Question Step
- איסוף קלט מהמשתמש
- שדה `key` לשמירת התשובה (חדש!)
- תמיכה בוולידציה מתקדמת
- הודעות שגיאה מותאמות אישית
- שומר תשובות בנתוני הסשן

#### 3. Options Step
- הצגת אפשרויות בחירה מרובות
- תמיכה בלוגיקת ענפים (branches)
- הודעות שגיאה מותאמות (`noMatchMessage`)
- מילות מפתח מרובות לכל אפשרות
- מטפל בניווט בתפריטים

#### 4. Date Step
- ניהול בחירת תאריך/שעה
- רזולוציות: חודשים, שבועות, ימים, שעות
- ענפי ניווט (חזור, תפריט) (חדש!)
- בדיקת זמינות
- תמיכה באינטגרציית יומן

## 🔄 זרימת השיחה

### שלבי הזרימה הראשיים
1. **הקדמה** (`intro`) - ברכה ראשונית
2. **תפריט ראשי** (`main_menu`) - אפשרויות בחירה
3. **זרימת קביעת פגישה** - איסוף פרטים ובחירת זמן
4. **אישור סופי** - אישור ואינטגרציות

### שלבים מיוחדים
1. **אישור סופי** (`final_confirmation`)
   - מאשר פרטי פגישה
   - מפעיל אינטגרציות
   - חוסם לקוח למניעת לולאות
   - שולח הודעת אישור

2. **תמיכה אנושית** (`human_support`)
   - מקפיא שיחה
   - מתריע לצוות תמיכה
   - מונע התערבות בוט

3. **לא מתאים** (`not_suitable`)
   - מטפל בלקוחות לא זכאים
   - מספק אפשרויות חלופיות
   - מקפיא שיחה

## 🔧 הגדרות מערכת

### הגדרות זרימה (`flow.json`)
```json
{
  "metadata": {
    "company_name": "שם החברה",
    "version": "1.0.0",
    "last_updated": "2024-01-01T00:00:00.000Z"
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
        "keywords": ["start", "begin"],
        "resetAfterHours": 24
      },
      "blockScheduledClients": {
        "enabled": true,
        "blockPastAndPresent": true,
        "blockFutureAndPresent": false,
        "allowRescheduling": true,
        "rescheduleOnlyFuture": true
      }
    },
    "client_management": {
      "freeze": {
        "enabled": true,
        "duration": 60,
        "messaging": {
          "send_explanation": true,
          "message": "השיחה הוקפאה למשך {duration} דקות"
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
  }
}
```

### מאפייני שלבים
- `id`: מזהה ייחודי לשלב
- `type`: סוג השלב (message/question/options/date)
- `key`: מפתח לשמירת תשובה (עבור question) **חדש!**
- `userResponseWaiting`: האם השלב ממתין לקלט משתמש
- `messageFile`: נתיב לקובץ תוכן הודעה
- `message`: הודעה ישירה
- `messageHeader`: כותרת הודעה
- `footerMessage`: הודעת סיום
- `next`: השלב הבא בזרימה
- `branches`: ענפי ניווט עם מילות מפתח
- `block`: חוסם לקוח אחרי השלב
- `freeze`: מקפיא שיחה זמנית
- `integrations`: הגדרות אינטגרציה ברמת השלב **חדש!**
- `integration`: הגדרות ספציפיות לאינטגרציות **חדש!**
- `reminders`: הגדרות תזכורות מתקדמות **חדש!**
- `noMatchMessage`: הודעת שגיאה מותאמת

## 🔌 מערכת האינטגרציות (מחודשת!)

### אינטגרציות ברמת השלב
הסרנו את האינטגרציות מההגדרות הכלליות והעברנו אותן לרמת השלב עבור גמישות מקסימלית.

#### 1. התראות ברמת השלב
```json
{
  "integrations": {
    "enabled": true,
    "notifications": true
  },
  "integration": {
    "notifications": {
      "recipients": "123456789,987654321",
      "message": "פגישה חדשה נקבעה: {client_name} ב-{meeting_date} בשעה {meeting_time}"
    }
  }
}
```

#### 2. תזכורות מתקדמות
```json
{
  "integrations": {
    "enabled": true,
    "reminders": true
  },
  "reminders": {
    "enabled": true,
    "reminders": [
      {
        "id": "reminder_24h",
        "hours": 24,
        "message": "תזכורת: יש לך פגישה מחר בשעה {meeting_time}"
      },
      {
        "id": "reminder_2h",
        "hours": 2,
        "message": "תזכורת: הפגישה שלך בעוד שעתיים בשעה {meeting_time}"
      }
    ]
  }
}
```

#### 3. Google Calendar ברמת השלב
```json
{
  "integrations": {
    "enabled": true,
    "googleCalendar": true
  },
  "integration": {
    "calendar": {
      "message": "פגישה עם {client_name} - {client_email}"
    }
  }
}
```

#### 4. Google Sheets ברמת השלב
```json
{
  "integrations": {
    "enabled": true,
    "googleSheets": true
  },
  "integration": {
    "sheets": {
      "message": "פגישה חדשה: {client_name} - {meeting_date} {meeting_time}"
    }
  }
}
```

#### 5. iPlan ברמת השלב
```json
{
  "integrations": {
    "enabled": true,
    "iPlan": true
  },
  "integration": {
    "iplan": {
      "message": "פגישה: {client_name} - {meeting_date} {meeting_time}"
    }
  }
}
```

### הבקנד החדש
- **ReminderService.js** - מעובד לתמיכה באינטגרציות ברמת השלב
- **FlowEngine.js** - מעודכן לעיבוד אינטגרציות בכל שלב message
- תמיכה בהחלפת משתנים בהודעות
- מערכת מפתחות ייחודיים למניעת כפילויות

## 🛡️ מערכת הוולידציה

### סוגי וולידציות

#### 1. וולידציית שם (Name Validator)
- **empty**: הודעה ריקה
- **tooShort**: שם קצר מדי
- **tooLong**: שם ארוך מדי
- **notEnoughWords**: לא מספיק מילים (צריך שם פרטי ומשפחה)
- **tooManyWords**: יותר מדי מילים
- **invalidCharacters**: תווים לא חוקיים
- **duplicateWords**: מילים חוזרות
- **cityName**: נראה כמו שם עיר

#### 2. וולידציית אימייל (Email Validator)
- **empty**: הודעה ריקה
- **invalid**: פורמט אימייל לא תקין

#### 3. וולידציית גיל (Age Validator)
- **empty**: הודעה ריקה
- **notNumber**: לא מספר
- **tooYoung**: צעיר מדי
- **tooOld**: מבוגר מדי
- **invalidRange**: מחוץ לטווח המותר

#### 4. וולידציית תאריך (Date Validator)
- **empty**: הודעה ריקה
- **invalid**: פורמט תאריך לא תקין
- **futureOnly**: נדרש תאריך עתידי
- **pastOnly**: נדרש תאריך בעבר
- **tooEarly**: מוקדם מדי
- **tooLate**: מאוחר מדי

#### 5. וולידציית מיקום (Location Validator)
- **קלט_ריק**: הודעה ריקה
- **עיר_לא_זמינה**: עיר לא נתמכת
- **הצעה_עיר_לא_זמינה**: הצעה לא נתמכת
- **עיר_לא_מוכרת**: לא מזוהה כעיר
- **SUGGESTION_SERVICEABLE**: הצעה לעיר נתמכת

### הגדרות וולידציה מותאמות
```json
{
  "validation": {
    "type": "Name",
    "errorMessages": {
      "empty": "נא להזין שם",
      "notEnoughWords": "יש להזין שם פרטי ושם משפחה",
      "tooShort": "השם שהזנת קצר מדי"
    }
  }
}
```

## 📊 ניהול נתונים

### מבנה נתוני ליד
```json
{
  "current_step": "step_id",
  "data": {
    "client_name": "string",
    "client_email": "string",
    "city_name": "string",
    "mobility": "string",
    "meeting_date": "string",
    "meeting_time": "string"
  },
  "is_schedule": boolean,
  "meeting": {
    "date": "string",
    "time": "string",
    "calendar_event_id": "string",
    "sheet_row_phone": "string"
  },
  "last_sent_message": "bot|client",
  "last_client_message": "string",
  "relevant": boolean,
  "blocked": boolean,
  "blocked_reason": "string",
  "frozenUntil": "ISO_date_string",
  "last_interaction": "string"
}
```

### ניהול סשנים
- זמן תפוגה של 30 דקות
- ניקוי אוטומטי
- שמירת מצב מתמשכת

## 🎨 עורך הזרימות (Flow Editor)

### ממשק משתמש מתקדם
- **עריכה ויזואלית** של זרימות
- **גרירה ושחרור** של שלבים
- **תצוגה בזמן אמת** של חיבורים
- **ולידציה מובנית** של המבנה

### תכונות חדשות
1. **שדה Key לשאלות** - הוספנו שדה מפתח שמירה לכל שאלה
2. **אינטגרציות ברמת השלב** - הגדרת אינטגרציות לכל בלוק message
3. **תזכורות מתקדמות** - מספר תזכורות עם שעות והודעות מותאמות
4. **ענפי ניווט לתאריכים** - אפשרות חזרה ותפריט בבלוקי תאריך
5. **טיפים והסברים** - tooltips מפורטים לכל שדה
6. **הודעות שגיאה מותאמות** - עבור כל סוג שלב

### מבנה קבצים
```
flow-editor/
├── src/
│   ├── components/
│   │   ├── FlowEditor.tsx        # העורך הראשי
│   │   ├── StepEditor.tsx        # עריכת שלבים (מעודכן!)
│   │   ├── MetadataEditor.tsx    # עריכת מטאדטה (מעודכן!)
│   │   └── nodes/
│   │       └── StepNode.tsx      # תצוגת שלבים (מעודכן!)
│   ├── types/
│   │   └── flow.ts              # טיפוסים (מעודכן!)
│   └── context/
│       └── FlowContext.tsx      # ניהול מצב
```

## 🔧 התקנה והפעלה

### דרישות מערכת
- Node.js 16+
- npm או yarn
- Google Cloud Console עם APIs מופעלים
- WhatsApp Business API

### התקנה
```bash
# התקנת תלויות
npm install

# הגדרת משתני סביבה
cp .env.example .env

# עריכת הגדרות
nano .env

# הפעלת המערכת
npm start

# הפעלת עורך הזרימות
cd flow-editor
npm install
npm start
```

### הגדרת Google APIs
1. יצירת פרויקט ב-Google Cloud Console
2. הפעלת Calendar API ו-Sheets API
3. יצירת Service Account
4. הורדת קובץ credentials.json
5. הגדרת נתיבים במשתני סביבה

## 🚀 שימוש מתקדם

### יצירת זרימה חדשה
1. פתח את עורך הזרימות
2. צור שלבים חדשים
3. קשר בין שלבים
4. הגדר וולידציות
5. הוסף אינטגרציות
6. שמור וייצא

### הגדרת אינטגרציות ברמת השלב
```json
{
  "id": "confirmation",
  "type": "message",
  "message": "תודה {client_name}! הפגישה שלך אושרה ל-{meeting_date} בשעה {meeting_time}",
  "integrations": {
    "enabled": true,
    "googleCalendar": true,
    "notifications": true,
    "reminders": true
  },
  "integration": {
    "calendar": {
      "message": "פגישה עם {client_name} - {client_email}"
    },
    "notifications": {
      "recipients": "123456789",
      "message": "פגישה חדשה: {client_name} ב-{meeting_date}"
    }
  },
  "reminders": {
    "enabled": true,
    "reminders": [
      {
        "id": "day_before",
        "hours": 24,
        "message": "תזכורת: פגישה מחר בשעה {meeting_time}"
      }
    ]
  }
}
```

### הגדרת ענפי ניווט לתאריכים
```json
{
  "id": "select_date",
  "type": "date",
  "resolution": "days",
  "limit": 30,
  "branches": {
    "חזור || back || previous": "previous_step",
    "תפריט || menu || main": "main_menu"
  },
  "noMatchMessage": "אנא בחר מספר מהרשימה או כתב 'חזור' לשלב הקודם"
}
```

## 🔍 פתרון בעיות נפוצות

### בעיות אינטגרציה
1. **שגיאות Google API**
   - בדוק הרשאות Service Account
   - וודא שה-APIs מופעלים
   - בדוק נתיבי קבצים

2. **שגיאות WhatsApp**
   - בדוק חיבור לאינטרנט
   - וודא שהמספר לא חסום
   - בדוק הגדרות API

### בעיות זרימה
1. **לולאות אינסופיות**
   - בדוק הגדרות `userResponseWaiting`
   - וודא שיש מסלולי יציאה
   - הוסף חסימה בשלבים סופיים

2. **שגיאות וולידציה**
   - בדוק הגדרות וולידציה
   - וודא שהודעות השגיאה מוגדרות
   - בדוק לוגיקת הענפים

## 📈 ביצועים ואופטימיזציה

### מעקב ביצועים
- לוגים מפורטים לכל פעולה
- מדידת זמני תגובה
- ניטור שימוש בזיכרון
- עקיבה אחר שגיאות

### אופטימיזציות
- מטמון לנתוני זמינות
- ניקוי סשנים אוטומטי
- דחיסת הודעות
- אינדקסים למסד הנתונים

## 🔐 אבטחה

### הגנת נתונים
- הצפנת נתוני לקוחות
- הגבלת גישה לAPI
- ולידציה של כל הקלטים
- לוגים מאובטחים

### ניהול הרשאות
- הפרדת הרשאות לפי תפקידים
- מפתחות API מוגבלים
- ניטור פעילות חשודה
- גיבויים מוצפנים

## 🚀 פיתוח עתידי

### תכונות מתוכננות
1. **תמיכה בשפות נוספות**
2. **אינטגרציות נוספות** (Zoom, Teams)
3. **ניתוח מתקדם** של שיחות
4. **בוט חכם** עם AI
5. **ממשק ניהול מתקדם**

### תרומה לפרויקט
1. Fork את הפרויקט
2. צור branch חדש
3. בצע שינויים
4. הוסף בדיקות
5. שלח Pull Request

## 📞 תמיכה

### קבלת עזרה
- **תיעוד מקוון**: [קישור לתיעוד]
- **GitHub Issues**: [קישור לissues]
- **קהילה**: [קישור לקהילה]
- **תמיכה מסחרית**: [פרטי קשר]

### דיווח על באגים
כאשר מדווחים על באג, אנא כללו:
1. תיאור הבעיה
2. שלבי שחזור
3. לוגים רלוונטיים
4. גרסת המערכת
5. סביבת ההפעלה

---

## 📝 רישיון
פרויקט זה מופץ תחת רישיון MIT. ראה קובץ LICENSE לפרטים נוספים.

## 🙏 תודות
תודה לכל התורמים והקהילה שעוזרת לפתח ולשפר את הפרויקט.

---

**גרסה**: 2.0.0  
**עדכון אחרון**: ינואר 2024  
**מחבר**: צוות הפיתוח 