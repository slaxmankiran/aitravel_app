#!/bin/bash

# VoyageAI JIRA Epic & Story Pusher
# Usage: ./push-to-jira.sh <email> <api-token> <site-url> <project-key>

set -e

EMAIL="$1"
TOKEN="$2"
SITE_URL="$3"
PROJECT_KEY="${4:-VOY}"

if [ -z "$EMAIL" ] || [ -z "$TOKEN" ] || [ -z "$SITE_URL" ]; then
    echo "Usage: ./push-to-jira.sh <email> <api-token> <site-url> [project-key]"
    echo "Example: ./push-to-jira.sh user@example.com ATATT... https://yoursite.atlassian.net VOY"
    exit 1
fi

AUTH=$(echo -n "$EMAIL:$TOKEN" | base64)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_FILE="$SCRIPT_DIR/jira-epics-stories.json"

if [ ! -f "$DATA_FILE" ]; then
    echo "Error: $DATA_FILE not found"
    exit 1
fi

echo "========================================"
echo "VoyageAI JIRA Pusher"
echo "========================================"
echo "Site: $SITE_URL"
echo "Project: $PROJECT_KEY"
echo ""

# Check if project exists
echo "Checking project $PROJECT_KEY..."
PROJECT_CHECK=$(curl -s -H "Authorization: Basic $AUTH" "$SITE_URL/rest/api/3/project/$PROJECT_KEY")
if echo "$PROJECT_CHECK" | grep -q "errorMessages"; then
    echo "Error: Project $PROJECT_KEY not found. Please create it first."
    echo "Response: $PROJECT_CHECK"
    exit 1
fi
echo "✓ Project found"
echo ""

# Get Epic issue type ID
echo "Finding Epic issue type..."
ISSUE_TYPES=$(curl -s -H "Authorization: Basic $AUTH" "$SITE_URL/rest/api/3/issuetype")
EPIC_ID=$(echo "$ISSUE_TYPES" | grep -o '"id":"[^"]*","description":"[^"]*","name":"Epic"' | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$EPIC_ID" ]; then
    # Try alternate format
    EPIC_ID=$(echo "$ISSUE_TYPES" | python3 -c "import sys,json; types=json.load(sys.stdin); print(next((t['id'] for t in types if t.get('name')=='Epic'), ''))" 2>/dev/null || echo "")
fi

if [ -z "$EPIC_ID" ]; then
    echo "Warning: Could not find Epic type, will use Story for all issues"
    EPIC_ID=""
fi

# Get Story issue type ID
STORY_ID=$(echo "$ISSUE_TYPES" | python3 -c "import sys,json; types=json.load(sys.stdin); print(next((t['id'] for t in types if t.get('name')=='Story'), ''))" 2>/dev/null || echo "")

if [ -z "$STORY_ID" ]; then
    # Fallback to Task
    STORY_ID=$(echo "$ISSUE_TYPES" | python3 -c "import sys,json; types=json.load(sys.stdin); print(next((t['id'] for t in types if t.get('name')=='Task'), ''))" 2>/dev/null || echo "10001")
fi

echo "Epic type ID: ${EPIC_ID:-'Not found, using Story'}"
echo "Story type ID: $STORY_ID"
echo ""

# Create Epics and Stories
echo "Creating issues..."
echo ""

EPIC_COUNT=0
STORY_COUNT=0

# Parse JSON and create issues
python3 << PYTHON_SCRIPT
import json
import subprocess
import sys
import time

with open("$DATA_FILE") as f:
    data = json.load(f)

site_url = "$SITE_URL"
auth = "$AUTH"
project_key = "$PROJECT_KEY"
epic_type_id = "$EPIC_ID" or "$STORY_ID"
story_type_id = "$STORY_ID"

epic_count = 0
story_count = 0

for epic in data["epics"]:
    print(f"Creating Epic: {epic['summary']}")

    # Create Epic
    epic_payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": epic["summary"],
            "description": {
                "type": "doc",
                "version": 1,
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": epic["description"]}]}]
            },
            "issuetype": {"id": epic_type_id}
        }
    }

    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        "-H", f"Authorization: Basic {auth}",
        "-H", "Content-Type: application/json",
        f"{site_url}/rest/api/3/issue",
        "-d", json.dumps(epic_payload)
    ], capture_output=True, text=True)

    response = json.loads(result.stdout) if result.stdout else {}

    if "key" in response:
        epic_key = response["key"]
        print(f"  ✓ Created {epic_key}: {epic['summary']}")
        epic_count += 1

        # Create Stories under this Epic
        for story in epic.get("stories", []):
            print(f"    Creating Story: {story['summary'][:50]}...")

            story_payload = {
                "fields": {
                    "project": {"key": project_key},
                    "summary": story["summary"],
                    "description": {
                        "type": "doc",
                        "version": 1,
                        "content": [{"type": "paragraph", "content": [{"type": "text", "text": story["description"]}]}]
                    },
                    "issuetype": {"id": story_type_id}
                }
            }

            # Try to link to Epic if Epic link field exists
            if epic_type_id != story_type_id:
                story_payload["fields"]["parent"] = {"key": epic_key}

            result = subprocess.run([
                "curl", "-s", "-X", "POST",
                "-H", f"Authorization: Basic {auth}",
                "-H", "Content-Type: application/json",
                f"{site_url}/rest/api/3/issue",
                "-d", json.dumps(story_payload)
            ], capture_output=True, text=True)

            story_response = json.loads(result.stdout) if result.stdout else {}

            if "key" in story_response:
                print(f"    ✓ Created {story_response['key']}: {story['summary'][:40]}...")
                story_count += 1
            else:
                print(f"    ✗ Failed: {story_response.get('errorMessages', result.stdout[:100])}")

            time.sleep(0.2)  # Rate limiting
    else:
        print(f"  ✗ Failed to create Epic: {response.get('errorMessages', result.stdout[:100])}")

    time.sleep(0.3)

print("")
print("======================================")
print(f"Created {epic_count} Epics and {story_count} Stories")
print("======================================")
PYTHON_SCRIPT

echo ""
echo "Done! View your backlog at: $SITE_URL/jira/software/projects/$PROJECT_KEY/backlog"
