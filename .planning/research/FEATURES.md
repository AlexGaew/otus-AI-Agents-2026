# Feature Research

**Domain:** personal single-user Telegram inbox (notes and links)
**Researched:** 2026-11-03
**Confidence:** HIGH for what is in or out (locked spec); MEDIUM for Telegram and Spring constraints

This milestone does not explore a larger inbox product. Behavior below is what F1–F5 must do so section 7 of `ТЗ-telegram-bot.md` can pass, plus the platform limits that change how those features feel. `playground/bot-mockup/` is a clickable sketch. It is not a bot feature, and a few of its choices contradict the spec. Do not copy them into requirements.

No third-party note or bookmark bots were compared. Exa, Tavily, Brave, and Perplexity are off in `.planning/config.json`. Competitor ideas are not a source for new scope.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any row here means the section 7 check fails: send a note and a link, confirm tags, find them by a word, and receive the next morning's digest on the VPS.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Whitelist before every reply and write | Section 2: one owner. Anyone else gets silence and no stored row. Section 7 is meaningless if strangers are served. | LOW | Already the rule in `AccessPolicy` / `MessageHandler`. Apply it to text updates and to tag-button callbacks before a database write, a page fetch, or a model call. An empty whitelist denies everyone. Do not answer in a group for a non-listed sender. |
| F1. Text note kept with date and time | The inbox is the note. Section 7 starts by sending one. | LOW | Persist the trimmed text and the instant it was received, in PostgreSQL, before tags are discussed. A blank message is not a note and must not be echoed as the string `null`. User-facing replies stay short and Russian; do not echo the whole note back. |
| F2. Link kept with page title and a short summary | Section 7 sends a link as well as a note. Section 5 limits the model to tags and the short summary, so the title comes from the page and the summary comes from the model. | MEDIUM | Treat as a link only when the whole message is one `http` or `https` URL. Fetch the HTML title (and enough page text for the summary). If the fetch times out, is too large, is not HTML, or errors, still save the URL with the timestamp and say that the title and summary are missing. Do not crawl URLs that sit inside a prose note. |
| F3. Model proposes tags; owner confirms or edits with buttons | Section 7 explicitly includes confirming the suggested tags. Unconfirmed model output must not become the record. | HIGH | Save the note or link first, then ask the model. Buttons toggle only the proposed tags, then a confirm button writes that set onto the existing row. Editing the inline keyboard in place is the intended gesture. If the model errors, the row stays, with no tags, and the owner is told that. Suggested tags are not searchable and do not form digest groups until confirm. The owner cannot type a new tag; the spec says buttons. |
| F4. Command search by words in text, title, and tags | Section 7: the saved note and link are found by a word. Section 4 forbids semantic search, so this command is the only retrieval. | MEDIUM | One command, `/search`, plus the query (the spec says "a command"; the sketch already uses this name, which fits Telegram command rules: slash, Latin letters, up to 32 characters). Case-insensitive whole-word match across the note text, the page title, and confirmed tags only. Several words are all required. No stemming, no fuzzy rank, no embeddings. Empty query asks for a word. No hits say nothing was found. Do not load the table into memory to scan it. |
| F5. Morning digest of the previous calendar day, grouped by tags | Section 7: the next morning a digest arrives. Section 5 names Spring `@Scheduled`, not a user command. | MEDIUM | One job, enabled with `@EnableScheduling`, cron in the owner's zone (`zone` on `@Scheduled`, six fields, seconds first). "Previous day" is that zone's calendar yesterday, from 00:00 inclusive to the next 00:00 exclusive, not a rolling 24 hours and not "whatever is in the session". Group by confirmed tags. A note with two tags is listed under both. Notes with no tags (model failure or no confirm) are listed under an untagged heading so they are not invisible. Each item is a line (title or text), not a count. If nothing was saved yesterday, send one line that says so, so a dead job is obvious. At most one digest per local morning. If the process was down at the cron instant and starts later the same local day, send yesterday once. Do not backfill older missed mornings; those notes stay searchable. |
| Restart does not drop the inbox | Section 6 and the VPS half of section 7. A digest of yesterday is impossible if the rows lived in memory. | MEDIUM | PostgreSQL is the store. The sketch's page-local array is not. The digest is sent to the owner's private chat id, remembered from an earlier allowed message. There is no broadcast list. |

### Differentiators (Competitive Advantage)

None. Do not add a row here during roadmap planning.

Every behavior in F1–F5 is required by section 7. Confirming tags with buttons is not optional polish: the acceptance sentence includes it. Failure-tolerant save is not a delight feature: without it a dead page or a dead model drops the thing the owner just sent. Shipping a subset and "validating" would miss the written MVP.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| — | — | — | Do not invent a differentiator inside this milestone. Quality of the model's tags is not a separate feature; a bad suggestion is fixed with the buttons, and a failed call still keeps the note. |

### Anti-Features (Commonly Requested, Often Problematic)

Section 4 is closed. The rows below are also the ways this repo's sketch, or the current Telegram platform, would pull the bot past the spec. "What to do instead" is the in-scope behavior, not a substitute product.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Tasks with due dates and reminders | A note often looks like "buy milk tomorrow". | Section 4. A second schedule, due dates, and nagging are a different product from a morning digest of what was saved. | Save the words as a normal note. The only clock is the F5 digest. |
| Voice, images, and files | Telegram delivers them to every bot. | Section 4. Storage, transcription, and file hosting are out of scope. The current handler would stringify a missing body as `null` if it were wired through. | Do not save them and do not reply to a stranger. For the owner, do not treat non-text as a note. No media pipeline. |
| Semantic, fuzzy, or stemmed search | Russian morphology (`молоко` / `молока`) and "find similar" feel smarter. | Section 4 names semantic search as out. Stemming and embeddings are that slope. F4 is word match in three fields. | Case-insensitive whole words. The owner repeats a word that is actually in the text, title, or confirmed tags. |
| Price monitoring, classifieds, fishing | A saved link looks like something to watch. The spec lists these by name. | Section 4. They need repeat fetches, alerts, and domain logic. F2 fetches a page once, at save time. | One title and one short summary at capture. No later re-fetch. |
| Several users, shared inboxes, roles | Whitelist could grow into accounts. | Section 2 is one person. Section 4 excludes multiple users. | One whitelist of Telegram ids. Empty list denies all. No profiles, no per-user tags. |
| A web UI, Mini App, or wiring the playground into the bot | The sketch already shows save, tags, search, and digest. Telegram now also pushes Mini Apps and rich messages. | Section 5: Telegram only. The sketch banner says it is not the bot. A second UI splits the MVP. | Chat only. Leave `playground/bot-mockup/` unwired. Playwright stays on the HTML file. |
| `/digest` as the way the digest works | The sketch and its Playwright test send `/digest`. | That command dumps every row of the page session and says so in the caption. F5 is the previous calendar day via `@Scheduled`. A manual command would become a second product path. | Do not implement `/digest`. Do not point Playwright at the Java process. |
| Saving only when the owner presses confirm | The sketch pushes into `store` inside the confirm handler. | Contradicts "after saving, the bot suggests tags" and the rule that a model failure must not lose the note. A closed chat would drop the text. | Insert first. Confirm only updates tags. |
| Tag list from a keyword dictionary | The sketch maps `java` / `spring` / `docker` to hashtags and otherwise uses `#заметка` or `#ссылка`. | F3 is a model behind an interface. A fixed dictionary will not match the owner's real notes and will be mistaken for the feature. | Model proposes tags. Tests pass a stub. No `KEYWORDS` table in Java. |
| Typing new tags, or a tag editor | "I edit them" can be read as free text. | The spec says edit with buttons. Free text needs a draft mode, collisions with notes, and more than 64 bytes of callback data if the tag string is stuffed into the button. | Toggle the proposed set on or off, then confirm. Button label is the tag text. `callback_data` is a short note id plus action (1–64 bytes). |
| Fetching every URL inside a sentence | People paste a link with a comment. | Turns F2 into a crawler and mixes a note with a page summary. The spec's link case is receiving a link. | Prose, even with a URL inside it, is F1. Only a message that is a single URL is F2. |
| Rich messages, streaming drafts, checklists, guest mode, business bots | The Bot API features page (read 2026-11-03) presents these as the current platform. | None of them are in sections 3–5. They add update types the whitelist does not handle yet. | Plain `sendMessage` text and an inline keyboard. Ignore other update types. |
| Quartz, a queue, or a hand-rolled loop in the message handler | Digests are often built that way. | Section 5 requires Spring `@Scheduled`. A loop inside the update handler blocks polling and is the wrong trigger. | `@EnableScheduling` and one `@Scheduled` method. Boot 4.1 already auto-configures the scheduler once scheduling is enabled. No new scheduler library. |
| Echoing the full note in the acknowledgement | The current handler returns `Принято:` plus the raw text. | Section 6 says the bot is not for secrets; echoing them into the chat makes that worse. The owner needs status, not a second copy. | Short status: saved, saved without summary, or saved without tags. |

## Feature Dependencies

```
Whitelist on the update (message or callback)
    └──requires──> any reply, fetch, model call, or insert

Owner private chat id, remembered from an allowed message
    └──requires──> F5 send

F1 saved row (text + timestamp) in PostgreSQL
    └──requires──> F2 (a link is that row, plus title and summary)
    └──requires──> F3 (buttons edit tags on that row)
    └──requires──> F4 (search reads rows)
    └──requires──> F5 (digest reads yesterday's rows)

F2 page fetch ──enhances──> title and the text the model summarizes
F2 fetch failure ──does not block──> the saved URL

F3 model ──enhances──> proposed tags and the F2 short summary
F3 model failure or no confirm ──does not block──> F4 text match or the F5 untagged group
F3 confirmed tags ──enhances──> F4 tag field and F5 groups

Semantic search, stemming, embeddings ──conflicts──> F4
/digest command or the sketch's session dump ──conflicts──> F5
Confirm-gated insert or KEYWORDS tags ──conflicts──> F1 and F3
Multi-user, web UI, media, reminders ──conflicts──> sections 2, 4, and 5
```

### Dependency Notes

- **Whitelist requires to precede I/O:** Section 2 and `.claude/rules/java-main.md`. A callback is an update. Answering `answerCallbackQuery` with no notification text is required to clear the Telegram client's progress bar (Bot API, read 2026-11-03). That empty answer is not a chat reply and must not write a row. A stranger still gets no chat message and no change.
- **F2 and F3 require F1's row:** "After saving" means the insert already happened. Title, summary, and tags are updates. Search and digest then have something to read even when the model is down.
- **F4 and F5 enhance with confirmed tags, they do not wait on them:** Tag match and tag groups are empty until F3 is confirmed. Text match and the untagged digest group still work. The build order still implements F3 before F4 before F5 (`docs/plan.md`). Do not reorder to "ship search before tags" or "ship digest before search".
- **F5 requires a known owner chat and a zone:** The job cannot call `sendMessage` without a chat id collected from an earlier allowed private message. The cron zone must be configured. The server default is the wrong definition of "yesterday" once the process runs on a VPS.
- **The sketch conflicts with the spec:** It stores on confirm, tags with a dictionary, searches with substring `includes`, and digests every session row under a fake "yesterday". Those are not acceptance tests for the bot.
- **Message length constrains F4 and F5, it does not create a feature:** `sendMessage` text is 1–4096 characters after entity parsing (Bot API, read 2026-11-03). A long hit list or a long digest is split into a few plain messages in the same chat. One owner is nowhere near the FAQ bulk-send ceiling (avoid more than about one message per second in a single chat). Do not add pagination UI, paid broadcast, or a web results page.

Build order stays the one in `docs/plan.md`. It is not a suggestion from this research:

1. Finish the Spring Boot skeleton, PostgreSQL in Docker, and a real reply only to the owner.
2. F1 and F2 together (the row, then link enrichment that can fail open).
3. F3 (buttons on a row that already exists).
4. F4 (reads rows; tag field starts to matter).
5. F5 (reads yesterday; groups need confirmed tags, untagged bucket needs F1).
6. VPS deploy, without which section 7 is not met.

## MVP Definition

### Launch With (v1)

The milestone MVP is section 7, in the order above. There is no smaller launch inside this spec.

- [ ] Skeleton reply only to a whitelisted id, secrets and the whitelist from the environment, PostgreSQL surviving restart
- [ ] F1 — a text note is stored with its timestamp and is not gated on a button
- [ ] F2 — a single-URL message stores the URL, and when the fetch works, the title and a model summary; a failed fetch still stores the URL
- [ ] F3 — after that save, buttons confirm or toggle the model's tags; a failed model still leaves the row
- [ ] F4 — `/search` finds by whole words in text, title, and confirmed tags
- [ ] F5 — one morning message for the previous calendar day, grouped by tags, via `@Scheduled`
- [ ] The same flow on a VPS, without the development machine

### Add After Validation (v1.x)

Nothing. Section 7 is the validation. Do not schedule a follow-up release of section 4 items, a `/digest` command, stemming, or a web UI after the first deploy.

- [ ] No v1.x feature — the spec's "out of scope" list stays out after the VPS check passes

### Future Consideration (v2+)

Not a backlog. These are refused for this project, not postponed until product-market fit. Re-open only by changing `ТЗ-telegram-bot.md`.

- [ ] Tasks, due dates, reminders — a different product; the digest is not a reminder
- [ ] Voice, images, files — section 4
- [ ] Semantic search — section 4; F4 is the retrieval feature
- [ ] Price watches, classifieds, fishing — section 4; no repeat fetch
- [ ] More than one user — section 2
- [ ] Any UI that is not Telegram — section 5; the playground mock does not graduate into the bot

## Feature Prioritization Matrix

All in-scope behavior is P1 because section 7 names each of them. There is no P2 inside the spec. P3 is not "later"; it is "do not build".

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Whitelist on messages and callbacks | HIGH | LOW | P1 |
| F1 timestamped text note | HIGH | LOW | P1 |
| F2 link, title, summary, save-on-fetch-failure | HIGH | MEDIUM | P1 |
| F3 button confirm and edit of model tags, save-on-model-failure | HIGH | HIGH | P1 |
| F4 `/search` word match | HIGH | MEDIUM | P1 |
| F5 calendar digest via `@Scheduled` | HIGH | MEDIUM | P1 |
| VPS deploy so the morning job runs without the laptop | HIGH | MEDIUM | P1 |
| Section 4 items, web UI, `/digest`, keyword tags, semantic search | — | — | Do not build |

**Priority key:**

- P1: Required for the section 7 check, in `docs/plan.md` order
- P2: Not used. Nothing in the spec is "should have"
- P3: Not used. Out-of-scope items are excluded, not deferred

## Competitor Feature Analysis

No external products were reviewed. The only behavior compared is the in-repo sketch, which must not be promoted to the spec.

| Feature | Sketch (`playground/bot-mockup`) | Our approach |
|---------|----------------------------------|--------------|
| When the row is stored | On confirm, in a page array that dies on reload | On receive, in PostgreSQL, before tags |
| Tags | `KEYWORDS` substring dictionary, else `#заметка` / `#ссылка` | Model, then inline buttons; nothing confirmed means no tags |
| Link summary | Placeholder sentence; title is the URL path | HTML title plus model summary; failure keeps the URL |
| Search | `/search`, substring `includes` on text, title, tags | `/search`, whole words, same three fields, confirmed tags only |
| Digest | `/digest` of every session row, group counts only | `@Scheduled` previous calendar day, items listed under tags, untagged included |
| Strangers | Not represented | Silence, no row, including on callbacks |
| Interface | Static HTML plus Playwright | Telegram only. The HTML file stays a sketch |

## Sources

- `ТЗ-telegram-bot.md` (2026-10-12), sections 2–8 — HIGH for scope. Primary requirement.
- `docs/plan.md` — HIGH for order. Steps 2–7 are open. Do not reorder.
- `.planning/PROJECT.md` (updated 2026-11-03) — HIGH. Active list matches F1–F5; out of scope matches section 4.
- `.planning/codebase/ARCHITECTURE.md` and `CONCERNS.md` (mapped 2026-11-03) — HIGH for what the Java tree does not do yet, and for the sketch's deviations.
- `playground/bot-mockup/index.html` and `playground/bot-mockup/tests/notes.spec.js` — HIGH as a description of the sketch, not of the bot.
- Telegram Bot API, `sendMessage` 1–4096 characters, `callback_data` 1–64 bytes, `answerCallbackQuery`, `editMessageReplyMarkup`: https://core.telegram.org/bots/api (page read 2026-11-03; changelog header shows Bot API 10.3 on 2026-08-24). Confidence MEDIUM (`classify-confidence` for context7).
- Inline keyboards should be edited in place when toggling: https://core.telegram.org/bots/features#inline-keyboards (read 2026-11-03). MEDIUM.
- Bulk-send caution, about one message per second in a single chat: https://core.telegram.org/bots/faq (read 2026-11-03). MEDIUM. Not a design driver for one owner.
- Spring Framework 7.0.5 scheduling: six-field cron and `zone` on `@Scheduled`. Spring Boot 4.1 scheduling is enabled with `@EnableScheduling` (https://docs.spring.io/spring-boot/4.1/reference/features/task-execution-and-scheduling.html, read 2026-11-03). Parent in `pom.xml` is Spring Boot 4.1.1. MEDIUM.
- Market comparison of other inbox bots — not done. LOW. Do not treat this file as a survey of Pocket, Saved Messages, or third-party bots.

## Gaps

- The spec never names the owner's time zone or the morning hour. F5 needs both in configuration. Do not silently use the JVM zone, and do not hard-code a city in this research.
- Whole-word match, AND across multiple query words, and "a message is a link only if it is entirely one URL" are readings of sections 3 and 4. They are not spelled out as algorithms. The sketch uses substring match and the same single-URL check.
- Russian stemming was not requested and was not researched as a library choice. It stays out with semantic search.
- Whether an empty yesterday should produce a message is not in the spec. This file recommends one line so a missed job is visible. That is a behavior of F5, not a new feature.
- Catch-up: one digest if the process starts later the same local morning is recommended so a reboot does not skip section 7. Backfill of several missed days was not researched and is not required.
- TelegramBots 10.3 Java method names were not part of this feature pass. The limits above are the HTTP Bot API, not the Java wrapper.
- The current Bot FAQ text that was fetched does not repeat an older "bots cannot write first" sentence. Operationally F5 still needs a chat id from a previous allowed message, because `sendMessage` requires one. That is a dependency, not a quoted platform ban.

---
*Feature research for: personal single-user Telegram inbox*
*Researched: 2026-11-03*
