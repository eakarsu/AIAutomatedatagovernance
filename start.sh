#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════╗
# ║        SkyGov - Airline Data Governance Platform                ║
# ║        Startup Script                                           ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║       ✈  SkyGov - Airline Data Governance Platform           ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: Check prerequisites ─────────────────────────────────
log_info "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v psql &> /dev/null; then
    log_error "PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
log_success "Node.js $(node -v) detected"
log_success "PostgreSQL detected"

# ── Step 2: Check .env file ─────────────────────────────────────
if [ ! -f ".env" ]; then
    log_error ".env file not found! Please create .env file in the project root."
    exit 1
fi
log_success ".env file found"

# ── Step 3: Clean up used ports ─────────────────────────────────
BACKEND_PORT=$(grep BACKEND_PORT .env | cut -d'=' -f2 | tr -d ' ' || echo "3001")
FRONTEND_PORT=3000

log_info "Cleaning up ports ${BACKEND_PORT} and ${FRONTEND_PORT}..."

kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        log_warn "Killed processes on port $port"
        sleep 1
    fi
}

kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

log_success "Ports cleaned"

# ── Step 4: Check PostgreSQL is running ─────────────────────────
DB_HOST=$(grep DB_HOST .env | cut -d'=' -f2 | tr -d ' ' || echo "localhost")
DB_PORT=$(grep DB_PORT .env | cut -d'=' -f2 | tr -d ' ' || echo "5432")
DB_USER=$(grep DB_USER .env | cut -d'=' -f2 | tr -d ' ' || echo "postgres")

log_info "Checking PostgreSQL connection..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
    log_warn "PostgreSQL doesn't seem to be running. Attempting to start..."
    if command -v brew &> /dev/null; then
        brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
        sleep 2
    fi
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
        log_error "Cannot connect to PostgreSQL. Please start it manually."
        exit 1
    fi
fi
log_success "PostgreSQL is running"

# ── Step 5: Install backend dependencies ────────────────────────
log_info "Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
if [ ! -d "node_modules" ]; then
    npm install --silent 2>&1 | tail -1
else
    log_info "Backend node_modules exists, checking for updates..."
    npm install --silent 2>&1 | tail -1
fi
log_success "Backend dependencies installed"

# ── Step 6: Install frontend dependencies ───────────────────────
log_info "Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install --silent 2>&1 | tail -1
else
    log_info "Frontend node_modules exists, checking for updates..."
    npm install --silent 2>&1 | tail -1
fi
log_success "Frontend dependencies installed"

# ── Step 7: Seed database ──────────────────────────────────────
cd "$PROJECT_DIR/backend"
log_info "Seeding database with airline data governance data..."
node seed.js
log_success "Database seeded successfully"

# ── Step 8: Start Backend with hot reload (nodemon) ─────────────
cd "$PROJECT_DIR/backend"
log_info "Starting backend server on port ${BACKEND_PORT} with hot reload..."
npx nodemon server.js &
BACKEND_PID=$!
sleep 2

# Verify backend is running
if curl -s "http://localhost:${BACKEND_PORT}/api/health" > /dev/null 2>&1; then
    log_success "Backend server is running on http://localhost:${BACKEND_PORT}"
else
    log_warn "Backend may still be starting up..."
fi

# ── Step 9: Start Frontend with hot reload ──────────────────────
cd "$PROJECT_DIR/frontend"
log_info "Starting frontend on port ${FRONTEND_PORT} with hot reload..."
BROWSER=none PORT=$FRONTEND_PORT npm start &
FRONTEND_PID=$!

# ── Step 10: Wait and display info ──────────────────────────────
sleep 5

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}${BOLD}SkyGov is running!${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}Frontend:${NC}  http://localhost:${FRONTEND_PORT}                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}Backend:${NC}   http://localhost:${BACKEND_PORT}/api                     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${BOLD}Demo Login:${NC}                                                 ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    Email:    admin@skylineairways.com                         ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    Password: Admin@2024!                                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Hot reload is enabled - changes auto-refresh${NC}                ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Press Ctrl+C to stop all services${NC}                           ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Cleanup on exit ─────────────────────────────────────────────
cleanup() {
    echo ""
    log_info "Shutting down SkyGov..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    log_success "SkyGov stopped. Goodbye!"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep script running
wait
