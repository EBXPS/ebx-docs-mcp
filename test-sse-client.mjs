#!/usr/bin/env node

/**
 * Simple SSE client to test the MCP server
 */

import { EventSource } from 'eventsource';

const sseUrl = 'http://localhost:8000/sse';
const messageUrl = 'http://localhost:8000/message';

console.log('Connecting to SSE endpoint:', sseUrl);

const es = new EventSource(sseUrl);

es.onopen = () => {
  console.log('✓ SSE connection opened');

  // Send a list tools request
  setTimeout(() => {
    console.log('\nSending tools/list request...');
    fetch(messageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    })
    .then(res => res.json())
    .then(data => console.log('Response:', JSON.stringify(data, null, 2)))
    .catch(err => console.error('Error:', err));
  }, 1000);
};

es.onmessage = (event) => {
  console.log('Received message:', event.data);
};

es.onerror = (error) => {
  console.error('SSE Error:', error);
  es.close();
  process.exit(1);
};

// Keep alive
setTimeout(() => {
  console.log('\nClosing connection...');
  es.close();
  process.exit(0);
}, 5000);
