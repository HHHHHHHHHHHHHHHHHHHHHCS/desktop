# Codex Update Notes

This repository carries a small set of local `[My]` commits on top of
`upstream/development`. Future Codex sessions should use this file as the
working checklist for updating the fork while preserving those local changes.

## Repository Remotes

- `origin`: fork, push target.
- `upstream`: `https://github.com/desktop/desktop.git`, source of truth.
- Main working branch: `development`.

## Current Local Change Shape

The fork should normally be `upstream/development` plus `[My]` commits only.
Check with:

```powershell
git fetch upstream --prune
git rev-list --left-right --count upstream/development...HEAD
git log --oneline upstream/development..HEAD
```

Expected shape:

- Left count should be `0`.
- Right count should be the number of `[My]` commits.
- Every commit above upstream should have a `[My]` subject prefix.

If the left count is not `0`, upstream has moved. Stop before committing or
pushing, then rebuild from latest upstream after confirming the desired flow.

## Update Flow

Before changing or rewriting `development`, create and push a backup branch:

```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$branch = "backup/development-my-$ts"
git branch $branch HEAD
git push origin "refs/heads/${branch}:refs/heads/${branch}"
```

Then verify upstream is current:

```powershell
git fetch upstream --prune
git rev-list --left-right --count upstream/development...HEAD
```

If upstream has not moved, normal incremental `[My]` work may be committed and
pushed to `origin/development`.

If upstream has moved and the goal is to force-refresh the fork:

```powershell
git reset --hard upstream/development
git cherry-pick <old-my-commit-1> <old-my-commit-2> ...
git push --force-with-lease origin development
```

Resolve conflicts by keeping upstream's current structure and reapplying the
intent of `[My]` changes. Do not blindly choose whole-file ours/theirs.

## File Isolation Rule

Prefer new files for `[My]` functionality when possible. Keep upstream-owned
files as thin wiring layers to reduce future merge conflicts.

Good existing examples:

- `app/src/lib/codex-cli.ts`
- `app/src/lib/external-diff.ts`
- `app/src/ui/toolbar/sync-fork-state.ts`
- `app/src/ui/preferences/codex-cli-settings.tsx`
- `app/src/ui/preferences/external-diff-settings.tsx`

High-conflict upstream files should stay minimal:

- `app/src/lib/stores/app-store.ts`
- `app/src/ui/app.tsx`
- `app/src/ui/dispatcher/dispatcher.ts`
- `app/src/ui/preferences/preferences.tsx`
- `app/src/ui/preferences/integrations.tsx`
- `app/src/ui/history/compare.tsx`

When adding behavior, first look for a way to put the real logic into a new
module or component and only add the smallest necessary imports, props, and
dispatcher calls to these files.

## Verification

After any `[My]` update, run:

```powershell
git diff --check upstream/development..HEAD
yarn compile:dev
```

For the current `[My]` areas, also run focused tests when relevant:

```powershell
yarn test:unit app/test/unit/codex-cli-test.ts app/test/unit/sync-fork-state-test.ts app/test/unit/repository-test.ts app/test/unit/ui/commit-message-warning-dialogs-test.tsx
```

Before pushing:

```powershell
git status --short --branch
git log --oneline upstream/development..HEAD
```

Push normal incremental commits with:

```powershell
git push origin development
```

Use `--force-with-lease` only after intentionally rebuilding `development` from
latest upstream and after a backup branch has been pushed.
