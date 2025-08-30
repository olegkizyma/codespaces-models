import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN, 
  baseURL: process.env.OPENAI_BASE_URL || "https://models.github.ai/inference" 
});

const testModels = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4",
  "openai/gpt-3.5-turbo",
  "meta-llama/Llama-3.2-3B-Instruct",
  "meta-llama/Llama-3.2-1B-Instruct",
  "microsoft/Phi-3.5-mini-instruct", 
  "microsoft/Phi-3-mini-4k-instruct",
  "AI21-Jamba-1.5-Mini",
  "AI21-Jamba-1.5-Large",
  "cohere/Cohere-command-r",
  "cohere/Cohere-command-r-plus",
  // Additional models to test
  "microsoft/Phi-3-medium-4k-instruct",
  "microsoft/Phi-3-small-8k-instruct",
  "mistralai/Mistral-7B-Instruct-v0.3",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "meta-llama/Llama-3.1-70B-Instruct",
  "meta-llama/Llama-3.1-8B-Instruct"
];

async function testModel(modelName) {
  try {
    console.log(`Testing ${modelName}...`);
    
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" }
      ],
      max_tokens: 10,
      temperature: 0
    });

    const reply = response.choices?.[0]?.message?.content || "No response";
    return { model: modelName, status: "✅ WORKING", response: reply.substring(0, 50) };
    
  } catch (err) {
    const errorMsg = err?.message || String(err);
    if (errorMsg.includes('404') || errorMsg.includes('Unknown model')) {
      return { model: modelName, status: "❌ NOT AVAILABLE", error: "Model not found" };
    } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
      return { model: modelName, status: "⚠️ RATE LIMITED", error: "Try again later" };
    } else {
      return { model: modelName, status: "🔥 ERROR", error: errorMsg.substring(0, 100) };
    }
  }
}

async function testAllModels() {
  console.log("🧪 Testing GitHub Models availability...\n");
  
  const results = [];
  
  for (const model of testModels) {
    const result = await testModel(model);
    results.push(result);
    
    console.log(`${result.status} ${result.model}`);
    if (result.response) console.log(`   → "${result.response}..."`);
    if (result.error) console.log(`   → ${result.error}`);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("\n📊 SUMMARY:");
  const working = results.filter(r => r.status.includes('WORKING'));
  const notAvailable = results.filter(r => r.status.includes('NOT AVAILABLE'));
  
  console.log(`✅ Working models (${working.length}):`);
  working.forEach(r => console.log(`   - ${r.model}`));
  
  console.log(`\n❌ Unavailable models (${notAvailable.length}):`);
  notAvailable.forEach(r => console.log(`   - ${r.model}`));
  
  console.log(`\n🔧 Working models for UI:`);
  const workingList = working.map(r => `      <option>${r.model}</option>`).join('\n');
  console.log(workingList);
}

testAllModels().catch(console.error);
