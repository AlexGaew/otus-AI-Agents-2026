---
last_mapped_commit: 9e7c48e1eac417870637cd7e5be0aec4a3f1d9a3
last_mapped_at: 2026-11-03
---
# Technology Stack

**Analysis Date:** 2026-11-03

## Languages

**Primary:**
- Java 21 — bot domain code under `src/main/java/notesbot/` and unit tests under `src/test/java/notesbot/`. Enforced by `maven-enforcer-plugin` in `pom.xml` (`requireJavaVersion` `[21,22)`).

**Secondary:**
- JavaScript (CommonJS) — UI mock and Playwright tests in `playground/bot-mockup/` (`index.html`, `playwright.config.js`, `tests/notes.spec.js`). Not part of the bot runtime.
- Python 3 — agent hooks only: `.claude/hooks/block_bash_writes.py`, `.claude/hooks/block_protected.py`, `.claude/hooks/check_after_edit.py`, and `unittest` in `.claude/hooks/test_block_bash_writes.py`. Not part of the bot runtime.
- HTML — static chat mock at `playground/bot-mockup/index.html`.

## Runtime

**Environment:**
- JDK 21 for the bot. `AGENTS.md` requires `JAVA_HOME` on JDK 21 (macOS: `/usr/libexec/java_home -v 21`). There is no `.java-version`, `.sdkmanrc`, or `.tool-versions`.
- Node.js `>=20` for the mockup, required by the locked Playwright engine in `playground/bot-mockup/package-lock.json`. No `.nvmrc`.
- Python 3 for hook unit tests (`python3 .claude/hooks/test_block_bash_writes.py`). Version is not pinned.

**Package Manager:**
- Maven 3.9.11 via the wrapper. `./mvnw` and `mvnw.cmd`; wrapper config `.mvn/wrapper/maven-wrapper.properties` (`wrapperVersion=3.3.4`, `distributionUrl` points at `apache-maven-3.9.11-bin.zip`).
- Lockfile: no Maven lockfile. Dependency versions for Spring-managed artifacts come from `spring-boot-starter-parent` `4.1.1` in `pom.xml`.
- npm for the mockup. Lockfile present: `playground/bot-mockup/package-lock.json` (lockfileVersion 3).

## Frameworks

**Core:**
- Spring Boot 4.1.1 (`org.springframework.boot:spring-boot-starter-parent`) — parent POM and `spring-boot-maven-plugin` in `pom.xml`. There is no `@SpringBootApplication` class and no `src/main/resources/application.yml` yet.
- `spring-boot-starter-jdbc` — declared in `pom.xml`. No repository, `DataSource`, or SQL usage in `src/`.
- TelegramBots 10.3.0 — `org.telegram:telegrambots-springboot-longpolling-starter` and `org.telegram:telegrambots-client` in `pom.xml`. No Java type imports these libraries yet. `MessageHandler` in `src/main/java/notesbot/bot/MessageHandler.java` is a plain class, not a bot.
- Spring `@Scheduled` is required by `ТЗ-telegram-bot.md` and `AGENTS.md` for the daily digest. It is not implemented and `spring-boot-starter` (scheduling) is not a direct dependency beyond what the JDBC starter pulls transitively. Do not add a scheduler until step 6 of `docs/plan.md`.

**Testing:**
- JUnit Jupiter and AssertJ — brought in by `spring-boot-starter-test` (`test` scope) in `pom.xml`. Tests use `org.junit.jupiter.api.Test` and `org.assertj.core.api.Assertions.assertThat` in `src/test/java/notesbot/access/AccessPolicyTest.java` and `src/test/java/notesbot/bot/MessageHandlerTest.java`. No explicit JUnit or AssertJ version in the POM.
- Mockito is on the test classpath via `spring-boot-starter-test` but is not used in the current tests.
- Playwright `@playwright/test` — declared `^1.50.0` in `playground/bot-mockup/package.json`, locked at `1.64.0` in `playground/bot-mockup/package-lock.json`. Config: `playground/bot-mockup/playwright.config.js` (Chromium, `testDir: ./tests`).
- Python `unittest` — `.claude/hooks/test_block_bash_writes.py`. No pytest, no `requirements.txt`.

**Build/Dev:**
- Maven Wrapper (`./mvnw`) — `test`, `verify`, `spotless:check`, `spotless:apply` (`AGENTS.md`).
- Spotless Maven plugin `3.10.4` with google-java-format `1.28.0` (`pom.xml`). Do not bump google-java-format to 1.37.0; `AGENTS.md` says that version fails.
- `maven-enforcer-plugin` — fails the build unless the JDK is Java 21.
- No Gradle, no Dockerfile, no `compose.yaml`. Docker PostgreSQL is specified in `ТЗ-telegram-bot.md` and still marked TODO in `AGENTS.md`.

## Key Dependencies

**Critical:**
- `org.springframework.boot:spring-boot-starter-jdbc` (version from parent 4.1.1) — future JDBC access. Not called from `src/main/java`.
- `org.postgresql:postgresql` (`runtime` scope, version from parent) — JDBC driver. No connection URL is committed.
- `org.telegram:telegrambots-springboot-longpolling-starter` `10.3.0` — long polling (not webhooks) once a bot class exists.
- `org.telegram:telegrambots-client` `10.3.0` — Telegram Bot API client.
- `org.springframework.boot:spring-boot-starter-test` — JUnit 5, AssertJ, Mockito, Spring Test.

**Infrastructure:**
- No ORM (no Spring Data JPA, no Flyway, no Liquibase) in `pom.xml`.
- No HTTP client for page fetch or an LLM SDK in `pom.xml`. `ТЗ-telegram-bot.md` requires a cheap cloud model API for tags and link summaries (steps 3–4 in `docs/plan.md`); that dependency is not chosen yet. Do not add it without agreement (`AGENTS.md`).
- Playwright `1.64.0` (devDependency of the mockup only) plus `@playwright/mcp@latest` in `.mcp.json` for the agent browser, not for the bot.

## Configuration

**Environment:**
- Committed application config: none. No `application.yml`, `application.properties`, or profile files under `src/main/resources`.
- Secrets must come from the process environment, never from git (`AGENTS.md`, `ТЗ-telegram-bot.md`, `.claude/rules/java-main.md`). `.gitignore` ignores `.env` and `.env.*`. Do not read or commit those files.
- The spec names the secret kinds (bot token, model API key, database password) but the repository does not yet define property keys or env var names. When configuration is added, bind them through Spring (`@ConfigurationProperties` or `application.yml` placeholders) and never log them.
- Whitelist of Telegram IDs is currently a constructor argument of `notesbot.access.AccessPolicy` (`src/main/java/notesbot/access/AccessPolicy.java`), not an external config file.

**Build:**
- `pom.xml` — coordinates `notesbot:notesbot:0.0.1-SNAPSHOT`, Java 21, Spring Boot parent 4.1.1.
- `.mvn/wrapper/maven-wrapper.properties` — Maven 3.9.11.
- `playground/bot-mockup/package.json` and `package-lock.json` — mockup only.
- `playground/bot-mockup/playwright.config.js` — e2e runner.
- `.mcp.json` — Playwright MCP for the coding agent.

## Platform Requirements

**Development:**
- JDK 21 on `JAVA_HOME`. `./mvnw test` for bot unit tests; `./mvnw verify` for the full Maven check; `./mvnw spotless:check` for format.
- Node.js 20+ and Chromium (`npx playwright install chromium`) only to run `cd playground/bot-mockup && npm test`.
- PostgreSQL in Docker is the intended database (`ТЗ-telegram-bot.md`) but is not set up: no `compose.yaml`.

**Production:**
- Target in `ТЗ-telegram-bot.md`: a VPS running Docker, so the bot stays up without the developer machine and restarts do not drop PostgreSQL data. No deploy manifests, images, or CI workflows exist (no `.github/`).
- Interface is Telegram only. `playground/bot-mockup/` is a teaching mock, not a frontend to deploy.

---

*Stack analysis: 2026-11-03*
