import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN, baseURL: process.env.OPENAI_BASE_URL || "https://models.github.ai/inference" });

async function main(){
  try{
    const resp = await client.models.list();
    const ids = resp.data?.map(m => m.id) || [];
    console.log(JSON.stringify({count: ids.length, models: ids}, null, 2));
  }catch(e){
    console.error('ERROR_MESSAGE:', e.message || e);
    try{
      if(e.response && typeof e.response.text === 'function'){
        const txt = await e.response.text();
        console.error('ERROR_DETAILS:', txt);
      }
    }catch(_){ }
    process.exit(1);
  }
}

main();
