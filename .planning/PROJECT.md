# notesbot — Telegram-бот «входящие»

## What This Is

Личный Telegram-бот для одного человека: принимает заметки и ссылки, предлагает теги через языковую модель, хранит записи в PostgreSQL, ищет по словам и раз в день присылает дайджест. Отдельного фронтенда нет. Доступ только по белому списку Telegram ID.

## Core Value

Заметка или ссылка, отправленная в Telegram, сохраняется и потом находится по слову; на следующее утро приходит дайджест за предыдущий день.

## Requirements

### Validated

- ✓ Папка проекта, `CLAUDE.md`, `AGENTS.md`, правила, навыки, hooks и память сессии — existing (шаг 1 `docs/plan.md`)
- ✓ Скелет Maven на Java 21: Spring Boot 4.1.1, Spotless (google-java-format 1.28.0), enforcer JDK 21, JDBC-стартер, драйвер PostgreSQL, TelegramBots 10.3.0 в `pom.xml` — existing
- ✓ Белый список: `AccessPolicy` молча отклоняет чужой и пустой Telegram ID — existing
- ✓ `MessageHandler` отвечает «Принято: …» только разрешённому отправителю и ничего не отвечает остальным — existing
- ✓ Макет диалога и Playwright-тесты в `playground/bot-mockup/` — existing, это не рантайм бота

### Active

- [ ] Довести шаг 2: приложение Spring Boot, конфигурация из переменных окружения, PostgreSQL в Docker (`compose.yaml`), живой бот отвечает только владельцу
- [ ] F1: текстовая заметка сохраняется с датой и временем
- [ ] F2: ссылка сохраняется вместе с заголовком и кратким содержанием страницы; сбой загрузки страницы не теряет запись
- [ ] F3: после сохранения модель предлагает теги, владелец подтверждает или правит их кнопками; сбой модели не теряет запись
- [ ] F4: поиск по словам в тексте, заголовке и тегах
- [ ] F5: утренний дайджест за предыдущий день, сгруппированный по тегам, через Spring `@Scheduled`
- [ ] Деплой на VPS в Docker; перезапуск не теряет данные

### Out of Scope

- Задачи со сроком и напоминания — не входят в первую версию ТЗ
- Голосовые сообщения, картинки и файлы — не входят в первую версию ТЗ
- Смысловой поиск — не входит в первую версию ТЗ; поиск только по словам
- Мониторинг цен, объявления, рыбалка — не входят в первую версию ТЗ
- Несколько пользователей — один владелец и белый список
- Отдельный веб-интерфейс — интерфейс только Telegram; макет в `playground/` не подключать к боту
- Смена стека из ТЗ — Java 21, Spring Boot, TelegramBots, PostgreSQL, `@Scheduled` зафиксированы

## Context

Источник требований: `ТЗ-telegram-bot.md` (2026-10-12) и порядок работ в `docs/plan.md`. Код уже начат: пакет `notesbot`, классы `notesbot.access.AccessPolicy` и `notesbot.bot.MessageHandler`. Карта репозитория лежит в `.planning/codebase/`.

Сейчас нет `@SpringBootApplication`, `application.yml`, `compose.yaml`, long polling, JDBC-репозитория, клиента модели и `@Scheduled`. Зависимости TelegramBots объявлены, но из Java не вызываются. Ответ «Принято» — заглушка, запись не сохраняется.

Побочная цель ТЗ: пройти проект вместе с кодинг-агентом, включая правила, hooks и skills. Хуки и навыки добавляются, когда в них появляется реальная потребность, а не заранее.

## Constraints

- **Tech stack**: Java 21, Spring Boot, TelegramBots, PostgreSQL в Docker, Spring `@Scheduled`, дешёвая облачная модель только для тегов и краткого содержания — так зафиксировано в ТЗ, раздел 5
- **Secrets**: токен бота, ключ модели и пароль БД только из переменных окружения; не класть их в репозиторий, `application.yml`, `.env` под git и compose
- **Access**: чужому Telegram ID не отвечать и ничего для него не сохранять
- **Data loss**: сбой модели или недоступная страница не должны терять запись
- **LLM boundary**: вызовы модели за интерфейсом, в юнит-тестах подменяются заглушкой
- **Tests**: юнит-тесты не ходят в сеть, Telegram, модель и реальную PostgreSQL
- **Order**: шаги ТЗ идут по порядку; функциональность из раздела «Вне рамок» не делать
- **Dependencies**: не добавлять зависимости и не менять стек без согласования
- **Data**: не удалять и не пересоздавать тома PostgreSQL без явного разрешения
- **Process**: код по TDD (red → green → refactor); коммиты только по просьбе, кроме коммитов документов, которые требует запущенная команда GSD
- **JDK**: `JAVA_HOME` только на JDK 21; google-java-format закреплён на 1.28.0

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Стек из раздела 5 ТЗ не пересматривается | Учебный проект и уже объявленные зависимости в `pom.xml` | — Pending |
| Один пользователь, белый список ID | ТЗ, раздел 2; уже реализовано в `AccessPolicy` | ✓ Good |
| Интерфейс только Telegram | ТЗ, раздел 5; макет остаётся отдельным | — Pending |
| Секреты только из окружения | ТЗ, раздел 6, и правила репозитория | — Pending |
| Порядок фаз совпадает с `docs/plan.md`, шаги 2–7 | Курс требует идти по шагам ТЗ, а не нарезать заново | — Pending |
| Планирование GSD ведётся в этом каталоге, ветка `hw2` | Артефакты `.planning/` должны быть видны любому агенту, который открывает проект | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-03 after initialization*
