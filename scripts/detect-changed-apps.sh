#!/usr/bin/env bash
set -eo pipefail

# This script prints a space-separated list of changed app directories under
# the "apps/" folder by diffing against an appropriate base ref.
# It also enforces a whitelist of allowed apps to be processed by CI workflows.
# If changes are detected but none of the changed apps are whitelisted, the
# script will FAIL (non-zero exit) to surface the violation in CI.
#
# Environment variables it respects (all optional):
#   PR_BASE_SHA       - Base SHA for pull_request events
#   PUSH_BASE_SHA     - The before SHA for push events
#   BASE_REF          - github.base_ref or base branch name
#   DEFAULT_BRANCH    - repository default branch name (e.g., main or master)
#   WHITELISTED_APPS  - space-separated list of allowed app paths (default: "apps/oss-app-test")

TARGET_BASE="${PR_BASE_SHA:-${PUSH_BASE_SHA:-}}"
FALLBACK_REF="${BASE_REF:-${DEFAULT_BRANCH:-main}}"

if [ -z "$TARGET_BASE" ]; then
  # Ensure we have the base branch locally to compare against
  git fetch origin "$FALLBACK_REF" --deepen=1 || git fetch origin "$FALLBACK_REF" --depth=1
  TARGET_BASE="origin/$FALLBACK_REF"
fi

echo "Using base ref: $TARGET_BASE" 1>&2

# List changed files under apps/** and collapse to unique app directories (apps/<name>)
changed_files=$(git diff --name-only "$TARGET_BASE"...HEAD -- 'apps/**' || true)
changed_apps=$(echo "$changed_files" | awk -F/ 'NF>=2 {print $1"/"$2}' | sort -u)

# Enforce whitelist (default allows only apps/oss-app-test)
WHITELISTED_APPS=${WHITELISTED_APPS:-"apps/oss-app-test"}
#WHITELISTED_APPS="$WHITELISTED_APPS apps/beatoven-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/braintrust"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/chatpdf"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/clipdrop"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/copy-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/coze"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/deep-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/deepinfra"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/dify"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/exa-ai-pjcopm"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/fal-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/freepik"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/ideogram"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/jina-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/llama"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/luma-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/mem0"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/murf-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/nvidia"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/oss-app-test"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/photoroom"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/qdrant-app-p6khdj"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/qwen-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/together-ai"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/xata"
#WHITELISTED_APPS="$WHITELISTED_APPS apps/zep"

if [ -n "$changed_apps" ]; then
  filtered_apps=""
  for app in $changed_apps; do
    for allowed in $WHITELISTED_APPS; do
      if [ "$app" = "$allowed" ]; then
        filtered_apps+=" $app"
        break
      fi
    done
  done
  # Trim leading/trailing whitespace
  filtered_apps=$(echo "$filtered_apps" | xargs || true)

  # If there were changes in apps but none are allowed, fail fast
  if [ -z "$filtered_apps" ]; then
    echo "Error: Detected changes in non-whitelisted apps: $changed_apps" 1>&2
    echo "Whitelist (WHITELISTED_APPS): $WHITELISTED_APPS" 1>&2
    exit 1
  fi

  changed_apps="$filtered_apps"
fi

# Print the result (can be empty string)
echo "$changed_apps"
