import React from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import { StepData } from '../types/flow';

interface VariableDisplayProps {
  steps: Record<string, StepData>;
  currentStepId: string;
}

const VariableDisplay: React.FC<VariableDisplayProps> = ({ steps, currentStepId }) => {
  // Function to get available variables up to current step
  const getAvailableVariables = () => {
    const variables: string[] = [];
    
    // Define the logical flow order for data collection steps
    const dataCollectionSteps = [
      'intro',              // starting point
      'main_menu',          // navigation
      'start_booking_flow', // message before data collection
      'ask_name',           // collects full_name
      'ask_name_again',     // collects full_name (retry)
      'confirm_full_name',  // confirms full_name
      'ask_city',           // collects city_name
      'ask_vehicle',        // collects mobility
      'show_available_months', // date selection starts
      'show_available_weeks',
      'show_available_days',
      'show_available_times',  // collects meeting_date, meeting_time
      'final_confirmation',    // all data available
      'not_suitable'           // alternative path - has name, city, mobility but no meeting
    ];
    
    // Find current step position in the flow
    const currentIndex = dataCollectionSteps.indexOf(currentStepId);
    
    // Special handling for specific steps
    if (currentStepId === 'not_suitable') {
      // not_suitable comes after ask_vehicle, so has name, city, mobility
      variables.push('full_name', 'city_name', 'mobility', 'phone');
      return [...new Set(variables)];
    }
    
    if (currentStepId === 'human_support' || currentStepId === 'remove_candidate') {
      // These can be reached from various points, check if we're in booking flow
      // If we have any data collection steps before this, include their variables
      variables.push('phone');
      return [...new Set(variables)];
    }
    
    // For steps in the main data collection flow
    if (currentIndex !== -1) {
      // full_name is available after ask_name step (index 3+)
      if (currentIndex >= 4) {
        variables.push('full_name');
      }
      
      // city_name is available after ask_city step (index 6+)
      if (currentIndex >= 7) {
        variables.push('city_name');
      }
      
      // mobility is available after ask_vehicle step (index 7+)
      if (currentIndex >= 8) {
        variables.push('mobility');
      }
      
      // meeting_date and meeting_time are available after date selection starts (index 8+)
      if (currentIndex >= 9) {
        variables.push('meeting_date', 'meeting_time');
      }
    } else {
      // For steps not in the main flow, check what data might be available
      const currentStep = steps[currentStepId];
      
      // Check if we have date-related steps in the flow
      const hasDateSteps = Object.values(steps).some(step => 
        step.type === 'date' || 
        step.id.includes('date') || 
        step.id.includes('time') || 
        step.id.includes('month') || 
        step.id.includes('week') || 
        step.id.includes('day')
      );
      
      // Check if we have name collection steps
      const hasNameSteps = Object.values(steps).some(step => 
        step.id.includes('name') || 
        step.type === 'question'
      );
      
      // Check if we have city/location steps
      const hasCitySteps = Object.values(steps).some(step => 
        step.id.includes('city') || 
        step.id.includes('location')
      );
      
      // Check if we have vehicle/mobility steps
      const hasVehicleSteps = Object.values(steps).some(step => 
        step.id.includes('vehicle') || 
        step.id.includes('mobility')
      );
      
      // If this is a message step for appointment confirmation, assume all data is available
      if (currentStep?.type === 'message' && 
          (currentStep.message?.includes('פגישה') || 
           currentStep.message?.includes('תאריך') ||
           currentStep.message?.includes('שעה') ||
           currentStep.id.includes('confirm') ||
           currentStep.id.includes('final'))) {
        if (hasNameSteps) variables.push('full_name');
        if (hasCitySteps) variables.push('city_name');
        if (hasVehicleSteps) variables.push('mobility');
        if (hasDateSteps) variables.push('meeting_date', 'meeting_time');
      }
      
      // Navigation steps - only show phone unless they're contextual
      if (currentStep?.type === 'options' && !currentStep.key) {
        variables.push('phone');
        return [...new Set(variables)];
      }
    }
    
    // System variables (always available)
    variables.push('phone');
    
    // Remove duplicates and return
    return [...new Set(variables)];
  };

  const getVariableDescription = (variable: string): string => {
    const descriptions: Record<string, string> = {
      'full_name': 'שם מלא של הלקוח',
      'city_name': 'עיר מגורים',
      'mobility': 'סוג ניידות (רכב/אופנוע/לא נייד)',
      'meeting_date': 'תאריך הפגישה שנבחר',
      'meeting_time': 'שעת הפגישה שנבחרה',
      'phone': 'מספר טלפון של הלקוח (זהה ל-user_id)',
    };
    
    return descriptions[variable] || `נתון שנשמר בשלב מסוים`;
  };

  const getVariableColor = (variable: string): 'primary' | 'secondary' | 'success' | 'warning' => {
    if (['full_name', 'city_name', 'mobility'].includes(variable)) return 'primary';
    if (['meeting_date', 'meeting_time'].includes(variable)) return 'success';
    if (['phone', 'user_id'].includes(variable)) return 'secondary';
    return 'warning';
  };

  const availableVariables = getAvailableVariables();

  if (availableVariables.length === 0) {
    return (
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          אין משתנים זמינים בשלב זה
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
        📊 משתנים זמינים לשימוש
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        ניתן להשתמש במשתנים הבאים בטקסט ההודעה עם סוגריים מסולסלים: {'{variable_name}'}
      </Typography>
      
      <Divider sx={{ my: 1 }} />
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {availableVariables.map((variable) => (
          <Chip
            key={variable}
            label={`{${variable}}`}
            size="small"
            color={getVariableColor(variable)}
            variant="outlined"
            title={getVariableDescription(variable)}
            sx={{ 
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              cursor: 'help'
            }}
          />
        ))}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        💡 לחץ על משתנה כדי לראות הסבר
      </Typography>
    </Box>
  );
};

export default VariableDisplay; 