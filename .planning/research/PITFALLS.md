# Pitfalls Research

**Domain:** Personal single-user Telegram inbox bot (notes, links, tag confirmation, word search, morning digest) on an existing Java 21 / Spring Boot 4.1.1 skeleton
**Researched:** 2026-11-03
**Confidence:** HIGH for traps verified in this repo and in the pinned 10.3.0 jars. MEDIUM for Context7 / Spring Boot reference excerpts (`classify-confidence --provider context7` returns MEDIUM). Official Telegram and Docker pages were read directly; `classify-confidence --provider webfetch` still returns LOW, so those quotes are cited, not upgraded.

This file is about mistakes that show up when wiring long polling, PostgreSQL in Docker, link fetch, an LLM, word search, and `@Scheduled` onto **this** bot. Steps are `docs/plan.md`: 2 skeleton, 3 save, 4 tags, 5 search, 6 digest, 7 deploy.

## Critical Pitfalls

### Pitfall 1: The whitelist exists only on the echo method

**What goes wrong:**
A Telegram user who is not on the allowlist gets a reply, a row, a model call, or a tag change. Today `AccessPolicy.isAllowed` rejects a null id and any id outside the set, and `MessageHandler.handle` returns `Optional.empty()` for a stranger. That check is not on a Telegram boundary. There is no update loop. Callback queries, edited messages, and commands have no handler. Tests only assert that the `Optional` is empty for id `7`; they never assert that a store was not called, because there is no store.

**Why it happens:**
The next step copies an update into a repository or an LLM client and calls `isAllowed` second, or only for `message`, not for `callback_query`. A group chat makes this worse: the sender and the chat are different ids.

**How to avoid:**
Step 2 has one entry point. It runs `AccessPolicy` before logging text, calling the model, fetching a URL, or inserting a row. The sender id is `Message.getFrom().getId()` or `CallbackQuery.getFrom().getId()` (both `User.getId()` return `Long` in telegrambots-meta 10.3.0). Ignore updates that are not a private chat (`Chat.isUserChat()` is on the 10.3.0 `Chat` class) until a later step has a reason to do otherwise. Load ids from the environment. Null, blank, or unparsable config becomes an empty set, which already denies everyone. Do not catch a parse error and then allow. For a denied id, the step 3 test asserts that the repository was not called.

**Warning signs:**
A reply is built before `isAllowed`. The first log line prints message text for every update. A callback handler checks the chat id and not `getFrom()`. The whitelist test still only checks `Optional`.

**Phase to address:**
Step 2 for the polling entry point. Re-check on step 4 (callback buttons) and step 5 (the search command).

---

### Pitfall 2: The token, model key, or database password lands in git or in a log

**What goes wrong:**
The first `application.yml`, `.env`, or `compose.yaml` contains a real token, model key, or `POSTGRES_PASSWORD`. Or the process logs the update URL or a bot session and the token is in the log. `.gitignore` ignores `.env` and `.env.*` only. `application.yml` and `compose.yaml` are not ignored, so a literal there will be committed.

**Why it happens:**
Spring examples use `${BOT_TOKEN:some-default}`. The official Postgres image README shows `POSTGRES_PASSWORD: example`. Telegram's documented request shape puts the token in the path. In the pinned 10.3.0 jar, `BotSession.toString()` calls `getBotToken()`, and `OkHttpTelegramClient` is constructed with the token string. An HTTP logger on that client prints the secret.

**How to avoid:**
Step 2 reads the bot token, and later the model key and database password, only from the environment. Committed YAML may contain placeholders with no defaults. Compose interpolates the password from the environment and does not embed a literal. Do not commit a sample env file of real-looking secrets. Do not log `BotSession`, the raw Bot API URL, request headers, or the model key. Do not log note text at info level either: the spec forbids sending secrets to the bot, but that is a usage rule, not a filter.

**Warning signs:**
`git grep` finds a token-shaped string. A placeholder has a default after the colon. Compose `environment:` has a quoted password. Debug logging is on for the HTTP client. A test prints the env map.

**Phase to address:**
Step 2 for the token, whitelist, and database password. Step 4 for the model key. Step 7 again, because the VPS env is a second place to paste secrets into a committed file.

---

### Pitfall 3: Building the bot from TelegramBots 6.x docs

**What goes wrong:**
The class that extends `TelegramLongPollingBot`, implements `onUpdateReceived` / `getBotUsername`, and registers with `TelegramBotsApi` plus `DefaultBotSession` does not compile against the jars in `pom.xml`. The project then downgrades TelegramBots or swaps in a webhook starter. Both are stack changes, which `AGENTS.md` forbids without agreement.

**Why it happens:**
Context7 still returns the project wiki for that older shape (provider confidence MEDIUM). `docs/memory.md` already says the 6.9.7.1 material does not describe 10.3.0.

**How to avoid:**
Implement step 2 against the pinned jars only. Verified in `~/.m2` for `org.telegram` `10.3.0` on 2026-11-03:

- `telegrambots-springboot-longpolling-starter`, `telegrambots-longpolling`, `telegrambots-client`, and `telegrambots-meta` do **not** contain `TelegramLongPollingBot`, `DefaultBotSession`, or `AbilityBot`.
- The starter's autoconfig import lists `TelegramBotStarterConfiguration`.
- `SpringLongPollingBot` is an interface with `getBotToken()` and `getUpdatesConsumer()`.
- `TelegramBotInitializer` takes a `List<SpringLongPollingBot>` and runs from `afterPropertiesSet`.
- `TelegramBotsLongPollingApplication.registerBot(String, LongPollingUpdateConsumer)` exists.
- `LongPollingUpdateConsumer.consume` takes a `List` of `Update`.
- `LongPollingSingleThreadUpdateConsumer` runs each update on a **static** `Executors.newSingleThreadExecutor` (daemon thread). Blocking work there stalls every later update.
- `GetUpdates` has `setAllowedUpdates`, `setOffset`, and `setTimeout`.
- The client can also execute `SetWebhook` and `DeleteWebhook`. Do not call `SetWebhook`.
- The starter pom **inside** the 10.3.0 jar declares Spring Boot `3.5.5`. This repo's parent is Spring Boot `4.1.1` (Spring Framework `7.0.9` in the 4.1.1 BOM). Nothing in this research started an application context, so that mix is **not** verified at runtime. Do not "fix" a startup failure by downgrading either pin without agreement.

Do not treat this list as a copy-paste bot. It is the surface that was decompiled, not a sample application.

**Warning signs:**
A new file imports `org.telegram.telegrambots.bots.TelegramLongPollingBot` or `DefaultBotSession`. The pom version changes. A webhook starter artifact appears.

**Phase to address:**
Step 2. Do not start step 3 until a whitelisted private text update is handled through this starter, not through a 6.x sample.

---

### Pitfall 4: The note is dropped when the model or the page fails

**What goes wrong:**
The user sends a link or a note. The page times out, or the model returns garbage, or the HTTP call throws. The handler aborts before the insert. The Telegram message is then consumed, and the note is gone. The spec and `.claude/rules/java-main.md` require the opposite: save without a summary, or save without tags.

**Why it happens:**
Fetch and tagging are written as one transaction that must succeed. The single-thread update consumer from pitfall 3 makes a hung fetch look like "the bot died", and the fix becomes "give up on this update".

**How to avoid:**
Step 3 saves the text, the link, and the timestamp first. Title and summary are optional and filled only after a bounded fetch. Step 4 suggests tags only after that save. The model sits behind an interface. A thrown call, a timeout, or unusable output leaves the saved row without tags or without a summary and still replies with a short status. Cap download size and time. Do not run that I/O on `LongPollingSingleThreadUpdateConsumer`'s single thread; hand it off, with a timeout, or the inbox stops for the next message too.

**Warning signs:**
The repository insert is after the HTTP call in the same try block. A test expects an exception and an empty table. The consumer calls the model directly. One slow URL stops replies to the next message.

**Phase to address:**
Step 3 for the page. Step 4 for the model. The failing tests come at the start of those steps, not after a happy path.

---

### Pitfall 5: PostgreSQL data is thrown away or never actually persisted

**What goes wrong:**
Notes survive a restart on the developer's laptop, then disappear after `docker compose down -v`, a recreated anonymous volume, or a Postgres 18 container whose mount points at the old path. Or the password in the env is changed and the existing data directory keeps the old password, so the bot cannot connect and someone deletes the volume to "fix" it.

**Why it happens:**
There is no `compose.yaml` yet. Examples use `image: postgres` with `latest`, a bind mount on the wrong directory, and a literal password. Official image docs (read 2026-11-03; webfetch tier LOW) say Docker-specific variables, including `POSTGRES_PASSWORD`, take effect only when the data directory is empty. They also say PostgreSQL 18 moved `PGDATA` to a versioned directory under `/var/lib/postgresql` and changed the image volume, while 17 and below persist only when the mount is `/var/lib/postgresql/data`. The tag list on that page shows `latest` tracking 18. Docker's Compose reference says `docker compose down -v` removes named volumes declared in the compose file and anonymous volumes attached to containers. Scripts in `/docker-entrypoint-initdb.d` run only on an empty data directory; a failed script plus a restart skips the rest.

**How to avoid:**
Step 2 pins an explicit major, not `latest`. Use `postgres:16` and a **named** volume mounted at `/var/lib/postgresql/data`. That path matches the 16/17 image docs. Do not jump to 18 unless the mount is the 18 path; mixing them looks like an empty database. Compose has no literal password and does not set `POSTGRES_HOST_AUTH_METHOD` to `trust`. Do not publish `5432` on `0.0.0.0` in step 7; keep it on the Docker network or on localhost. Never `down -v`, `volume rm`, or delete the data directory unless the user explicitly asks. Password rotation is `ALTER USER` inside the existing volume, not a new empty volume. Do not put the only copy of the schema in `docker-entrypoint-initdb.d`: the next column change will not run, and the temptation is to wipe the volume.

**Warning signs:**
`image: postgres` with no tag. A volume at `/var/lib/postgresql/data` on a `postgres:18` or `latest` image. `compose down -v` in a README or a script. The bot's JDBC URL uses `localhost` from inside another container. After a restart the note count is zero and nobody ran a migration.

**Phase to address:**
Step 2 creates the named volume and the pin. Step 3 refuses to repair schema drift by recreating it. Step 7 reuses that volume on the VPS and does not expose Postgres publicly.

---

### Pitfall 6: `schema.sql` is "done" but Postgres never runs it

**What goes wrong:**
The app starts, JDBC connects, and the first insert fails because the table was never created. Or `spring.sql.init.mode` is forced to `always` with a bare `CREATE TABLE`, the second boot fails, and the volume is deleted so init can succeed.

**Why it happens:**
In `spring-boot-sql` 4.1.1, configuration metadata says `spring.sql.init.mode` defaults to `embedded`, and `spring.sql.init.continue-on-error` defaults to false. PostgreSQL is not an embedded database, so classpath `schema.sql` / `data.sql` do not run. Boot 4.1 docs (Context7, MEDIUM) also say that if `spring.datasource.url` is missing, Boot tries to auto-configure an embedded database. This pom has the PostgreSQL driver and no H2. Adding H2 to make the context start hides the missing server and is a new dependency.

**How to avoid:**
Step 2 does not mark the skeleton done until the app fails clearly without a JDBC URL, and starts when the URL points at the compose Postgres. Step 3 applies the schema on purpose. If that is `spring.sql.init.mode=always`, the script must be idempotent (`IF NOT EXISTS` and the same for later alters) so a restart does not fail and does not need a new volume. Prove the table with a test that does not depend on a side effect nobody configured. Do not add Flyway or Liquibase unless the user agrees; they are not in the spec stack. Do not add H2.

**Warning signs:**
`schema.sql` exists and `spring.sql.init.mode` is unset. Startup SQL errors are fixed by `compose down -v`. A test uses an in-memory database.

**Phase to address:**
Step 2 for the datasource URL and compose. Step 3 for the idempotent schema. Step 7 must not point at a fresh empty volume and expect init scripts from an old laptop volume to re-run.

---

### Pitfall 7: Tags, search, or the digest are built before a note can be saved

**What goes wrong:**
The morning job, the keyword buttons, or `/search` land while `MessageHandler` still returns `"Принято: " + text` and nothing is stored. `docs/plan.md` still has step 2 open. The MVP criterion (save, confirm tags, find by word, digest next morning, on a VPS) cannot be met, and the early feature has nowhere honest to put data.

**Why it happens:**
The mock in `playground/bot-mockup/index.html` already shows tags, search, and a digest, so it looks like the product path. The mock keeps notes in a page-local array and suggests tags from a `KEYWORDS` dictionary (`java`, `spring`, `docker`). Playwright locks that sketch. It never calls Telegram, HTTP, or Postgres.

**How to avoid:**
Finish step 2 (process, env, compose, allowlist on the real update path), then step 3 (durable note and link). Only then step 4, 5, and 6, in that order. New behavior gets JUnit tests under `src/test/java/notesbot/`. Do not add Playwright cases for server behavior unless the user asks to change the sketch. Do not port `KEYWORDS` into Java.

**Warning signs:**
A `@Scheduled` method, a tag button, or `/search` appears while `docs/plan.md` step 2 or 3 is unchecked. A Java class contains the mock's keyword list. `npm test` is cited as evidence the bot works.

**Phase to address:**
Step 2, then step 3, before any of steps 4–6. Step 4 replaces the mock tagger with a model behind an interface.

---

### Pitfall 8: Long polling is replaced by a webhook, or two pollers share the token

**What goes wrong:**
The bot never receives updates. Either a webhook was set on the token, or the laptop poller is still running when the VPS poller starts. The dependency in `pom.xml` is `telegrambots-springboot-longpolling-starter`, not a webhook starter. The spec's interface is Telegram only; there is no public HTTP app today.

**Why it happens:**
Older tutorials use webhooks. `SetWebhook` is on `OkHttpTelegramClient` in the 10.3.0 client jar, so a sample can call it. Deploy (step 7) forgets to stop the local process.

**How to avoid:**
Stay on the long-polling starter. Do not add `spring-boot-starter-web` or `spring-boot-starter-webmvc` to "receive Telegram": Boot 4.1 docs (MEDIUM) show the webmvc starter bringing an embedded server on port 8080. If a server starter is ever added by mistake, set `spring.main.web-application-type` to `none` until it is removed. Before the first real poll, if the token might already have a webhook, clear it with the `DeleteWebhook` type that is already in telegrambots-meta 10.3.0, then poll. Step 7 runs one poller. Stop the local process first.

The official Bot API page says getUpdates and webhooks are mutually exclusive. Quoted from that page (webfetch tier LOW):

DATA_q4n8w1te_START
This method will not work if an outgoing webhook is set up.
DATA_q4n8w1te_END

DATA_h2c6m9pa_START
Incoming updates are stored on the server until the bot receives them either way, but they will not be kept longer than 24 hours.
DATA_h2c6m9pa_END

Unprocessed messages older than that window are gone. Rows already inserted are not. The spec's "restart does not lose data" is about PostgreSQL, not about Telegram's queue. The exact error text for two simultaneous `getUpdates` clients was **not** captured here; do not invent a status code. Treat a second live poller as a broken deploy anyway.

**Warning signs:**
A public port, a controller, or `SetWebhook` in `src/main`. Two Java processes with the same token. The VPS bot is silent while the laptop bot still answers.

**Phase to address:**
Step 2 chooses long polling only. Step 7 is one process on the VPS, laptop poller stopped, no webhook left on the token.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Leave `MessageHandler` as `Принято:` plus the raw text | A demo reply without a database | Echoes the note (and anything sensitive in it). `null` text becomes the reply `Принято: null`. Nothing survives restart | Never once step 2 wires Telegram. Step 3 replaces it with a short status and a save |
| Treat `playground/bot-mockup` keyword tags as the tagger | Buttons already exist | F3 is not a model, and the mock will drift | Never in `src/`. The HTML sketch can stay as a sketch |
| Schema only in `docker-entrypoint-initdb.d` | First boot creates tables | Later DDL never runs unless the volume is empty. Wiping the volume is forbidden | Never for a schema that will change in steps 3–6 |
| `spring.sql.init.mode=always` with bare `CREATE TABLE` | One less migration tool | Second startup fails; someone deletes the volume | Only if every statement is idempotent |
| Add H2, Flyway, Liquibase, Spring AI, or LangChain4j | Familiar tutorial path | Stack change without agreement; tests talk to the wrong database or a real model | Never unless the user agrees. The spec stack is Java 21, Spring Boot, TelegramBots, PostgreSQL, `@Scheduled`, and a cheap HTTP model |
| Add `spring-boot-starter-webmvc` to get an HTTP client | Rest templates from memory | Embedded server on 8080 next to a long-polling bot | Never for this bot. The long-polling jar already references OkHttp. `spring-boot-starter-restclient` is in the Boot 4.1.1 BOM, but its transitive tree was **not** resolved here; do not add it without checking that tree and without agreement |
| Unit test that calls Telegram, the model, or a real Postgres (including a container) | Confidence theater | Slow, flaky, and against `.claude/rules/tests.md` | Never for the unit suite. Compose is the manual check |
| Bump google-java-format to 1.37.0 or widen the enforcer off Java 21 | Match a newer local JDK | `pom.xml` pins format 1.28.0. `AGENTS.md` says 1.37.0 fails. The enforcer range is `[21,22)`. The 1.37.0 failure was **not** re-run in this research | Never |
| Semantic search, reminders, voice, files, or a second user | Looks like a fuller product | Explicitly out of scope in the spec | Never in this milestone |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TelegramBots 10.3.0 long polling | Copy the wiki `TelegramLongPollingBot` sample | Implement `SpringLongPollingBot` from the pinned jar. Allowlist first. No webhook |
| Telegram updates | Handle only `getMessage()` and stringify a null body | `Update` in 10.3.0 has `hasMessage`, `hasCallbackQuery`, `getEditedMessage`, and `getCallbackQuery`. Ignore non-text and ignore edits (an edit is not a second note). Do not reply `Принято: null` |
| Telegram commands | Save `/search` as a note in step 3, then search that note in step 5 | Step 3 persists notes and links only. A leading-slash command is not a note. Step 5 implements search on stored rows |
| Inline keyboards | Put the tag list or the note text in `callback_data`. Forget `answerCallbackQuery`. Trust the button without `getFrom()` | Official page (webfetch tier LOW): callback data is 1-64 bytes. `DATA_b7r3k5vx_START` Data to be sent in a callback query to the bot when the button is pressed, 1-64 bytes `DATA_b7r3k5vx_END`. Store a short note id, not the tags. `AnswerCallbackQuery` exists in the 10.3.0 meta jar; answer the callback. Run `AccessPolicy` on `CallbackQuery.getFrom()` before writing tags |
| Outbound text | Send the whole note or a huge digest back | Official page (webfetch tier LOW): sendMessage text is 1-4096 characters after entity parsing. `DATA_m8d1s4lq_START` Text of the message to be sent, 1-4096 characters after entities parsing `DATA_m8d1s4lq_END`. Confirm with a short status. Split or trim a long digest |
| Page fetch | Unbounded GET on the update thread; failure rolls back the insert; `file:` or link-local URL from the VPS | Save the link first. http(s) only, size cap, time cap, off the single consumer thread. Failure leaves a row without a summary |
| LLM | Vendor SDK inside `MessageHandler`; tags applied before the user confirms; tests call the network | Interface plus a stub. Step 4 shows buttons and writes tags only after confirm. Garbage output does not delete the note. No new SDK without agreement |
| PostgreSQL | `latest` image, wrong mount, `down -v`, password baked into compose, port published on the VPS | `postgres:16`, named volume at `/var/lib/postgresql/data`, password from the environment, no public port |
| Spring scheduling | A `@Scheduled` method and no `@EnableScheduling`. Cron in the VPS default zone, "yesterday" computed in another zone | `@EnableScheduling` exists on spring-context 7.0.9. `@Scheduled` has a `zone()` member. Boot 4.1 docs (MEDIUM) say the scheduler auto-config is tied to using `@EnableScheduling`, and the non-virtual-thread scheduler pool defaults to one thread. Set the zone. Use the same zone for the "previous day" query. One hung digest blocks that single scheduler thread |

## Performance Traps

This is one user and one bot process. Do not add a queue, a cache, or a second instance for scale.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Page fetch or model call inside `LongPollingSingleThreadUpdateConsumer.consume(Update)` | The next private message sits unanswered until the HTTP call returns | Timeout and do the slow work off that static single thread. The library already built it as `newSingleThreadExecutor` | The first slow or hung URL, not at 10k users |
| Search loads every row into the JVM, or copies the mock's `includes` over one concatenated string | Fine on a dozen notes; wrong matches; the database is unused | Step 5: parameterized SQL over text, title, and tags. Word match as in the spec, not the mock substring, and not semantic search | Unnecessary even for one user; a full-table load is the wrong design, not a future scale plan |
| Digest or tag job does extra model calls for the whole history every morning | Slow morning, token spend, duplicate tags | Step 6 reads rows already stored for the previous day. Tags were decided in step 4 | The first morning after a large import, if history is re-tagged |
| Publishing Postgres or starting Tomcat "just in case" | Extra attack surface, not throughput | One long-polling process and one Postgres on a private network | Immediately on a VPS, not at 1M users |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Reply or insert before the allowlist | Strangers use a private inbox, and their text is sent to the model | Step 2 entry point. Empty whitelist denies all. Callbacks use `getFrom()` |
| Secret in `application.yml`, compose, `.env` that is not ignored, or logs | Token and database takeover. `.env` is ignored; YAML and compose are not | Placeholders only. Never log `BotSession` or the Bot API URL |
| `POSTGRES_HOST_AUTH_METHOD=trust` or `5432` on `0.0.0.0` | Anyone who reaches the port is the superuser or can brute-force it | Default auth. No published port on the VPS (step 7) |
| Fetching a user-supplied URL from the VPS with no host or scheme check | The server-side fetch can hit localhost, link-local, or instance metadata | Step 3: http(s) only, size and time caps. Do not follow redirects onto non-public hosts |
| Search built by concatenating the query into SQL | Injected SQL from a message the bot was trusted with | Bind parameters. The unit test uses a stub, not a live database |
| Echoing the raw note back, or logging it | A password pasted into the chat is repeated and stored in logs | Short status. The spec already says not to send sensitive content; the code must not amplify it |
| Confirmed tags taken from model output with no length or character check | A hostile page in the summary prompt produces a huge or control-character tag | Step 4 caps the list and ignores unusable output. The note stays saved |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Reply is `Принято:` plus the full body, or `Принято: null` for a sticker or empty text | The chat repeats the note. Non-text looks like a saved "null" | Step 2 ignores non-text and blank text with no reply. Step 3 confirms with a short status, not an echo |
| Tag buttons that never answer the callback | The client keeps a loading state on the button | Step 4 calls `AnswerCallbackQuery` after the allowlist check, including when the note id is unknown |
| Model tags written before confirm, or the mock's `#java` / `#spring` / `#docker` keywords used instead | Search and the digest group notes the user did not accept | Step 4 stores tags only after the button confirm or edit. Unconfirmed suggestions are not in search (step 5) or the digest (step 6) |
| `/search` and the digest implemented like the mock (substring, in-memory, local clock) | A word match in the spec does not match the sketch; the digest "works" only in the browser | Step 5 matches words in text, title, and tags in Postgres. Step 6 groups the previous day's saved notes by confirmed tags |
| Digest has no zone, or is sent to a group chat id | It arrives at the wrong morning, or it posts private notes into a group | Pick one zone on `@Scheduled.zone` and use it for the day boundary. Send only to the owner's private `getChatId()`, remembered from an allowed private message in step 2 |
| Silent skip when yesterday was empty | A missed schedule looks the same as a quiet day | Step 6 still sends one short line when there are no rows, so a dead scheduler is visible |
| Digest or search reply longer than the Bot API text limit | The send fails and the morning looks broken | Trim or split under the 4096-character limit quoted above |

## "Looks Done But Isn't" Checklist

- [ ] **Step 2 process:** `./mvnw test` is green while there is still no `@SpringBootApplication`, no env binding, and no poller. Verify a whitelisted private text gets a short reply and a stranger gets none, through the long-polling starter, not only through `MessageHandler` unit tests.
- [ ] **Allowlist:** Callbacks and commands bypass `AccessPolicy`. Verify a stranger's callback does not change tags and does not insert.
- [ ] **Secrets:** `application.yml` or `compose.yaml` contains a real token or password, or logs print `BotSession`. Verify placeholders and a log line that does not contain the token.
- [ ] **Postgres:** The container is up but the volume is anonymous, on the wrong path, or `latest`. Verify a named `postgres:16` volume at `/var/lib/postgresql/data`, then a restart that keeps a row. Confirm nobody used `down -v`.
- [ ] **Schema:** `schema.sql` is on the classpath and `spring.sql.init.mode` is still the 4.1.1 default `embedded`. Verify the table exists in that Postgres after restart.
- [ ] **Save failure policy:** A down model or a dead URL leaves no row. Verify the row remains, without tags or without a summary.
- [ ] **Non-text:** A null body becomes `Принято: null`. Verify silence for non-text and for blank text.
- [ ] **Tags:** Buttons match `playground/bot-mockup` keywords, or tags are saved before confirm. Verify a stub model and a confirm click, and that search does not see unconfirmed tags.
- [ ] **Search:** Results come from the HTML mock or from loading the whole table. Verify a parameterized word query over text, title, and tags.
- [ ] **Digest:** The method exists, `@EnableScheduling` does not, or the zone is the server default. Verify a clock-stubbed previous day in the chosen zone, including an empty day, sent to the private chat only.
- [ ] **Tests:** A test reaches the network, Telegram, the model, or Postgres. Verify stubs. `npm test` in the mock does not count.
- [ ] **Build:** `./mvnw verify` is the only check. Spotless is not bound to `verify` in `pom.xml`. Run `./mvnw spotless:check` on JDK 21 (`JAVA_HOME` on Temurin 21). This research saw `JAVA_HOME` pointing at a JDK 25 home that exists on disk; the enforcer range is `[21,22)`. The JDK 25 failure was not executed here.
- [ ] **Deploy:** The laptop poller is still running, a webhook is set, or Postgres is on a public port. Verify one poller and a private database. Remember the 24-hour update retention quote: downtime longer than that drops unprocessed messages, not stored rows.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Secret committed or logged | HIGH | Revoke the bot token and the model key. Change the database password with `ALTER USER` on the existing volume. Remove the file from the tree. Do not delete the volume to rotate the password |
| Volume removed or mounted on the wrong Postgres 18 path | HIGH | Rows are gone if there is no copy. Restore only from a dump the user already has. Do not create a fresh volume and call it recovery. Next boot uses the pinned 16.x path |
| Note never inserted because fetch or the model threw | HIGH | Cannot recreate the Telegram message once it is acknowledged and older than the 24-hour retention window. Fix the save-first path before more traffic |
| Webhook left on the token, or two pollers | LOW | Stop the extra process. Clear the webhook with the existing `DeleteWebhook` type, then start only the long-polling starter. Do not switch the app to webhooks |
| Bot class written from the 6.x wiki | MEDIUM | Rewrite the registration against `SpringLongPollingBot` in the 10.3.0 jar. Do not downgrade TelegramBots or Spring Boot without agreement |
| `schema.sql` never applied, or a second boot fails on `CREATE TABLE` | MEDIUM | Apply an idempotent script to the existing volume. Do not `down -v` |
| Wrong tags confirmed or suggested | LOW | Step 4's edit buttons are the fix. Until confirm, do not show those tags in search or the digest |
| Digest missed a morning | LOW | Run the same previous-day query once by hand for that zone. Then fix `@EnableScheduling` and `zone`. Do not re-tag history |
| Stranger was answered or stored | MEDIUM | Stop the process, delete those rows by the stranger's id, fix the entry point, add the "store not called" test |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Whitelist only on the echo method; callbacks and commands skip it | Step 2, again at steps 4 and 5 | Stranger message, stranger callback, and empty whitelist: no reply, no row, no model call |
| Secrets in YAML, compose, `.env`, or logs (`BotSession.toString`, token in the URL) | Step 2, model key at step 4, VPS env at step 7 | Committed files have placeholders only. A sample log does not contain the token |
| 6.x `TelegramLongPollingBot` sample against 10.3.0 jars | Step 2 | The bot type is `SpringLongPollingBot`. The pom versions are unchanged. Context starts or the failure is recorded without a downgrade |
| Webhook or a second poller | Step 2 and step 7 | No `SetWebhook` in app code. One process. `DeleteWebhook` used only if a webhook was already set |
| Note lost when the page or the model fails; I/O on the single update thread | Step 3 and step 4 | Failed fetch and failed model tests still see the row. A slow call does not block the next update |
| `compose down -v`, `latest`/Postgres 18 path, password only on first init | Step 2 and step 7 | Named `postgres:16` volume. Restart keeps rows. No `down -v` in scripts |
| `spring.sql.init.mode=embedded` so `schema.sql` never runs | Step 3 | Table exists in compose Postgres after a second boot. Script is idempotent |
| Tags, search, or digest before save | Steps 2 and 3 must finish first; features at 4, 5, 6 | `docs/plan.md` order. No `@Scheduled` or `/search` while step 3 is open |
| Mock `KEYWORDS` used as the tagger | Step 4 | Java tagger is a stubbed model port. Playwright is not the acceptance test |
| JDK other than 21, or google-java-format 1.37.0 | Step 2 | `JAVA_HOME` is Temurin 21. Format pin stays 1.28.0. `spotless:check` is run even though it is not bound to `verify` |
| Real Telegram, model, or Postgres from unit tests | Steps 2–6 | `./mvnw test` uses stubs only |
| Extra dependencies (web starter, H2, Flyway, LLM SDK) | Any step | `pom.xml` dependency list unchanged unless the user agreed |
| `callback_data` over 64 bytes, unanswered callback, tags saved before confirm | Step 4 | Button payload is a short note id. Callback is answered. Search and digest see confirmed tags only |
| Search is the mock's substring or string-built SQL | Step 5 | Parameterized word match on text, title, and tags |
| Digest zone, missing `@EnableScheduling`, group chat, empty morning looks like a dead job | Step 6 | Clock stub, explicit `zone()`, private chat id, one line when the day is empty |
| Non-text `Принято: null` and full-note echo | Step 2 and step 3 | Non-text is ignored. Reply is a short status |
| Unprocessed updates older than 24 hours | Step 7 | Documented as Telegram retention, not as database loss. One poller stays up |

## Sources

- This repo: `ТЗ-telegram-bot.md`, `docs/plan.md`, `AGENTS.md`, `.claude/rules/java-main.md`, `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `pom.xml` (Boot 4.1.1, TelegramBots 10.3.0, google-java-format 1.28.0, enforcer `[21,22)`), `AccessPolicy`, `MessageHandler`, `MessageHandlerTest`, `.gitignore`, `playground/bot-mockup/index.html` (`KEYWORDS`).
- `docs/memory.md` and `docs/memory-archive-2026-10-14-1.md`: 10.3.0 versus the 6.9.7.1 Context7 material; format 1.37.0 recorded as failing with `InvocationTargetException` (cause not established there; not re-run here).
- Local jars, 2026-11-03: `telegrambots-*-10.3.0.jar`, `spring-boot-dependencies` 4.1.1 (`spring-framework.version` 7.0.9), `spring-context` 7.0.9 (`Scheduled.zone`, `EnableScheduling`), `spring-boot-sql` 4.1.1 (`spring.sql.init.mode` default `embedded`).
- Context7, MEDIUM: `/rubenlagus/telegrambots` wiki samples still show `TelegramLongPollingBot`. `/spring-projects/spring-boot/v4.1.0` on `@EnableScheduling`, missing `spring.datasource.url`, and `spring-boot-starter-webmvc`.
- Official pages read with webfetch (classifier tier LOW): [Telegram Bot API](https://core.telegram.org/bots/api), [postgres image README](https://github.com/docker-library/docs/blob/master/postgres/README.md), [docker compose down](https://docs.docker.com/reference/cli/docker/compose/down/).

## Unverified

These are not facts about the running bot:

- The long-polling starter was not booted on Spring Boot 4.1.1. Its own pom says Boot 3.5.5. Compatibility is unproven.
- google-java-format 1.37.0 was not run. JDK 25 was not passed to `./mvnw`. The enforcer range and the current pin are facts; the failure mode is a project note.
- `spring-boot-starter-restclient` 4.1.1 is named in the BOM. The jar was not on disk, so its transitive dependencies were not checked.
- `TaskSchedulingAutoConfiguration` is `@ConditionalOnBean`. Which bean was not decoded from the class file. Context7 says the scheduler is set up when `@EnableScheduling` is used.
- No Telegram error code for two pollers was copied. No owner timezone is specified in the spec; step 6 has to choose one and test it.
- No LLM vendor is chosen. Do not pick one inside a later step without agreement.

---
*Pitfalls research for: notesbot, a personal Telegram inbox*
*Researched: 2026-11-03*
