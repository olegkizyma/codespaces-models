#!/bin/bash

# Test all 58 models systematically
echo "🧪 Testing all 58 models in GitHub Models API..."
echo "================================================"

# Get all model IDs
models=$(curl -s "http://localhost:4000/v1/models" | jq -r '.data[].id')

# Counters
working=0
failed=0
total=0

# Results arrays
declare -a working_models
declare -a failed_models

echo "📋 Found $(echo "$models" | wc -l) models to test"
echo ""

# Test each model
for model in $models; do
    total=$((total + 1))
    echo -n "[$total/58] Testing $model... "
    
    # Make API request with timeout
    response=$(timeout 30s curl -s -X POST "http://localhost:4000/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer dummy-key" \
        -d "{
            \"model\": \"$model\",
            \"messages\": [{\"role\": \"user\", \"content\": \"Hi\"}],
            \"max_tokens\": 10
        }" 2>/dev/null)
    
    # Check if request was successful
    if echo "$response" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
        working=$((working + 1))
        working_models+=("$model")
        echo "✅ WORKING"
    else
        failed=$((failed + 1))
        failed_models+=("$model")
        error_msg=$(echo "$response" | jq -r '.error.message // "Unknown error"' 2>/dev/null)
        echo "❌ FAILED: $error_msg"
    fi
    
    # Small delay to avoid overwhelming the API
    sleep 0.5
done

echo ""
echo "📊 SUMMARY RESULTS"
echo "=================="
echo "Total models tested: $total"
echo "Working models: $working"
echo "Failed models: $failed"
echo "Success rate: $(( working * 100 / total ))%"

echo ""
echo "✅ WORKING MODELS ($working):"
echo "=========================="
for model in "${working_models[@]}"; do
    echo "  ✓ $model"
done

echo ""
echo "❌ FAILED MODELS ($failed):"
echo "======================="
for model in "${failed_models[@]}"; do
    echo "  ✗ $model"
done

echo ""
echo "📝 Test completed at $(date)"
