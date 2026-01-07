#!/usr/bin/env node

/**
 * Helper script to generate OAuth app credentials
 * Run: node generate-credentials.js
 */

const crypto = require('crypto');

console.log('\n=== Ave OAuth App Credential Generator ===\n');

// Generate a random client ID
const clientId = 'app_' + crypto.randomBytes(16).toString('hex');

// Generate a random client secret
const clientSecret = crypto.randomBytes(32).toString('hex');

// Hash the client secret (for storing in database)
const clientSecretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');

console.log('Generated Credentials:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('Client ID:');
console.log(clientId);
console.log('\nClient Secret (keep this safe!):');
console.log(clientSecret);
console.log('\nClient Secret Hash (for database):');
console.log(clientSecretHash);
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('SQL to insert into database:\n');
console.log(`INSERT INTO oauth_apps (
  name, 
  description, 
  icon_url, 
  website_url, 
  client_id, 
  client_secret_hash, 
  redirect_uris, 
  supports_e2ee, 
  owner_id
) VALUES (
  'My App',
  'Description of my app',
  'https://example.com/icon.png',
  'http://localhost:8000',
  '${clientId}',
  '${clientSecretHash}',
  '["http://localhost:8000/callback"]'::jsonb,
  false,
  NULL
);`);

console.log('\n\nUpdate your app config with:');
console.log(`const CLIENT_ID = '${clientId}';`);
console.log(`const CLIENT_SECRET = '${clientSecret}';`);
console.log('\n');
