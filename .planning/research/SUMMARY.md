# Project Research Summary

**Project:** notesbot — personal Telegram inbox bot
**Domain:** Single-user Telegram long-polling bot (notes, links, tag confirmation, word search, morning digest)
**Researched:** 2026-11-03
**Confidence:** MEDIUM

## Executive Summary

notesbot is a brownfield, single-owner Telegram inbox. The owner sends a note or a link; the bot stores it in PostgreSQL, asks a cheap model for tags, writes those tags only after inline-button confirmation, finds rows by whole words, and sends one morning digest of the previous calendar day. Experts build this as one Spring Boot process with long polling, not as a web app, webhook, or multi-service system. The HTML sketch in `playground/bot-mockup/` is not the product and must not be copied: it stores on confirm, tags from a keyword dictionary, searches with substring `includes`, and dumps the session on `/digest`.

The stack is locked by `ТЗ-telegram-bot.md` section 5 and `pom.xml`. Use Java 21, Spring Boot 4.1.1, TelegramBots 10.3.0 long polling (`SpringLongPollingBot`, not the 6.x `TelegramLongPollingBot` wiki sample), PostgreSQL in Docker, `JdbcClient`, JDK `HttpClient`, and Spring `@Scheduled` only at the digest step. Do not add dependencies. Step 1 of `docs/plan.md` (project folder, rules, hooks, memory) is already done. The roadmap is steps 2–7 of that plan, in that order: skeleton and owner-only reply, then F1+F2 save, F3 buttons, F4 search, F5 digest, then one VPS process. There are no differentiators and no v1.x backlog inside this milestone.

The main risks are a stranger write (the whitelist today sits only on the echo method), a dropped note when a page or the model fails, secrets in committed YAML or logs, and Postgres data loss from `latest`, the wrong volume path, or `docker compose down -v`. Mitigate by checking `AccessPolicy` before any I/O, inserting before enrichment, reading secrets only from the environment, and pinning `postgres:16` on a named volume at `/var/lib/postgresql/data`. A live boot of the 10.3.0 long-polling starter on Spring Boot 4.1.1 was not proven; do not "fix" that by downgrading either pin.

## Key Findings

### Recommended Stack

The classpath is already enough for steps 2–7. Versions below were resolved from this repo (`pom.xml` and `./mvnw dependency:tree` on Temurin 21) and checked against the Spring Boot 4.1.1 tag and the TelegramBots 10.3.0 jars. Do not bump Boot to 4.1.2, do not widen the enforcer off `[21,22)`, and do not move google-java-format off 1.28.0 (the 1.37.0 failure was not re-run here).

**Core technologies:**
- Java 21 (`[21,22)`): language and `java.net.http.HttpClient` for pages and the model — enforcer rejects anything else; no new HTTP library.
- Spring Boot 4.1.1 (Spring Framework 7.0.9): application, JDBC, and scheduling — parent already set; manages HikariCP 7.0.2, PostgreSQL driver 42.7.13, Jackson 2.21.5 via TelegramBots.
- TelegramBots 10.3.0 long-polling starter and client: receive `List<Update>` and send — `SpringLongPollingBot` plus `OkHttpTelegramClient` / `TelegramClient`. The starter POM builds against Boot 3.5.5; class presence on 4.1.1 was checked, runtime registration was not.
- PostgreSQL in Docker, driver 42.7.13, `JdbcClient`: durable notes — official image, named volume. No server major is locked in the repo; research recommends `postgres:16` with the 16/17 mount path, not `latest` (which tracks 18).
- Spring `@Scheduled` (spring-context 7.0.9): morning digest only — `@EnableScheduling` plus cron and `zone`. Do not enable it before plan step 6. Do not add Quartz.
- Maven Wrapper 3.9.11 / wrapper 3.3.4, Spotless 3.10.4, JUnit Jupiter 6.0.3: build and offline unit tests — `./mvnw test` and `./mvnw spotless:check`. Spotless is not bound to `verify`.

Supporting facts that must not become new dependencies: OkHttp 4.12.0 stays inside the Telegram client (`notesbot` must not import `okhttp3`). Jackson is already compile-scoped via `telegrambots-meta`. Avoid webhooks, `spring-boot-starter-web` / webmvc, H2, JPA, Spring Data JDBC, Flyway, Liquibase, Spring AI, LangChain4j, Jsoup, Testcontainers, Lombok, and `spring-boot-docker-compose`. `spring-boot-starter-restclient` is named in the Boot 4.1.1 BOM; its jar was not on disk, so its tree was not checked — do not add it without agreement.

### Expected Features

Scope is section 7 of the spec, in `docs/plan.md` order. All of it is P1. There is no P2. Section 4 is excluded, not deferred. No competitor products were surveyed.

**Must have (table stakes):**
- Whitelist before every reply, fetch, model call, or insert, including callback queries. Empty whitelist denies everyone. Silence, not an error string.
- F1 — trimmed text note with timestamp in PostgreSQL, before any tag discussion. Blank or non-text is not a note. Short Russian status; do not echo the body once save exists (step 2 may still return `Принято: ` plus text until a later test changes that line).
- F2 — a message that is entirely one `http` or `https` URL is a link. Title from the page, short summary from the model. Fetch failure still saves the URL. URLs inside prose stay F1 notes. "Entirely one URL" is a reading of the spec, not a spelled-out algorithm.
- F3 — after the insert, the model proposes tags; inline buttons toggle that set and confirm writes it. Model failure leaves the row with no tags. Unconfirmed suggestions are not searchable and do not form digest groups. Owner cannot type a new tag. `callback_data` is 1–64 bytes (Bot API page; webfetch tier LOW): note id plus action, not the tag text.
- F4 — `/search` plus a query. Case-insensitive whole-word match on text, title, and confirmed tags; several words all required. Empty query asks for a word; no hits say nothing was found. SQL, not an in-memory scan. Whole-word AND is a reading of sections 3–4, not an algorithm in the spec. The sketch's substring match is not acceptance.
- F5 — one `@Scheduled` job, previous calendar day in a configured zone (`[yesterday 00:00, today 00:00)`), grouped by confirmed tags (a note with two tags appears under both). Untagged notes under an untagged heading. One line when yesterday is empty so a dead job is visible — that empty-day line is a recommendation, not a sentence in the spec. The owner's zone and morning hour are not named; do not hard-code a city or use the JVM default. Catch-up of one digest if the process starts later the same local morning is recommended; multi-day backfill is not required and was not researched. Do not implement `/digest`.
- Restart keeps rows (named Postgres volume). Digest goes to the owner's private chat, remembered from an earlier allowed message. Whether `chat_id` always equals the user id was not verified.

**Should have (competitive):**
- None. Do not add a differentiator. Tag quality is not a feature; buttons fix a bad suggestion, and a failed call still keeps the note.

**Defer (v2+):**
- Nothing is postponed. These are refused until `ТЗ-telegram-bot.md` changes: tasks and reminders, voice/images/files, semantic/fuzzy/stemmed search, price watches, classifieds, fishing, more than one user, any UI that is not Telegram, `/digest`, keyword `KEYWORDS` tags, confirm-gated insert, Quartz or a handler loop, rich messages and Mini Apps.

### Architecture Approach

One Spring Boot process long-polls Telegram, runs `AccessPolicy` first, then a use case, then `JdbcClient`. PostgreSQL is a second container. The mock never shares a classpath with Java. `AccessPolicy` and `MessageHandler` stay plain objects; `@Configuration` wires them. The only production type that sees Telegram SDK types is the bot adapter (`SpringLongPollingBot`). Save the row, then enrich title, summary, and tags. `Optional.empty()` means "stranger, stay silent," not "fetch or model failed." Ports: `NoteRepository`, `PageFetcher`, `NoteModel` (`summarize` in step 3, `suggestTags` added in step 4 on the same interface), and `ChatSender` for the digest so digest does not depend on the adapter class. Packages are created only in the step that has a failing test. `@SpringBootApplication` sits in package `notesbot`. `schema.sql` is additive (`CREATE TABLE IF NOT EXISTS`), with `spring.sql.init.mode=always` once the script exists — the Boot 4.1.1 default `embedded` does not run it on PostgreSQL. Unit tests fake ports; they do not boot Telegram or Postgres.

**Major components:**
1. `AccessPolicy` — immutable whitelist; null and unknown ids denied; no I/O.
2. `MessageHandler` — text routing after the policy: note, link, later `/search`. No SQL or HTTP inside it.
3. Telegram adapter — `consume(List<Update>)`, send via `TelegramClient`, answer the owner's callback. Token from the environment. The starter does not register a client bean.
4. `NoteRepository` (`JdbcClient`) — insert first, then title, summary, confirmed tags, word search, and day range.
5. `PageFetcher` and `NoteModel` — JDK `HttpClient` behind interfaces; timeouts; failure does not roll back the insert. No vendor SDK. No vendor is chosen.
6. Tag confirmation — callback updates an already saved row; pending labels stored, not only in memory.
7. `MorningDigest` — `@Scheduled` with explicit `zone`, reads notes, sends through `ChatSender`. Not a command.
8. PostgreSQL — `postgres:16`, named volume, password from the environment only.

### Critical Pitfalls

1. **Whitelist only on the echo method** — One entry point runs `AccessPolicy` on `Message.getFrom()` or `CallbackQuery.getFrom()` before logging text, fetching, calling the model, or inserting. Ignore non-private chats until a later step has a reason. Empty or unparsable config denies everyone. Step 3 test asserts the repository was not called for a stranger. Re-check on callbacks (step 4) and `/search` (step 5).
2. **Secrets in git or logs** — Committed YAML and compose are not gitignored. Placeholders with no defaults. Do not log `BotSession` (10.3.0 `toString()` includes the token), the raw Bot API URL, headers, the model key, or note text at info level. Model key at step 4; VPS env at step 7.
3. **6.x bot sample, or a webhook / second poller** — Implement `SpringLongPollingBot` from the pinned jars. Do not import `TelegramLongPollingBot`, `DefaultBotSession`, or AbilityBot. Do not call `SetWebhook`. If a webhook might already be set, clear it with `DeleteWebhook` already in the 10.3.0 meta jar, then poll. One process. The starter was not booted on Boot 4.1.1; that mix stays unverified. Do not downgrade. The exact error for two `getUpdates` clients was not captured.
4. **Note dropped when the page or model fails, or I/O on the single update thread** — Insert first. `LongPollingSingleThreadUpdateConsumer` uses a static single-thread executor; a hung fetch stalls every later update. Timeouts, off that thread. Cap size and time. http(s) only; do not follow redirects onto non-public hosts (SSRF from the VPS).
5. **Postgres volume destroyed or schema never applied** — Pin `postgres:16`, named volume at `/var/lib/postgresql/data`. Official image docs (webfetch tier LOW) say 18 moved `PGDATA` and that `POSTGRES_PASSWORD` applies only on an empty data directory; `docker compose down -v` removes named volumes. Never wipe a volume to rotate a password or to re-run init. Idempotent `schema.sql` in the app, not only `docker-entrypoint-initdb.d`. Do not add H2 so the context starts. Do not publish 5432 on `0.0.0.0` on the VPS.

Also: do not build tags, search, or the digest before a note can be saved; do not port the mock's `KEYWORDS`; do not treat `npm test` as proof the bot works; `callback_data` over 64 bytes or an unanswered owner callback; search by concatenating SQL; digest with no zone, sent to a group, or silent on an empty day (the empty-day line is recommended, not specified). Unprocessed Telegram updates older than 24 hours are dropped by Telegram (webfetch tier LOW); rows already inserted are not. That quote is about the Bot API queue, not PostgreSQL.

## Implications for Roadmap

Based on research, suggested phase structure:

Step 1 of `docs/plan.md` is already done (project folder, `CLAUDE.md`, `AGENTS.md`, rules, skills, hooks, session memory). Do not reopen it as a phase. Phases below are plan steps 2–7. Do not insert a phase before step 2 and do not pull a later feature forward.

### Phase 1: Skeleton, env config, PostgreSQL, owner-only reply
**Rationale:** Plan step 2. Later flows have nowhere honest to write until a process, a database, and a whitelist on the real update path exist. `MessageHandler` today is not a Telegram boundary.
**Delivers:** `@SpringBootApplication` in package `notesbot`, env-backed `AccessPolicy` bean, one `SpringLongPollingBot` that calls `MessageHandler` and sends the optional string, `application.yml` keys only, root `compose.yaml` for PostgreSQL with a named `postgres:16` volume. A whitelisted private text gets a short reply; a stranger gets none. Keep `Принято: ` plus the text until a later test changes the owner-facing line. `staysSilentForStranger` stays empty.
**Addresses:** Whitelist on the live update path; restart-safe database process (volume created; the note table itself is Phase 2). Secrets and datasource URL from the environment. No default password.
**Avoids:** 6.x bot class, webhook, second poller, secrets in YAML or `BotSession` logs, `image: postgres` / `latest` / wrong PG 18 mount, `down -v`, H2, web starter, `@Scheduled`, model client, new Maven dependencies. Non-text must not become `Принято: null`. `JAVA_HOME` is JDK 21; format pin stays 1.28.0; run `spotless:check` even though it is not on `verify`.
**Uses:** Java 21, Boot 4.1.1, TelegramBots 10.3.0 starter, JDBC starter present but schema not applied yet.
**Implements:** `NotesBotApplication`, `BotConfiguration`, `TelegramPollingBot`. No `notes/`, `links/`, `model/`, `tags/`, `search/`, or `digest/` packages yet.

### Phase 2: F1 and F2, save notes and links
**Rationale:** Plan step 3. Tags, search, and the digest all read a row. The spec says "after saving."
**Delivers:** Idempotent `schema.sql` with `spring.sql.init.mode=always` (no `DROP`). Text note stored with timestamp. A single-URL message stores the URL; bounded page fetch fills title; `NoteModel.summarize` fills a short summary. Fetch or model failure leaves the row and still replies with a short status (saved, or saved without summary). Stranger causes no insert.
**Addresses:** F1, F2, failure-tolerant save. Prose that merely contains a URL stays a note.
**Avoids:** Confirm-gated insert, I/O on the single consumer thread, unbounded GET, SSRF to localhost or link-local, schema only in `docker-entrypoint-initdb.d`, repairing drift with `down -v`, echoing the full note, treating `/search` as a note.
**Uses:** `JdbcClient`, JDK `HttpClient`, Jackson already on the classpath, behind interfaces.
**Implements:** `notesbot.notes`, `notesbot.links`, `notesbot.model` with `summarize` only.

### Phase 3: F3 tags with button confirmation
**Rationale:** Plan step 4. Search and the digest read confirmed tags. The model port already exists from the summary, so this step adds `suggestTags` instead of a second HTTP stack.
**Delivers:** After insert, suggest tags, send an inline keyboard, edit it in place, write tags only on confirm. Pending labels survive restart on the row. `callback_data` is a short note id plus action. `AnswerCallbackQuery` for the allowed user, including an unknown note id. Stranger callback: no chat message, no write. Model failure: row stays, no buttons.
**Addresses:** F3. Unconfirmed tags stay out of search and digest.
**Avoids:** Mock `KEYWORDS`, free-typed tags, stuffing tag text into `callback_data`, saving tags before confirm, answering a stranger, a new LLM SDK. Vendor stays unchosen and behind `NoteModel`.
**Implements:** `notesbot.tags`, callback branch on the adapter. Widening `MessageHandler`'s return type is allowed here if buttons cannot be a string; it was not allowed in Phase 1.

### Phase 4: F4 word search
**Rationale:** Plan step 5. Rows and confirmed tags exist. Search must not ship before save.
**Delivers:** `/search` after the allow check. Parameterized case-insensitive whole-word match on text, title, and confirmed tags; all query words required. Not inserted as a note. Reply trimmed or split under the 4096-character `sendMessage` limit (Bot API quote, webfetch tier LOW).
**Addresses:** F4. No semantic search, stemming, fuzzy rank, or embeddings.
**Avoids:** Loading the table into the JVM, string-built SQL, the mock's `includes`, treating unconfirmed tags as matches.
**Implements:** Repository query. A `notesbot.search` package only if a query object is actually needed. Unit-test fake implements the same match in memory.

### Phase 5: F5 morning digest
**Rationale:** Plan step 6. Needs stored rows, confirmed tags, an untagged bucket, a remembered private chat id, and a zone. The clock is not a user command.
**Delivers:** `@EnableScheduling` and one `@Scheduled(cron, zone)` method. Previous calendar day in the configured zone, grouped by confirmed tag, untagged heading, one line per item. Send only to the owner's private chat via `ChatSender`. One line when the day is empty (recommended, not specified). At most one digest per local morning; if the process was down at the cron instant and starts later the same local day, send yesterday once (recommended). No backfill of older missed mornings.
**Addresses:** F5.
**Avoids:** `/digest` from the mock, a loop inside `MessageHandler`, JVM default zone, group chat, re-tagging history, missing `@EnableScheduling` (Boot wires the scheduler when that annotation is used; Context7 confidence MEDIUM). Default scheduler pool is one thread; do not add `@Async`. The zone and hour must be configuration, chosen when this phase is planned, not invented as a city in research.
**Uses:** `@Scheduled.zone` on spring-context 7.0.9. `spring.threads.virtual.enabled` stays unset.
**Implements:** `notesbot.digest`.

### Phase 6: VPS deploy
**Rationale:** Plan step 7. Section 7 is not met on the laptop. Deploy packages the finished process; it does not finish features.
**Delivers:** The same Spring Boot process and the same Postgres data on a VPS in Docker. One poller. Laptop poller stopped. No webhook left on the token. Secrets only in the host environment. Restart does not attach an empty volume. Postgres not published on `0.0.0.0`.
**Addresses:** "The same flow on a VPS." Restart does not drop the inbox. Document the 24-hour Telegram update retention as queue loss, not database loss.
**Avoids:** Recreating volumes, committing `.env`, changing the stack, a second poller, a public database port, `POSTGRES_HOST_AUTH_METHOD=trust`.

### Phase Ordering Rationale

- Step 1 is done. Phase 1 is the first code phase because the adapter and the policy are the only way later flows can talk to Telegram without a stranger write.
- The row (Phase 2) must exist before tags, search, or the digest can read it. Enrichment is an update, not a gate.
- Tags (Phase 3) precede search and the digest because both read confirmed tags, and the spec already places F3 before F4 and F5. Do not reorder to "ship search before tags."
- The model port appears in Phase 2 for the summary so Phase 3 does not invent a second HTTP client.
- Deploy is last. A digest of yesterday is impossible if rows lived in memory or only on the laptop.
- Each phase is red → green → refactor. `./mvnw test` stays free of network, Telegram, the model, and PostgreSQL. Playwright stays on the HTML sketch.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Boot the long-polling starter on Spring Boot 4.1.1. Compatibility is unproven (starter POM declares Boot 3.5.5). Also confirm `DeleteWebhook` only if a webhook is already set, and how a comma-separated allowlist binds into `new AccessPolicy(Set.copyOf(...))` — that binding was not executed. Do not downgrade if startup fails; record the failure and fix wiring with 10.3.0 types already on the classpath.
- **Phase 2:** http(s) fetch limits, redirect policy (JDK `HttpClient` default is `NEVER`), and what "enough HTML for a title" means without Jsoup. No model vendor is chosen; do not pick one in the roadmap.
- **Phase 3:** Button actions and pending-tag storage. Re-check `callback_data` (1–64 bytes) and `answerCallbackQuery` against the Bot API; those quotes are webfetch tier LOW. TelegramBots 10.3 Java method names were not part of the feature pass; the jars were inspected in stack and pitfalls research, but a button flow was not run.
- **Phase 5:** Owner timezone and morning hour are unspecified. Confirm whether private `chat_id` equals the user id when wiring `ChatSender` (unverified). Empty-day message and same-morning catch-up are recommendations, not spec sentences; decide them explicitly in the plan.
- **Phase 6:** One-process deploy, volume reuse, and stopping the laptop poller. No Telegram error code for two pollers was copied.

Phases with standard patterns (skip research-phase):
- **Phase 4:** Parameterized word SQL through `JdbcClient` on three columns. The match rule (whole word, AND) still needs a written decision, but the mechanism is ordinary JDBC, not a new integration.
- **Phase 2 schema mechanics:** Idempotent `schema.sql` plus `spring.sql.init.mode=always` is documented in the Boot 4.1.1 data-initialization guide. The open question is column shape, not the init switch.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions from `pom.xml`, `dependency:tree` on Temurin 21, Boot 4.1.1 tag, and 10.3.0 jars. MEDIUM only for live starter registration on Boot 4.1.1 and for the unreproduced google-java-format 1.37.0 failure. |
| Features | HIGH | In/out scope is the locked spec and `docs/plan.md`. MEDIUM for Telegram limits and Spring cron/`zone` (docs read; classifier does not upgrade webfetch). LOW for any market comparison — none was done. Several F2/F4/F5 behaviors are readings or recommendations, not algorithms in the spec. |
| Architecture | MEDIUM | Package boundaries and build order match the repo. Library wiring checked against Boot 4.1.0 docs (pom is 4.1.1; patch notes were not diffed) and TelegramBots `v10.3.0` sources. `dependency:tree` for a transitive web server was not run in the architecture pass (stack research did run it and saw no `spring-web`). `chat_id` vs user id unverified. |
| Pitfalls | HIGH | Traps verified in this repo and in the pinned 10.3.0 jars. MEDIUM for Context7 / Spring excerpts. Official Telegram, Postgres image, and Compose pages were read; `classify-confidence --provider webfetch` stays LOW, so those quotes stay citations. |

**Overall confidence:** MEDIUM

The locked stack, the refusal of extra features, and the phase order are solid. Overall stays MEDIUM because the riskiest integration (TelegramBots 10.3.0 starter on Spring Boot 4.1.1) has not been booted, and several product rules the roadmap will encode (whole-word AND, single-URL detection, empty digest line, same-morning catch-up, owner zone) are not written as algorithms in the spec.

### Gaps to Address

- **Starter on Boot 4.1.1:** Unverified at runtime. Phase 1 planning should boot one `SpringLongPollingBot` and must not downgrade Boot or TelegramBots without agreement.
- **`spring-boot-starter-restclient` transitives:** Not resolved. Do not add the starter.
- **`TaskSchedulingAutoConfiguration` condition:** The class is `@ConditionalOnBean`; which bean was not decoded. Context7 (MEDIUM) says the scheduler is set up when `@EnableScheduling` is used. Prove it in Phase 5 with a clock stub, not by assuming the bean name.
- **No LLM vendor:** Do not pick one in the roadmap. Keep URL and key in the environment behind `NoteModel`.
- **Owner zone and digest hour:** Unspecified. Choose in Phase 5 configuration and test that zone. Do not hard-code a city in research or in source as a silent default.
- **Whole-word match, AND of query words, and "message is a link only if it is one URL":** Readings of sections 3 and 4. Write them as acceptance tests in Phases 2 and 4; do not treat them as already proven.
- **Empty yesterday and same-day catch-up:** Recommended so section 7 is visible after a reboot. Not in the spec. Decide in the Phase 5 plan. Multi-day backfill stays out.
- **Private `chat_id` vs user id:** Unverified. Digest sends to the id remembered from an allowed private message; confirm against `Chat` when wiring `ChatSender`.
- **Comma-separated allowlist binding:** Not executed. The bean must still end in `new AccessPolicy`. An empty or unparsable value denies everyone.
- **google-java-format 1.37.0 and JDK 25:** Not re-run. The pin and the enforcer range are facts. Stay on 1.28.0 and JDK 21. This research saw `JAVA_HOME` pointing at a JDK 25 home; that failure was not executed.
- **Two simultaneous pollers:** No error code was captured. Still treat a second live poller as a broken deploy.
- **Spring Boot 4.1.1 vs the 4.1.0 doc tag:** Patch notes were not diffed. Prefer the 4.1.1 tag files the stack pass cited when a sentence disagrees.

## Sources

### Primary (HIGH confidence)
- `ТЗ-telegram-bot.md` (2026-10-12), sections 2–8 — locked scope, stack, secrets, order.
- `docs/plan.md` — step 1 done; steps 2–7 are the phases. Do not reorder.
- `.planning/PROJECT.md` (2026-11-03) — active work and out-of-scope list.
- `pom.xml`, `.mvn/wrapper/maven-wrapper.properties`, `./mvnw dependency:tree` on Temurin 21 (2026-11-03) — Boot 4.1.1, TelegramBots 10.3.0, driver 42.7.13, HikariCP 7.0.2, Jackson 2.21.5, OkHttp 4.12.0, JUnit Jupiter 6.0.3, Spotless 3.10.4, google-java-format 1.28.0, enforcer `[21,22)`.
- Spring Boot tag `v4.1.1` reference: `data/sql.adoc`, `features/task-execution-and-scheduling.adoc`, `how-to/data-initialization.adoc`, `features/external-config.adoc`.
- Local jars (2026-11-03): `telegrambots-*-10.3.0.jar` (`SpringLongPollingBot`, `TelegramBotStarterConfiguration`, `TelegramBotInitializer`, `LongPollingSingleThreadUpdateConsumer`, no `TelegramLongPollingBot` / `DefaultBotSession` / `AbilityBot`), `spring-context` 7.0.9 (`EnableScheduling`, `Scheduled.zone`), `spring-boot-sql` 4.1.1 (`spring.sql.init.mode` default `embedded`).
- This repo: `AccessPolicy`, `MessageHandler`, `MessageHandlerTest`, `.gitignore`, `AGENTS.md`, `.claude/rules/java-main.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONCERNS.md`.
- `playground/bot-mockup/index.html` and `tests/notes.spec.js` — HIGH as a description of the sketch, which must not become the bot.

### Secondary (MEDIUM confidence)
- Context7 `/spring-projects/spring-boot/v4.1.0` — scheduling and DataSource behavior that matches the 4.1.1 tag. Index did not list `v4.1.1`.
- Context7 `/rubenlagus/telegrambots` — wiki still shows `TelegramLongPollingBot`. Rejected as the wrong shape for 10.3.0.
- Spring Framework 7.0.5 scheduling doc (six-field cron, `zone`) and Spring Boot 4.1 scheduling page — parent is 4.1.1; framework jar on the tree is 7.0.9.
- `docs/memory.md` and `docs/memory-archive-2026-10-14-1.md` — 10.3.0 versus 6.9.7.1 material; format 1.37.0 recorded as failing. Cause not re-established here.
- Telegram Bot API and inline-keyboard feature page, read 2026-11-03 (`sendMessage` 1–4096, `callback_data` 1–64 bytes, `answerCallbackQuery`, getUpdates vs webhook, 24-hour retention). Classifier does not treat webfetch as HIGH; cited, not upgraded.
- JDK 21 `HttpClient` javadoc — default redirect policy `NEVER`.

### Tertiary (LOW confidence)
- Official Postgres image README and Docker Compose `down -v` page, read 2026-11-03 — `POSTGRES_*` only on an empty data directory, PG 18 `PGDATA` move, `latest` tracks 18, `down -v` removes named and anonymous volumes. Webfetch tier LOW.
- Market comparison of other inbox bots — not done. Do not treat this research as a survey.
- Two-poller Telegram error text — not captured.
- `chat_id` equals user id for a private chat — not verified.
- `spring-boot-starter-restclient` 4.1.1 transitive tree — jar was not on disk.

---
*Research completed: 2026-11-03*
*Ready for roadmap: yes*
