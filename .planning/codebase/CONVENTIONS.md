---
last_mapped_commit: 9e7c48e1eac417870637cd7e5be0aec4a3f1d9a3
last_mapped_at: 2026-11-03
---
# Coding Conventions

**Analysis Date:** 2026-11-03

## Naming Patterns

**Files:**
- Java production and tests: one public type per file, PascalCase matching the type. Package mirrors the directory under `src/main/java/` or `src/test/java/`. Examples: `src/main/java/notesbot/access/AccessPolicy.java`, `src/test/java/notesbot/bot/MessageHandlerTest.java`.
- Test class name is the production class plus `Test`. Do not use `*Tests`, `*Spec`, or a separate `tests/` tree for Java.
- Playwright: one spec file per surface, `*.spec.js`, under `playground/bot-mockup/tests/` (`notes.spec.js`).
- Python hook tests: `test_<module>.py` next to the hook, e.g. `.claude/hooks/test_block_bash_writes.py`.
- Identifiers in code are English. User-facing bot strings, class-level Javadoc, Playwright `test.describe` / `test()` titles, and assertion messages are Russian (`Agents.md`, `.claude/rules/java-main.md`).

**Functions:**
- Java methods: camelCase verbs. `AccessPolicy.isAllowed`, `MessageHandler.handle`.
- JUnit methods: camelCase behavior phrases, not the method under test. Use `allowsUserFromWhitelist`, `deniesUnknownSender`, `staysSilentForStranger` — not `testIsAllowed` or `handle_stranger`.
- Playwright tests: Russian sentence that states the behavior and, when it maps to the spec, the feature ids in parentheses, e.g. `'поиск без совпадений сообщает об этом (F4)'` in `playground/bot-mockup/tests/notes.spec.js`.
- Python: `snake_case`. Test methods start with `test_`.

**Variables:**
- Java locals: camelCase, prefer `var` when the constructor or method return type is obvious (`var policy = new AccessPolicy(...)`, `var reply = handler.handle(...)`).
- Fields: `private final`, camelCase (`allowedIds`, `accessPolicy`). No prefixes (`m_`, `_`).
- Constants in Python tests: `UPPER_SNAKE` lists of fixtures (`BLOCKED`, `ALLOWED` in `.claude/hooks/test_block_bash_writes.py`).
- Playwright helpers: short verbs (`send`) or noun selectors (`lastBot`).

**Types:**
- Classes and records (when added): PascalCase English nouns (`AccessPolicy`, `MessageHandler`).
- Packages: lowercase, one word per segment, rooted at `notesbot`. Current slices: `notesbot.access` (whitelist), `notesbot.bot` (incoming update handling). Add a new package under `notesbot` for a new responsibility; do not dump unrelated types into `notesbot.bot`.
- Do not use Hungarian prefixes or `I` for interfaces. An LLM client, when introduced, is an interface in its own package so tests can substitute a stub (`.claude/rules/java-main.md`).

## Code Style

**Formatting:**
- Java is formatted only by Spotless with google-java-format **1.28.0** (`pom.xml` properties `spotless.version` 3.10.4 and `google-java-format.version`). Do not bump google-java-format to 1.37.0; that version fails on this project (`Agents.md`).
- Check: `./mvnw spotless:check`. Fix: `./mvnw spotless:apply`. Do not hand-format against the plugin.
- Observed GJF layout (match it; the plugin rewrites deviations):
  - 2-space indent, no tabs.
  - Opening brace on the same line.
  - One blank line between methods. No blank line between fields and the constructor in the current types.
  - Static imports first, then a blank line, then other imports with no blank line between `java.*` and project packages (`MessageHandler.java`).
  - No wildcard imports.
- No Checkstyle, PMD, Error Prone, EditorConfig, Prettier, or ESLint config is present. JavaScript in `playground/bot-mockup/` is CommonJS (`require`), 2-space indent, single quotes, semicolons — match `playwright.config.js` and `tests/notes.spec.js`. Python hooks use 4-space indent.
- Java language level is 21 only. `maven-enforcer-plugin` execution `require-java-21` in `pom.xml` rejects anything outside `[21,22)`. Set `JAVA_HOME` to JDK 21 before `./mvnw`.

**Linting:**
- The Java gate is Spotless, not a semantic linter. `./mvnw verify` runs the default Maven lifecycle (compile, test, package) and does not by itself fail on format unless Spotless is bound; run `spotless:check` explicitly before calling Java done.
- There is no `src/main/resources` and no `application.yml` yet. When configuration appears, secrets (bot token, model key, database password) come from environment variables through Spring, never from committed YAML, `.env`, or compose files (`Agents.md`, `.claude/rules/java-main.md`). Do not log tokens or keys.

## Import Organization

**Order:**
1. Static imports (`import static org.assertj.core.api.Assertions.assertThat;`).
2. Blank line.
3. Remaining imports, single-class, as google-java-format orders them (java, then third-party, then `notesbot` — no extra blank lines).

**Path Aliases:**
- Not applicable. Java uses packages. The Playwright spec resolves the mock page with `path.resolve(__dirname, '..', 'index.html')` and `pathToFileURL`. No bundler aliases, no `jsconfig` / `tsconfig`.

## Error Handling

**Patterns:**
- Deny by outcome, not by exception, for access control. `AccessPolicy.isAllowed` returns `false` for an id outside the whitelist, an empty whitelist, and `null`. `MessageHandler.handle` returns `Optional.empty()` for a stranger and `Optional.of(...)` for an allowed sender. Callers must not send a Telegram reply or persist a note when the `Optional` is empty.
- Every Telegram update is checked against the whitelist before any reply or save (`.claude/rules/java-main.md`). `MessageHandler` takes `AccessPolicy` in the constructor; do not re-check IDs ad hoc inside later features — call `isAllowed` (or `handle`) first.
- Copy the whitelist with `Set.copyOf` so the policy does not share a mutable set with the caller (`AccessPolicy` constructor).
- When LLM or link-fetch code is added: a failure must not drop the user's note. Persist without tags or without a summary (`.claude/rules/java-main.md`, `.claude/skills/write-tests/SKILL.md`). Do not let those failures escape as an unhandled exception that skips the save.
- Do not catch `Exception` broadly to swallow failures. There is no custom exception hierarchy yet; add one only when a checked failure mode exists and a test asserts the observable result (saved-without-tags, empty reply), not the exception type alone.
- User-visible text is a complete Russian sentence or the current ack form `"Принято: " + text`. Do not mix English into bot replies.

## Logging

**Framework:** None in `src/main`. No SLF4J calls, no `System.out`.

**Patterns:**
- Do not add logs for the happy path of whitelist checks. When logging is introduced, use the Spring Boot SLF4J logger (`org.slf4j.LoggerFactory`) on the class, and never log the bot token, model API key, or database password.
- Playwright records browser `console` errors and `pageerror` into a list and asserts it is empty in `afterEach`. Do not `console.error` from mockup code under test.

## Comments

**When to Comment:**
- One short Russian Javadoc on the type when the type's rule is not obvious from the name: `AccessPolicy` ("всё, чего нет в списке, отклоняется"), `MessageHandler` ("постороннему не отвечает и ничего не сохраняет"). Do not comment each method that the name already describes.
- No TODO/FIXME trailers in `src/`. Inline comments are absent; do not narrate assignments.
- Python hook tests may use a one-line Russian assertion message (`"должна блокироваться: ..."`). `# noqa: E402` is only for the intentional path insert before import in `.claude/hooks/test_block_bash_writes.py`.

**JSDoc/TSDoc:**
- Not used. Playwright helpers are uncommented.

## Function Design

**Size:** Keep methods small enough that one JUnit test covers one behavior. `isAllowed` and `handle` are single-purpose. Do not grow `handle` into tag suggestion, search, and digest; those become separate types with their own tests.

**Parameters:** Constructor injection of collaborators (`MessageHandler(AccessPolicy)`). No field injection, no service locator. Methods take explicit inputs (`Long senderId`, `String text`) rather than a Telegram `Update` until the bot adapter exists. Whitelist ids are `Long` (Telegram user id), never `int`.

**Return Values:**
- Boolean for a pure policy (`isAllowed`).
- `Optional<String>` when the result is "reply or stay silent". Empty means no reply and no persistence. Do not return `null` strings or sentinel text for denial.
- Prefer `Set.copyOf` / immutable inputs over mutating collections passed in by the caller.

## Module Design

**Exports:**
- Production types are `public`. Test classes and `@Test` methods are package-private (no `public` on `AccessPolicyTest` or its methods). New tests stay package-private.
- No Spring beans, `@Configuration`, or application main class exist yet. When they are added, keep Telegram, LLM, and JDBC behind interfaces in `notesbot.*` and leave the framework wiring in a small configuration type. Domain types (`AccessPolicy`, `MessageHandler`) stay free of Spring annotations so unit tests construct them with `new`.
- Dependencies allowed today are declared in `pom.xml`: `spring-boot-starter-jdbc`, PostgreSQL driver (runtime), `telegrambots-springboot-longpolling-starter` and `telegrambots-client` 10.3.0, `spring-boot-starter-test` (test). Do not add libraries or change the stack without agreement (`Agents.md`).

**Barrel Files:** Not used. No `index.js` re-exports. Playwright imports `@playwright/test` directly.

## Project Skills That Constrain Style

- `.claude/skills/write-tests/SKILL.md`: one behavior per test, given / when / then, red before production code. Match neighboring tests instead of inventing a new style.
- `.claude/skills/review-step/SKILL.md`: a finished step must implement only its TZ slice, keep the whitelist on the entry path, keep secrets out of the tree, and not add dependencies.
- `.claude/rules/tdd.md`: red → green → refactor. Do not land production code that has no failing test first. Do not weaken or delete a test to make it pass.
- `.claude/rules/tests.md`: assert observable behavior, not call order or private methods. Playwright selectors are `data-testid` or role, never layout text or CSS classes.

---

*Convention analysis: 2026-11-03*
