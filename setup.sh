#!/usr/bin/env bash
set -euo pipefail

NODE_MAJOR_MIN=18

# ---------- helpers ----------

info()  { printf '\033[1;34m[info]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[ok]\033[0m    %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m  %s\n' "$*"; }
fail()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

# Return 0 if installed node meets the minimum version.
node_version_ok() {
  local ver
  ver="$(node --version 2>/dev/null | sed 's/^v//')"
  [ -z "$ver" ] && return 1
  local major
  major="${ver%%.*}"
  [ "$major" -ge "$NODE_MAJOR_MIN" ]
}

detect_os() {
  case "$(uname -s)" in
    Linux*)
      if [ -f /etc/os-release ]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        echo "${ID:-linux}"
      else
        echo "linux"
      fi
      ;;
    Darwin*) echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

# ---------- Node.js installation ----------

install_node_linux() {
  local distro="$1"

  # Prefer the NodeSource setup script — it works on Debian, Ubuntu, RHEL,
  # Fedora, Amazon Linux, etc.
  if command_exists curl; then
    info "Installing Node.js 20.x via NodeSource (requires sudo)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh

    case "$distro" in
      ubuntu|debian|pop|linuxmint|elementary|raspbian)
        sudo -E bash /tmp/nodesource_setup.sh
        sudo apt-get install -y nodejs
        ;;
      fedora|rhel|centos|rocky|alma|amzn)
        sudo -E bash /tmp/nodesource_setup.sh
        sudo yum install -y nodejs || sudo dnf install -y nodejs
        ;;
      arch|manjaro)
        info "Installing Node.js via pacman..."
        sudo pacman -Sy --noconfirm nodejs npm
        ;;
      alpine)
        info "Installing Node.js via apk..."
        sudo apk add --no-cache nodejs npm
        ;;
      *)
        # Fallback: try the NodeSource script anyway — it detects the distro
        # itself and will error out cleanly if unsupported.
        sudo -E bash /tmp/nodesource_setup.sh
        sudo apt-get install -y nodejs 2>/dev/null \
          || sudo yum install -y nodejs 2>/dev/null \
          || fail "Could not install Node.js automatically. Please install Node.js >= ${NODE_MAJOR_MIN} manually: https://nodejs.org/"
        ;;
    esac
    rm -f /tmp/nodesource_setup.sh
  else
    fail "curl is required to install Node.js. Install curl first, then re-run this script."
  fi
}

install_node_macos() {
  if command_exists brew; then
    info "Installing Node.js via Homebrew..."
    brew install node
  else
    info "Homebrew not found. Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Make brew available in the current shell
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null)"
    brew install node
  fi
}

ensure_node() {
  if node_version_ok; then
    ok "Node.js $(node --version) is installed (>= ${NODE_MAJOR_MIN} required)"
    return
  fi

  if command_exists node; then
    warn "Node.js $(node --version) is installed but version >= ${NODE_MAJOR_MIN} is required"
  else
    info "Node.js is not installed"
  fi

  local os
  os="$(detect_os)"

  case "$os" in
    macos)   install_node_macos ;;
    windows) fail "On Windows, please install Node.js >= ${NODE_MAJOR_MIN} from https://nodejs.org/ and re-run this script in Git Bash or WSL." ;;
    *)       install_node_linux "$os" ;;
  esac

  # Verify
  if ! node_version_ok; then
    fail "Node.js installation succeeded but version check failed. You may need to open a new terminal. Installed: $(node --version 2>/dev/null || echo 'not found')"
  fi
  ok "Node.js $(node --version) installed successfully"
}

ensure_npm() {
  if command_exists npm; then
    ok "npm $(npm --version) is available"
  else
    fail "npm was not installed alongside Node.js. Please install npm manually."
  fi
}

# ---------- Project setup ----------

install_deps() {
  info "Installing project dependencies..."
  npm install
  ok "Dependencies installed"
}

setup_env() {
  if [ -f .env ]; then
    ok ".env file already exists — skipping"
    return
  fi

  info "Creating .env from .env.example..."
  cp .env.example .env

  warn ".env file created — fill in your API client IDs before running the app"
}

verify_setup() {
  info "Verifying setup..."

  # Quick TypeScript type-check
  if npx tsc --noEmit >/dev/null 2>&1; then
    ok "TypeScript compiles cleanly"
  else
    warn "TypeScript compilation has errors (run 'npx tsc --noEmit' for details)"
  fi

  # Run tests
  if npx vitest run >/dev/null 2>&1; then
    ok "All tests pass"
  else
    warn "Some tests failed (run 'npm test' for details)"
  fi
}

# ---------- main ----------

main() {
  # cd to script directory so paths are relative to repo root
  cd "$(dirname "$0")"

  printf '\n\033[1m PersonalMedia — Project Setup\033[0m\n\n'

  ensure_node
  ensure_npm
  install_deps
  setup_env
  verify_setup

  printf '\n\033[1;32mSetup complete!\033[0m\n'
  printf 'Next steps:\n'
  printf '  1. Fill in your API keys in .env\n'
  printf '  2. Run \033[1mnpm run dev\033[0m to start the dev server\n\n'
}

main "$@"
