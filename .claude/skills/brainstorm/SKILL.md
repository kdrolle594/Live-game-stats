---
name: brainstorm
description: Brainstorm and shape an idea into a clear design before writing code. Use when the user says "brainstorm", "let's plan", "I have an idea for", or wants to explore a new feature for NBA Live Hub before building it.
---

# Brainstorm

Turn a rough idea into an agreed design. Do not write or edit code during this skill.

## Steps

1. **Get context.** Skim `index.html`, `app.js`, `style.css`, and `winter-sky-692e/src/worker.js` (the Cloudflare Worker proxy) so ideas fit what already exists.
2. **Ask one question at a time.** Find out the goal, who uses it, and what "done" looks like. Prefer multiple-choice questions when you can. Stop asking once the goal is clear.
3. **Offer 2-3 approaches.** For each: one-line summary, what files change, and trade-offs (effort, API limits, data source, mobile layout). Say which one you recommend and why.
4. **Write the design.** Once the user picks an approach, present a short design in sections:
   - Goal
   - UI changes (what the user sees)
   - Data (which ESPN/NBA endpoint, via the worker proxy or not)
   - Code changes (by file)
   - Edge cases (no games, API errors, live vs past dates)
   - Open questions
   Check each section with the user before moving on.
5. **Save it.** Write the agreed design to `docs/ideas/YYYY-MM-DD-<topic>.md`.
6. **Hand off.** Ask if the user wants to start building it now.

## Rules

- Keep it short. Plain words, no filler.
- YAGNI: cut anything the user didn't ask for.
- If the idea is too big, split it into smaller pieces and brainstorm the first one.
