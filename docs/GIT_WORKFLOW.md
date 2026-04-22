# 🔄 Git Workflow — AI Instructions

> **IMPORTANT:** Any AI assistant working on this project **MUST** follow this workflow before making any code changes. This ensures the developer can safely revert to any previous state.

---

## 📋 Pre-Change Checklist

Before writing or modifying **any** code, complete these steps **in order**:

### Step 1: Check Current Status

```bash
git status
git log --oneline -5
```

- Confirm which branch you're on (should be `main` or a feature branch).
- Confirm the working tree is clean. If there are uncommitted changes, **ask the user** whether to commit or discard them first.

### Step 2: Create a Save Point

**Always** commit the current state before making changes:

```bash
git add -A
git commit -m "save point: before [brief description of upcoming change]"
```

Example:
```bash
git commit -m "save point: before updating home screen UI"
```

### Step 3: Create a Feature Branch (for big changes)

For **major changes** (new features, UI overhauls, refactors), create a branch:

```bash
git checkout -b feature/[short-description]
```

Example:
```bash
git checkout -b feature/redesign-home-screen
```

For **small changes** (bug fixes, text edits, minor tweaks), working on `main` is fine.

---

## 🔨 During Changes

### Commit Frequently

Don't make 50 file changes in one go. Commit in logical chunks:

```bash
git add -A
git commit -m "feat: [what you did]"
```

Use these prefixes for commit messages:

| Prefix | When to Use |
|--------|-------------|
| `feat:` | New feature or functionality |
| `fix:` | Bug fix |
| `style:` | UI/CSS/visual changes only |
| `refactor:` | Code restructuring (no behavior change) |
| `docs:` | Documentation changes |
| `chore:` | Config, dependencies, tooling |
| `test:` | Adding or updating tests |

### Example Commit Flow

```bash
# After updating backend API
git add -A
git commit -m "feat: add quiz analytics endpoint"

# After updating frontend to use it
git add -A
git commit -m "feat: display quiz analytics on dashboard"

# After fixing a bug found during testing
git add -A
git commit -m "fix: handle empty quiz results gracefully"
```

---

## ✅ Post-Change Checklist

After finishing all changes:

### Step 1: Review What Changed

```bash
git diff --stat HEAD~[number-of-commits-made]
```

### Step 2: Push to GitHub

```bash
git push origin [branch-name]
```

If on `main`:
```bash
git push origin main
```

If on a feature branch:
```bash
git push origin feature/[short-description]
```

### Step 3: Merge Feature Branch (if applicable)

```bash
git checkout main
git merge feature/[short-description]
git push origin main
```

---

## ⏪ How to Revert Changes

### Scenario 1: Undo Uncommitted Changes (discard all edits)

```bash
git checkout .
```

### Scenario 2: Undo the Last Commit (keep the files)

```bash
git reset --soft HEAD~1
```

### Scenario 3: Undo the Last Commit (delete the files changes too)

```bash
git reset --hard HEAD~1
```

### Scenario 4: Go Back to a Specific Save Point

```bash
# Find the save point
git log --oneline

# Reset to it (WARNING: deletes all changes after that point)
git reset --hard [commit-hash]
```

### Scenario 5: Revert a Specific Commit (safe — creates a new undo commit)

```bash
git revert [commit-hash]
```

### Scenario 6: Undo Changes to a Single File

```bash
git checkout [commit-hash] -- path/to/file
```

### Scenario 7: Force Push After Reverting (sync GitHub with local)

```bash
git push origin main --force
```

> ⚠️ **WARNING:** Only force push if you're the sole developer. This rewrites remote history.

---

## 🗂️ Project Info

| Item | Value |
|------|-------|
| **Repository** | https://github.com/Kimmmmy03/MySmartStudy |
| **Default Branch** | `main` |
| **Visibility** | Private |
| **Tech Stack** | Python (FastAPI) · Next.js · Flutter · Firebase |

---

## 🚨 Rules for AI Assistants

1. **NEVER** modify code without creating a save point commit first.
2. **NEVER** force push without explicit user permission.
3. **ALWAYS** tell the user the commit hash of the save point so they can revert.
4. **ALWAYS** commit in small, logical chunks — not one giant commit.
5. **ALWAYS** use descriptive commit messages with the correct prefix.
6. **ALWAYS** check `git status` before and after making changes.
7. **ASK** the user before deleting branches or resetting history.
8. If you break something, **immediately** tell the user the command to revert:
   ```bash
   git reset --hard [last-safe-commit-hash]
   ```

---

## 📌 Quick Reference

```bash
# Check status
git status
git log --oneline -10

# Save current state
git add -A && git commit -m "save point: before [change]"

# Make changes, then commit
git add -A && git commit -m "feat: [description]"

# Push to GitHub
git push origin main

# OH NO, revert everything
git reset --hard HEAD~1

# Go back to a specific point
git log --oneline          # find the hash
git reset --hard abc1234   # go back to it
git push origin main --force  # sync GitHub (ask user first!)
```
