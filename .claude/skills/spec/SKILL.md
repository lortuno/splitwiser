---
name: spec
description: Brainstorm and specify one epic from specs/roadmap.md, or a new feature, through rounds of questions the user answers in a file, ending in a specification with numbered acceptance checks. Use when the user runs /spec.
argument-hint: "[epic number or feature]"
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
            - /hooks/spec-loop-guard.ts
---

# /spec: brainstorm, then specify

Argument: `$ARGUMENTS`

This skill specifies a feature. It does not implement one: write no code and change no file other than the two
files named below. The hook `.claude/hooks/spec-loop-guard.ts` blocks every step out of order. When it blocks, fix
what it names. Never work around it.

## 1. Resolve the feature

- **A number** (`/spec 2`): epic 2 in `specs/roadmap.md`. `{nr}` is that number with two digits (`02`).
- **Anything else** (`/spec export to CSV`): a new feature, whether or not the roadmap mentions it. `{nr}` is the next
  free number: one more than the highest of every epic number in the roadmap and every `{nr}` already used in
  `specs/`.
- **Empty**: ask which epic or feature to specify, and stop.
- `{name}` is a short lowercase slug of the epic's title, or of the feature: `trip-at-a-glance`, `export-csv`.
- Files: `specs/{nr}-{name}-brainstorming.md` and `specs/{nr}-{name}-specification.md`.
- If the brainstorming file already exists, do not start over: continue the loop from where the file stands (step 3).
  If the specification already exists, tell the user and stop.

## 2. Read before asking

1. `specs/guidelines/architecture.md` and `specs/guidelines/ui.md`. Technology, schema, packages, money in integer
   euro cents, calculations only in the API, tokens and components are fixed there. Do not ask about them again. If the
   feature cannot be built within them, stop and ask the user in the chat before writing anything.
2. `specs/roadmap.md`, for the epic (or the epic the feature is closest to): what a person can do afterwards, what is on
   screen, how it is tested, and what is **out of scope**.
3. The code the feature touches (screens, API routes, schema, seed), so questions start from what exists.
4. Earlier `specs/*-specification.md`, to reuse decisions and keep the same shape.

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

## 4. Write the specification

⛔ `specs/{nr}-{name}-specification.md` can only be written when every round is answered and a wireframe (or
`No new screens.`) is in the brainstorming file. Use this shape, in this order (the hook checks the ⛔ headings):

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

The `## Acceptance checks` heading and its numbered items are also read by `.claude/statusline.ts`, so keep that exact
heading.

After the specification, you may append a closing section to the brainstorming file (no `## Round` heading) listing
decisions you made while writing it. Anything that needs the user's decision goes into a new round instead.

## 5. Commit

When the specification is written, commit the brainstorming and the specification files, and nothing else, on a
branch (never on `main`): `Spec epic {n}: {title}` or `Spec {feature}`. Then tell the user the file paths, the number
of acceptance checks, and anything in the spec they should look at first. Do not start building, and do not add an
estimate: that happens when the build starts.
