import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'dummy-key',
  baseURL: 'http://localhost:3010/v1'
});

async function main() {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Explain AI in simple terms' }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    console.log('✅ Response:', response.choices[0].message.content);
    console.log('📊 Usage:', response.usage);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();