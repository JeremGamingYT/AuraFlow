#!/usr/bin/env node

/**
 * Script simple pour tester la connexion LM Studio
 * Usage: node scripts/test-lm-studio.js
 */

console.log('🧪 Testing LM Studio Connection');
console.log('================================\n');

// Configuration simple
const LM_STUDIO_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.165.2.65:1234';

console.log(`📡 Testing connection to: ${LM_STUDIO_URL}`);

// Test de connexion basique
async function testConnection() {
  try {
    const response = await fetch(`${LM_STUDIO_URL}/v1/models`, {
      headers: {
        'Authorization': 'Bearer lm-studio'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      console.log('✅ Connection successful!');
      console.log('📋 Available models:');
      data.data.forEach((/** @type {{ id: string }} */ model) => {
        console.log(`   - ${model.id}`);
      });
    } else {
      console.log('⚠️  Connected but no models found');
      console.log('   Please load a model in LM Studio');
    }

    return true;
  } catch (error) {
    console.log('❌ Connection failed:');
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   ${message}`);
    
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Is LM Studio running?');
    console.log('   2. Is the local server started? (green "Start Server" button)');
    console.log('   3. Is a model loaded?');
    console.log(`   4. Is the URL correct? (${LM_STUDIO_URL})`);
    
    return false;
  }
}

// Test de chat simple
async function testChat() {
  try {
    const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio'
      },
      body: JSON.stringify({
        model: 'default',
        messages: [{ role: 'user', content: 'Say just "Test successful"' }],
        stream: false,
        max_tokens: 50
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      console.log('✅ Chat test successful!');
      console.log(`💬 Response: "${data.choices[0].message.content.trim()}"`);
      return true;
    } else {
      console.log('⚠️  Chat response malformed');
      console.log('   Response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Chat test failed:');
    const message = error instanceof Error ? error.message : String(error);
    console.log(`   ${message}`);
    return false;
  }
}

// Exécuter les tests
async function runTests() {
  console.log('1. Testing connection...');
  const connectionOk = await testConnection();
  
  if (connectionOk) {
    console.log('\n2. Testing chat...');
    const chatOk = await testChat();
    
    console.log('\n📊 Results:');
    console.log(`   Connection: ${connectionOk ? '✅' : '❌'}`);
    console.log(`   Chat: ${chatOk ? '✅' : '❌'}`);
    
    if (connectionOk && chatOk) {
      console.log('\n🎉 All tests passed! LM Studio is ready to use with AuraFlow.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the issues above.');
      process.exit(1);
    }
  } else {
    console.log('\n⚠️  Cannot proceed to chat test - connection failed.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
