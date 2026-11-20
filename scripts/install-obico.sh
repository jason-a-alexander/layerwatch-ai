#!/bin/sh
# Installs the Obico ML API for LayerWatch AI with one command:
#
#   curl -fsSLo install-obico.sh https://raw.githubusercontent.com/leotrax3d/layerwatch-ai/main/scripts/install-obico.sh && sh install-obico.sh
#
# When Prusa Connect runs on another machine, name it:
#
#   sh install-obico.sh 192.168.1.20
#
# It checks the hardware, builds Obico's ml_api from
# github.com/TheSpaghettiDetective/obico-server (AGPL-3.0; the model weights
# are downloaded by Obico's own build, LayerWatch AI does not ship them), runs it
# on port 3333 with automatic restart, waits until it answers and prints a
# plain-text setup code to paste into the LayerWatch AI page in Prusa Connect.
set -eu

PORT="${LAYERWATCH_OBICO_PORT:-3333}"
FRAMES_PORT=18491
DIR="${LAYERWATCH_OBICO_DIR:-$HOME/.layerwatch-ai/obico-server}"
NAME=layerwatch-ai-obico
CONNECT_HOST="${1:-}"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m! %s\033[0m\n' "$*"; }
die() { printf '\033[31mx %s\033[0m\n' "$*" >&2; exit 1; }

# --- hardware check ---------------------------------------------------------
say "Checking this machine"

case "$(uname -m)" in
  x86_64 | amd64 | aarch64 | arm64) ;;
  *) die "CPU type $(uname -m) is not supported by Obico. Use LayerWatch AI's built-in check instead." ;;
esac

ram_mib=0
if [ -r /proc/meminfo ]; then
  ram_mib=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
elif command -v sysctl >/dev/null 2>&1; then
  ram_mib=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1048576 ))
fi
if [ "$ram_mib" -gt 0 ] && [ "$ram_mib" -lt 1800 ]; then
  die "Only ${ram_mib} MiB RAM. Obico needs about 2 GiB. Use LayerWatch AI's built-in check instead."
fi
[ "$ram_mib" -gt 0 ] && [ "$ram_mib" -lt 3500 ] && warn "${ram_mib} MiB RAM: Obico will run, but slowly."

mkdir -p "$(dirname "$DIR")"
free_mib=$(df -Pm "$(dirname "$DIR")" | awk 'NR==2 {print $4}')
[ "${free_mib:-0}" -lt 6000 ] && die "Only ${free_mib} MiB free disk space. The Obico image needs about 6 GiB."

if ! command -v docker >/dev/null 2>&1; then
  die "Docker is missing. Install it (https://docs.docker.com/engine/install/ or Docker Desktop), start it, and run this command again."
fi

SUDO=""
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    SUDO=sudo
  else
    die "Docker does not answer. Start Docker and run this command again."
  fi
fi
command -v git >/dev/null 2>&1 || die "git is missing. Install git and run this command again."

# --- Obico ML API -----------------------------------------------------------
say "Fetching Obico (AGPL-3.0)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only --quiet
else
  git clone --quiet --depth 1 --branch release https://github.com/TheSpaghettiDetective/obico-server.git "$DIR"
fi

say "Building the Obico ML API (takes a few minutes the first time)"
$SUDO docker build --quiet -t "$NAME" "$DIR/ml_api" >/dev/null

$SUDO docker rm -f "$NAME" >/dev/null 2>&1 || true
$SUDO docker run -d --name "$NAME" --restart unless-stopped -p "$PORT:3333" "$NAME" \
  gunicorn --bind 0.0.0.0:3333 --workers 1 --timeout 120 wsgi >/dev/null

say "Waiting for the model to load"
tries=0
until curl -fsS "http://127.0.0.1:$PORT/hc/" >/dev/null 2>&1; do
  tries=$((tries + 1))
  [ "$tries" -gt 60 ] && die "Obico did not answer after 5 minutes. Look at: $SUDO docker logs $NAME"
  sleep 5
done

# --- setup code -------------------------------------------------------------
ip=""
if command -v ip >/dev/null 2>&1; then
  ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<NF;i++) if ($i=="src") print $(i+1)}' | head -1)
fi
[ -z "$ip" ] && command -v ipconfig >/dev/null 2>&1 && ip=$(ipconfig getifaddr en0 2>/dev/null || true)
[ -z "$ip" ] && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$ip" ] && ip=127.0.0.1
[ -z "$CONNECT_HOST" ] && CONNECT_HOST="$ip"

code="pg1 http://$ip:$PORT http://$CONNECT_HOST:$FRAMES_PORT"

echo
say "Obico is running."
echo "Open Prusa Connect > LayerWatch AI > Setup, paste this setup code and press \"Save and test\":"
echo
printf '    %s\n' "$code"
echo
echo "  Obico address:  http://$ip:$PORT"
echo "  Frame address:  http://$CONNECT_HOST:$FRAMES_PORT"
echo
echo "Obico's ML API has no password: keep port $PORT inside your home network."
echo "Remove it again with: $SUDO docker rm -f $NAME"
