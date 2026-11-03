---
last_mapped_commit: 9e7c48e1eac417870637cd7e5be0aec4a3f1d9a3
last_mapped_at: 2026-11-03
---
# External Integrations

**Analysis Date:** 2026-11-03

Declared integrations live in `pom.xml` and the product spec `ТЗ-telegram-bot.md`. Runtime wiring is not in the Java sources yet: there is no Spring Boot application class, no `src/main/resources`, and no calls from `src/main/java` to Telegram, JDBC, HTTP, or an LLM. `docs/plan.md` still has steps 2–7 open (skeleton through VPS deploy).

## APIs & External Services

**Messaging:**
- Telegram Bot API — inbound notes and links, replies, tag buttons, search results, and the daily digest (`ТЗ-telegram-bot.md` F1–F5).
  - SDK/Client: `org.telegram:telegrambots-client` `10.3.0` and `org.telegram:telegrambots-springboot-longpolling-starter` `10.3.0` in `pom.xml`. Long polling is the chosen transport (starter artifact name). No `org.telegram` import exists under `src/`.
  - Auth: bot token from the environment only (`AGENTS.md`, `.claude/rules/java-main.md`). The property or variable name is not defined in the repo. Do not commit it and do not log it.
  - Current stand-in: `notesbot.bot.MessageHandler` (`src/main/java/notesbot/bot/MessageHandler.java`) returns `Optional<String>` and does not call Telegram.

**Language model (specified, not integrated):**
- A cheap cloud LLM HTTP API for suggested tags and link summaries (`ТЗ-telegram-bot.md` section 5, step 4 in `docs/plan.md`).
  - SDK/Client: none in `pom.xml`. Provider is not chosen. Add a client only after agreement (`AGENTS.md`: do not change the stack without approval).
  - Auth: model API key from the environment only. Name not defined in the repo.
  - Required failure mode (`.claude/rules/java-main.md`): if the model fails, still save the note, without tags or without a summary. Isolate the client behind an interface so tests can stub it.

**Page fetch (specified, not integrated):**
- Public web pages for link title and short summary (`ТЗ-telegram-bot.md` F2).
  - SDK/Client: none. No HTTP client dependency in `pom.xml`.
  - Auth: none expected.
  - If the page is unreachable, save the link without a summary (`.claude/rules/java-main.md`).

**Agent-only browser (not a bot integration):**
- Playwright MCP — `.mcp.json` runs `npx @playwright/mcp@latest` so the coding agent can open the mockup. It is not used by the Java process.
- Playwright Test `1.64.0` drives `playground/bot-mockup/index.html` locally (`playground/bot-mockup/playwright.config.js`). No external site.

## Data Storage

**Databases:**
- PostgreSQL, intended to run in Docker (`ТЗ-telegram-bot.md`, `AGENTS.md`).
  - Connection: not configured. No JDBC URL, username, or password property is committed. Password must come from the environment when configuration is added.
  - Client: `org.postgresql:postgresql` (`runtime`) plus `spring-boot-starter-jdbc` in `pom.xml`. No `DataSource`, repository, schema, or migration tool. Do not delete or recreate PostgreSQL volumes without an explicit request (`AGENTS.md`).

**File Storage:**
- Local filesystem only for the mockup and docs (`playground/bot-mockup/`, `docs/`). Notes are specified to live in PostgreSQL, not on disk. No object storage.

**Caching:**
- None.

## Authentication & Identity

**Auth Provider:**
- Custom Telegram user-id allowlist. Not OAuth, not Telegram Login Widget.
  - Implementation: `notesbot.access.AccessPolicy` (`src/main/java/notesbot/access/AccessPolicy.java`) holds an immutable `Set<Long>` and `isAllowed` rejects `null` and unknown ids. `MessageHandler.handle` returns `Optional.empty()` for strangers so nothing is replied and nothing is stored (`src/main/java/notesbot/bot/MessageHandler.java`).
  - Policy (`.claude/rules/java-main.md`): every Telegram update must pass the allowlist before any other work. The allowlist is not loaded from config yet; tests pass `Set.of(42L)` in `src/test/java/notesbot/bot/MessageHandlerTest.java`.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry or similar dependency.

**Logs:**
- No logging framework usage in `src/`. When Spring Boot starts, use its default logging and never log the bot token, model key, or database password (`.claude/rules/java-main.md`).

## CI/CD & Deployment

**Hosting:**
- Not deployed. Spec target is a VPS in Docker after local development (`ТЗ-telegram-bot.md` section 5 and step 7). No `Dockerfile`, `compose.yaml`, or deploy scripts. `AGENTS.md` marks `./mvnw` plus PostgreSQL in Docker as TODO waiting on the TelegramBots bot and `compose.yaml` (step 2).

**CI Pipeline:**
- None. No `.github/workflows`. Checks are local: `./mvnw test`, `./mvnw verify`, `./mvnw spotless:check`, and `cd playground/bot-mockup && npm test`.

## Environment Configuration

**Required env vars:**
- Not named in code or committed config. The spec requires three secret kinds, all outside git: Telegram bot token, model API key, PostgreSQL password (`ТЗ-telegram-bot.md` section 6). Introduce Spring placeholders only when the skeleton (step 2) and later features need them. Do not put values in `application.yml`, `.env`, or compose files that are tracked.

**Secrets location:**
- Process environment at runtime.
- `.gitignore` ignores `.env` and `.env.*` plus `.claude/settings.local.json`.
- Hooks `.claude/hooks/block_protected.py` and `.claude/hooks/block_bash_writes.py` block writes and reads that touch `.env` paths. Do not print secret values into docs or logs.

## Webhooks & Callbacks

**Incoming:**
- None. Telegram is specified as long polling via `telegrambots-springboot-longpolling-starter` in `pom.xml`, not as an HTTPS webhook. No HTTP server starter (`spring-boot-starter-web`) is declared, and there is no controller.

**Outgoing:**
- None implemented. Planned outbound calls, once built: Telegram `sendMessage` (and inline keyboard) through TelegramBots, an LLM HTTP API for tags and summaries, and HTTP GET of user-supplied links for F2. No callback URLs are registered.

---

*Integration audit: 2026-11-03*
