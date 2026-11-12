#!/usr/bin/env bash
# Agent loop for one issue: coder → build/lint gate → screenshots → reviewer, up to MAX_ROUNDS.
# Run by .github/workflows/agent.yml on a fresh checkout of main (fetch-depth 0, no persisted credentials).
# Needs ISSUE, GITHUB_REPOSITORY, GH_TOKEN (workflow token) and CLAUDE_CODE_OAUTH_TOKEN.
set -euo pipefail

: "${ISSUE:?}" "${GITHUB_REPOSITORY:?}" "${GH_TOKEN:?}"
MAX_ROUNDS=${MAX_ROUNDS:-5}
CODER_MODEL=${CODER_MODEL:-claude-opus-5-5}
REVIEWER_MODEL=${REVIEWER_MODEL:-claude-fable-5-1}
STEP_TIMEOUT=${STEP_TIMEOUT:-45m}

HERE=$(cd "$(dirname "$0")" && pwd)
BRANCH=agent/issue-$ISSUE
SHOTS_BRANCH=agent-screenshots
MARKER='<!-- sailing-trainer-agent -->'
export AGENT_WORK=${RUNNER_TEMP:-/tmp}/agent-$ISSUE
mkdir -p "$AGENT_WORK"
CODER_SESSION=$(cat /proc/sys/kernel/random/uuid)
REVIEWER_SESSION=$(cat /proc/sys/kernel/random/uuid)
AUTH_HEADER="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)"

log() { echo "::notice::$*"; }

# The token is passed per command instead of stored in .git/config, so the agents can't read it from the checkout.
git_push() { git -c "http.https://github.com/.extraheader=$AUTH_HEADER" "$@"; }

# Comment on the PR once it exists, else on the issue. The marker lets us tell agent comments from human ones.
# PRs are issues to the REST API, so these work on both.
comment() {
  printf '%s\n\n%s\n' "$(cat)" "$MARKER" | gh api "repos/$GITHUB_REPOSITORY/issues/${PR:-$ISSUE}/comments" -F body=@- >/dev/null
}

set_outcome_label() {
  local l
  for l in agent-approved needs-human; do
    gh api -X DELETE "repos/$GITHUB_REPOSITORY/issues/${PR:-$ISSUE}/labels/$l" >/dev/null 2>&1 || true
  done
  gh api "repos/$GITHUB_REPOSITORY/issues/${PR:-$ISSUE}/labels" -f "labels[]=$1" >/dev/null
}

# The GitHub token is kept out of Claude's environment. This is not a hard boundary: the agents run as the same user
# as this script, so a determined process could still read it from /proc. The real controls are that only
# write-access users can trigger a run and that the token is job-scoped.
claude_json() { # <out.json> <prompt file> <claude args...>
  local out=$1 prompt=$2 rc=0; shift 2
  env -u GH_TOKEN -u GITHUB_TOKEN timeout "$STEP_TIMEOUT" \
    claude -p --output-format json --permission-prompts none --add-dir "$AGENT_WORK" "$@" < "$prompt" > "$out" || rc=$?
  if ! jq -e '.is_error == false and .structured_output != null' "$out" >/dev/null 2>&1; then
    echo "::error::claude exited $rc (124 = timed out after $STEP_TIMEOUT)" >&2
    jq 'del(.usage, .modelUsage)' "$out" >&2 || cat "$out" >&2
    return 1
  fi
}

# 0 if the branch exists on origin, 1 if not; any other ls-remote failure (e.g. network) aborts.
remote_branch_exists() {
  local rc=0
  git ls-remote --exit-code --heads origin "$1" >/dev/null || rc=$?
  case $rc in 0) return 0 ;; 2) return 1 ;; *) echo "::error::git ls-remote failed ($rc)" >&2; exit 1 ;; esac
}

# Screenshot every view into <dir>. Page errors (stderr) go to <dir>/errors.txt; returns non-zero if the app didn't load.
screenshots() { # <dir>
  mkdir -p "$1"
  node scripts/screenshot.mjs --out "$1" > /dev/null 2> "$1/errors.txt"
}

# Upload a directory of PNGs to the screenshots branch; prints the raw URL base for embedding.
publish_shots() { # <src dir> <dest path>
  local src=$1 dest=$2 wt=$AGENT_WORK/shots-wt
  if [[ ! -d $wt ]]; then
    if remote_branch_exists "$SHOTS_BRANCH"; then
      git fetch -q origin "$SHOTS_BRANCH"
      git worktree add -q --detach "$wt" FETCH_HEAD
    else
      git worktree add -q --detach "$wt"
      git -C "$wt" checkout -q --orphan "$SHOTS_BRANCH"
      git -C "$wt" rm -rqf .
    fi
  fi
  mkdir -p "$wt/$dest"
  cp "$src"/*.png "$wt/$dest/"
  git -C "$wt" add -A
  # Identical PNGs (a re-run against an unchanged main) leave nothing to commit; the existing files serve.
  if ! git -C "$wt" diff --cached --quiet; then
    git -C "$wt" commit -qm "Screenshots: $dest"
    # Runs for other issues push to the same branch concurrently; their files never overlap, so rebasing is safe.
    local pushed=false
    for _ in 1 2 3; do
      if git_push -C "$wt" push -q origin "HEAD:refs/heads/$SHOTS_BRANCH"; then pushed=true; break; fi
      git -C "$wt" fetch -q origin "$SHOTS_BRANCH"
      git -C "$wt" rebase -q FETCH_HEAD || { git -C "$wt" rebase --abort; break; }
    done
    $pushed || { echo "::error::could not push screenshots to $SHOTS_BRANCH" >&2; return 1; }
  fi
  echo "https://raw.githubusercontent.com/$GITHUB_REPOSITORY/$(git -C "$wt" rev-parse HEAD)/$dest"
}

shots_table() { # <before url> <after url>
  echo '| View | Before (main) | After |'
  echo '|---|---|---|'
  for f in "$AGENT_WORK/shots/base"/*.png; do
    local name; name=$(basename "$f")
    echo "| ${name%.png} | <img src=\"$1/$name\" width=\"320\"> | <img src=\"$2/$name\" width=\"320\"> |"
  done
}

# Human feedback left on the PR since the agent last posted (comments, reviews and inline review comments).
human_feedback() {
  local since
  since=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate \
    | jq -rs --arg m "$MARKER" '[add[] | select(.body | contains($m))] | last | .created_at // ""')
  gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate \
    | jq -rs --arg m "$MARKER" --arg t "$since" \
      'add[] | select((.body | contains($m) | not) and .created_at > $t) | "@\(.user.login): \(.body)\n\n---"'
  gh api "repos/$GITHUB_REPOSITORY/pulls/$PR/reviews" --paginate \
    | jq -rs --arg t "$since" 'add[] | select(.body != "" and .submitted_at > $t) | "@\(.user.login) (review): \(.body)\n\n---"'
  gh api "repos/$GITHUB_REPOSITORY/pulls/$PR/comments" --paginate \
    | jq -rs --arg t "$since" 'add[] | select(.created_at > $t) | "@\(.user.login) on \(.path):\(.line // .original_line): \(.body)\n\n---"'
}

gate() { # build + lint; prints failures, returns non-zero on failure
  local out=$AGENT_WORK/gate.log
  if npm run build > "$out" 2>&1 && npm run lint >> "$out" 2>&1; then return 0; fi
  tail -n 80 "$out"
  return 1
}

# --- setup ---------------------------------------------------------------------------------------

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
for l in agent-approved:0e8a16 needs-human:d93f0b; do gh label create "${l%%:*}" --color "${l##*:}" --force >/dev/null; done

if [[ $(gh issue view "$ISSUE" --json state --jq .state) != OPEN ]]; then
  log "Issue #$ISSUE is closed; nothing to do"
  exit 0
fi
gh issue view "$ISSUE" --json title,body --jq '"# \(.title)\n\n\(.body // "")"' > "$AGENT_WORK/issue.md"

PR=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // empty')
if [[ -z $PR && -n $(gh pr list --head "$BRANCH" --state all --json number --jq '.[0].number // empty') ]]; then
  printf 'The PR for `%s` is already merged or closed. Delete the branch to have the agent start over.\n' "$BRANCH" | comment
  exit 0
fi

log "Baseline screenshots of main"
screenshots "$AGENT_WORK/shots/base"

git fetch -q origin main
CONFLICTS=
if remote_branch_exists "$BRANCH"; then
  git fetch -q origin "$BRANCH"
  git checkout -q -B "$BRANCH" FETCH_HEAD
  if git merge -q --no-edit origin/main; then
    git_push push -q origin "HEAD:refs/heads/$BRANCH"
    # npm ci ran against main; the branch may have added dependencies.
    git diff --quiet origin/main -- package-lock.json || npm ci --no-audit --no-fund
  else
    CONFLICTS=$(git diff --name-only --diff-filter=U)
  fi
else
  git checkout -q -B "$BRANCH" origin/main
fi
BASE_URL=$(publish_shots "$AGENT_WORK/shots/base" "issue-$ISSUE/base-$(git rev-parse --short origin/main)")

FEEDBACK=
if [[ -n $PR ]]; then FEEDBACK=$(human_feedback); fi
# A re-run on an existing PR with nothing new to address goes straight to review.
SKIP_CODER=false
if [[ -n $PR && -z $FEEDBACK && -z $CONFLICTS ]]; then SKIP_CODER=true; fi

# --- loop ----------------------------------------------------------------------------------------

CODER_ARGS=(--model "$CODER_MODEL" --append-system-prompt-file "$HERE/coder.md" --json-schema "$(cat "$HERE/coder.schema.json")"
  --permission-mode acceptEdits
  --allowedTools Read Edit Write Glob Grep TodoWrite 'Bash(npm run build)' 'Bash(npm run lint)' 'Bash(npx tsc:*)'
    'Bash(npm install:*)' 'Bash(node scripts/screenshot.mjs:*)' 'Bash(git status:*)' 'Bash(git diff:*)' 'Bash(git log:*)'
    'Bash(git show:*)' 'Bash(ls:*)')
REVIEWER_ARGS=(--model "$REVIEWER_MODEL" --append-system-prompt-file "$HERE/reviewer.md" --json-schema "$(cat "$HERE/reviewer.schema.json")"
  --allowedTools Read Glob Grep 'Bash(git diff:*)' 'Bash(git log:*)' 'Bash(git show:*)' 'Bash(npx tsc:*)' 'Bash(npm run lint)'
    'Bash(node scripts/screenshot.mjs:*)'
  --disallowedTools Edit Write NotebookEdit)
CODER_NOTES=
CODER_STARTED=false
REVIEWER_STARTED=false

for ((ROUND = 1; ROUND <= MAX_ROUNDS; ROUND++)); do
  log "Round $ROUND/$MAX_ROUNDS"

  if ! $SKIP_CODER; then
    prompt=$AGENT_WORK/coder-prompt-$ROUND.md
    if ! $CODER_STARTED; then
      session=(--session-id "$CODER_SESSION")
      {
        echo 'Implement this GitHub issue.'; echo; cat "$AGENT_WORK/issue.md"
        if [[ -n $PR && $ROUND == 1 ]]; then
          printf '\n\nThe branch already has work from an earlier run (PR #%s). Feedback on the PR:\n\n%s\n' "$PR" "${FEEDBACK:-(none)}"
        elif [[ -n $FEEDBACK ]]; then
          printf '\n\nThe branch already has work. The reviewer requested changes:\n\n%s\n' "$FEEDBACK"
        fi
        if [[ -n $CONFLICTS ]]; then
          printf '\n\nMerging main into this branch left conflicts to resolve first:\n%s\n' "$CONFLICTS"
        fi
      } > "$prompt"
      CODER_STARTED=true
    else
      session=(--resume "$CODER_SESSION")
      { echo "Round $ROUND of $MAX_ROUNDS. Address this feedback:"; echo; echo "$FEEDBACK"; } > "$prompt"
    fi
    claude_json "$AGENT_WORK/coder-$ROUND.json" "$prompt" "${session[@]}" "${CODER_ARGS[@]}"
    result=$(jq '.structured_output' "$AGENT_WORK/coder-$ROUND.json")
    CODER_NOTES=$(jq -r '.summary' <<< "$result")

    git add -A
    # The workflow token can't push workflow changes, so drop any the coder made (merges from main are left alone).
    if ! git rev-parse -q --verify MERGE_HEAD >/dev/null && [[ -n $(git diff --cached --name-only -- .github/workflows) ]]; then
      git restore -q --staged --worktree --source=HEAD -- .github/workflows
      CODER_NOTES+=$'\n\n_(The orchestrator reverted changes under `.github/workflows/`: the agent cannot push workflow files.)_'
    fi
    if git diff --cached --quiet && ! git rev-parse -q --verify MERGE_HEAD >/dev/null; then
      if [[ -z $PR ]]; then
        printf '**Agent made no changes.**\n\n%s\n' "$CODER_NOTES" | comment
        set_outcome_label needs-human
        exit 0
      fi
    else
      git commit -q -F <(jq -r '.commit_message' <<< "$result")
    fi
    git_push push -q origin "HEAD:refs/heads/$BRANCH"

    if [[ -z $PR ]]; then
      pr_url=$(gh pr create --base main --head "$BRANCH" --title "$(jq -r '.pr_title' <<< "$result")" \
        --body-file <(printf '%s\n\nCloses #%s\n' "$(jq -r '.pr_body' <<< "$result")" "$ISSUE"))
      PR=${pr_url##*/}
    fi
    printf '### 🛠️ Coder — round %s/%s\n\n%s\n' "$ROUND" "$MAX_ROUNDS" "$CODER_NOTES" | comment
  fi
  SKIP_CODER=false

  if ! gate_out=$(gate); then
    FEEDBACK=$(printf '`npm run build` / `npm run lint` failed:\n\n```\n%s\n```' "$gate_out")
    printf '### ❌ Build/lint failed — round %s/%s\n\n%s\n' "$ROUND" "$MAX_ROUNDS" "$FEEDBACK" | comment
    continue
  fi

  log "Screenshots for round $ROUND"
  shots=$AGENT_WORK/shots/r$ROUND
  if ! screenshots "$shots"; then
    FEEDBACK=$(printf 'The app did not load for screenshots:\n\n```\n%s\n```' "$(tail -n 40 "$shots/errors.txt")")
    printf '### ❌ App failed to load — round %s/%s\n\n%s\n' "$ROUND" "$MAX_ROUNDS" "$FEEDBACK" | comment
    continue
  fi
  after_url=$(publish_shots "$AGENT_WORK/shots/r$ROUND" "pr-$PR/r$ROUND-$(git rev-parse --short HEAD)")
  printf '### 📸 Screenshots — round %s/%s\n\n%s\n' "$ROUND" "$MAX_ROUNDS" "$(shots_table "$BASE_URL" "$after_url")" | comment

  prompt=$AGENT_WORK/reviewer-prompt-$ROUND.md
  if $REVIEWER_STARTED; then session=(--resume "$REVIEWER_SESSION"); else session=(--session-id "$REVIEWER_SESSION"); fi
  REVIEWER_STARTED=true
  { echo "Review round $ROUND of $MAX_ROUNDS for PR #$PR (branch $BRANCH). The issue:"; echo; cat "$AGENT_WORK/issue.md"
    printf '\n\nThe coder'"'"'s notes for this round:\n\n%s\n' "${CODER_NOTES:-(no new coder round; review the branch as it is)}"
    printf '\nScreenshots of main (before): %s/*.png\nScreenshots of this branch (after): %s/*.png\n' \
      "$AGENT_WORK/shots/base" "$shots"
    printf '\nBrowser console/page errors on main:\n%s\n\nOn this branch:\n%s\n' \
      "$(cat "$AGENT_WORK/shots/base/errors.txt")" "$(cat "$shots/errors.txt")"
  } > "$prompt"
  claude_json "$AGENT_WORK/reviewer-$ROUND.json" "$prompt" "${session[@]}" "${REVIEWER_ARGS[@]}"
  review=$(jq '.structured_output' "$AGENT_WORK/reviewer-$ROUND.json")
  verdict=$(jq -r '.verdict' <<< "$review")
  FEEDBACK=$(jq -r '.summary + "\n\n" + (.issues | map("- **\(.severity)** `\(.file)\(if .line then ":\(.line)" else "" end)`: \(.comment)") | join("\n"))' <<< "$review")
  printf '### 🔍 Reviewer — round %s/%s: `%s`\n\n%s\n' "$ROUND" "$MAX_ROUNDS" "$verdict" "$FEEDBACK" | comment

  if [[ $verdict == approve ]]; then
    set_outcome_label agent-approved
    log "Approved in round $ROUND"
    exit 0
  fi
done

printf '**No approval after %s rounds** — over to a human. Comment on this PR and re-add the `agent` label to the issue to run again.\n' "$MAX_ROUNDS" | comment
set_outcome_label needs-human
