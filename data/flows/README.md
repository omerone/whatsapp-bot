# WhatsApp Bot Flow Storage

This directory contains the conversation flow scripts for the WhatsApp bot. Each flow is stored as a separate JSON file with a `.flow.json` extension.

## Flow File Structure

Each flow file follows this structure:

```json
{
  "id": "unique-flow-id",
  "name": "Flow Name",
  "createdAt": "ISO date string",
  "updatedAt": "ISO date string",
  "metadata": {
    "company_name": "Company Name",
    "version": "1.0.0",
    "last_updated": "ISO date string",
    "description": "Optional flow description",
    "tags": ["tag1", "tag2"]
  },
  "configuration": {
    "rules": {
      "activation": {
        "keywords": ["start", "begin"],
        "schedule": {
          "enabled": false,
          "cron": "0 9 * * *"
        }
      },
      "blockedSources": {
        "ignoreContacts": false,
        "ignoreArchived": true,
        "ignoreGroups": true
      }
    },
    "client_management": {
      "freeze": {
        "enabled": false,
        "duration": 3600
      },
      "reset": {
        "enabled": false,
        "conditions": ["timeout", "manual"]
      },
      "blockScheduledClients": {
        "enabled": false,
        "duration": 3600
      }
    }
  },
  "integrations": {
    "enabled": false,
    "googleWorkspace": {
      "enabled": false,
      "sheets": {
        "enabled": false,
        "sheetId": "",
        "filterByDateTime": false,
        "preventDuplicates": true
      },
      "calendar": {
        "enabled": false,
        "calendarId": ""
      }
    }
  },
  "start": "first-step-id",
  "steps": {
    "step-id": {
      "id": "step-id",
      "type": "message|question|options|date",
      "position": {
        "x": 0,
        "y": 0
      },
      "messageHeader": "Optional header text",
      "message": "Main message content",
      "footerMessage": "Optional footer text",
      "messageFile": "Optional file path",
      "next": "next-step-id",
      "options": {
        "option1": "next-step-id-1",
        "option2": "next-step-id-2"
      },
      "branches": {
        "condition1": "next-step-id-3",
        "condition2": "next-step-id-4"
      },
      "validation": [
        {
          "type": "required|regex|length|custom",
          "value": "validation value",
          "message": "Error message"
        }
      ],
      "metadata": {
        "customField1": "value1",
        "customField2": "value2"
      }
    }
  }
}
```

## Flow Types

1. **Message Flow**: Simple message delivery
2. **Question Flow**: Interactive questions with validation
3. **Options Flow**: Multiple choice responses
4. **Date Flow**: Date and time selection

## Best Practices

1. Use meaningful IDs for flows and steps
2. Keep messages clear and concise
3. Add proper validation rules for user inputs
4. Use metadata for custom requirements
5. Document any special conditions or requirements
6. Test flows thoroughly before deployment

## Flow Management

The flow editor provides a visual interface for:

- Creating new flows
- Editing existing flows
- Testing flow execution
- Managing flow versions
- Importing/exporting flows
- Configuring integrations 