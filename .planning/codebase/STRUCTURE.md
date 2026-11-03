---
last_mapped_commit: 9e7c48e1eac417870637cd7e5be0aec4a3f1d9a3
last_mapped_at: 2026-11-03
---
# Codebase Structure

**Analysis Date:** 2026-11-03

## Directory Layout

```
/  (repo root)
├── pom.xml                 # Maven module notesbot, Java 21, Spring Boot 4.1.1
├── mvnw, mvnw.cmd          # Maven wrapper
├── .mvn/wrapper/           # Wrapper properties (Maven distribution)
├── src/main/java/notesbot/ # Production Java, package root notesbot
├── src/test/java/notesbot/ # JUnit 5 tests, same package tree
├── playground/bot-mockup/  # Static chat mock and Playwright tests
├── docs/                   # Plan, session memory, screenshots, about
├── .claude/                # Rules, skills, hooks, settings for the coding agent
├── graft/                  # Present directory; not application source
├── AGENTS.md               # Project commands and constraints
├── CLAUDE.md               # Points at docs/plan.md and docs/memory.md
├── README.md               # Human overview (status paragraph lags the Java slice)
├── ТЗ-telegram-bot.md      # Product spec (F1–F5, stack, order of work)
└── .planning/codebase/     # Generated codebase maps (this file)
```

`src/main/resources/` does not exist. There is no `application.yml`, no `compose.yaml`, and no Java class with `main`.

## Directory Purposes

**`src/main/java/notesbot/`:**
- Purpose: All production bot code. Package declaration matches the directory.
- Contains: Subpackages `access` and `bot` only.
- Key files: `src/main/java/notesbot/access/AccessPolicy.java`, `src/main/java/notesbot/bot/MessageHandler.java`.

**`src/main/java/notesbot/access/`:**
- Purpose: Who may use the bot.
- Contains: One public class, no Spring stereotypes.
- Key files: `AccessPolicy.java`.

**`src/main/java/notesbot/bot/`:**
- Purpose: Inbound text handling after the policy exists.
- Contains: `MessageHandler.java`.
- Key files: `MessageHandler.java` (depends on `notesbot.access`).

**`src/test/java/notesbot/`:**
- Purpose: Unit tests mirrored by package. No `src/test/resources`, no `@SpringBootTest`.
- Contains: `access/AccessPolicyTest.java`, `bot/MessageHandlerTest.java`.
- Key files: those two tests. Assertions are AssertJ (`org.assertj.core.api.Assertions`).

**`playground/bot-mockup/`:**
- Purpose: Teaching mock of the chat. Not on the Maven reactor.
- Contains: `index.html`, `package.json`, `package-lock.json`, `playwright.config.js`, `tests/notes.spec.js`.
- Key files: `index.html` (markup and all behaviour), `tests/notes.spec.js` (e2e). `npm install` also creates local `node_modules/` (not source).

**`playground/bot-mockup/tests/`:**
- Purpose: Playwright specs. `playwright.config.js` sets `testDir` to `./tests` and `outputDir` to `./test-results`.
- Contains: `notes.spec.js` only.
- Key files: `notes.spec.js`. Screenshots written to `playground/bot-mockup/test-results/` (for example `search.png` from the spec). Treat `test-results/` as generated output.

**`docs/`:**
- Purpose: Working memory for the single developer and the agent, plus homework screenshots.
- Contains: `plan.md` (steps 1–7; only step 1 checked), `memory.md`, `memory-archive-2026-10-14-1.md`, `about.md`, `screenshots/`.
- Key files: `docs/plan.md`, `docs/memory.md`. `CLAUDE.md` tells the agent to read both at session start.

**`.claude/`:**
- Purpose: Agent policy, not bot runtime.
- Contains: `rules/*.md`, `skills/write-tests/SKILL.md`, `skills/review-step/SKILL.md`, `hooks/*.py`, `settings.json`.
- Key files: `.claude/rules/java-main.md` (gates on `src/main`), `.claude/rules/tdd.md`, `.claude/rules/tests.md`, `.claude/hooks/test_block_bash_writes.py` (hook unit test, run with `python3`, not Maven).

**Repo root metadata:**
- Purpose: Build identity and product contract.
- Contains: `pom.xml`, wrapper scripts, `AGENTS.md`, `README.md`, `ТЗ-telegram-bot.md`.
- Key files: `pom.xml` (coordinates `notesbot:notesbot:0.0.1-SNAPSHOT`).

## Key File Locations

**Entry Points:**
- `src/main/java/notesbot/bot/MessageHandler.java`: Only callable production entry (`handle(Long, String)`). No process `main`.
- `playground/bot-mockup/index.html`: Browser entry. Open the file directly.
- `playground/bot-mockup/tests/notes.spec.js`: e2e entry via `npm test` in `playground/bot-mockup/`.
- `mvnw`: `./mvnw test`, `./mvnw verify`, `./mvnw spotless:check`, `./mvnw spotless:apply` (`AGENTS.md`). JDK must be 21.

**Configuration:**
- `pom.xml`: Dependencies and plugins. No profile named `test` or `prod`.
- `playground/bot-mockup/playwright.config.js`: Chromium, list reporter, test and output directories.
- `playground/bot-mockup/package.json`: Script `test` → `playwright test`. Dev dependency `@playwright/test`.
- `.claude/settings.json`: Agent command permissions (not Spring config).
- Spring `application.yml` and Docker `compose.yaml`: not in the repo. When added, secrets stay in the environment (`AGENTS.md`).

**Core Logic:**
- `src/main/java/notesbot/access/AccessPolicy.java`: Whitelist.
- `src/main/java/notesbot/bot/MessageHandler.java`: Allow → `"Принято: " + text`; deny → empty `Optional`.
- `playground/bot-mockup/index.html`: `save`, `search`, `digest`, `suggestTags` (mock only).

**Testing:**
- `src/test/java/notesbot/access/AccessPolicyTest.java`: Policy cases.
- `src/test/java/notesbot/bot/MessageHandlerTest.java`: Reply vs silence. Allowed id in both files is `42L`.
- `playground/bot-mockup/tests/notes.spec.js`: Link+tags+search, tag edit, empty search, digest groups. Selectors are `data-testid` (`input`, `send`, `bot-message`, `tag`, `confirm`, `digest-group`).
- `.claude/hooks/test_block_bash_writes.py`: Tests the Bash write-blocking hook.

**Spec and plan:**
- `ТЗ-telegram-bot.md`: Behaviour the Java packages do not implement yet (save note, fetch link, model tags, word search, morning digest).
- `docs/plan.md`: Step 2 is the next structural change (real bot, PostgreSQL compose). Do not mark it done from this map.

## Naming Conventions

**Files:**
- Java production and test types: PascalCase file name equals the public class (`AccessPolicy.java`, `AccessPolicyTest.java`).
- Tests end with `Test`, sit in the same package as the class, under `src/test/java`.
- Packages are a single lowercase word under `notesbot`: `access`, `bot`.
- Mockup tests: `notes.spec.js` (Playwright `*.spec.js`).
- Agent skills: directory name is the command (`write-tests`, `review-step`) with `SKILL.md` inside.
- User-facing spec file keeps the Russian name `ТЗ-telegram-bot.md`.

**Directories:**
- Maven standard: `src/main/java`, `src/test/java`.
- One feature area per package directory. Do not add a default package.
- Playground feature lives in `playground/<name>/`, currently only `bot-mockup`.
- Docs and screenshots stay in `docs/`, not beside Java sources.

**Java names:**
- Types and methods are English (`isAllowed`, `handle`). Comments and reply strings are Russian (`AGENTS.md`).
- Test methods are English behaviour phrases without the word `test` prefix: `allowsUserFromWhitelist`, `staysSilentForStranger`.
- No `I` prefixes, no `Impl` suffixes (no interfaces exist yet).

**Mockup:**
- Stable hooks are `data-testid` attributes, not CSS classes or visible copy (`.claude/rules/tests.md`).
- Commands in the page are `/search` and `/digest`.

## Where to Add New Code

**Whitelist or reply behaviour (current slice):**
- Production: extend `src/main/java/notesbot/access/` or `src/main/java/notesbot/bot/` only when the change belongs to that type.
- Tests first: `src/test/java/notesbot/access/` or `src/test/java/notesbot/bot/`, one behaviour per method (`.claude/rules/tdd.md`, `.claude/skills/write-tests/SKILL.md`).
- Run `./mvnw test` before calling the change done (`.claude/rules/run-tests-before-done.md`). Format with `./mvnw spotless:apply` (google-java-format 1.28.0 in `pom.xml`).

**New bot feature (F1–F5, still absent):**
- Primary code: new package under `src/main/java/notesbot/`, not a dump into `MessageHandler`. Suggested placement when the failing test arrives:
  - notes and links persistence: `src/main/java/notesbot/notes/`
  - model port and tag suggestion: `src/main/java/notesbot/tags/` (interface in `src/main`, stub in `src/test`)
  - page fetch: `src/main/java/notesbot/links/`
  - search: `src/main/java/notesbot/search/`
  - morning digest: `src/main/java/notesbot/digest/`
  - Telegram long-polling adapter and Spring `@Configuration`: `src/main/java/notesbot/bot/` or `src/main/java/notesbot/config/` once a test or the skeleton step needs beans
  - `@SpringBootApplication` class: `src/main/java/notesbot/` (package root), name aligned with the class, only when step 2 of `docs/plan.md` is implemented
- Tests: mirror the package under `src/test/java/notesbot/`. Unit tests construct objects or use Mockito-style stubs; they must not call Telegram, a real LLM, the network, or a real PostgreSQL (`.claude/rules/tests.md`).
- SQL or Spring config that is not secret: `src/main/resources/` (directory does not exist yet; create it with the feature). Keep tokens and passwords out of committed yaml.
- Docker database definition: `compose.yaml` at the repo root when step 2 adds it (`AGENTS.md`). Do not commit passwords.

**Spring Boot application class and wiring:**
- There is no application class today. Add it at `src/main/java/notesbot/` so component scan covers every `notesbot.*` package. Do not put it under `access` or `bot` only.
- Register `AccessPolicy` from environment-backed configuration. Do not hard-code the owner's id in `src/main`.

**New mockup behaviour:**
- Implementation: `playground/bot-mockup/index.html` (single page; there is no JS module split).
- Tests: `playground/bot-mockup/tests/notes.spec.js`, or another `*.spec.js` in that folder.
- Run: `cd playground/bot-mockup && npm test`. One test: `npx playwright test -g "поиск без совпадений"` (`AGENTS.md`).
- Do not add a frontend framework. The product UI is Telegram (`ТЗ-telegram-bot.md` §5).

**Utilities:**
- No `util` package exists. Put helpers next to their only caller. Share a type only when a second package needs it.
- Agent hooks stay in `.claude/hooks/`. Hook tests stay beside them (`test_block_bash_writes.py`), not in `src/test`.

**Out of scope (do not add directories for these):**
- Tasks, reminders, voice, images, files, semantic search, price watch, multi-user (`ТЗ-telegram-bot.md` §4).

## Special Directories

**`src/main/java/notesbot/`:**
- Purpose: Shipped bot logic.
- Generated: No.
- Committed: Yes.

**`src/test/java/notesbot/`:**
- Purpose: JUnit tests.
- Generated: No.
- Committed: Yes.

**`playground/bot-mockup/node_modules/` and `playground/bot-mockup/test-results/`:**
- Purpose: Install tree and Playwright output (screenshot path in `notes.spec.js`).
- Generated: Yes.
- Committed: No (install and run artifacts). `package-lock.json` is committed.

**`docs/screenshots/`:**
- Purpose: Course evidence images (`docs/screenshots/`).
- Generated: No (saved captures).
- Committed: Yes.

**`docs/memory-archive-2026-10-14-1.md`:**
- Purpose: Older session notes rotated out of `docs/memory.md` (rule in `.claude/rules/session-memory.md`).
- Generated: No.
- Committed: Yes. Not loaded by default.

**`.claude/`:**
- Purpose: Agent rules and hooks.
- Generated: No.
- Committed: Yes, except a local `settings.local.json` if present (`README.md` says personal settings stay untracked).

**`graft/`:**
- Purpose: Tool index directory at repo root. Empty of application code.
- Generated: By the graft indexer when used.
- Committed: Do not put bot features here.

**`.planning/codebase/`:**
- Purpose: Architecture and structure maps for later planning.
- Generated: By the codebase mapper.
- Committed: Only when the user asks for a commit (`AGENTS.md`).

**Missing on purpose until step 2+:**
- `src/main/resources/` — Spring config and later SQL.
- `compose.yaml` — PostgreSQL for local run.
- Application entry class under `src/main/java/notesbot/`.
- Packages beyond `access` and `bot`.

---

*Structure analysis: 2026-11-03*
