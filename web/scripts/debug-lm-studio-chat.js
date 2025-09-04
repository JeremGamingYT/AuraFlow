#!/usr/bin/env node

/**
 * Script pour débugger spécifiquement l'API chat de LM Studio
 * Usage: node scripts/debug-lm-studio-chat.js
 */

console.log('🔍 Debugging LM Studio Chat API');
console.log('===============================\n');

const LM_STUDIO_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.165.2.65:1234';
const BASE_URL = LM_STUDIO_URL.includes('/v1') ? LM_STUDIO_URL : LM_STUDIO_URL.replace(/\/$/, '') + '/v1';
const CHAT_URL = `${BASE_URL}/chat/completions`;

console.log(`📡 Testing chat endpoint: ${CHAT_URL}`);

/**
 * @param {string} formatName
 * @param {object} requestBody
 */
async function testChatFormat(formatName, requestBody) {
  console.log(`\n🧪 Testing format: ${formatName}`);
  console.log('📤 Request:', JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📋 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response:`, errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Success! Response:', JSON.stringify(result, null, 2));
    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.log(`❌ Request failed:`, error.message);
    } else {
      console.log(`❌ Request failed:`, String(error));
    }
    return false;
  }
}

async function runTests() {
  // Format 1: OpenAI standard
  const format1 = {
    model: "default",
    messages: [
      { role: "user", content: "Hello! Say just 'Test 1 OK'" }
    ],
    stream: false,
    max_tokens: 50
  };

  // Format 2: Avec "message" au lieu de "messages"
  const format2 = {
    model: "default",
    message: "Hello! Say just 'Test 2 OK'",
    stream: false,
    max_tokens: 50
  };

  // Format 3: Format LM Studio SDK
  const format3 = {
    model: "default",
    prompt: "Hello! Say just 'Test 3 OK'",
    stream: false,
    max_tokens: 50
  };

  // Format 4: Format minimal
  const format4 = {
    model: "default",
    messages: [
      { role: "user", content: "Hello! Say just 'Test 4 OK'" }
    ]
  };

  // Format 5: Avec des paramètres complets
  const format5 = {
    model: "default",
    messages: [
      { role: "user", content: "Hello! Say just 'Test 5 OK'" }
    ],
    stream: false,
    temperature: 0.7,
    max_tokens: 50,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0
  };

  const formats = [
    ['OpenAI Standard', format1],
    ['Message (singular)', format2], 
    ['Prompt format', format3],
    ['Minimal format', format4],
    ['Complete format', format5]
  ];

  let successCount = 0;
  
  for (const format of formats) {
    const name = /** @type {string} */ (format[0]);
    const body = /** @type {object} */ (format[1]);
    if (name && body) {
      const success = await testChatFormat(name, body);
      if (success) {
        successCount++;
        console.log(`✅ ${name} works!`);
      } else {
        console.log(`❌ ${name} failed`);
      }
    }
  }

  console.log(`\n📊 Summary: ${successCount}/${formats.length} formats worked`);
  
  if (successCount === 0) {
    console.log('\n💡 Troubleshooting suggestions:');
    console.log('1. Check if LM Studio server is running');
    console.log('2. Check if a model is loaded');
    console.log('3. Try accessing the web UI: http://192.165.2.65:1234');
    console.log('4. Check LM Studio logs for error details');
  } else {
    console.log('\n🎉 At least one format works! The working format should be used in the code.');
  }
}

// Test connection first
console.log('1. Testing basic connection...');
fetch(`${BASE_URL}/models`)
  .then(response => {
    if (response.ok) {
      console.log('✅ Basic connection works');
      return response.json();
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  })
  .then(data => {
    if (data && data.data) {
      console.log(`📋 Available models: ${data.data.map((/** @type {{ id: string }} */ m) => m.id).join(', ')}`);
    }
    console.log('\n2. Testing chat formats...');
    return runTests();
  })
  .catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.log('❌ Basic connection failed:', message);
    console.log('\nCannot test chat formats without basic connection.');
    process.exit(1);
  });
