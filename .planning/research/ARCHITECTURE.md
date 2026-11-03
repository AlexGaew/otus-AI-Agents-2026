# Architecture Research

**Domain:** Single-user Telegram inbox bot (brownfield `notesbot`)
**Researched:** 2026-11-03
**Confidence:** MEDIUM

Package boundaries and the build order are fixed by the repo (`docs/plan.md`, `.planning/codebase/STRUCTURE.md`, the two existing types). Library wiring was checked against Spring Boot 4.1.0 reference docs (pom parent is 4.1.1) and the TelegramBots tag `v10.3.0` sources. A few runtime details were not re-verified; they are called out below and must not be treated as settled.

## Standard Architecture

One Spring Boot process. No web UI, no second service, no import of `playground/bot-mockup`. The process long-polls Telegram, gates every update on `AccessPolicy`, and only then saves, fetches, calls a model, searches, or sends. PostgreSQL is a separate container with a named volume. The HTML mock is a third program that never shares a classpath with Java.

What already exists stays. `AccessPolicy` remains a pure whitelist. `MessageHandler` remains the text use-case entry and still returns no reply for a stranger. Later features are collaborators constructed next to those types, not a replacement graph.

```
┌──────────────────────────────────────────────────────────────────┐
│ Telegram (long polling, already on the classpath)               │
│ SpringLongPollingBot  →  LongPollingUpdateConsumer.consume      │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Update list, inbound only
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ notesbot.bot  adapter (only type that sees Telegram SDK types)  │
│ maps text to MessageHandler; maps a button press to tags        │
│ sends only when a use case returns a reply                      │
└───────────────────────────────┬──────────────────────────────────┘
                                │ (senderId, text) or (senderId, callback)
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ AccessPolicy.isAllowed first                                    │
│ denied → Optional.empty / no save / no model / no fetch / no    │
│ answerCallbackQuery. Silence, not an error string.              │
└───────────────┬───────────────────────────────┬──────────────────┘
                │ allowed text                  │ allowed button
                ▼                               ▼
┌─────────────────────────────┐   ┌────────────────────────────────┐
│ MessageHandler              │   │ notesbot.tags (step 4)         │
│ note | link | /search       │   │ confirm or edit stored tags    │
└──────────────┬──────────────┘   └──────────────┬─────────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ notesbot.notes  NoteRepository (JdbcClient)                      │
│ insert first, then fill title, summary, confirmed tags          │
└───────▲──────────────────▲───────────────────────▲───────────────┘
        │                  │                       │
┌───────┴───────┐  ┌───────┴────────┐   ┌──────────┴───────────────┐
│ notesbot.links│  │ notesbot.model │   │ notesbot.digest (step 6) │
│ page fetch    │  │ interface only │   │ @Scheduled, previous day │
│ JDK HttpClient│  │ JDK HttpClient │   │ reads notes, sends out   │
└───────────────┘  └────────────────┘   └──────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ PostgreSQL in Docker. Named volume. schema.sql is additive.     │
│ Not in the unit-test process.                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ playground/bot-mockup  — browser only, not a dependency          │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `AccessPolicy` | Membership of a Telegram user id. Null and unknown ids are denied. | Existing plain class. `Set.copyOf` in the constructor. No Spring, JDBC, HTTP, or Telegram types. |
| `MessageHandler` | Text entry after the policy exists. Stranger → `Optional.empty()`. Owner → route note, link, or `/search`. | Existing plain class. Constructor gains collaborators only when a failing test needs them. Do not put SQL or HTTP here. |
| Telegram adapter | The only production type that touches `Update`, `SendMessage`, keyboards, and `AnswerCallbackQuery`. | `@Bean` implementing `SpringLongPollingBot` (`getBotToken`, `getUpdatesConsumer`). Token from the environment. Send with `OkHttpTelegramClient(token)` and `execute(BotApiMethod)`. The long-polling starter does **not** register a client bean. |
| `BotConfiguration` | Build the plain objects and read environment properties. | `@Configuration` under `notesbot.config`. `new AccessPolicy(...)`. No secrets written into yaml. |
| `NotesBotApplication` | Process entry. Component scan of `notesbot`. | `@SpringBootApplication` in package `notesbot`, not under `access` or `bot`. |
| `NoteRepository` | Insert and update one note, word search, notes in a time range, replace confirmed tags. | Interface in `notesbot.notes`. JDBC implementation uses auto-configured `JdbcClient`. Tests use a fake, not PostgreSQL. |
| `PageFetcher` | GET a link and return a title plus plain text, or a failure. | Interface in `notesbot.links`. JDK `java.net.http.HttpClient` with connect and request timeouts. No Jsoup and no `spring-boot-starter-web`. |
| `NoteModel` | Summarize page text and, later, suggest tags. | Interface in `notesbot.model`. One HTTP implementation. Tests pass a stub. Vendor stays behind the interface. |
| Tag confirmation | Turn a callback into a tag update on an already saved note. | `notesbot.tags`. Returns a small result. Does not send Telegram calls. |
| Digest | Previous local day, grouped by confirmed tags, sent to the owner. | `notesbot.digest`. `@Scheduled` method on its own bean. Calls a sender port, not `MessageHandler`. |
| PostgreSQL | Durable notes across restarts. | Official image in root `compose.yaml`, named volume. App talks through the JDBC starter already in `pom.xml`. |
| Mockup | Teaching copy of the chat. | Stays in `playground/bot-mockup`. Java must not read it. |

## Recommended Project Structure

Current tree plus the packages `STRUCTURE.md` already reserves. Create a package only in the step that has a failing test for it. Do not add empty feature packages in step 2.

```
src/main/java/notesbot/
├── NotesBotApplication.java     # step 2, package root
├── access/
│   └── AccessPolicy.java        # exists, leave as a JDK type
├── bot/
│   ├── MessageHandler.java      # exists, text routing
│   ├── TelegramPollingBot.java  # step 2, SpringLongPollingBot
│   └── ChatSender.java          # interface; digest and adapter share it from step 6
├── config/
│   └── BotConfiguration.java    # step 2, env → beans, @EnableScheduling only in step 6
├── notes/                       # step 3
│   ├── Note.java
│   ├── NoteRepository.java
│   └── JdbcNoteRepository.java
├── links/                       # step 3
│   ├── PageFetcher.java
│   └── HttpPageFetcher.java
├── model/                       # step 3 summarize; step 4 adds suggestTags
│   ├── NoteModel.java
│   └── HttpNoteModel.java
├── tags/                        # step 4
│   └── TagConfirmation.java
├── search/                      # step 5, query object only if the repository method is not enough
└── digest/                      # step 6
    └── MorningDigest.java

src/main/resources/
├── application.yml              # step 2, property keys only, values from the environment
└── schema.sql                   # step 3, CREATE TABLE IF NOT EXISTS, never DROP

src/test/java/notesbot/          # mirror of the same packages
compose.yaml                     # step 2, PostgreSQL only; bot service waits for step 7
```

### Structure Rationale

- **`notesbot` root:** `@SpringBootApplication` must sit here so scan covers `access`, `bot`, and every later package.
- **`access/`:** Already the gate. Growing it with I/O would force every unit test onto Telegram or PostgreSQL.
- **`bot/`:** Inbound mapping and outbound send. `MessageHandler` stays free of SDK types so `MessageHandlerTest` can keep constructing it with `new`.
- **`config/`:** The only place that reads the whitelist, token, database, zone, and model settings. Production code does not hard-code the test id `42L`.
- **`notes/`:** Owns the row. Search, tags, links, and digest call the repository. They do not open `JdbcClient` themselves.
- **`links/` and `model/`:** Separate ports so a failed fetch and a failed model are catchable without losing the insert. The model is not inside the fetcher: the spec uses the model for the summary and for tags, while the title comes from the page.
- **`tags/`, `search/`, `digest/`:** Different triggers (button, `/search`, clock). They do not become private methods of `MessageHandler`.
- **`playground/`:** Not on the Maven reactor. Its `KEYWORDS` list is not the tagger. Its `/digest` command is not F5.

## Architectural Patterns

### Pattern 1: Plain objects, Spring only at the edge

**What:** `AccessPolicy` and `MessageHandler` stay constructor-injected JDK objects. `@Configuration` builds them. The polling bot is the framework adapter.
**When to use:** Every step. Unit tests already `new` these types and must keep doing that.
**Trade-offs:** A bit of manual `@Bean` wiring. In return, tests do not boot Spring, do not need Testcontainers, and do not gain a dependency. `@SpringBootTest` against a live database is out of bounds for unit tests.

**Example:**
```java
@Configuration
public class BotConfiguration {
  @Bean
  AccessPolicy accessPolicy(BotProperties properties) {
    return new AccessPolicy(properties.allowedIds());
  }

  @Bean
  MessageHandler messageHandler(AccessPolicy accessPolicy) {
    return new MessageHandler(accessPolicy);
  }
}
```

Step 3 adds repository, fetcher, and model parameters to that second factory method. It does not add `@Component` onto `AccessPolicy`.

### Pattern 2: Save, then enrich

**What:** For an allowed note or link, insert the row before any page fetch or model call. Enrichment updates nullable columns. Failure leaves the row in place.
**When to use:** F1, F2, and F3. This is the opposite of the mockup, which pushes into `store` only after the confirm button.
**Trade-offs:** A crash during fetch still keeps the text. Unconfirmed notes show up in search and in the digest under «без тегов» until the owner presses a button. That matches the failure rule. Waiting to insert until the model returns would drop the note when the model is down.

**Example:**
```java
public Optional<String> handle(Long senderId, String text) {
  if (!accessPolicy.isAllowed(senderId)) {
    return Optional.empty();
  }
  if (isSearch(text)) {
    return Optional.of(search.describe(text));
  }
  Note saved = notes.insert(text, clock.instant());
  links.tryFill(saved);   // catch inside; never throw away saved
  return Optional.of("Принято: " + text);
}
```

`links.tryFill` may call `NoteModel.summarize`. A thrown IO exception or a model error is swallowed at that boundary, logged without secrets, and not mapped to `Optional.empty()`. Empty still means "this sender gets silence."

### Pattern 3: Ports for anything the unit tests must not call

**What:** `NoteRepository`, `PageFetcher`, `NoteModel`, and `ChatSender` are interfaces. Production implementations are the only classes that use `JdbcClient`, `HttpClient`, or `TelegramClient`.
**When to use:** As soon as the step needs I/O. The model interface appears in step 3 because F2's summary uses the model. Step 4 adds `suggestTags` to that same interface instead of a second client.
**Trade-offs:** One extra type per boundary. Avoids new libraries (no Spring AI, no Jsoup, no JPA, no Testcontainers) and keeps `./mvnw test` offline.

**Example:**
```java
public interface NoteModel {
  Optional<String> summarize(String pageText);

  List<String> suggestTags(String text);
}
```

`suggestTags` is not implemented, and not called, before step 4. A stub in tests returns a fixed summary or throws, and the assertion is that the note still exists.

### Pattern 4: Callback payload is an id, not the note

**What:** Inline buttons carry `callback_data` of at most 1–64 bytes (Bot API field on `InlineKeyboardButton`). Put a note id and a short action (`ok`, `edit`, a tag index), not the note text and not the tag label.
**When to use:** Step 4 only.
**Trade-offs:** The proposed labels must live on the note row (a pending column or pending rows), not only in memory, or a restart between suggestion and confirm forgets which button meant which tag. Confirmed labels are a separate `note_tag` set. Search and digest read confirmed tags only.

The owner's client shows a spinner until `answerCallbackQuery`. For the allowed user, the adapter always calls it, with no notification text. For a stranger, do not call it and do not write: silence beats dismissing a button the stranger should not have. The spinner on a forged callback is acceptable.

### Pattern 5: Scheduler is not a command

**What:** F5 is a `@Scheduled` method with a six-field Spring cron and an explicit `zone`. `@EnableScheduling` is added on the configuration class in step 6.
**When to use:** Step 6, after notes and tags exist.
**Trade-offs:** The default scheduler is one thread. One morning job for one user does not need `@Async` or a pool. The digest bean depends on `NoteRepository` and `ChatSender`, not on `MessageHandler`, so a tick cannot be mistaken for an inbound update and cannot skip the "no user message" path.

Day boundary is `[yesterday 00:00, today 00:00)` in the configured zone. Do not use the JVM default on the VPS, and do not use a rolling 24 hours. The mock's `/digest` command is not this feature. Do not add that command.

## Data Flow

### Request Flow

```
Telegram getUpdates
    ↓
TelegramPollingBot.consume(List<Update>)
    ↓
text?  → MessageHandler.handle(senderId, text)
              ↓
         AccessPolicy.isAllowed
              ↓ no                         ↓ yes
         Optional.empty()             /search → repository query → reply text
         adapter sends nothing        link    → insert → fetch → summarize → update
                                      note    → insert → reply «Принято: …»
    ↓
button? → TagConfirmation (isAllowed again) → update confirmed tags
              ↓ allowed                         ↓ denied
         answerCallbackQuery               send nothing, write nothing
    ↓
clock → MorningDigest → repository by zone-day → ChatSender → execute(SendMessage)
```

Direction is inward from Telegram to the policy, then to a use case, then to the repository or a port. Replies travel back only through the adapter. The repository never calls the policy, the model, or Telegram. The model never calls Telegram. The mockup never calls Java.

### State Management

```
Environment (token, allowed ids, datasource, model key, zone)
    ↓ read once at startup by notesbot.config
AccessPolicy (immutable set)
JdbcNoteRepository (no cache)
PostgreSQL volume (source of truth)
```

There is no session and no in-memory note list in production. `MessageHandler` holds collaborators, not notes. Pending tag labels are columns or rows, so a restart does not delete the note. Confirmed tags change only on an allowed callback. The digest does not write tags.

`42L` remains a test fixture in `AccessPolicyTest` and `MessageHandlerTest`. It is not a production default.

### Key Data Flows

1. **Stranger text or button:** Policy denies. No insert, no fetch, no model, no `SendMessage`, no `AnswerCallbackQuery`. The optional stays empty. Do not substitute a "доступ запрещён" string.
2. **Owner note (F1, step 3):** Insert body and `created_at` (server `Instant`). Reply `Принято: ` plus the text. No tags yet.
3. **Owner link (F2, step 3):** Same insert, with the URL stored. Then `PageFetcher`. On success, store the `<title>` from a bounded scan of the HTML (no Jsoup). Then `NoteModel.summarize`. On success, store the summary. If the fetch fails, title and summary stay null and the reply still confirms the save. If only the model fails, keep the title when it was parsed.
4. **Tags (F3, step 4):** After the insert, `suggestTags`. On success, send an inline keyboard whose `callback_data` is note id plus action. On model failure, the row stays, no buttons, the owner still got the accept reply. Confirm writes `note_tag` and clears the proposal. Edit replaces the proposal; it does not delete the note.
5. **Search (F4, step 5):** `/search` is not inserted as a note. Split the query on whitespace and match every word, case-insensitive, against body, title, and confirmed tags. A repository method does the match. The fake in unit tests implements the same match in memory. No embeddings.
6. **Digest (F5, step 6):** Load notes whose `created_at` falls on the previous day in the configured zone. Group in Java by confirmed tag. Notes with none go to one «без тегов» group. `ChatSender` sends one message to the single allowed id. A send failure is logged and does not delete rows.
7. **Startup (step 2):** `TelegramBotInitializer` registers every `SpringLongPollingBot` with `TelegramBotsLongPollingApplication`. Missing `spring.datasource.url` makes Boot look for an embedded database that this pom does not have, so the URL must come from the environment whenever the process starts. `schema.sql` does not run on PostgreSQL unless `spring.sql.init.mode=always`, and that switch waits until step 3.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | This product is one user. One process, one Postgres container, synchronous fetch with timeouts, one scheduler thread. Do not split modules into services. |
| 1k-100k users | Out of scope (`ТЗ` §4, one whitelist). The first real limit would be long polling plus blocking HTTP inside `consume`, not SQL. |
| 100k+ users | Not a goal. Webhooks, a job queue, and a pool would be a different product. |

### Scaling Priorities

1. **First bottleneck:** A hung page or model call inside `consume` stalls the next update. Bound both with `HttpClient` connect and request timeouts. Catch failures and keep the row. Do not add `@Async` for one user.
2. **Second bottleneck:** None at this size. `JdbcClient` and a named volume are enough. Do not introduce a cache, JPA, or a second database.

## Anti-Patterns

### Anti-Pattern 1: Extending `TelegramLongPollingBot` and calling `execute()` on the bot

**What people do:** Copy the TelegramBots wiki "Getting Started" sample (`onUpdateReceived`, `getBotToken` on the bot subclass).
**Why it's wrong:** That sample is the pre-rewrite API. `telegrambots-springboot-longpolling-starter` 10.3.0 registers a `SpringLongPollingBot` and delivers `List<Update>` to `LongPollingUpdateConsumer.consume`. The starter's `TelegramBotStarterConfiguration` does not create a sender. Context7's wiki hits still show the old shape.
**Do this instead:** Implement `SpringLongPollingBot`. Send through `OkHttpTelegramClient` and `TelegramClient.execute`. Keep that client inside the adapter.

### Anti-Pattern 2: Work before the whitelist

**What people do:** Parse the URL, open JDBC, or call the model, then check the sender. Or answer a stranger with an error string.
**Why it's wrong:** `ТЗ` §2 and `.claude/rules/java-main.md`. `MessageHandler` already returns empty before building a reply.
**Do this instead:** `isAllowed` is the first branch in `handle` and in the callback use case. The adapter does not call a use case that skips the check.

### Anti-Pattern 3: Using `Optional.empty()` for a failed fetch or model

**What people do:** Treat every failure as "say nothing."
**Why it's wrong:** Empty means the sender is not allowed to be answered. The owner would think the bot ignored a note that was actually saved, or the note would never be saved.
**Do this instead:** Insert first. On enrichment failure, still return the accept reply. Log the failure without the token or the model key.

### Anti-Pattern 4: Confirm-then-save, copied from the mockup

**What people do:** Hold the note in a field until the owner presses confirm, as `index.html` does with `store`.
**Why it's wrong:** A model outage or a restart before the click drops the text. The spec says the opposite: save even when the model fails.
**Do this instead:** Insert, then offer buttons. Confirmed tags are an update.

### Anti-Pattern 5: New libraries or a web server

**What people do:** Add Spring AI, JPA, Flyway, Jsoup, Testcontainers, or `spring-boot-starter-web` so the bot "has a port."
**Why it's wrong:** `AGENTS.md` forbids new dependencies without agreement. The pom already has JDBC, the PostgreSQL driver, and both TelegramBots artifacts. Page fetch and the model HTTP call are `java.net.http.HttpClient` (JDK 21). Schema is `schema.sql`. Unit tests fake the ports.
**Do this instead:** Stay on that classpath. Do not add the web starter. If some transitive jar ever starts a server, set `spring.main.web-application-type=none`. That was not observed in this pass; do not add the property speculatively in step 2 unless a port actually binds.

### Anti-Pattern 6: Destructive database ops

**What people do:** `DROP TABLE` in `schema.sql`, `docker compose down -v`, or a fresh volume on each deploy.
**Why it's wrong:** Restart must keep the notes (`ТЗ` §6). Volumes are not recreated without an explicit user request.
**Do this instead:** `CREATE TABLE IF NOT EXISTS`. Named volume in `compose.yaml`. Step 7 publishes the same volume. Compose may reference `${POSTGRES_PASSWORD}` but must not contain the password.

### Anti-Pattern 7: Pulling F3–F5 into the skeleton

**What people do:** Ship tags, search, or the cron in step 2 because the classes are "small."
**Why it's wrong:** `docs/plan.md` locks the order. Step 2 is the process, env config, Postgres connection, and a live reply only to the owner.
**Do this instead:** Follow the build order below. `MessageHandler` in step 2 still returns `Принято: ` plus the text and still saves nothing.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Telegram Bot API | Long polling via `SpringLongPollingBot`. Outbound via `OkHttpTelegramClient(String botToken)` and `execute`. | Token only from the environment. One bot bean. Do not log the token. `answerCallbackQuery` for the owner even when the notification text is blank. `callback_data` is 1–64 bytes. |
| Web pages (F2) | `HttpClient.send` behind `PageFetcher`. Follow redirects only if the builder asks (`Redirect.NORMAL`); the JDK default client does not follow redirects. | Timeouts required. Non-200 or IOException → note already saved, title and summary empty. Do not fetch for a stranger. |
| Cloud model | One `HttpNoteModel` behind `NoteModel`. URL and key from the environment. | Used for summary (step 3) and tags (step 4). No vendor SDK. Failure does not roll back the insert. |
| PostgreSQL | `spring.datasource.url` / username / password from `SPRING_DATASOURCE_*`. `JdbcClient` auto-configured by `spring-boot-starter-jdbc`. | No JPA. `spring.sql.init.mode=always` only once `schema.sql` exists (step 3), or Boot will not run the script on a non-embedded database. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Adapter → `MessageHandler` | Direct call, `(Long, String)` → `Optional<String>` | Step 2 keeps this signature. Step 4 may widen the return type when a test needs buttons. Do not widen it in step 2. |
| `MessageHandler` → `AccessPolicy` | Direct call, first line | Already true. Never invert. |
| `MessageHandler` → `NoteRepository`, `PageFetcher`, search | Direct call after allow | Step 3 and step 5. Constructor injection. |
| `links` → `NoteModel` | `summarize` only | Step 3. Tags must not call this path. |
| `tags` → `NoteModel` + `NoteRepository` | `suggestTags`, then update | Step 4. No Telegram types in `tags`. |
| `digest` → `ChatSender` | Interface in `notesbot.bot`, implemented by the adapter | Avoids a cycle: digest does not depend on the adapter class, the adapter does not depend on digest. |
| `config` → all of the above | `@Bean` factories | Only layer that sees environment values. |
| Java ↔ `playground/bot-mockup` | None | Playwright stays a file URL against `index.html`. |

## Build Order

Matches `docs/plan.md` steps 2–7. Do not insert a phase before step 2 and do not pull a later feature forward. Each step is red → green → refactor. `./mvnw test` stays free of network, Telegram, the model, and PostgreSQL.

| Step | What is added | What is deliberately absent |
|------|----------------|-----------------------------|
| 2. Skeleton | `NotesBotApplication`, `BotConfiguration`, env-backed `AccessPolicy` bean, `TelegramPollingBot` that calls `MessageHandler` and sends the optional string, root `compose.yaml` for PostgreSQL with a named volume, `application.yml` keys only. The live bot replies only to the owner. | Note table, fetch, model, buttons, search, `@Scheduled`, bot service in compose, any new Maven dependency. |
| 3. F1 and F2 | `notesbot.notes`, `schema.sql` (`spring.sql.init.mode=always`, no DROP), `notesbot.links`, `notesbot.model` with `summarize` only. Insert then enrich. Stranger still causes no insert. | Tag buttons, `/search` persistence, digest. |
| 4. F3 | `suggestTags` on the existing model port. `notesbot.tags`. Callback path on the adapter. Pending labels stored on the row. Keyboard `callback_data` is an id plus an action. | Search command, cron. Do not delay the insert until confirm. |
| 5. F4 | `/search` branch in `MessageHandler` after the allow check. Repository word match on body, title, confirmed tags. A search is not saved as a note. | Semantic search, digest. |
| 6. F5 | `notesbot.digest`, `@EnableScheduling`, cron with `zone`, `ChatSender`. Group the previous local day by confirmed tag. | A `/digest` command copied from the mock. Hand-rolled `while(true)` in `MessageHandler`. |
| 7. VPS | Run the same process and the same Postgres volume in Docker on the VPS. Secrets stay in the host environment. Restart does not load a new empty volume. | Recreating volumes, committing `.env`, changing the stack. |

**Why this order:** The adapter and the policy are the only way later flows can talk to Telegram without a stranger write. The row must exist before tags, search, or the digest can read it. Tags land before search and the digest because both read confirmed tags, and the spec already places F3 before F4 and F5. The model port is introduced for the summary so step 4 does not invent a second HTTP stack. Deploy is last because it packages the finished process; it is not a place to finish features.

**Step 2 and the current tests:** `repliesToWhitelistedUser` only asserts that the optional is present. Keep returning `Принято: ` plus the text until a later test specifies a different owner-facing line. `staysSilentForStranger` must remain empty after every step.

**Signature change:** Widening `handle`'s return type is allowed in step 4 when buttons cannot be expressed as a string. It is not allowed in step 2. The access check and the empty-for-stranger result stay.

## Sources

- Repo: `ТЗ-telegram-bot.md` (2026-10-12), `docs/plan.md`, `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `pom.xml` (Spring Boot 4.1.1, TelegramBots 10.3.0), `AccessPolicy`, `MessageHandler`. Confidence in those constraints: high; they were read from this workspace.
- Spring Boot 4.1.0 reference (JdbcClient auto-config, `spring.datasource.*`, `schema.sql` only for embedded databases unless `spring.sql.init.mode=always`, relaxed environment binding, `spring.main.web-application-type`): https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/data/sql.adoc and the data-initialization / external-config how-tos. Seam confidence for Context7: MEDIUM. Patch version in the pom is 4.1.1, not the 4.1.0 doc tag.
- Spring Framework 7.0.5 scheduling (`@EnableScheduling`, six-field cron, `zone`): https://github.com/spring-projects/spring-framework/blob/v7.0.5/framework-docs/modules/ROOT/pages/integration/scheduling.adoc. Seam confidence: MEDIUM.
- TelegramBots `v10.3.0` sources read from GitHub: `SpringLongPollingBot`, `TelegramBotStarterConfiguration`, `TelegramBotInitializer`, `LongPollingUpdateConsumer`, `OkHttpTelegramClient(String botToken)`, `TelegramClient.execute(BotApiMethod)`, `SendMessage`, `AnswerCallbackQuery`. https://github.com/rubenlagus/TelegramBots/tree/v10.3.0. The older wiki sample that subclasses `TelegramLongPollingBot` is the wrong shape for this starter.
- Telegram Bot API, `CallbackQuery`, `answerCallbackQuery`, and `callback_data` "1-64 bytes": https://core.telegram.org/bots/api. Seam rates a plain web fetch as LOW; the byte limit and the spinner note were read on that page in this pass and should be re-checked if the button step is planned in detail.
- JDK 21 `java.net.http.HttpClient`: https://docs.oracle.com/en/java/javase/21/docs/api/java.net.http/java/net/http/HttpClient.html. Default redirect policy is `NEVER`. Reuse one client. No extra library.

### Left unverified

- Whether a private chat's `chat_id` is always the same number as the user id. The digest should send to the single whitelisted id; confirm against the `Chat` object when wiring `ChatSender`, and do not invent a second id unless a send fails.
- `mvn dependency:tree` was not run, so a transitive web server was not proven absent.
- The exact `@ConfigurationProperties` binding of a comma-separated id list was not executed. The configuration bean must still end in `new AccessPolicy(Set.copyOf(...))`.
- No model vendor is chosen in the spec. Do not pick one in the roadmap; keep it behind `NoteModel` and environment variables.
- Spring Boot 4.1.1 patch notes were not diffed against the 4.1.0 doc tag.

---
*Architecture research for: notesbot Telegram inbox*
*Researched: 2026-11-03*
