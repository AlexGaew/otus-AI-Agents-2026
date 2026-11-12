---
last_mapped_commit: 9e7c48e1eac417870637cd7e5be0aec4a3f1d9a3
last_mapped_at: 2026-11-03
---
<!-- refreshed: 2026-11-03 -->
# Architecture

**Analysis Date:** 2026-11-03

## System Overview

Two independent programs share one repository. The product is a single-user Telegram inbox bot specified in `ТЗ-telegram-bot.md`. The Java side is a Spring Boot 4.1.1 / Java 21 Maven module (`pom.xml`, artifact `notesbot`) that today contains only plain domain classes. The UI sketch is a static page plus Playwright tests under `playground/bot-mockup/`. It does not call the Java process.

There is no `@SpringBootApplication` class, no `src/main/resources`, no `application.yml`, no `compose.yaml`, no Telegram long-polling bean, no JDBC repository, no LLM client, and no `@Scheduled` digest. Those are required by the spec and declared as dependencies or rules, but they are not in the tree. README status in `README.md` still says the bot code has not started; that sentence is stale relative to `src/main/java/notesbot/`.

```text
┌─────────────────────────────────────────────────────────────┐
│  Intended runtime (not present): Telegram long polling      │
│  spec: ТЗ-telegram-bot.md §5; starter in pom.xml            │
├──────────────────┬──────────────────┬───────────────────────┤
│  Access gate     │  Update handler  │  (not built)          │
│  `notesbot.access│  `notesbot.bot.  │  persistence, LLM,    │
│   .AccessPolicy` │   MessageHandler`│  fetch, digest        │
└────────┬─────────┴────────┬─────────┴───────────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Reply or silence: Optional<String>                          │
│  `src/main/java/notesbot/bot/MessageHandler.java`            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Separate: browser mockup (not wired to Java)               │
│  `playground/bot-mockup/index.html`                          │
│  in-memory `store[]`, keyword tags, /search, /digest        │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Maven / Spring Boot parent | Java 21, JDBC starter, PostgreSQL driver, TelegramBots 10.3.0, tests, Spotless, Java version enforcer | `pom.xml` |
| AccessPolicy | Immutable whitelist of Telegram user ids; null and unknown ids are denied | `src/main/java/notesbot/access/AccessPolicy.java` |
| MessageHandler | First gate on an inbound text update; strangers get no reply; allowed senders get a fixed acknowledgement | `src/main/java/notesbot/bot/MessageHandler.java` |
| AccessPolicyTest | Whitelist allow, deny, empty list, null sender | `src/test/java/notesbot/access/AccessPolicyTest.java` |
| MessageHandlerTest | Reply present vs empty | `src/test/java/notesbot/bot/MessageHandlerTest.java` |
| Spec | F1–F5, out of scope, stack, secret rules, build order | `ТЗ-telegram-bot.md` |
| Agent rules for bot code | Whitelist first, secrets from env, LLM behind an interface, failed fetch must not drop the note | `.claude/rules/java-main.md` |
| Chat mockup | Local simulation of save, tag toggle, search, digest | `playground/bot-mockup/index.html` |
| Mockup e2e | Playwright scenarios for F1–F5 against the HTML file | `playground/bot-mockup/tests/notes.spec.js` |

## Pattern Overview

**Overall:** Early layered slice inside a future Spring Boot process, plus an isolated front-end prototype. The Java slice is constructor-injected plain objects with no framework annotations. Tests new up the same objects.

**Key Characteristics:**
- Package root is `notesbot`. Subpackages split policy (`notesbot.access`) from update handling (`notesbot.bot`).
- The handler depends on the policy, never the reverse (`MessageHandler` imports `AccessPolicy`).
- Denial is absence of a reply (`Optional.empty()`), not an error string and not an exception.
- Allowed-user behaviour is a stub string `"Принято: " + text`. Nothing is stored.
- The mockup copies the product conversation (note, link, tags, `/search`, `/digest`) in one script with an in-page array. Do not import it into the bot or treat its keyword dictionary as the LLM.

## Layers

**Access:**
- Purpose: Decide whether a Telegram user id may be served.
- Location: `src/main/java/notesbot/access/`
- Contains: `AccessPolicy` only.
- Depends on: JDK `Set`. No Spring, no Telegram types.
- Used by: `notesbot.bot.MessageHandler` and `AccessPolicyTest`.

**Bot update handling:**
- Purpose: Turn `(senderId, text)` into an optional user-visible reply.
- Location: `src/main/java/notesbot/bot/`
- Contains: `MessageHandler` only.
- Depends on: `notesbot.access.AccessPolicy`.
- Used by: `MessageHandlerTest` only. No Telegram listener calls it yet.

**Build and runtime wiring (declared, not implemented):**
- Purpose: `pom.xml` pulls `spring-boot-starter-jdbc`, `org.postgresql:postgresql`, `telegrambots-springboot-longpolling-starter`, and `telegrambots-client`. The enforcer requires JDK `[21,22)`.
- Location: `pom.xml`, wrapper `mvnw` / `mvnw.cmd`.
- Contains: plugin config for `spring-boot-maven-plugin`, `maven-enforcer-plugin`, `spotless-maven-plugin`.
- Depends on: none of the current Java classes are Spring beans, so the starters are unused by source.
- Used by: future application class and tests. `./mvnw test` is the command in `AGENTS.md`.

**Browser mockup:**
- Purpose: Clickable spec of chat behaviour for Playwright. Banner in `index.html` states it is not the bot.
- Location: `playground/bot-mockup/`
- Contains: one HTML file, `playwright.config.js`, `tests/notes.spec.js`.
- Depends on: browser DOM and `@playwright/test` (devDependency in `playground/bot-mockup/package.json`).
- Used by: `npm test` in that directory. Not on the Maven classpath.

**Agent and process docs (not runtime):**
- Purpose: How code is added, not how the bot runs.
- Location: `AGENTS.md`, `CLAUDE.md`, `.claude/rules/`, `.claude/skills/write-tests/SKILL.md`, `.claude/skills/review-step/SKILL.md`, `docs/plan.md`, `docs/memory.md`.
- Contains: TDD, whitelist, and secret rules. `docs/plan.md` marks only step 1 done; step 2 (Spring skeleton, Docker PostgreSQL, bot replies only to the owner) is still open.

## Data Flow

### Primary Request Path

The path that exists is a method call, not an HTTP or Telegram callback.

1. Caller supplies a Telegram user id and text (`MessageHandler.handle`, `src/main/java/notesbot/bot/MessageHandler.java`).
2. `AccessPolicy.isAllowed` returns false for `null` or any id not in the copied set (`src/main/java/notesbot/access/AccessPolicy.java`).
3. If denied, `handle` returns `Optional.empty()` and does not read further side effects (there are none).
4. If allowed, `handle` returns `Optional.of("Принято: " + text)`. Text is not parsed, trimmed, or persisted.

There is no second step that sends the optional string to Telegram.

### Mockup message path

1. Form submit on `#composer` reads `[data-testid=input]` (`playground/bot-mockup/index.html`).
2. Empty text returns. Otherwise the user bubble is appended.
3. Text starting with `/search` goes to `search`; exact `/digest` goes to `digest`; anything else goes to `save`.
4. `save` builds an entry, shows suggested tags, and pushes into `store` only after the confirm button. Search and digest read `store`. Reload drops the array.

**State Management:**
- `AccessPolicy` stores an unmodifiable copy of the constructor set. No global registry.
- `MessageHandler` holds only the policy reference.
- Mockup state is the module-level `store` array and the DOM under `#chat` in `playground/bot-mockup/index.html`.

## Key Abstractions

**AccessPolicy:**
- Purpose: The only authorization rule: membership in a whitelist of `Long` Telegram ids.
- Examples: `src/main/java/notesbot/access/AccessPolicy.java`
- Pattern: Immutable value object. Construct with `Set.copyOf`. Call `isAllowed` before any reply or future write.

**MessageHandler:**
- Purpose: Application entry for one text update, expressed as `Optional<String>` so "do not answer" is a normal result.
- Examples: `src/main/java/notesbot/bot/MessageHandler.java`
- Pattern: Constructor injection of `AccessPolicy`. Keep Telegram SDK types out of this class until a dedicated adapter exists; tests construct it directly (`MessageHandlerTest`).

**Mockup entry:**
- Purpose: `{ text, title, tags, at }` held only until confirm, then in `store`.
- Examples: `save` in `playground/bot-mockup/index.html`
- Pattern: Not a Java type. Do not copy the keyword table `KEYWORDS` into production tag suggestion. Spec F3 requires a model behind an interface (`.claude/rules/java-main.md`).

## Entry Points

**MessageHandler.handle:**
- Location: `src/main/java/notesbot/bot/MessageHandler.java`
- Triggers: Unit tests in `src/test/java/notesbot/bot/MessageHandlerTest.java`. No `main`.
- Responsibilities: Whitelist check, then a placeholder reply.

**Maven Surefire (via Spring Boot parent):**
- Location: `pom.xml`, invoked as `./mvnw test` or `./mvnw verify` (`AGENTS.md`).
- Triggers: Developer or agent.
- Responsibilities: Runs JUnit 5 tests under `src/test/java`. No Spring context is started.

**Mockup page:**
- Location: `playground/bot-mockup/index.html`
- Triggers: Browser open, or Playwright `page.goto` of a `file:` URL in `playground/bot-mockup/tests/notes.spec.js`.
- Responsibilities: Simulate F1–F5 in the page. Config: `playground/bot-mockup/playwright.config.js` (`testDir: ./tests`, Chromium).

**Not entry points:**
- No `notesbot.NotesbotApplication` (or any other `@SpringBootApplication`).
- No `src/main/resources/application.yml`.
- No `compose.yaml` (called out as missing in `AGENTS.md` and `docs/about.md`).
- `mvnw` is the build launcher, not the bot process.

## Architectural Constraints

- **Threading:** Current classes are stateless aside from the immutable id set. No executors, no `@Async`, no scheduled tasks. Future digest must use Spring `@Scheduled` per `ТЗ-telegram-bot.md` §5, not a hand-rolled loop in `MessageHandler`.
- **Global state:** None in Java. Mockup uses script-level `store`, `chat`, and `KEYWORDS` in `playground/bot-mockup/index.html`.
- **Circular imports:** None. `notesbot.bot` → `notesbot.access` only.
- **Whitelist before I/O:** `.claude/rules/java-main.md` and `ТЗ-telegram-bot.md` §2: every future Telegram update must call `AccessPolicy` (or a successor that preserves this rule) before a reply, a database write, an HTTP fetch, or an LLM call. Strangers get silence, not an error message.
- **Secrets:** Token, model key, and database password come from the environment through Spring configuration. Do not add them to `application.yml`, `.env`, or compose files that are committed (`AGENTS.md`).
- **Failure isolation:** When F2/F3 exist, a failed page fetch or LLM call must still keep the note, without tags or without a summary (`.claude/rules/java-main.md`). That path does not exist yet; do not drop the text on the floor inside `MessageHandler` once persistence is added.
- **LLM boundary:** Model calls stay behind an interface so tests pass a stub (`.claude/rules/java-main.md`, `.claude/skills/write-tests/SKILL.md`). No such interface is in the repo.
- **Scope:** Do not add reminders, voice, images, semantic search, price monitoring, or multi-user from `ТЗ-telegram-bot.md` §4.
- **Stack lock:** Do not add dependencies beyond `pom.xml` / the spec without agreement (`AGENTS.md`). JDBC and Telegram starters are already approved and unused.
- **Single owner, `main`:** Work lands on `main` (`AGENTS.md`). That is process, not a runtime component.

## Anti-Patterns

### Answering or storing before the whitelist

**What happens:** A new Telegram adapter parses text, calls JDBC, or calls an LLM, then checks the sender.
**Why it's wrong:** `ТЗ-telegram-bot.md` §2 and `.claude/rules/java-main.md` forbid any reply or save for ids outside the list. `MessageHandler` already returns empty before building a reply.
**Do this instead:** Keep `accessPolicy.isAllowed(senderId)` as the first branch in the handler (see `src/main/java/notesbot/bot/MessageHandler.java`). Adapters may map Telegram `Update` to `(Long, String)` and then call `handle`.

### Putting Telegram, JDBC, or HTTP inside AccessPolicy

**What happens:** The policy grows bot tokens, repositories, or Spring annotations.
**Why it's wrong:** `AccessPolicy` is a pure set membership check so unit tests stay free of Telegram, network, and PostgreSQL (`.claude/rules/tests.md`).
**Do this instead:** Leave `src/main/java/notesbot/access/AccessPolicy.java` as a JDK type. Add a Spring `@Configuration` later that reads allowed ids from the environment and `new AccessPolicy(...)`.

### Treating the mockup as the bot or sharing its tag dictionary

**What happens:** Production tags come from the `KEYWORDS` array, or Playwright tests are pointed at a live bot.
**Why it's wrong:** `playground/bot-mockup/package.json` and the banner in `index.html` say the page is an exercise. Tags there are a word list; F3 requires a model. Search runs on unpersisted session memory and digest ignores calendar days (`digest()` comment in `index.html`).
**Do this instead:** Keep e2e in `playground/bot-mockup/tests/notes.spec.js` with `data-testid` selectors. Implement F1–F5 in `src/main/java/notesbot/` with JUnit stubs.

### Growing MessageHandler into the whole product

**What happens:** Link fetch, tag prompts, SQL, and the morning job are private methods of `MessageHandler`.
**Why it's wrong:** The class is the inbound text gate. F4 and F5 are different triggers (a search command and a schedule), and F2/F3 need replaceable clients.
**Do this instead:** Add new types under new packages when those features are built (for example `notesbot.notes` for storage, `notesbot.tags` for the model port, `notesbot.digest` for the scheduler). Wire them from the handler only after the access check. Do not create those packages until a failing test needs them.

## Error Handling

**Strategy:** Denial is a normal empty optional. No exceptions are thrown by current production code. Null sender id is denied, not NPE'd, in `AccessPolicy.isAllowed`.

**Patterns:**
- Stranger or unknown sender: `return Optional.empty()` in `MessageHandler.handle`. Callers must not send a message in that case.
- Allowed sender: `Optional.of(...)`. The string is user-facing Russian (`Принято: ...`), matching `AGENTS.md` (user-facing text in Russian, identifiers in English).
- Mockup: empty composer input returns without a bubble. `/search` with an empty query tells the user to pass a word. Search with no hits returns a not-found line. Empty digest says there were no entries (`playground/bot-mockup/index.html`).
- Future external failures (LLM, HTTP, database) are unspecified in code. When added, catch them at the client boundary, log without secrets, and still persist the user text (`.claude/rules/java-main.md`). Do not use an empty optional for those failures; empty means "not allowed to respond."

## Cross-Cutting Concerns

**Logging:** No logger in Java sources. Do not log bot tokens or model keys (`.claude/rules/java-main.md`).

**Validation:** Only `telegramId != null` and set membership. Message text is not validated. Mockup trims input and treats a full-string `http(s)` URL as a link (`isLink` in `index.html`).

**Authentication:** Whitelist of numeric Telegram ids held in memory by whoever constructs `AccessPolicy`. Tests use `42L` as the allowed id (`AccessPolicyTest`, `MessageHandlerTest`). No session, password, or OAuth. Production source of the set is not implemented; it must be environment configuration, not a hard-coded id in `src/main`.

**Persistence:** Not implemented. PostgreSQL driver and JDBC starter are on the classpath for the later Docker database. Unit tests must not open a real database (`.claude/skills/write-tests/SKILL.md`).

**Scheduling and outbound Telegram:** Not implemented. Digest in the mockup is the command `/digest`, which is a stand-in. The product digest is a morning `@Scheduled` job (`ТЗ-telegram-bot.md` F5), not only a user command.

---

*Architecture analysis: 2026-11-03*
