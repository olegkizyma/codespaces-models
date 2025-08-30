import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN, 
  baseURL: process.env.OPENAI_BASE_URL || "https://models.github.ai/inference" 
});

// Extended list of potential models based on GitHub Models ecosystem
const potentialModels = [
  // OpenAI models
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4",
  "openai/gpt-4-turbo",
  "openai/gpt-3.5-turbo",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  
  // Microsoft models
  "microsoft/Phi-3.5-mini-instruct",
  "microsoft/Phi-3-mini-4k-instruct",
  "microsoft/Phi-3-medium-4k-instruct", 
  "microsoft/Phi-3-small-8k-instruct",
  "microsoft/Phi-3.5-MoE-instruct",
  "microsoft/DialoGPT-medium",
  "Phi-3.5-mini-instruct",
  "Phi-3-mini-4k-instruct",
  "Phi-3-medium-4k-instruct",
  
  // Meta Llama models
  "meta-llama/Llama-3.2-3B-Instruct",
  "meta-llama/Llama-3.2-1B-Instruct", 
  "meta-llama/Llama-3.1-70B-Instruct",
  "meta-llama/Llama-3.1-8B-Instruct",
  "meta-llama/Meta-Llama-3-70B-Instruct",
  "meta-llama/Meta-Llama-3-8B-Instruct",
  "meta-llama/CodeLlama-7b-Instruct-hf",
  "meta-llama/CodeLlama-13b-Instruct-hf",
  "Llama-3.2-3B-Instruct",
  "Llama-3.2-1B-Instruct",
  "Llama-3.1-70B-Instruct",
  "Llama-3.1-8B-Instruct",
  
  // Mistral models
  "mistralai/Mistral-7B-Instruct-v0.3",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "mistralai/Mistral-Small",
  "mistralai/Mistral-Large",
  "mistralai/Codestral-22B-v0.1",
  "mistral-large",
  "mistral-small",
  "Mistral-7B-Instruct-v0.3",
  "Mixtral-8x7B-Instruct-v0.1",
  
  // AI21 models
  "AI21-Jamba-1.5-Mini",
  "AI21-Jamba-1.5-Large",
  "ai21/jamba-instruct",
  "ai21/j2-ultra",
  "ai21/j2-mid",
  "Jamba-1.5-Mini",
  "Jamba-1.5-Large",
  
  // Cohere models
  "cohere/Cohere-command-r",
  "cohere/Cohere-command-r-plus",
  "cohere/command-r",
  "cohere/command-r-plus",
  "cohere/command-light",
  "Cohere-command-r",
  "Cohere-command-r-plus",
  
  // Anthropic models
  "anthropic/claude-3-haiku",
  "anthropic/claude-3-sonnet", 
  "anthropic/claude-3-opus",
  "anthropic/claude-3.5-sonnet",
  "claude-3-haiku",
  "claude-3-sonnet",
  "claude-3.5-sonnet",
  
  // Google models
  "google/gemini-1.5-pro",
  "google/gemini-1.5-flash",
  "google/gemma-2b-it",
  "google/gemma-7b-it",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  
  // Other models
  "stabilityai/stable-code-instruct-3b",
  "HuggingFaceH4/zephyr-7b-beta",
  "teknium/OpenHermes-2.5-Mistral-7B",
  "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO",
  "databricks/dbrx-instruct",
  "togethercomputer/RedPajama-INCITE-7B-Chat"
];

async function testModel(modelName) {
  try {
    console.log(`Testing ${modelName}...`);
    
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hi" }
      ],
      max_tokens: 5,
      temperature: 0
    });

    const reply = response.choices?.[0]?.message?.content || "No response";
    return { model: modelName, status: "✅ WORKING", response: reply.substring(0, 30) };
    
  } catch (err) {
    const errorMsg = err?.message || String(err);
    if (errorMsg.includes('404') || errorMsg.includes('Unknown model')) {
      return { model: modelName, status: "❌ NOT AVAILABLE", error: "Model not found" };
    } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      return { model: modelName, status: "⚠️ RATE LIMITED", error: "Try again later" };
    } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
      return { model: modelName, status: "🔐 AUTH ERROR", error: "Invalid token/permission" };
    } else {
      return { model: modelName, status: "🔥 OTHER ERROR", error: errorMsg.substring(0, 80) };
    }
  }
}

async function discoverAllModels() {
  console.log("🔍 Discovering ALL GitHub Models...\n");
  console.log(`Testing ${potentialModels.length} potential models...\n`);
  
  const results = [];
  let currentIndex = 0;
  
  for (const model of potentialModels) {
    currentIndex++;
    const result = await testModel(model);
    results.push(result);
    
    const progress = `[${currentIndex}/${potentialModels.length}]`;
    console.log(`${progress} ${result.status} ${result.model}`);
    if (result.response) console.log(`   → "${result.response}..."`);
    if (result.error) console.log(`   → ${result.error}`);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 FINAL RESULTS:");
  console.log("=".repeat(60));
  
  const working = results.filter(r => r.status.includes('WORKING'));
  const notAvailable = results.filter(r => r.status.includes('NOT AVAILABLE'));
  const rateLimited = results.filter(r => r.status.includes('RATE LIMITED'));
  const authErrors = results.filter(r => r.status.includes('AUTH ERROR'));
  const otherErrors = results.filter(r => r.status.includes('OTHER ERROR'));
  
  console.log(`\n✅ WORKING MODELS (${working.length}):`);
  working.forEach(r => console.log(`   - ${r.model}`));
  
  console.log(`\n❌ NOT AVAILABLE (${notAvailable.length}):`);
  notAvailable.slice(0, 10).forEach(r => console.log(`   - ${r.model}`));
  if (notAvailable.length > 10) console.log(`   ... and ${notAvailable.length - 10} more`);
  
  if (rateLimited.length > 0) {
    console.log(`\n⚠️ RATE LIMITED (${rateLimited.length}):`);
    rateLimited.forEach(r => console.log(`   - ${r.model}`));
  }
  
  if (authErrors.length > 0) {
    console.log(`\n🔐 AUTH ERRORS (${authErrors.length}):`);
    authErrors.forEach(r => console.log(`   - ${r.model}`));
  }
  
  if (otherErrors.length > 0) {
    console.log(`\n🔥 OTHER ERRORS (${otherErrors.length}):`);
    otherErrors.forEach(r => console.log(`   - ${r.model} → ${r.error}`));
  }
  
  console.log(`\n🔧 HTML OPTION TAGS FOR UI (${working.length} models):`);
  console.log("=".repeat(60));
  working.forEach(r => {
    console.log(`      <option>${r.model}</option>`);
  });
  
  console.log(`\n🗂️ JAVASCRIPT ARRAY:`);
  console.log("=".repeat(60));
  console.log("const workingModels = [");
  working.forEach(r => {
    console.log(`  "${r.model}",`);
  });
  console.log("];");
}

discoverAllModels().catch(console.error);
