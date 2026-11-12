# Stack Research

**Domain:** personal single-user Telegram inbox bot (brownfield; stack locked)
**Researched:** 2026-11-03
**Confidence:** HIGH for versions resolved from this repo; MEDIUM for one runtime gap noted below

This is not a greenfield choice. `ТЗ-telegram-bot.md` section 5 and `pom.xml` already fix the language, framework, Telegram library, database, and scheduler. Nothing below replaces that stack or adds a dependency. Versions were taken from `pom.xml` and from `./mvnw dependency:tree` on JDK 21 (`JAVA_HOME` resolved to Temurin 21), then checked against the Spring Boot 4.1.1 reference tag and the TelegramBots 10.3.0 jars.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Java | 21, range `[21,22)` | Language and HTTP client for pages and the model | Enforcer in `pom.xml` fails any other JDK. Java 21 already contains `java.net.http.HttpClient`, so link fetch and the model call need no new library. macOS: `JAVA_HOME=$(/usr/libexec/java_home -v 21)`. | HIGH |
| Spring Boot parent | 4.1.1 | Application, configuration, JDBC and scheduling auto-config | Already the parent. It manages Spring Framework 7.0.9, the JDBC starter, HikariCP, the PostgreSQL driver, and the test stack. Do not bump it (the 4.1 docs site also offers 4.1.2; this repo stays on 4.1.1). | HIGH |
| Maven Wrapper | Maven 3.9.11, wrapper 3.3.4 | Build | `./mvnw` and `.mvn/wrapper/maven-wrapper.properties` (`distributionUrl` is `apache-maven-3.9.11`). Do not install a second Maven. | HIGH |
| TelegramBots long polling | 10.3.0 | Receive updates and send messages | `telegrambots-springboot-longpolling-starter` and `telegrambots-client` are already declared and share `${telegrambots.version}`. The library README for tag `v10.3.0` recommends long polling. One user, one process, no public HTTPS endpoint. | HIGH for the artifacts; MEDIUM for a Boot 4 smoke test (see compatibility) |
| PostgreSQL JDBC | driver 42.7.13, `runtime` scope, version from the Boot BOM | Store notes | `org.postgresql:postgresql` is already in `pom.xml` with no version of its own. Boot 4.1.1 resolved it to 42.7.13. The server is PostgreSQL in Docker, not an embedded engine. | HIGH |
| Spring `@Scheduled` | Spring Framework 7.0.9, already on the classpath | Daily digest at step 6 only | `EnableScheduling` and `Scheduled` (including `cron` and `zone`) are inside `spring-context-7.0.9.jar`. `TaskSchedulingAutoConfiguration` is inside `spring-boot-autoconfigure-4.1.1.jar`. No Quartz starter and no new scheduler dependency. Do not turn scheduling on before step 6 of `docs/plan.md`. | HIGH |

### Supporting Libraries

These are already resolved. Do not re-declare them with a different version.

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `spring-boot-starter-jdbc` | 4.1.1 | HikariCP `DataSource`, `JdbcClient`, script init | All note, search, and digest SQL. Inject `JdbcClient` (auto-configured by `JdbcClientAutoConfiguration` in `spring-boot-jdbc`). Do not add Spring Data JDBC or JPA. | HIGH |
| HikariCP | 7.0.2 | Pool | Pulled by `spring-boot-starter-jdbc`. Do not set `spring.datasource.type` to another pool. | HIGH |
| `spring-boot` and `spring-boot-autoconfigure` | 4.1.1 | `SpringApplication` and auto-config | `spring-boot-starter` 4.1.1 depends on `spring-boot-autoconfigure`, which depends on `spring-boot`. The long-polling starter also depends on both. One `@SpringBootApplication` class is still missing and is part of step 2. | HIGH |
| Jackson Databind | 2.21.5 (annotations 2.21, jsr310 2.21.5) | JSON for the model call later | Already `compile` via `telegrambots-meta`. Use it behind the model interface when F2/F3 need JSON. Do not add `spring-boot-starter-json` or a second parser. | HIGH |
| OkHttp | 4.12.0 | Telegram HTTP only | Transitive through `telegrambots-client`. Notesbot code must not import `okhttp3`. Page fetch and the model use JDK `HttpClient`. | HIGH |
| `spring-boot-starter-test` | 4.1.1 | Unit tests | Brings JUnit Jupiter 6.0.3, AssertJ 3.27.7, Mockito 5.23.0. Tests stay free of Telegram, the model, and PostgreSQL. Do not add JUnit 4 or Testcontainers. | HIGH |
| Spotless Maven plugin | 3.10.4 | Format | Already the plugin version. Both the plugin and `google-java-format` 1.28.0 are in the local Maven repository. | HIGH |
| google-java-format | 1.28.0 | Java format | Pinned in `pom.xml`. `AGENTS.md` says 1.37.0 fails. Do not bump it. The failure itself was not reproduced in this research. | HIGH for the pin; MEDIUM for the 1.37.0 failure mode |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `./mvnw` | Test, verify, Spotless | `./mvnw test`, `./mvnw verify`, `./mvnw spotless:check`, `./mvnw spotless:apply`. JDK 21 only. |
| `maven-enforcer-plugin` | Reject non-21 JDKs | Rule `requireJavaVersion` `[21,22)` is already configured. Do not widen it. |
| Docker, official `postgres` image | Database for step 2 | Not a Maven dependency. `compose.yaml` does not exist yet. Use a named volume so a restart does not drop data. No server major is locked in the repo; do not "choose" one by adding H2 instead. |
| Playwright in `playground/bot-mockup/` | Teaching mock only | Not on the bot classpath. Do not deploy it and do not add it to `pom.xml`. |

## Installation

No new packages. The bot POM is already complete for steps 2 through 7.

```bash
# JDK 21 only. Do not add Maven dependencies.
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
./mvnw verify
./mvnw spotless:check
```

PostgreSQL is started later from `compose.yaml` (step 2). Do not add `spring-boot-docker-compose` to start it from the app.

## How to use what is already declared

### Configuration and secrets

There is no `application.yml` yet. Non-secrets (init mode, digest cron, digest zone) may be committed. The bot token, model key, and database password must be environment variables only. Never write the values into `application.yml`, a committed `.env`, or `compose.yaml`.

Spring Boot 4.1.1 relaxed binding turns a property into an environment variable by replacing `.` with `_`, removing `-`, and uppercasing. The documented example is `spring.main.log-startup-info` to `SPRING_MAIN_LOGSTARTUPINFO`. Dashes are removed, not turned into underscores. Prefer dotted property names so the variable stays readable:

| Property | Environment variable | When |
|----------|----------------------|------|
| `spring.datasource.url` | `SPRING_DATASOURCE_URL` | Step 2. Required. If it is absent, Boot tries an embedded database, and this classpath has none. |
| `spring.datasource.username` | `SPRING_DATASOURCE_USERNAME` | Step 2 |
| `spring.datasource.password` | `SPRING_DATASOURCE_PASSWORD` | Step 2. Secret. |
| `telegram.bot.token` | `TELEGRAM_BOT_TOKEN` | Step 2. The starter does not read a token property. The bot bean returns it from `getBotToken()`. |
| `notesbot.owner.id` | `NOTESBOT_OWNER_ID` | Step 2. The library has no allow-list. `AccessPolicy` stays in front of every update. |
| `model.api.key` | `MODEL_API_KEY` | F2/F3 only, behind an interface. Vendor is not chosen. |
| `spring.sql.init.mode` | commit `always` in config, or `SPRING_SQL_INIT_MODE` | Step 2, only together with an idempotent `schema.sql` |

Do not log these values. Do not give secrets a default in YAML.

`TelegramBotStarterConfiguration` is registered from `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` and is active unless `telegrambots.enabled=false` (`matchIfMissing = true`). A Spring test that loads this configuration will call Telegram during startup. Unit tests must not load it. `telegrambots.enabled=false` is the off switch if a context test is ever added.

### Long polling, not the old wiki sample

Context7's TelegramBots wiki still shows `TelegramLongPollingBot`, `getBotToken()` on that base class, `DefaultBotSession`, and `TelegramBotsApi`. That is the old monolith. Tag `v10.3.0` does not work that way. Ignore that sample.

The 10.3.0 starter registers every `SpringLongPollingBot` bean. The interface is only:

- `String getBotToken()`
- `LongPollingUpdateConsumer getUpdatesConsumer()`

`TelegramBotInitializer` calls `TelegramBotsLongPollingApplication.registerBot(...)` with that token and consumer. The consumer's method is `consume(List<Update>)`. The same list carries ordinary messages and `CallbackQuery` updates, so tag buttons do not need a second bot.

Send replies with `telegrambots-client`, not with `execute()` inherited from `TelegramLongPollingBot` (that type is not the 10.3.0 API):

- Client: `org.telegram.telegrambots.client.okhttp.OkHttpTelegramClient`, constructor `(String botToken)`
- Interface to depend on in notesbot code: `org.telegram.telegrambots.meta.generics.TelegramClient`
- Text: `org.telegram.telegrambots.meta.api.methods.send.SendMessage`, then `execute(BotApiMethod)`
- F3 buttons, already in `telegrambots-meta` 10.3.0: `InlineKeyboardButton`, `InlineKeyboardMarkup`, `CallbackQuery`, `AnswerCallbackQuery`

Construct one client from the environment token. Do not put the token in source. Check `AccessPolicy` inside the update consumer before any reply or save. The starter does not filter users.

The starter's own POM imports Spring Boot BOM 3.5.5 for its build. This repo does not: `dependency:tree` resolves `spring-boot` and `spring-boot-autoconfigure` to 4.1.1 and `spring-context` to 7.0.9. The configuration class imports `ConditionalOnProperty` and `ConditionalOnMissingBean`, and both classes are still in `spring-boot-autoconfigure-4.1.1.jar` under `org.springframework.boot.autoconfigure.condition`. `InitializingBean` and `AnnotationUtils` are in the resolved Spring 7.0.9 jars. That is a class-level check, not a live poll. Step 2 should boot one `SpringLongPollingBot` bean. If that fails, fix the wiring with the 10.3.0 types already on the classpath. Do not downgrade Boot to 3.5.5 and do not switch libraries.

Lombok is `provided` inside the starter POM and is not a notesbot dependency. Do not add it.

### JDBC and schema

Set `spring.datasource.url` to a `jdbc:postgresql:` URL. Boot deduces the driver from the URL. Application code should use `JdbcClient` and not import `org.postgresql.*`.

`schema.sql` on the classpath is not run for PostgreSQL unless `spring.sql.init.mode=always`. The default is embedded databases only. With `always`, Boot runs the script on every start and fails startup if the script throws (`continue-on-error` stays at the default). Write idempotent DDL (`CREATE TABLE IF NOT EXISTS` and the same for indexes). Do not put `DROP` in that script. Do not add Flyway or Liquibase: both are extra dependencies, and Boot's own guide says not to mix them with `schema.sql`.

### Model and page fetch, still without a new dependency

F2 and F3 need HTTP. Use JDK `HttpClient`. Parse model JSON with Jackson 2.21.5, which is already on the compile classpath. Hide both behind interfaces so unit tests pass a stub. A failed page fetch or a failed model call must still save the note.

Do not pick a model vendor in the POM. Do not add Spring AI, LangChain4j, an OpenAI client, Jsoup, or `spring-boot-starter-web` just to obtain `RestClient`. Declaring Jackson as a direct dependency is unnecessary while `telegrambots-meta` brings it; adding it anyway would be a dependency change and needs agreement.

### Digest scheduler, step 6 only

`@EnableScheduling` plus one `@Scheduled(cron = "...", zone = "...")` method is the whole scheduler. Boot's default `ThreadPoolTaskScheduler` has one thread when virtual threads are off. Leave `spring.threads.virtual.enabled` unset. Put the cron and zone in configuration (`notesbot.digest.cron`, `notesbot.digest.zone`) so the zone is explicit. Do not add this annotation in step 2.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| TelegramBots 10.3.0 long polling, already in `pom.xml` | Webhooks, or another bot framework | Webhooks suit a public HTTPS host and more than one instance. This bot is one user and one process. The webhook starter is a different artifact and is not in the POM. Not in this project. |
| `spring-boot-starter-jdbc` and `JdbcClient` | Spring Data JPA, Spring Data JDBC, jOOQ | Those fit a larger model or generated SQL. This bot has a few tables and the JDBC starter is already declared. `spring-boot-starter-data-jdbc` is not the same artifact as `spring-boot-starter-jdbc`. |
| Idempotent `schema.sql` with `spring.sql.init.mode=always` | Flyway or Liquibase | A migration tool is better once shipped databases need versioned change. It is a new dependency and is out of scope until agreed. |
| JDK `HttpClient` plus an interface | A vendor LLM SDK or Spring AI | An SDK is reasonable after a vendor is chosen. The spec forbids that dependency for now. The vendor stays a later decision. |
| `@Scheduled` at step 6 | Quartz | Quartz is for clustered or persisted job stores. One morning job does not need `spring-boot-starter-quartz`. |
| Official PostgreSQL in Docker | H2, SQLite, or an embedded Boot database | Embedded is easier for a demo and loses data, which breaks the spec. Boot will auto-configure H2 if it is added and the URL is missing. Do not add it. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `telegrambots-springboot-webhook-starter`, `telegrambots-webhook`, `SetWebhook` | Needs a public URL and a web server. The POM is the long-polling starter on purpose. | `SpringLongPollingBot` and `OkHttpTelegramClient` |
| `spring-boot-starter-web` or an embedded Tomcat | Not required for long polling. The resolved tree has no `spring-web` and no Tomcat. Adding it widens the process for no feature in the spec. | The existing long-polling starter |
| `TelegramLongPollingBot`, `TelegramBotsApi`, `DefaultBotSession`, AbilityBot, `telegrambots-abilities` | Pre-modular API. Context7's wiki still shows it. It will not match the 10.3.0 jars on the classpath. | `SpringLongPollingBot`, `LongPollingUpdateConsumer`, `TelegramClient` |
| A second polling process for the same token | Long polling consumes one update stream. Step 7 is one bot container. | One `SpringLongPollingBot` bean |
| H2, HSQLDB, Derby, SQLite | Wrong database, and an embedded driver plus a missing URL makes Boot skip PostgreSQL. | PostgreSQL in Docker and driver 42.7.13 |
| `spring-boot-starter-data-jpa`, Hibernate, `spring-boot-starter-data-jdbc`, jOOQ | New stacks. Search and the digest are SQL through `JdbcClient`. | `spring-boot-starter-jdbc` |
| Flyway, Liquibase, `spring-boot-starter-flyway` | New dependencies. Boot warns not to mix them with `schema.sql`. | Idempotent `schema.sql`, `spring.sql.init.mode=always` |
| Elasticsearch, pgvector, embeddings, semantic search | Out of scope. Search is word match in text, title, and tags. | Parameterized SQL via `JdbcClient` (`ILIKE` is enough; do not concatenate the query) |
| `spring-boot-starter-quartz` or any scheduler added before step 6 | The spec names `@Scheduled`. The annotation is already in Spring Framework 7.0.9. | `@EnableScheduling` and `@Scheduled` in step 6 only |
| Spring AI, LangChain4j, or a vendor model client | New dependency and an early vendor lock. The model is only tags and short page summaries. | Interface plus JDK `HttpClient` and Jackson already on the classpath |
| Jsoup or another HTML parser dependency | New dependency. A failed fetch must still save the link. | JDK `HttpClient`; store the link without a summary if the page fails |
| `okhttp3` imports in `notesbot` | Couples page fetch and the model to Telegram's HTTP stack. | `java.net.http.HttpClient` |
| Lombok, Kotlin, Testcontainers, Actuator, `spring-boot-docker-compose` | Not required. Testcontainers and the Docker Compose starter are new dependencies. Unit tests must not open PostgreSQL. | Plain JUnit Jupiter and a hand-written `compose.yaml` |
| google-java-format 1.37.0, a JDK other than 21, Spring Boot other than 4.1.1 | Breaks the enforcer or the agreed formatter pin. | The versions in `pom.xml` |
| Secrets in git | Spec section 6 and `AGENTS.md`. | Environment variables listed above, with no sample values in the repo |
| Playwright or `playground/bot-mockup` on the bot runtime | The mock is a separate Node app. | Telegram only |

## Stack Patterns by Variant

**Step 2 (skeleton, this is the next code step):**
- Add `@SpringBootApplication` and one `SpringLongPollingBot` bean. Do not extend `TelegramLongPollingBot`.
- Bind `telegram.bot.token` and `spring.datasource.*` from the environment. Add PostgreSQL in Docker with a named volume. No password in the committed compose file.
- Add idempotent `schema.sql` and `spring.sql.init.mode=always`.
- Do not add `@Scheduled`, a model client, or a web server.

**Steps 3 and 4 (save notes, links, tags):**
- Persist with `JdbcClient`.
- Fetch pages and call the model through interfaces implemented with JDK `HttpClient`. Jackson may read and write the model JSON.
- Tag confirmation uses `InlineKeyboardMarkup` and `CallbackQuery` from `telegrambots-meta` 10.3.0.
- Because the spec says not to add a dependency, do not add an SDK when the model vendor is chosen unless that choice is agreed first.

**Step 5 (word search):**
- SQL only. No search service.

**Step 6 (digest):**
- `@EnableScheduling` and one `@Scheduled` method with an explicit zone. Still no new dependency.

**Step 7 (VPS):**
- Same process image plus the same PostgreSQL volume. One bot container. Do not switch the bot to webhooks in order to scale out.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Java `[21,22)` | Spring Boot 4.1.1, Spring Framework 7.0.9 | Enforced. `dependency:tree` showed `spring-context` 7.0.9, `spring-jdbc` 7.0.9, `spring-core` 7.0.9. |
| `spring-boot-starter-jdbc` 4.1.1 | HikariCP 7.0.2, PostgreSQL driver 42.7.13 | Driver version comes from the Boot BOM. Do not add a `<version>` on the driver. |
| `spring-boot-starter` 4.1.1 | `spring-boot-autoconfigure` 4.1.1 and `spring-boot` 4.1.1 | Verified from the published POMs. Scheduling and `SpringApplication` do not need another starter. |
| TelegramBots 10.3.0 starter | Boot 4.1.1 on this classpath | The library builds against Boot 3.5.5, but the classes it imports are present in the resolved 4.1.1 jars. Live registration is not yet proven. Do not "fix" that by downgrading Boot. |
| `telegrambots-client` 10.3.0 | `telegrambots-meta` 10.3.0, Jackson 2.21.5, OkHttp 4.12.0 | Keep both Telegram artifacts on `${telegrambots.version}`. OkHttp stays an implementation detail of the client. |
| Spotless 3.10.4 | google-java-format 1.28.0 | Do not move the formatter to 1.37.0. |
| `spring-boot-starter-test` 4.1.1 | JUnit Jupiter 6.0.3, AssertJ 3.27.7, Mockito 5.23.0 | Existing tests already use Jupiter and AssertJ. Do not add `junit-vintage`. |

## Sources

- `pom.xml`, `.mvn/wrapper/maven-wrapper.properties`, and `./mvnw dependency:tree` on Temurin 21 (2026-11-03). Resolved versions in the tables above. Confidence HIGH.
- Spring Boot tag `v4.1.1` reference: `data/sql.adoc` (DataSource, Hikari, `JdbcClient`), `features/task-execution-and-scheduling.adoc` (`@EnableScheduling`, one-thread scheduler), `how-to/data-initialization.adoc` (`schema.sql`, `spring.sql.init.mode=always`, fail-fast), `features/external-config.adoc` (relaxed binding). Raw files from `github.com/spring-projects/spring-boot` tag `v4.1.1`. Confidence HIGH.
- Published POMs: `spring-boot-starter-jdbc` 4.1.1, `spring-boot-starter` 4.1.1, `spring-boot-autoconfigure` 4.1.1, `telegrambots-springboot-longpolling-starter` 10.3.0 (own BOM property `spring.version` 3.5.5). Confidence HIGH.
- TelegramBots tag `v10.3.0` source: `SpringLongPollingBot`, `TelegramBotStarterConfiguration`, `TelegramBotInitializer`, `AutoConfiguration.imports`, and README ("I recommend long polling"). Jars inspected with `javap` / `jar tf`: `OkHttpTelegramClient(String)`, `TelegramClient.execute`, `LongPollingUpdateConsumer.consume`, `SendMessage`, `InlineKeyboardButton`, `CallbackQuery`, `AnswerCallbackQuery`. Confidence HIGH for API shape.
- Class presence on Boot 4.1.1: `ConditionalOnProperty`, `ConditionalOnMissingBean`, `TaskSchedulingAutoConfiguration` in `spring-boot-autoconfigure-4.1.1.jar`; `DataSourceAutoConfiguration` and `JdbcClientAutoConfiguration` in `spring-boot-jdbc-4.1.1.jar`; `EnableScheduling` and `Scheduled` in `spring-context-7.0.9.jar`. Confidence HIGH that those classes exist. Confidence MEDIUM that the starter's registration succeeds at runtime, because the app has not been booted.
- Context7 (`/spring-projects/spring-boot/v4.1.0`, `/rubenlagus/telegrambots`) was queried. The Spring scheduling and DataSource hits match the 4.1.1 tag. The Telegram hits are the old wiki (`TelegramLongPollingBot`, `DefaultBotSession`) and were rejected. Context7's index listed Spring Boot `v4.1.0`, not `v4.1.1`. Confidence MEDIUM for Context7, LOW for the Telegram wiki sample.
- `AGENTS.md` and `ТЗ-telegram-bot.md` for the locked stack and the google-java-format pin. The 1.37.0 failure was not reproduced here.

---
*Stack research for: notesbot, a personal Telegram inbox bot*
*Researched: 2026-11-03*
