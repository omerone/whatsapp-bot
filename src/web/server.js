const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static(__dirname));
app.use(express.json());

// POST /api/save-availability
app.post('/api/save-availability', (req, res) => {
  fs.writeFile(path.join(__dirname, '../../data/availability.json'), JSON.stringify(req.body, null, 2), err => {
    if (err) {
      console.error('שגיאה בשמירה:', err);
      return res.status(500).send('שגיאה בשמירה');
    }
    res.sendStatus(200);
  });
});

// POST /api/save-city-groups
app.post('/api/save-city-groups', (req, res) => {
  const { groups } = req.body;
  fs.writeFile(path.join(__dirname, '../../data/city-groups.json'), JSON.stringify({ groups }, null, 2), err => {
    if (err) {
      console.error('שגיאה בשמירת city-groups:', err);
      return res.status(500).send('שגיאה בשמירה');
    }
    res.sendStatus(200);
  });
});

// API endpoints for flow editor
app.get('/api/flows', async (req, res) => {
  try {
    const flowsDir = path.join(__dirname, '../../data/flows');
    const files = await fs.readdir(flowsDir);
    const flows = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const content = await fs.readFile(path.join(flowsDir, file), 'utf8');
          const flow = JSON.parse(content);
          return {
            id: file.replace('.json', ''),
            name: flow.metadata?.company_name || file.replace('.json', ''),
            metadata: flow.metadata
          };
        })
    );
    res.json(flows);
  } catch (error) {
    console.error('Error loading flows:', error);
    res.status(500).json({ error: 'Failed to load flows' });
  }
});

app.post('/api/flows', async (req, res) => {
  try {
    const { name, metadata } = req.body;
    const flowsDir = path.join(__dirname, '../../data/flows');
    
    // Ensure flows directory exists
    await fs.mkdir(flowsDir, { recursive: true });
    
    const flowId = `flow-${Date.now()}`;
    const flowPath = path.join(flowsDir, `${flowId}.json`);
    
    const newFlow = {
      metadata: {
        company_name: name,
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        ...metadata
      },
      configuration: {
        rules: {
          blockedSources: {
            ignoreContacts: true,
            ignoreArchived: true,
            ignoreGroups: true,
            ignoreStatus: true
          },
          activation: {
            enabled: true,
            keywords: [],
            resetAfterHours: 24
          }
        },
        client_management: {
          freeze: {
            enabled: true,
            duration: 60,
            messaging: {
              send_explanation: true,
              message: 'תחזור אלינו בעוד {duration} דקות. תודה על הסבלנות! 🙏'
            }
          },
          reset: {
            enabled: true,
            keyword: 'תפריט',
            target_step: 'main_menu',
            options: {
              unfreeze: true,
              delete_appointment: true,
              allow_unblock: true
            }
          }
        }
      },
      start: 'intro',
      steps: {
        intro: {
          id: 'intro',
          type: 'message',
          userResponseWaiting: false,
          next: 'main_menu',
          messageFile: 'intro.txt'
        },
        main_menu: {
          id: 'main_menu',
          type: 'options',
          userResponseWaiting: true,
          options: {
            "1 || פגישה || לקבוע פגישה": "book",
            "2 || שאלות || מידע": "questions",
            "3 || נציג || נציג אנושי": "human"
          },
          branches: {
            book: 'start_booking_flow',
            questions: 'faq1',
            human: 'human_support'
          },
          messageFile: 'main_menu.txt'
        }
      }
    };
    
    await fs.writeFile(flowPath, JSON.stringify(newFlow, null, 2));
    
    res.json({
      id: flowId,
      name,
      metadata: newFlow.metadata
    });
  } catch (error) {
    console.error('Error creating flow:', error);
    res.status(500).json({ error: 'Failed to create flow' });
  }
});

app.put('/api/flows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const flowPath = path.join(__dirname, '../../data/flows', `${id}.json`);
    await fs.writeFile(flowPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating flow:', error);
    res.status(500).json({ error: 'Failed to update flow' });
  }
});

app.delete('/api/flows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const flowPath = path.join(__dirname, '../../data/flows', `${id}.json`);
    await fs.unlink(flowPath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flow:', error);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
});

// Serve the data files
app.get('/availability.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../../data/availability.json'));
});

app.get('/city-groups.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../../data/city-groups.json'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'editor.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(port, () => {
  console.log(`⚡ השרת רץ בכתובת: http://localhost:${port}`);
});