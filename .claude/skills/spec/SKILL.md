---
name: spec
description: Brainstorm and specify one epic from specs/roadmap.md, a new feature, or a change to an existing feature, through rounds of questions the user answers in a file, ending in the feature's one living specification (in its category folder) with numbered acceptance checks. Use when the user runs /spec.
argument-hint: "[epic number, feature, or change to a feature]"
disable-model-invocation: true
hooks:
  PreToolUse:
    - matcher: "Edit|Write|Bash"
      hooks:
        - type: command
          command: docker
          args:
            - run
            - --rm
            - -i
            - -e
            - CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR}
            - -e
            - SPECS_DIR=/specs
            - -v
            - ${CLAUDE_PROJECT_DIR}/.claude/hooks:/hooks:ro
            - -v
            - ${CLAUDE_PROJECT_DIR}/specs:/specs:ro
            - oven/bun:1.4.3-debian
            - bun
            - /hooks/spec-guard.ts
            - --loop
---

# /spec: brainstorm, then specify

Argument: `$ARGUMENTS`

This skill specifies a feature, or a change to one. It does not implement anything: write no code and change no file
other than the feature's brainstorming, specification and progress files. The hook `.claude/hooks/spec-guard.ts`
blocks every step out of order. When it blocks, fix what it names. Never work around it.

**One feature, one living specification.** Every feature belongs to a category and keeps its files in that category's
folder:

```
specs/{category}/{nr}-{name}-brainstorming.md    every round ever asked about the feature, append-only
specs/{category}/{nr}-{name}-specification.md    the source of truth: how the feature works today
specs/{category}/{nr}-{name}-progress.md         build ticks (created by the build, not by this skill)
```

A change to an existing feature (another language, a dropdown instead of buttons, a new limit) never gets a new
spec: it is a new round in the same brainstorming file, and then the existing specification is edited in place so it
describes the feature as it is now. The specification has no change log, no "previously" and no struck-through text;
git keeps the history. The hook blocks a second spec for the same feature, a name such as `-v2` or `-changes`, and
change-log sections.

## 1. Resolve the feature

List `specs/*/` first: every category folder and every feature in it.

- **Empty**: ask which epic, feature or change to specify, and stop.
- **A number** (`/spec 6`): if `specs/*/{nr}-*-specification.md` (or its brainstorming file) exists, this is a
  **change** to that feature, or the continuation of its loop. Otherwise it is epic `{nr}` in `specs/roadmap.md`, a
  **new feature**; `{nr}` is that number with two digits (`02`).
- **Anything else** (`/spec show the languages as a dropdown`): read the `# ` title and `## Goal` of every
  specification. If the text is about a feature that already has a specification, it is a **change** to that feature,
  even if it is worded as something new. Only when no existing feature covers it is it a **new feature**, with `{nr}`
  the next free number: one more than the highest of every epic number in the roadmap and every `{nr}` already used in
  `specs/`. If you cannot tell which feature it belongs to, or whether it is a new one, ask in the chat and stop.
- **Category of a new feature**: one of the existing folders when the feature fits (`trips`, `accounts`, `expenses`,
  `translations`, `tooling`, ...). If none fits, propose a new lowercase category name in the chat and stop until the
  user agrees; the folder is created with the feature's first file. A change keeps its feature's category.
- `{name}` of a new feature is a short lowercase slug of the epic's title, or of the feature: `trip-at-a-glance`,
  `export-csv`. Never a version or change suffix.
- If the brainstorming file's last round is not answered yet, do not start over: continue the loop from where the
  file stands (step 3).

## 2. Read before asking

1. `specs/guidelines/architecture.md` and `specs/guidelines/ui.md`. Technology, schema, packages, money in integer
   euro cents, calculations only in the API, tokens and components are fixed there. Do not ask about them again. If the
   feature cannot be built within them, stop and ask the user in the chat before writing anything.
2. `specs/roadmap.md`, for the epic (or the epic the feature is closest to): what a person can do afterwards, what is on
   screen, how it is tested, and what is **out of scope**.
3. The code the feature touches (screens, API routes, schema, seed), so questions start from what exists.
4. Earlier `specs/*/*-specification.md`, to reuse decisions and keep the same shape. For a **change**, the feature's
   own specification and brainstorming file in full, and every other specification that mentions what changes (a
   change to a screen may also touch the checks of another feature).

## 3. The loop: one round, then wait

Each round is appended to the end of the brainstorming file and looks like this:

````markdown
## Round 2

### Q1. <question>
<one or two lines of context, if needed>
- [x] <option> (Recommended)
- [ ] <option>
- [ ] <option>

### Q2. ...

- [ ] Round 2 answered (tick this when you have answered every question above)
````

Rules (the hook enforces those marked ⛔):

- ⛔ **Append only.** Never change or remove a question, an option or an answer already in the file, not even a
  typo. To append, use Write with the whole current file plus the new text, or Edit whose `old_string` is the file's
  last line.
- ⛔ **One round at a time**, numbered `## Round 1`, `## Round 2`, …, ending with its unticked
  `- [ ] Round N answered` line.
- **Options as `[ ]`, with your recommendation pre-selected as `[x]` and marked "(Recommended)".** Give 2 to 4 options.
  The user may also write their own answer under a question.
- ⛔ **After appending a round, stop.** Tell the user in one or two lines that round N is in the file and that they
  should answer there and tick "Round N answered". Then end your turn. Never answer for the user, never guess ahead,
  never append a second round in the same turn.
- ⛔ **Only the user ticks "Round N answered".** When they say they are done, read the whole file again. Take their
  answers from the file: the `[x]` they left or moved, and any notes they wrote. If the line is still unticked, ask them
  to tick it, and do nothing else.
- If an answer is unclear or contradicts another answer, ask about it in the next round. Do not decide it yourself.
- The first round starts with a short "What exists today" section above `## Round 1`.
- **A change** appends to the feature's existing brainstorming file, and its rounds continue the numbering (after
  `## Round 3` comes `## Round 4`). Its first round starts with a `# Change: {short title}` heading and a short "What
  the specification says today" section that quotes the rules, wireframes and checks the change touches. Ask only
  about what changes and what it affects; do not ask again what the specification already decides.

**What the rounds must cover** before the specification (spread them over as many rounds as needed, most important
first):

- functionality: what a person can do afterwards, and the rules behind it;
- screens: which ones change or are new. ⛔ **Every new or changed screen is drawn as an ASCII wireframe at phone
  width (390 px) in a fenced block, as a question the user can correct.** Write the specification only after the
  wireframe round is answered. If nothing on screen changes, add the line `No new screens.` to a round instead;
- interaction on a phone: tap targets (`size.tapMin`, `size.tapPrimary`), thumb reach, primary action at the bottom,
  the keyboard for amounts (`decimal-pad`);
- data and API: what is read and written, endpoints, request and response shapes, money in cents, what is calculated
  in the API;
- what can go wrong: errors, edge cases and invalid input, and the **seed or test data each case needs**. Always
  consider: no data yet, everyone already even, amounts that do not divide evenly to the cent, a very long name, a very
  large amount, the API unreachable, a trip already marked as paid, and anything specific to this feature.

When every topic is answered and the last round is ticked, go to step 4. Do not add an empty round to close the loop.

## 4. Write or change the specification

⛔ `specs/{category}/{nr}-{name}-specification.md` can only be written or changed when every round is answered and a
wireframe (or `No new screens.`) is in the brainstorming file.

**For a change**, edit the existing specification in place; do not rewrite it from scratch and do not create a new
one:

- Change every section the answers touch (Goal, Screens and wireframes, Data, API, Seed data, Tests, Acceptance
  checks, Out of scope) so the whole specification describes the feature as it is now. Remove what no longer holds.
  ⛔ No "Changes", "History" or "Update" section, no "previously" or "now" wording, no ~~strikethrough~~: git keeps
  the history.
- Keep the numbers of the acceptance checks stable, because the progress file and the tests refer to them: a changed
  check keeps its number, a new check gets the next free number at the end, and a dropped check is deleted without
  renumbering the others.
- Leave the `## Estimate` table alone; the build adds its row.
- If the progress file exists, bring it in line: untick every build step and check the change touches, add new
  checks unticked, delete the lines of dropped checks.
- If the change also touches another feature's specification (a check that names a screen that changed), edit that
  one too, the same way.

**For a new feature**, use this shape, in this order (the hook checks the ⛔ headings):

1. `# Epic {n}: {title} — specification`, its source (roadmap epic or "new feature") and the brainstorming file.
2. `## Goal`: one short paragraph.
3. ⛔ `## Screens`: every screen with its **empty, loading and error state**, the agreed wireframe, and what each
   element does when tapped.
4. ⛔ `## Data`: what the feature reads and writes, and schema changes.
5. ⛔ `## API`: endpoints with request and response shapes, money in `_cents`, errors with status and `code`.
6. ⛔ `## Seed data`: the trips, people and expenses the checks rely on, with the exact euro amounts they produce.
   Calculate them with the real API code on a fresh in-memory database. Do not work them out by hand.
7. `## Tests`: PHP, TypeScript and the Playwright screenshots at 390x844 that come from the checks.
8. ⛔ `## Acceptance checks`: a numbered list (`1.`, `2.`, …). This list is the contract: the build, the tests and the
   screenshots come from it. Each check names **the screen, what you do and what you should see**, with exact euro
   amounts (`1.915,57 €`) wherever money appears. Verifiable in a browser at a 390x844 viewport after a fresh seed.
   Include every error and edge case agreed in the rounds, not only the happy path. Mark the ones Playwright
   screenshots with 📸.
9. ⛔ `## Out of scope`: taken from the roadmap epic, plus anything the rounds excluded.
10. ⛔ `## Check on iOS and Android`: a short list of what must be checked on a device and cannot be seen in the
    browser.

The `## Acceptance checks` heading and its numbered items, and the `## Screens`, `## Data`, `## API`, `## Seed data` and
`## Tests` headings (one build step each), are also read by `.claude/statusline.ts`, so keep those exact headings.

After the specification, you may append a closing section to the brainstorming file (no `## Round` heading) listing
decisions you made while writing it. Anything that needs the user's decision goes into a new round instead.

## 5. Commit

When the specification is written, commit the brainstorming, specification and (for a change) progress files, and
nothing else, on a branch (never on `main`): `Spec epic {n}: {title}`, `Spec {feature}` or `Spec change to {feature}:
{change}`. Then tell the user the file paths, the number of acceptance checks (for a change: which checks changed,
were added or were dropped), and anything in the spec they should look at first. Do not start building, and do not
add an estimate: that happens when the build starts.
