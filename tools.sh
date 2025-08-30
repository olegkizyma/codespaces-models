#!/bin/bash

# 🛠️ Model Development Tools
# Зручні інструменти для роботи з моделями

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_PORT=3010
SERVER_HOST="localhost"
SERVER_URL="http://${SERVER_HOST}:${SERVER_PORT}"

print_header() {
    echo -e "${BLUE}🛠️  Model Development Tools${NC}"
    echo "=================================="
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_dependencies() {
    print_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        return 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        return 1
    fi
    
    # Check if packages are installed
    if [ ! -d "node_modules" ]; then
        print_warning "Node modules not found, installing..."
        npm install
    fi
    
    print_success "Dependencies OK"
}

check_server() {
    print_info "Checking server status..."
    
    if curl -s "${SERVER_URL}/health" > /dev/null 2>&1; then
        print_success "Server is running at ${SERVER_URL}"
        return 0
    else
        print_warning "Server is not running"
        return 1
    fi
}

start_server() {
    print_info "Starting server..."
    
    if check_server; then
        print_warning "Server is already running"
        return 0
    fi
    
    npm start &
    SERVER_PID=$!
    
    # Wait for server to start
    for i in {1..10}; do
        sleep 1
        if check_server; then
            print_success "Server started successfully (PID: $SERVER_PID)"
            return 0
        fi
    done
    
    print_error "Failed to start server"
    return 1
}

stop_server() {
    print_info "Stopping server..."
    
    # Find and kill server process
    pkill -f "node.*server" || true
    pkill -f "npm.*start" || true
    
    sleep 2
    
    if ! check_server; then
        print_success "Server stopped"
    else
        print_error "Failed to stop server"
    fi
}

generate_examples() {
    print_info "Generating code examples..."
    
    if [ ! -f "code-generator.mjs" ]; then
        print_error "Code generator not found"
        return 1
    fi
    
    node code-generator.mjs
    print_success "Examples generated in './generated-examples/'"
}

quick_test() {
    print_info "Starting quick test tool..."
    
    if ! check_server; then
        print_warning "Server not running, starting it..."
        start_server || return 1
    fi
    
    node quick-test.mjs "$@"
}

health_check() {
    print_info "Running health check..."
    
    node model-helper.mjs health
}

benchmark() {
    print_info "Running benchmark..."
    
    if ! check_server; then
        print_warning "Server not running, starting it..."
        start_server || return 1
    fi
    
    node quick-test.mjs --benchmark
}

show_usage() {
    print_header
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start              Start the model server"
    echo "  stop               Stop the model server"
    echo "  status             Check server status"
    echo "  test               Interactive model testing"
    echo "  benchmark          Run model benchmark"
    echo "  generate           Generate code examples"
    echo "  health             Run health check"
    echo "  setup              Initial setup and dependencies"
    echo "  logs               Show server logs"
    echo ""
    echo "Examples:"
    echo "  $0 start           # Start server"
    echo "  $0 test            # Interactive testing"
    echo "  $0 benchmark       # Benchmark all models"
    echo "  $0 generate        # Generate examples"
    echo ""
}

setup() {
    print_header
    print_info "Setting up development environment..."
    
    # Install dependencies
    check_dependencies || return 1
    
    # Generate examples
    generate_examples || return 1
    
    # Run setup
    node model-helper.mjs setup
    
    print_success "Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. ./tools.sh start      # Start server"
    echo "  2. ./tools.sh test       # Test models"
    echo "  3. ./tools.sh health     # Check health"
}

show_logs() {
    print_info "Showing server logs..."
    
    # Try to find log files
    if [ -f "server.log" ]; then
        tail -f server.log
    elif [ -f "logs/server.log" ]; then
        tail -f logs/server.log
    else
        print_warning "No log files found"
        print_info "Server output (if running):"
        pkill -f "node.*server" -USR1 2>/dev/null || print_warning "Server not running"
    fi
}

# Main command handling
case "${1:-}" in
    "start")
        print_header
        start_server
        ;;
    "stop")
        print_header
        stop_server
        ;;
    "status")
        print_header
        check_server && print_success "Server is running" || print_warning "Server is stopped"
        ;;
    "test")
        print_header
        quick_test "${@:2}"
        ;;
    "benchmark")
        print_header
        benchmark
        ;;
    "generate")
        print_header
        generate_examples
        ;;
    "health")
        print_header
        health_check
        ;;
    "setup")
        setup
        ;;
    "logs")
        print_header
        show_logs
        ;;
    "help"|"--help"|"-h")
        show_usage
        ;;
    "")
        show_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
