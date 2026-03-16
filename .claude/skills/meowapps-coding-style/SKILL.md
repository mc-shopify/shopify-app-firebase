---
name: meowapps-coding-style
description: Review or refactor code against meowapps coding style rules (rules 1-13 + conventions). Use when user wants code review, style feedback, or style-compliant refactoring.
---

Read `reference.md` from the same directory as this SKILL.md file. It contains all coding style rules with examples.

## Step 1 — Understand scope

If no files specified, ask:
- Which files to review or refactor?
- All rules or specific rules? (e.g. "only check rule 11 and 13")
- Review mode (report + approve) or apply mode (fix directly)?

Read the specified files first. If the user gives a directory, list its contents and confirm which files to include.

## Step 2 — Review

Check every rule (1-13) and every convention from reference.md against each file. Only flag violations of listed rules and conventions — not general code quality or linting.

If no violations: report that files pass all style checks and stop.

If violations found, present findings grouped by file:

For each violation:
1. File path and line number
2. Which rule is violated (by number and name)
3. What's wrong (one line)
4. Proposed fix

Ask the user:
- Do these findings look correct? Any false positives?
- Approve all fixes, adjust, or skip specific ones?

Wait for approval before making changes.

## Step 3 — Fix

After approval, fix violations file by file. Verify each file before moving to the next.

If in apply mode (user explicitly asked to refactor/apply): skip the approval step in Step 2 — apply fixes directly and report what changed. But still ask: should I only fix style violations, or also restructure code to better follow call flow (rule 10)?

$ARGUMENTS
