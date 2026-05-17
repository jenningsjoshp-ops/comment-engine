const fs = require('fs');

const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';
const apifyToken = process.env.APIFY_API_TOKEN || process.env.EXPO_PUBLIC_APIFY_API_TOKEN || '';

const content = `export const ANTHROPIC_API_KEY = '${anthropicKey}';
export const APIFY_API_TOKEN = '${apifyToken}';
`;

fs.writeFileSync('./config.js', content);
console.log('config.js generated with keys:', anthropicKey ? 'ANTHROPIC ✓' : 'ANTHROPIC ✗', apifyToken ? 'APIFY ✓' : 'APIFY ✗');