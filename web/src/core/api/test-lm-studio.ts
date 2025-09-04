// Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
// SPDX-License-Identifier: MIT

/**
 * Utilitaires de test pour LM Studio
 * Ce fichier contient des fonctions utiles pour tester la connexion LM Studio
 */

import { createLMStudioProvider, isLMStudioURL } from './lm-studio';
import type { LMStudioConfig } from './lm-studio';

export interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Test de connexion basique à LM Studio
 */
export async function testLMStudioConnection(config?: Partial<LMStudioConfig>): Promise<TestResult> {
  try {
    console.log('🧪 Testing LM Studio connection...');
    
    const provider = createLMStudioProvider(config);
    
    // Test de récupération des modèles
    const models = await provider.getLoadedModels();
    
    if (models.length === 0) {
      return {
        success: false,
        message: 'No models loaded in LM Studio',
        error: 'Please load at least one model in LM Studio before testing'
      };
    }

    console.log('✅ Connection test passed');
    
    return {
      success: true,
      message: `Successfully connected to LM Studio`,
      data: {
        models,
        config: provider.getConfig()
      }
    };
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    
    return {
      success: false,
      message: 'Failed to connect to LM Studio',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test d'envoi d'un message simple
 */
export async function testLMStudioChat(
  message: string = "Hello! Can you respond with just 'Test successful'?",
  config?: Partial<LMStudioConfig>
): Promise<TestResult> {
  try {
    console.log('🧪 Testing LM Studio chat...');
    
    const provider = createLMStudioProvider(config);
    
    let response = '';
    let hasError = false;
    
    // Test du streaming
    try {
      for await (const chunk of provider.chat(message)) {
        if (chunk.type === 'message_chunk' && chunk.data.content) {
          response += chunk.data.content;
        }
      }
    } catch (error) {
      hasError = true;
      throw error;
    }

    if (!response.trim()) {
      return {
        success: false,
        message: 'Empty response received',
        error: 'Model did not generate any content'
      };
    }

    console.log('✅ Chat test passed');
    
    return {
      success: true,
      message: 'Chat test successful',
      data: {
        response: response.trim(),
        responseLength: response.length
      }
    };
  } catch (error) {
    console.error('❌ Chat test failed:', error);
    
    return {
      success: false,
      message: 'Failed to chat with LM Studio',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test complet (connexion + chat)
 */
export async function testLMStudioFull(config?: Partial<LMStudioConfig>): Promise<{
  connection: TestResult;
  chat: TestResult;
  overall: TestResult;
}> {
  console.log('🧪 Running full LM Studio test suite...');
  
  const connection = await testLMStudioConnection(config);
  
  let chat: TestResult;
  if (connection.success) {
    chat = await testLMStudioChat(undefined, config);
  } else {
    chat = {
      success: false,
      message: 'Skipped due to connection failure',
      error: 'Connection test must pass first'
    };
  }

  const overall: TestResult = {
    success: connection.success && chat.success,
    message: connection.success && chat.success 
      ? 'All tests passed! LM Studio is ready to use.'
      : 'Some tests failed. Check the details above.',
    data: {
      connectionPassed: connection.success,
      chatPassed: chat.success
    }
  };

  console.log(overall.success ? '✅ Full test suite passed!' : '❌ Some tests failed');

  return { connection, chat, overall };
}

/**
 * Diagnostic de configuration LM Studio
 */
export function diagnoseConfiguration(): TestResult {
  console.log('🔍 Diagnosing LM Studio configuration...');
  
  const issues: string[] = [];
  const config: any = {};

  // Vérifier NEXT_PUBLIC_API_URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  config.NEXT_PUBLIC_API_URL = apiUrl || 'not set';
  
  if (!apiUrl) {
    issues.push('NEXT_PUBLIC_API_URL is not set');
  } else if (!isLMStudioURL(apiUrl)) {
    issues.push(`NEXT_PUBLIC_API_URL (${apiUrl}) does not look like a LM Studio URL`);
  }

  // Vérifier si on est dans le bon environnement
  if (typeof window === 'undefined') {
    issues.push('Running in server environment - some features may not work');
  }

  const success = issues.length === 0;

  return {
    success,
    message: success 
      ? 'Configuration looks good!'
      : `Found ${issues.length} configuration issue(s)`,
    data: {
      config,
      issues
    },
    error: success ? undefined : issues.join('; ')
  };
}

/**
 * Affiche un rapport de diagnostic complet
 */
export async function runDiagnostics(config?: Partial<LMStudioConfig>): Promise<void> {
  console.log('\n🔍 LM Studio Diagnostics Report');
  console.log('================================\n');

  // Configuration
  const configTest = diagnoseConfiguration();
  console.log('📋 Configuration:', configTest.success ? '✅ OK' : '❌ Issues found');
  if (!configTest.success && configTest.data?.issues) {
    configTest.data.issues.forEach((issue: string) => console.log(`   - ${issue}`));
  }
  console.log();

  // Tests complets
  const tests = await testLMStudioFull(config);
  
  console.log('🔌 Connection:', tests.connection.success ? '✅ OK' : '❌ Failed');
  if (!tests.connection.success) {
    console.log(`   Error: ${tests.connection.error}`);
  } else if (tests.connection.data?.models) {
    console.log(`   Models: ${tests.connection.data.models.join(', ')}`);
  }
  console.log();

  console.log('💬 Chat:', tests.chat.success ? '✅ OK' : '❌ Failed');
  if (!tests.chat.success) {
    console.log(`   Error: ${tests.chat.error}`);
  } else if (tests.chat.data?.response) {
    console.log(`   Response: "${tests.chat.data.response.substring(0, 100)}${tests.chat.data.response.length > 100 ? '...' : ''}"`);
  }
  console.log();

  console.log('📊 Overall:', tests.overall.success ? '✅ All tests passed!' : '❌ Some issues found');
  
  if (!tests.overall.success) {
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Ensure LM Studio is running');
    console.log('   2. Load a model in LM Studio');
    console.log('   3. Start the local server in LM Studio');
    console.log('   4. Check NEXT_PUBLIC_API_URL in your .env file');
    console.log('   5. Try restarting both LM Studio and your application');
  }
  
  console.log('\n================================\n');
}

// Export pour utilisation dans la console du navigateur
if (typeof window !== 'undefined') {
  (window as any).testLMStudio = {
    connection: testLMStudioConnection,
    chat: testLMStudioChat,
    full: testLMStudioFull,
    diagnose: diagnoseConfiguration,
    runDiagnostics
  };
}
