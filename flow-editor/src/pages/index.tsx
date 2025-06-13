import React from 'react';
import { Box } from '@mui/material';
import FlowEditor from '../components/FlowEditor';

const Home: React.FC = () => {
  return (
    <Box sx={{ width: '100%', height: '100vh' }}>
      <FlowEditor />
    </Box>
  );
};

export default Home; 