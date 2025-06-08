# 🔐 Credentials Directory

תיקייה זו מכילה את קבצי ההזדהות (credentials) עבור כל האינטגרציות החיצוניות.

## 📁 קבצים נדרשים:

### 🗓️ Google Calendar API
**קובץ:** `google-calendar-credentials.json`

**שלבי הגדרה:**
1. לך ל-[Google Cloud Console](https://console.cloud.google.com/)
2. צור פרויקט חדש או בחר פרויקט קיים
3. הפעל את Google Calendar API:
   - "APIs & Services" → "Library" → חפש "Google Calendar API" → "Enable"
4. צור Service Account:
   - "APIs & Services" → "Credentials" → "Create Credentials" → "Service Account"
5. הורד את קובץ ה-JSON והשם אותו `google-calendar-credentials.json`
6. שתף את היומן עם email של ה-service account (הרשאות עריכה)

### 📊 Google Sheets API  
**קובץ:** `google-sheets-credentials.json`

**שלבי הגדרה:**
1. לך ל-[Google Cloud Console](https://console.cloud.google.com/)
2. צור פרויקט חדש או בחר פרויקט קיים  
3. הפעל את Google Sheets API:
   - "APIs & Services" → "Library" → חפש "Google Sheets API" → "Enable"
4. צור Service Account:
   - "APIs & Services" → "Credentials" → "Create Credentials" → "Service Account"
5. הורד את קובץ ה-JSON והשם אותו `google-sheets-credentials.json`
6. שתף את Google Sheet עם email של ה-service account (הרשאות עריכה)

## ⚠️ חשוב!

- **אל תעלה את הקבצים האלה ל-Git!** (הם כבר ב-.gitignore)
- כל service account צריך הרשאות מתאימות במשאבי Google
- שמור על קבצי ה-credentials במקום בטוח
- אל תשתף את קבצי ה-credentials עם אף אחד

## 🛠️ פורמט קובץ Credentials:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

## 🔧 בדיקת תקינות:

כשהבוט רץ, תראה בטרמינל הודעות כגון:
- `GoogleCalendarService: Successfully initialized` ✅
- `GoogleSheetsService: Successfully initialized` ✅

אם יש שגיאה:
- `GoogleCalendarService: Failed to initialize: [error]` ❌
- בדוק שהקובץ קיים ובפורמט נכון
- בדוק שה-API מופעל ב-Google Cloud Console
- בדוק שיש הרשאות מתאימות 