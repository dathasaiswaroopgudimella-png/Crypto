import fs from 'fs';
import path from 'path';

// Read .env.local or .env for standalone node execution
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function run() {
  const apiKey = process.env.EXPLABS_API_KEY;
  const baseUrl = process.env.EXPLABS_BASE_URL || 'https://api.experientiallabs.ai/v1';
  const targetModel = 'gpt-6-astra';

  console.log('=== EXPERIENTIAL LABS GATEWAY VERIFICATION ===');
  console.log('Base URL:', baseUrl);
  console.log('API Key Configured:', apiKey ? apiKey.slice(0, 8) + '...' : 'MISSING');
  console.log('Exact Target Model:', targetModel);

  if (!apiKey) {
    console.error('ERROR: EXPLABS_API_KEY is not set.');
    process.exit(1);
  }

  async function callGateway(model) {
    const payload = {
      model: model,
      messages: [{ role: 'user', content: 'In one sentence, what is crypto tracing?' }],
      max_tokens: 60
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AEGIS-TRACE-Verification/1.0'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return { status: res.status, data };
  }

  console.log('\n--- 1. Testing gpt-6-astra Call ---');
  const astraRes = await callGateway(targetModel);
  console.log('Status Code:', astraRes.status);
  console.log('Response Payload:', JSON.stringify(astraRes.data, null, 2));

  console.log('\n--- 2. Testing Parallel Active Model on Same Key (claude-fable-latest) ---');
  const fableRes = await callGateway('claude-fable-latest');
  console.log('Status Code:', fableRes.status);
  console.log('Response Payload:', JSON.stringify(fableRes.data, null, 2));
}

run().catch(console.error);
