#!/bin/bash

MODEL="gpt-4o-mini"
PROMPT="What is machine learning?"

echo "🤖 Testing model: $MODEL"
echo "💬 Prompt: $PROMPT"
echo "================================================"

echo "📡 Using simple-chat API:"
curl -s -X POST "http://localhost:3010/v1/simple-chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$PROMPT\", \"model\": \"$MODEL\"}" | jq -r '.message // .error'

echo ""
echo "📡 Using OpenAI compatible API:"
curl -s -X POST "http://localhost:3010/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL\",
    \"messages\": [
      {\"role\": \"system\", \"content\": \"You are a helpful assistant.\"},
      {\"role\": \"user\", \"content\": \"$PROMPT\"}
    ],
    \"temperature\": 0.7,
    \"max_tokens\": 1000
  }" | jq '.choices[0].message.content // .error'