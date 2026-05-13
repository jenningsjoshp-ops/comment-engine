const fs = require('fs');

const content = `export const ANTHROPIC_API_KEY = '${process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || ''}';
export const APIFY_API_TOKEN = '${process.env.APIFY_API_TOKEN || process.env.EXPO_PUBLIC_APIFY_API_TOKEN || ''}';
`;

fs.writeFileSync('./config.js', content);
console.log('config.js generated from environment variables');