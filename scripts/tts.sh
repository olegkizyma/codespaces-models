#!/usr/bin/env bash
# Simple TTS helper for macOS/Linux terminals
# Usage:
#   scripts/tts.sh -t "текст" [-v voice] [-s scale] [-n name] [-u base_url] [--no-play]
# Examples:
#   scripts/tts.sh -t "крута українська озвучка" -v natalia -u "http://localhost:8080"
#   scripts/tts.sh -t "крута українська озвучка" -v anatol -s 1.6 -u "https://8a42c760f69d.ngrok-free.app/tts"

set -euo pipefail

TEXT=""
VOICE=""
SCALE=""
NAME=""
BASE_URL="${TTS_URL:-http://localhost:8080}"
NO_PLAY="0"
OUTFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--text)
      TEXT="$2"; shift 2;;
    -v|--voice)
      VOICE="$2"; shift 2;;
    -s|--scale)
      SCALE="$2"; shift 2;;
    -n|--name)
      NAME="$2"; shift 2;;
    -u|--url)
      BASE_URL="$2"; shift 2;;
    -o|--out)
      OUTFILE="$2"; shift 2;;
    --no-play)
      NO_PLAY="1"; shift;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *)
      echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ -z "$TEXT" ]]; then
  echo "Error: --text is required" >&2
  exit 1
fi

# Build query
PARAMS=("--get" "--data-urlencode" "text=${TEXT}")
[[ -n "$VOICE" ]] && PARAMS+=("--data-urlencode" "voice=${VOICE}")
[[ -n "$SCALE" ]] && PARAMS+=("--data-urlencode" "scale=${SCALE}")
[[ -n "$NAME"  ]] && PARAMS+=("--data-urlencode" "name=${NAME}")

# Output file
if [[ -z "$OUTFILE" ]]; then
  if [[ -n "$NAME" ]]; then
    OUTFILE="${NAME}.mp3"
  else
    OUTFILE="/tmp/tts_$(date +%s)_$RANDOM.mp3"
  fi
fi

# Fetch audio
curl -s -L "${BASE_URL}" "${PARAMS[@]}" -o "$OUTFILE"

if [[ ! -s "$OUTFILE" ]]; then
  echo "Error: empty audio file. Check server or parameters." >&2
  exit 2
fi

echo "Saved: $OUTFILE ($(wc -c < "$OUTFILE") bytes)"

# Play if possible
if [[ "$NO_PLAY" != "1" ]]; then
  if command -v afplay >/dev/null 2>&1; then
    afplay "$OUTFILE"
  elif command -v mpg123 >/dev/null 2>&1; then
    mpg123 "$OUTFILE"
  else
    echo "Player not found. Install mpg123 (Linux) or use macOS afplay." >&2
  fi
fi
