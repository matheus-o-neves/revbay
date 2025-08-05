#!/bin/bash

# RevBay Payment Flow Test Suite Runner
# This script runs comprehensive tests for the RevBay payment system

set -e  # Exit on any error

echo "🧪 RevBay Payment Flow Test Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if services are running
check_service() {
    local service_name=$1
    local service_url=$2
    
    print_status "Checking $service_name service..."
    
    if curl -s -f "$service_url/health" > /dev/null; then
        print_success "$service_name is running and healthy"
        return 0
    else
        print_error "$service_name is not running at $service_url"
        return 1
    fi
}

# Check if database is accessible
check_database() {
    print_status "Checking database connection..."
    
    if npx prisma db status --schema=infrastructure/database/prisma/schema.prisma > /dev/null 2>&1; then
        print_success "Database is accessible"
        return 0
    else
        print_error "Database is not accessible"
        return 1
    fi
}

# Pre-flight checks
print_status "Running pre-flight checks..."
echo

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and run: docker-compose up -d"
    exit 1
fi

# Check if services are running
API_GATEWAY_URL="http://localhost:3000"
ORCHESTRATOR_URL="http://localhost:3001"

if ! check_service "API Gateway" "$API_GATEWAY_URL"; then
    print_warning "Starting API Gateway service..."
    cd services/api-gateway
    npm run dev > /dev/null 2>&1 &
    API_GATEWAY_PID=$!
    cd ../../
    sleep 5
    
    if ! check_service "API Gateway" "$API_GATEWAY_URL"; then
        print_error "Failed to start API Gateway"
        exit 1
    fi
fi

if ! check_service "Payment Orchestrator" "$ORCHESTRATOR_URL"; then
    print_warning "Starting Payment Orchestrator service..."
    cd services/payment-orchestrator
    npm run dev > /dev/null 2>&1 &
    ORCHESTRATOR_PID=$!
    cd ../../
    sleep 5
    
    if ! check_service "Payment Orchestrator" "$ORCHESTRATOR_URL"; then
        print_error "Failed to start Payment Orchestrator"
        exit 1
    fi
fi

# Check database
if ! check_database; then
    print_warning "Setting up database..."
    npm run db:generate
    npm run db:migrate
    
    if ! check_database; then
        print_error "Failed to setup database"
        exit 1
    fi
fi

echo
print_success "All services are ready!"
echo

# Run test suites
FAILED_TESTS=0

run_test_suite() {
    local test_name=$1
    local test_command=$2
    local description=$3
    
    echo
    print_status "Running $test_name"
    echo "Description: $description"
    echo "Command: $test_command"
    echo

    if eval "$test_command"; then
        print_success "$test_name passed!"
    else
        print_error "$test_name failed!"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Test execution
echo "🚀 Starting test execution..."
echo

# 1. Complete Payment Flow Tests
run_test_suite \
    "Complete Payment Flow Tests" \
    "npm run test:payment-flow" \
    "Tests the complete payment flow from API Gateway through Payment Orchestrator"

# 2. Stripe Integration Tests
run_test_suite \
    "Stripe Integration Tests" \
    "npm run test:stripe" \
    "Tests Stripe payment provider integration and routing"

# 3. Celcoin Integration Tests
run_test_suite \
    "Celcoin Integration Tests" \
    "npm run test:celcoin" \
    "Tests Celcoin payment provider integration for PIX and Boleto"

# 4. Database Persistence Tests
run_test_suite \
    "Database Persistence Tests" \
    "npm run test:database" \
    "Tests database persistence, audit logging, and data integrity"

# Summary
echo
echo "=================================================="
print_status "Test Execution Summary"
echo "=================================================="

if [ $FAILED_TESTS -eq 0 ]; then
    print_success "All test suites passed! ✅"
    echo
    echo "🎉 Your RevBay payment system is working correctly!"
    echo
    echo "Summary of what was tested:"
    echo "  ✅ API Gateway → Payment Orchestrator communication"
    echo "  ✅ Payment routing (CARD → Stripe, PIX/BOLETO → Celcoin)"
    echo "  ✅ Input validation and error handling"
    echo "  ✅ Currency validation for Brazilian payment methods"
    echo "  ✅ Database persistence and audit logging"
    echo "  ✅ Payment status tracking and updates"
    echo "  ✅ Customer payment history retrieval"
    echo "  ✅ Concurrent request handling"
    echo "  ✅ Service health checks and monitoring"
    echo
else
    print_error "$FAILED_TESTS test suite(s) failed ❌"
    echo
    echo "Please check the test output above for details."
    echo "Common issues:"
    echo "  • Services not running (API Gateway on :3000, Orchestrator on :3001)"
    echo "  • Database not accessible"
    echo "  • Invalid test credentials"
    echo "  • Network connectivity issues"
fi

# Cleanup
if [ -n "$API_GATEWAY_PID" ]; then
    print_status "Stopping API Gateway (PID: $API_GATEWAY_PID)..."
    kill $API_GATEWAY_PID 2>/dev/null || true
fi

if [ -n "$ORCHESTRATOR_PID" ]; then
    print_status "Stopping Payment Orchestrator (PID: $ORCHESTRATOR_PID)..."
    kill $ORCHESTRATOR_PID 2>/dev/null || true
fi

echo
if [ $FAILED_TESTS -eq 0 ]; then
    exit 0
else
    exit 1
fi