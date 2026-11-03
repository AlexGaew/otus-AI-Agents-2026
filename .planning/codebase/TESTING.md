---
last_mapped_commit: 9e7c48e1eac417870637cd7e5be0aec4a3f1d9a3
last_mapped_at: 2026-11-03
---
# Testing Patterns

**Analysis Date:** 2026-11-03

## Test Framework

**Runner:**
- Bot unit tests: JUnit Jupiter, brought in by `spring-boot-starter-test` (parent `spring-boot-starter-parent` 4.1.1 in `pom.xml`). There is no explicit `junit-jupiter` version and no `surefire` plugin block; Surefire's default `*Test.java` includes `src/test/java`.
- Assertions: AssertJ (`org.assertj.core.api.Assertions.assertThat`). Hamcrest and raw `Assertions.assertEquals` are not used in Java tests. Do not add them.
- Mock UI: Playwright `@playwright/test` `^1.50.0` (`playground/bot-mockup/package.json`). Config: `playground/bot-mockup/playwright.config.js` (`testDir: ./tests`, `outputDir: ./test-results`, `reporter: 'list'`, `browserName: 'chromium'`).
- Hook unit tests: Python `unittest` from the standard library. No pytest, no `requirements.txt`.

**Assertion Library:**
- Java: AssertJ.
- Playwright: `expect` from `@playwright/test`.
- Python: `unittest.TestCase.assertIsNotNone` / `assertIsNone` with `subTest`.

**Run Commands:**
```bash
./mvnw test                                      # bot unit tests (JDK 21 required)
./mvnw verify                                    # full Maven verify
./mvnw spotless:check                            # format gate, not a test run
python3 .claude/hooks/test_block_bash_writes.py  # hook unit tests
cd playground/bot-mockup && npm test             # all Playwright e2e
cd playground/bot-mockup && npx playwright test -g "поиск без совпадений"  # one e2e
```

No Java watch mode is configured. No coverage command is configured. Playwright has no `npm run test:watch`. First-time mockup setup is `cd playground/bot-mockup && npm install && npx playwright install chromium` (`Agents.md`).

## Test File Organization

**Location:**
- Java: mirrored packages under `src/test/java/notesbot/`, not co-located with `src/main`.
  - `src/test/java/notesbot/access/AccessPolicyTest.java` tests `src/main/java/notesbot/access/AccessPolicy.java`.
  - `src/test/java/notesbot/bot/MessageHandlerTest.java` tests `src/main/java/notesbot/bot/MessageHandler.java`.
- Playwright: `playground/bot-mockup/tests/notes.spec.js` drives `playground/bot-mockup/index.html` via `file://`. This mockup is not the bot (`package.json` description). Do not put bot unit tests here.
- Hooks: `.claude/hooks/test_block_bash_writes.py` beside `block_bash_writes.py`.

**Naming:**
- Java class: `<Type>Test`. Method: camelCase behavior, no `test` prefix (JUnit 5).
- Playwright file: `<area>.spec.js`. Title: Russian behavior, feature id in parentheses when it maps to the TZ (`F1`…`F5`).
- Python: `test_<behavior>` on a `unittest.TestCase` subclass (`VerdictTest`).

**Structure:**
```
src/test/java/notesbot/<package>/<Type>Test.java
playground/bot-mockup/tests/*.spec.js
playground/bot-mockup/test-results/          # Playwright output; not source
.claude/hooks/test_block_bash_writes.py
```

New bot behavior gets a new method on the existing test class if it belongs to that type, or a new `*Test.java` in the matching package. Do not create `src/integrationTest` until there is a real database test, and do not point unit tests at PostgreSQL.

## Test Structure

**Suite Organization:**
```java
package notesbot.bot;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import notesbot.access.AccessPolicy;
import org.junit.jupiter.api.Test;

class MessageHandlerTest {

  private final MessageHandler handler = new MessageHandler(new AccessPolicy(Set.of(42L)));

  @Test
  void staysSilentForStranger() {
    var reply = handler.handle(7L, "привет");

    assertThat(reply).isEmpty();
  }
}
```

From `MessageHandlerTest` and `AccessPolicyTest`:
- Package-private class, no `@SpringBootTest`, no `@ExtendWith`, no `@Nested`.
- No `@BeforeEach` in the Java tests. A shared fixture may be a `private final` field when every test uses the same whitelist (`MessageHandlerTest`). When the fixture varies (empty set, null id), construct it inside the test (`AccessPolicyTest`).
- Given / when / then is visual, not commented: arrange, blank line, act, blank line, single `assertThat`. No `if`, loops, or `assert` chains that encode multiple behaviors (`.claude/rules/tests.md`, `.claude/skills/write-tests/SKILL.md`).
- One `@Test` method, one behavior. Whitelist coverage is four tests: member allowed, non-member denied, empty list denies, `null` sender denied.

Playwright (`notes.spec.js`):
```javascript
test.describe('макет бота «входящие»', () => {
  let problems;

  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    await page.goto(PAGE);
  });

  test.afterEach(() => {
    expect(problems, 'в консоли не должно быть ошибок').toEqual([]);
  });
});
```

- `beforeEach` opens a fresh `file://` page and starts console capture. `afterEach` asserts no console errors and no `pageerror`. Every new spec stays inside this describe so that check still runs.
- Helpers `send` and `lastBot` live at the top of the spec file. Reuse them; do not repeat `getByTestId('input').fill` plus click.

**Patterns:**
- Whitelist id `42L` is the allowed user; `7L` is the stranger. Keep those ids so tests read the same way.
- Assert the outcome the user would see: `isTrue` / `isFalse`, `isPresent` / `isEmpty`, `toContainText`, `toHaveText`, `toHaveAttribute`.
- `repliesToWhitelistedUser` only checks `isPresent()`. A test that cares about reply text must assert that text directly (`assertThat(reply).contains("...")`), not call order.
- TDD cycle is mandatory (`.claude/rules/tdd.md`): write the failing test, run it, then the minimum production code. Bug fixes start with a test that reproduces the bug. Do not delete or loosen an assertion to go green.
- `.claude/rules/run-tests-before-done.md`: a feature is not done until `./mvnw test` has been run and passed. If the run fails or tests do not exist yet, say so; do not claim the step was verified.
- `.claude/skills/review-step/SKILL.md` re-runs unit tests before a step is called mergeable and checks that tests were not weakened.

## Mocking

**Framework:** None in current tests. `spring-boot-starter-test` transitively includes Mockito, but no source file imports `org.mockito` or uses `@Mock` / `@SpringBootTest`. Do not introduce Mockito for types you can construct.

**Patterns:**
```java
private final MessageHandler handler = new MessageHandler(new AccessPolicy(Set.of(42L)));
```

Collaborators are real objects. When an LLM or HTTP client appears, hide it behind an interface and pass a hand-written stub that returns a fixed value or throws. Assert the note was still saved without tags or without a summary (`.claude/skills/write-tests/SKILL.md`). Do not `Mockito.verify` interaction order.

**What to Mock:**
- Telegram Bot API, the LLM HTTP client, and outbound fetches of user-supplied URLs. Unit tests must not open sockets (`.claude/rules/tests.md`).
- Clock or scheduler only when a digest test needs a fixed "now". Prefer injecting a `java.time.Clock` over mocking `ScheduledExecutorService`.

**What NOT to Mock:**
- `AccessPolicy` when testing `MessageHandler` — use a real policy with a known set.
- Value objects, `Set`, `Optional`, and pure functions.
- PostgreSQL. Unit tests do not start the database. A future SQL test is a separate integration test, not a unit test with a live server (`.claude/skills/write-tests/SKILL.md`). Testcontainers is not a dependency; do not add it without agreement.

Python hooks are tested by calling `verdict(cmd)` directly. Insert the hook directory on `sys.path` the same way `test_block_bash_writes.py` does. No filesystem or git subprocess is required for those cases.

## Fixtures and Factories

**Test Data:**
```java
var policy = new AccessPolicy(Set.of(42L));
assertThat(policy.isAllowed(null)).isFalse();
```

```python
BLOCKED = [
    "echo SECRET=1 >> .env",
    "cat .env",
]
ALLOWED = [
    "git status",
    "cat .git/config",
]
```

```javascript
async function send(page, text) {
  await page.getByTestId('input').fill(text);
  await page.getByTestId('send').click();
}
```

**Location:**
- No `src/test/resources`, no JSON fixtures, no factory classes.
- Java fixtures are inline `Set.of` and string literals.
- Python command lists are module-level constants in `.claude/hooks/test_block_bash_writes.py`. A new blocked or allowed command is a string in the matching list plus the existing parameterized `subTest`, not a new test method per command.
- Playwright sample notes and URLs live in the test body (`'купить молоко'`, `'https://spring.io/blog/java-21'`, `'/search spring'`, `'/digest'`).
- One spec writes `test-results/search.png` via `page.screenshot`. That directory is Playwright output (`outputDir`), not a fixture source. Do not assert on screenshot pixels.

Cases the write-tests skill requires once those features exist: empty text, very long text, a link with no title, the same link saved twice, stranger gets no reply and no row, LLM down or garbage response, link page failed to open. Each is its own test method.

## Coverage

**Requirements:** None enforced. No JaCoCo plugin in `pom.xml`, no coverage threshold, no Codecov config.

**View Coverage:**
```bash
# Not configured. Do not claim a coverage percentage.
./mvnw test
```

Review coverage by behavior, not by a number: whitelist allow, deny, empty list, null sender, silent stranger, reply to an allowed user. Untested today (no production code yet): persistence, tag suggestion, search, digest scheduling, Telegram update adapter, Spring context startup.

## Test Types

**Unit Tests:**
- Scope: pure Java types in `notesbot.*`, constructed with `new`. No Spring context, no network, no Telegram, no LLM, no PostgreSQL.
- Current suites: `AccessPolicyTest` (4 tests), `MessageHandlerTest` (2 tests).
- Also: Python `unittest` for `.claude/hooks/block_bash_writes.py` (`verdict` returns non-null to block, null to allow). `block_protected.py` and `check_after_edit.py` have no tests.

**Integration Tests:**
- Not used. `spring-boot-starter-jdbc` and the PostgreSQL driver are on the classpath, but nothing starts a database or loads `@SpringBootTest`. Do not "integration test" by pointing JDBC at a developer database from `src/test`.

**E2E Tests:**
- Playwright against the static mockup only. `playwright.config.js` does not set `baseURL` or a web server; the spec navigates to a `file:` URL of `index.html`.
- Selectors: `getByTestId` (`input`, `send`, `bot-message`, `tag`, `confirm`, `digest-group`) or a role/accessible name. `index.html` already exposes `data-testid` and `aria-label="Сообщение"`. Do not select by CSS class or by Russian copy in the layout chrome (`.claude/rules/tests.md`). Asserting bot reply text with `toContainText('Ничего не найдено')` is the expected behavior check, not a layout selector.
- The four tests: link save plus tag confirm plus search (F2, F3, F4); edit tags with `aria-pressed` before confirm (F1, F3); search with no hits (F4); digest grouped by tag (F5).
- `test-results/` is generated output. Do not commit it as a source of truth.

## Common Patterns

**Async Testing:**
```javascript
test('поиск без совпадений сообщает об этом (F4)', async ({ page }) => {
  await send(page, 'купить молоко');
  await page.getByTestId('confirm').click();

  await send(page, '/search java');
  await expect(lastBot(page)).toContainText('Ничего не найдено');
});
```

Java tests are synchronous. Do not add `CompletableFuture` assertions or `Thread.sleep`. Playwright uses `await` on `expect` auto-retry; do not add fixed timeouts.

**Error Testing:**
```java
@Test
void deniesUnknownSender() {
  var policy = new AccessPolicy(Set.of(42L));

  assertThat(policy.isAllowed(null)).isFalse();
}
```

```javascript
test.afterEach(() => {
  expect(problems, 'в консоли не должно быть ошибок').toEqual([]);
});
```

```python
def test_blocks_dangerous_commands(self):
    for cmd in BLOCKED:
        with self.subTest(cmd=cmd):
            self.assertIsNotNone(verdict(cmd), f"должна блокироваться: {cmd}")
```

- Access failure is a `false` or an empty `Optional`, not an exception. Do not write `assertThatThrownBy` for a stranger.
- When a later API throws (invalid config, SQL), assert the thrown type and the observable state (nothing saved, no reply) with AssertJ `assertThatThrownBy`. One failure mode per test.
- Browser failures are collected in `problems` and asserted in `afterEach`. A spec that expects a failed network call must not emit `console.error` unless the test clears that message before `afterEach`.
- Python uses `subTest` so one bad command does not hide the rest. Java parameterized tests (`@ParameterizedTest`, `@CsvSource`) are not used yet. Prefer separate `@Test` methods for distinct behaviors; use `@ParameterizedTest` only for the same behavior across inputs, and keep the method name a behavior phrase.

**What a new Java test must not do:**
- Call `https://`, the Telegram API, an LLM endpoint, or `localhost` Postgres.
- Boot the Spring context just to check a pure function.
- Assert private methods, argument captors, or the order of collaborator calls.
- Share a mutable list or set across tests. `Set.of` is immutable; if a test needs a mutable collection, create it inside the method.

---

*Testing analysis: 2026-11-03*
