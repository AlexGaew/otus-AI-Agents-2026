---
last_mapped_commit: 9e7c48e1eac417870637cd7e5be0aec4a3f1d9a3
last_mapped_at: 2026-11-03
---
# Codebase Concerns

**Analysis Date:** 2026-11-03

The spec is `ТЗ-telegram-bot.md`. Plan status is `docs/plan.md`: step 1 is done; steps 2–7 are open. Production code is two classes, `src/main/java/notesbot/access/AccessPolicy.java` and `src/main/java/notesbot/bot/MessageHandler.java`. There is no Spring application, no Telegram update loop, no PostgreSQL schema, no LLM client, and no `compose.yaml`.

## Tech Debt

**Step 2 skeleton is declared in Maven but not wired:**
- Issue: `pom.xml` pulls `spring-boot-starter-jdbc`, the PostgreSQL driver, `telegrambots-springboot-longpolling-starter` 10.3.0, and `telegrambots-client` 10.3.0, but nothing in `src/main` is a `@SpringBootApplication`, a `TelegramBot`, or a datasource config. `src/main/resources/` does not exist. `compose.yaml` does not exist. `AGENTS.md` still marks the Docker run command as TODO.
- Files: `pom.xml`, `src/main/java/notesbot/bot/MessageHandler.java`, `AGENTS.md`, `docs/plan.md`
- Impact: `./mvnw test` can pass while the bot cannot start, cannot read a token, and cannot survive a restart. Adding `@SpringBootApplication` later will turn on JDBC auto-config and fail fast without a database URL.
- Fix approach: Finish step 2 before F1. Add a main class, bind the bot token and whitelist only from environment variables (no literals in `application.yml`), put PostgreSQL in `compose.yaml` with the password as an env var, and keep `AccessPolicy` as the first check on every update. Do not mark step 2 done in `docs/plan.md` until `./mvnw test` passes against that wiring.

**Handler is an echo, not an inbox:**
- Issue: A whitelisted sender gets `Optional.of("Принято: " + text)` and nothing is stored. The class comment says a stranger is not saved; there is no store to prove that.
- Files: `src/main/java/notesbot/bot/MessageHandler.java` (reply at the return of `handle`), `src/test/java/notesbot/bot/MessageHandlerTest.java`
- Impact: F1–F5 in `ТЗ-telegram-bot.md` section 3 are unimplemented. Restart safety in section 6 is vacuously true only because there is no data.
- Fix approach: On steps 3–6, replace the echo with save / tag / search / digest behavior behind interfaces tests can stub. Keep the whitelist branch returning empty and add an assertion that the store was not called.

**Docs and session notes disagree with the tree:**
- Issue: `README.md` says there is no bot code yet and that bot commands appear after step 2. `AGENTS.md` already documents `./mvnw test` and Spotless. `docs/memory.md` (2026-10-14 entry) still asks to add `target/` to `.gitignore` (already present), to fill those Maven commands (already filled), and to rename `playground/bot-mockup/tests/inbox.spec.js` (the file is `playground/bot-mockup/tests/notes.spec.js`). `docs/about.md` is closer to the truth.
- Files: `README.md`, `docs/memory.md`, `docs/about.md`, `.gitignore`
- Impact: The next session follows `docs/memory.md` and repeats finished cleanup or looks for a file that is gone.
- Fix approach: When the next real step lands, replace the stale «Дальше» bullets. Update the status paragraph in `README.md` so it matches `docs/plan.md`. Do not treat the journal as the source of file layout.

**Spotless is not part of the build lifecycle:**
- Issue: `pom.xml` configures `spotless-maven-plugin` but does not bind `check` to `verify`. Format is only `./mvnw spotless:check` or the `check_after_edit.py` hook.
- Files: `pom.xml`, `.claude/hooks/check_after_edit.py`
- Impact: `./mvnw verify` can succeed on code the project style would reject if the hook did not run (CI, another editor).
- Fix approach: Bind `spotless:check` to `verify` when CI or a release build is added. Until then, run the explicit goal before calling a step done.

**Mock UI stands in for the product:**
- Issue: `playground/bot-mockup/index.html` keeps notes in a page-local `store`, picks tags from a `KEYWORDS` dictionary, and never calls Telegram, HTTP, or Postgres. The banner in that file says so. Playwright in `playground/bot-mockup/tests/notes.spec.js` locks the mock contract (`/search`, `/digest`, `data-testid`).
- Files: `playground/bot-mockup/index.html`, `playground/bot-mockup/tests/notes.spec.js`, `playground/bot-mockup/package.json`
- Impact: Green `npm test` does not mean F1–F5 work. The mock will drift from the Java bot unless someone updates it on purpose.
- Fix approach: Treat the mock as a UI sketch only. New bot behavior gets JUnit tests under `src/test/java/notesbot/`, not new Playwright cases, unless the user asks to change the sketch.

## Known Bugs

**Null message text becomes the string `null`:**
- Symptoms: `handle` for an allowed id returns `Принято: null` when `text` is null. There is no test.
- Files: `src/main/java/notesbot/bot/MessageHandler.java`
- Trigger: Call `handle` with a whitelisted id and a null body (a Telegram update that is not a text message, once wired).
- Workaround: None in code. Do not connect this method to long polling until non-text updates are ignored and blank text is rejected without a reply that echoes `"null"`.

**No other runtime defects are implemented yet:**
- Symptoms: Not detected beyond the echo and the missing process. `AccessPolicy` fails closed for null ids and an empty set (`src/test/java/notesbot/access/AccessPolicyTest.java`).
- Files: `src/main/java/notesbot/access/AccessPolicy.java`
- Trigger: Not applicable.
- Workaround: Not applicable.

## Security Considerations

**Whitelist is not on a Telegram boundary:**
- Risk: The spec says anyone outside the whitelist gets no reply and no write. Today that rule exists only inside `MessageHandler.handle`. Callback queries, commands, and edited messages have no handler. A later bot class can persist first and call `isAllowed` second.
- Files: `src/main/java/notesbot/bot/MessageHandler.java`, `src/main/java/notesbot/access/AccessPolicy.java`, `.claude/rules/java-main.md`
- Current mitigation: Unit tests require silence for id `7` and allow id `42`. `Set.copyOf` rejects a null element. An empty whitelist denies everyone. No real user id is committed.
- Recommendations: One entry point must call `AccessPolicy` before logging text, calling an LLM, or inserting a row. Load ids from an environment variable. Empty or missing whitelist must keep the deny-all behavior. Do not answer in groups for non-whitelisted senders.

**Secrets are absent from the tree, and the next config file is the likely leak:**
- Risk: Token, model key, and database password must not land in git. There is no `application.yml`, no committed env file, and no compose file yet, so nothing to leak. The risk starts when those files are added.
- Files: `.gitignore` (ignores `.env` and `.env.*`), `AGENTS.md`, `pom.xml` (no credentials)
- Current mitigation: Gitignore plus hooks `.claude/hooks/block_protected.py` and `.claude/hooks/block_bash_writes.py`. `README.md` documents that the Bash hook is a text heuristic, not a sandbox, and that it also blocks harmless commands whose text contains `.env`.
- Recommendations: Commit only placeholders such as `${BOT_TOKEN}` with no defaults. Pass the database password into Compose via the environment, not a literal. Do not log update payloads that might contain the token. Do not add a sample env file with real-looking secrets. This audit did not read env files.

**User text is copied into the reply:**
- Risk: `Принято: ` plus the raw body will echo passwords or other sensitive notes back into Telegram if this method is connected as-is. Section 6 of the spec says the bot must not be used for sensitive content; that is not enforced in code.
- Files: `src/main/java/notesbot/bot/MessageHandler.java`
- Current mitigation: The method is not registered with Telegram.
- Recommendations: Confirm with a short status, not a full echo of the note. Do not log message text at info level.

**Dependency surface is unused but real:**
- Risk: JDBC and Telegram starters are on the classpath with no security config, no update allow-list, and no request timeouts of our own.
- Files: `pom.xml`
- Current mitigation: No listening process.
- Recommendations: When the long-polling bot starts, restrict updates to the types the bot handles, set HTTP timeouts on page fetch and the model client, and do not enable a public HTTP port for Telegram.

## Performance Bottlenecks

**Not applicable at current size:**
- Problem: There is no database, scheduler, HTTP fetch, or model call. `AccessPolicy.isAllowed` is a `Set` lookup.
- Files: `src/main/java/notesbot/access/AccessPolicy.java`
- Cause: Feature work has not reached I/O.
- Improvement path: When F4 arrives, search with SQL (`ILIKE` or `to_tsvector` on text, title, and tags) in PostgreSQL, not a full table load into the bot. When F2 arrives, cap page download size and time so one URL cannot stall the polling thread. When F5 arrives, one scheduled query per day is enough for a single user.

## Fragile Areas

**`MessageHandler` will be the wrong seam if storage is added inside it:**
- Files: `src/main/java/notesbot/bot/MessageHandler.java`, `src/test/java/notesbot/bot/MessageHandlerTest.java`
- Why fragile: The method mixes authorization and a placeholder reply. Tests only check that `Optional` is present or empty, so a regression that saves a stranger’s note still passes. `text` is not validated.
- Safe modification: Keep `handle` (or its replacement) free of Telegram types so tests stay pure. Inject a repository and a tagger port. For a denied id, assert no insert. For an allowed id, assert the saved text, not the reply string `"Принято:"`, once F1 exists. Follow `.claude/rules/tdd.md`: one failing test, then the minimum code.
- Test coverage: Allow and deny only. No empty string, no null body, no link, no persistence.

**`AccessPolicy` constructor assumes a non-null set:**
- Files: `src/main/java/notesbot/access/AccessPolicy.java`
- Why fragile: `Set.copyOf(allowedIds)` throws if the caller passes null. A Spring binder that fails to parse the env var can crash startup or, if someone substitutes `Set.of()` incorrectly versus null, change who gets in. Fail-closed is already tested for an empty set.
- Safe modification: Parse the env var in one configuration class. Null, blank, and unparsable values become an empty set and a log line that says the whitelist is empty, without logging the raw secret-bearing environment. Do not catch and then allow.
- Test coverage: Allow, deny, empty whitelist, null sender. No test for a null set argument.

**Java 21 is mandatory and easy to miss:**
- Files: `pom.xml` (`maven-enforcer-plugin`, range `[21,22)`), `AGENTS.md`
- Why fragile: The build fails on any other JDK. `docs/memory.md` records that the machine has also had JDK 25 and that Maven uses `JAVA_HOME`.
- Safe modification: Set `JAVA_HOME` to JDK 21 before `./mvnw`. Do not widen the enforcer range to match a newer local JDK; the spec requires 21.
- Test coverage: The enforcer rule is configuration, not a JUnit test.

**TelegramBots 10.3.0 does not match older docs:**
- Files: `pom.xml`, `docs/memory.md` (permanent trap)
- Why fragile: Context7 material for TelegramBots 6.9.7.1 does not describe 10.3.0. Copying a 6.x `TelegramLongPollingBot` sample will not compile.
- Safe modification: Read the 10.3.0 classes from the local jar (long-polling starter and client) before writing the bot. Keep that code behind the whitelist.
- Test coverage: None. The library is unused.

**Agent hooks are heuristic:**
- Files: `.claude/hooks/block_bash_writes.py`, `.claude/hooks/block_protected.py`, `README.md`
- Why fragile: A command can bypass the Bash hook with variables, scripts, or `eval`. The same hook blocks any command whose text mentions `.env`, including documentation commits.
- Safe modification: Do not “fix” the hook by weakening `.env` detection. Write env examples with the Write tool, not a shell redirect. Real secret safety is still gitignore plus review.
- Test coverage: `python3 .claude/hooks/test_block_bash_writes.py` (hook unit tests, not bot tests).

**Session memory is capped and partly stale:**
- Files: `docs/memory.md`, `docs/memory-archive-2026-10-14-1.md`, `.claude/rules/session-memory.md`
- Why fragile: Only two journal entries stay in context. The older one still lists finished chores. Agents that execute «Дальше» literally will fight the tree.
- Safe modification: After the next completed step, archive the oldest entry per `session-memory.md` and rewrite «Дальше» from `docs/plan.md` plus the files on disk.
- Test coverage: Not applicable.

## Scaling Limits

**Single-user inbox, not built:**
- Current capacity: Zero stored notes. Whitelist lookup is in memory.
- Limit: Spec section 4 excludes multi-user. One PostgreSQL container is the intended store. Long polling is one bot process. A digest is one morning job (`@Scheduled`), not a queue.
- Scaling path: Do not add sharding, a cache, or a second user. If search gets slow, add the SQL indexes for that one user’s rows. If page fetch blocks polling, isolate it with a timeout, not a worker fleet.

## Dependencies at Risk

**`org.telegram:telegrambots-*:10.3.0`:**
- Risk: Major API jump versus 6.x docs. The starter is unused, so a wrong sample fails at the first integration compile.
- Impact: Step 2 slips or the bot is written against the wrong types.
- Migration plan: Implement against the jars already pinned in `pom.xml`. Do not downgrade to 6.9.7.1 without an explicit stack change; `AGENTS.md` forbids unapproved stack changes.

**Spring Boot 4.1.1 parent:**
- Risk: JDBC auto-config, test slices, and Telegram starter compatibility are unverified because no application context starts. Boot 4 also expects a current platform; the enforcer still pins Java 21.
- Impact: First `SpringBootTest` or `spring-boot:run` can fail for reasons unrelated to inbox logic.
- Migration plan: Stay on the pinned parent. Introduce the context with a test that uses Testcontainers or a stub datasource only when `compose.yaml` exists. Do not add a second web stack.

**Playwright `^1.50.0`:**
- Risk: The caret can move the mock’s runner without a Java change. `package-lock.json` is the pin.
- Impact: Mock e2e only. The bot does not depend on it.
- Migration plan: Leave the mock alone unless its tests fail. Do not import Playwright into `src/`.

**No Flyway, Liquibase, or LLM SDK:**
- Risk: Not a vulnerable package. Schema and model access are unspecified in code.
- Impact: F2/F3 have no migration history and no port to fake in tests.
- Migration plan: Add a schema tool only if the user agrees it is still “PostgreSQL in Docker” from the spec. Put the model behind an interface in the bot; do not call a vendor SDK from `MessageHandler`.

## Missing Critical Features

**Telegram long polling and env configuration:**
- Problem: No bot process, no token property, no whitelist property, no reply sent through TelegramBots.
- Blocks: Step 2 of `docs/plan.md` and the “answers only me” requirement in `ТЗ-telegram-bot.md` section 8.

**PostgreSQL and `compose.yaml`:**
- Problem: The JDBC driver is a dependency only. No schema, repository, or Docker Compose service. `AGENTS.md` leaves the run command as TODO.
- Blocks: Durable notes (section 6) and every feature that stores data.

**F1 text notes and F2 links:**
- Problem: No timestamped save, no URL detection, no page title, no summary. A failed fetch cannot be degraded because nothing is saved.
- Blocks: MVP criterion in section 7.

**F3 tags with inline buttons:**
- Problem: No model client, no confirm/edit callback path. The mock buttons in `playground/bot-mockup/index.html` are not the bot.
- Blocks: Tag confirmation in the MVP criterion.

**F4 word search:**
- Problem: No `/search` (or equivalent) on the Java side. Word match across text, title, and tags does not exist.
- Blocks: The search half of the MVP criterion.

**F5 morning digest:**
- Problem: No `@Scheduled` job, no timezone, no grouping by tag, no send to the whitelist chat.
- Blocks: “Next morning” in section 7.

**VPS deploy:**
- Problem: No Dockerfile, compose, or host docs for running without the developer machine.
- Blocks: Step 7 and section 6 (“works without my computer”).

**Out of scope (do not build while closing the gaps above):**
- Problem: Section 4 excludes deadlines, voice, images, files, semantic search, price monitoring, and multi-user.
- Blocks: Nothing in the MVP. Adding them violates `AGENTS.md`.

## Test Coverage Gaps

**Telegram, config, and persistence:**
- What's not tested: Application startup, env binding, long polling, whitelist loaded from configuration, inserts, “stranger causes zero rows”.
- Files: `src/test/java/notesbot/` (only `access/AccessPolicyTest.java` and `bot/MessageHandlerTest.java`); no `src/test/resources/`
- Risk: The first real bot can reply to or store a non-whitelisted update while unit tests stay green.
- Priority: High

**Failure policy from the spec and `write-tests` skill:**
- What's not tested: Empty text, very long text, link with no title, duplicate link, LLM down or garbage output, unreachable page. The skill `.claude/skills/write-tests/SKILL.md` requires the note to be stored anyway, without tags or without a summary.
- Files: No production types exist for these cases.
- Risk: A later implementation will drop the user’s message when the model or HTTP call throws.
- Priority: High (write the failing tests at the start of F1–F3, not after)

**Digest schedule and search SQL:**
- What's not tested: Clock edge (midnight, timezone), grouping, empty day, word match versus substring, no network in unit tests.
- Files: None yet.
- Risk: Silent missed digest or search that only works in the mock (`playground/bot-mockup/tests/notes.spec.js`).
- Priority: Medium until F4/F5; High inside those steps.

**Build and format:**
- What's not tested: `spotless:check` is not bound to `verify`. No `.github/` workflow runs `./mvnw verify` or the Playwright suite.
- Files: `pom.xml`
- Risk: Style and mock regressions depend on a local hook and a human.
- Priority: Medium

**Mock e2e is not a substitute:**
- What's not tested: The Java bot. Playwright covers the static page only.
- Files: `playground/bot-mockup/tests/notes.spec.js`
- Risk: Reporting mock results as bot readiness.
- Priority: Low for the mock itself; do not extend it to cover server gaps.

---

*Concerns audit: 2026-11-03*
