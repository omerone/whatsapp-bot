# WhatsApp Bot Documentation

## 📝 Overview
A sophisticated WhatsApp bot designed for appointment scheduling and client management. The bot handles the entire flow from initial contact to appointment confirmation, integrating with Google Calendar, Google Sheets, and providing WhatsApp group notifications.

## 🏗️ Architecture

### Core Components
1. **FlowEngine** (`src/engine/FlowEngine.js`)
   - Manages conversation flow and state
   - Handles step transitions
   - Processes user inputs
   - Manages user sessions

2. **LeadsManager** (`src/engine/LeadsManager.js`)
   - Manages client data persistence
   - Handles lead status updates
   - Tracks conversation history
   - Manages blocking and freezing functionality

3. **RulesManager** (`src/engine/RulesManager.js`)
   - Controls message processing rules
   - Handles client blocking/freezing
   - Manages activation keywords
   - Controls chat filtering (groups, contacts, etc.)

4. **ValidatorRegistry** (`src/engine/ValidatorRegistry.js`)
   - Centralized validator management
   - Supports name and location validation
   - Extensible validation system

### Step Types
1. **MessageStep**
   - Simple message display
   - No user input required
   - Supports auto-continuation

2. **QuestionStep**
   - Collects user input
   - Supports validation
   - Stores responses in session data

3. **OptionStep**
   - Presents multiple choice options
   - Supports branching logic
   - Handles menu navigation

4. **DateStep**
   - Manages date/time selection
   - Handles availability checking
   - Supports calendar integration

## 🔄 Conversation Flow

### Main Flow Stages
1. **Introduction** (`intro`)
   - Initial greeting
   - Transitions to main menu

2. **Main Menu** (`main_menu`)
   - Book appointment
   - FAQ/Information
   - Human support
   - Remove from list

3. **Booking Flow**
   - Name collection and validation
   - City selection and validation
   - Mobility type selection
   - Date and time selection
   - Final confirmation

### Special Steps
1. **Final Confirmation** (`final_confirmation`)
   - Confirms appointment details
   - Triggers integrations
   - Blocks client to prevent loops
   - Sends confirmation message

2. **Human Support** (`human_support`)
   - Freezes conversation
   - Notifies support team
   - Prevents bot interference

3. **Not Suitable** (`not_suitable`)
   - Handles ineligible clients
   - Provides alternative options
   - Freezes conversation

## 🔧 Configuration

### Flow Configuration (`flow.json`)
```json
{
  "rules": {
    "ignoreContacts": true,
    "ignoreArchived": true,
    "ignoreGroups": true,
    "ignoreStatus": true,
    "blockScheduledClients": {
      "enabled": true,
      "blockPastAndPresent": true,
      "blockFutureAndPresent": false,
      "allowRescheduling": true,
      "rescheduleOnlyFuture": true
    }
  }
}
```

### Step Properties
- `id`: Unique step identifier
- `type`: Step type (message/question/options/date)
- `userResponseWaiting`: Whether step waits for user input
- `messageFile`: Path to message content file
- `next`: Next step in flow
- `block`: Blocks client after step (e.g., final_confirmation)
- `freeze`: Freezes conversation temporarily

## 🔌 Integrations

### Google Workspace
1. **Google Sheets**
   - Records appointment details
   - Tracks client information
   - Configurable column mapping

2. **Google Calendar**
   - Creates calendar events
   - Checks availability
   - Manages scheduling conflicts

### WhatsApp Notifications
- Group notifications for new appointments
- Support request alerts
- Configurable message templates

## 🛡️ Security Features

### Client Management
1. **Blocking**
   - Prevents spam
   - Handles completed flows
   - Manages invalid clients

2. **Freezing**
   - Temporary conversation pausing
   - Support handover
   - Configurable duration

### Validation
1. **Name Validation**
   - Full name requirements
   - Language support (Hebrew/English)
   - Format verification

2. **Location Validation**
   - City verification
   - Service area checking
   - Mobility restrictions

## 📊 Data Management

### Lead Data Structure
```json
{
  "current_step": "step_id",
  "data": {
    "full_name": "string",
    "city_name": "string",
    "mobility": "string"
  },
  "is_schedule": boolean,
  "meeting": {
    "date": "string",
    "time": "string"
  },
  "last_sent_message": "bot|client",
  "relevant": boolean,
  "blocked": boolean,
  "blocked_reason": "string"
}
```

### Session Management
- 30-minute timeout
- Automatic cleanup
- State persistence

## 🚀 Best Practices

### Flow Design
1. Always provide clear navigation options
2. Include error handling for each step
3. Maintain conversation context
4. Use appropriate validation

### Integration Guidelines
1. Handle API failures gracefully
2. Implement retry mechanisms
3. Maintain credential security
4. Log important events

### Error Handling
1. Validate all user inputs
2. Provide clear error messages
3. Maintain fallback options
4. Log errors for debugging

## 🔍 Debugging

### Common Issues
1. **Infinite Loops**
   - Check step transitions
   - Verify blocking logic
   - Monitor conversation flow

2. **Integration Failures**
   - Verify credentials
   - Check API access
   - Monitor rate limits

3. **Validation Issues**
   - Review validation rules
   - Check input formats
   - Monitor error messages

### Logging
- Flow transitions
- User interactions
- Integration events
- Error conditions

## 🔄 Updates and Maintenance

### Version Control
- Git repository management
- Feature branching
- Documentation updates

### Deployment
- Environment configuration
- Dependency management
- Integration testing

## 📱 Testing

### Test Flow Script
Use `src/test-flow.js` to simulate conversations:
```javascript
// Simulate conversation flow
await flowEngine.processStep(userId, 'היי', true);
await flowEngine.processStep(userId, '1', false);  // Menu selection
await flowEngine.processStep(userId, 'שם מלא', false);
// ... continue with test flow
```