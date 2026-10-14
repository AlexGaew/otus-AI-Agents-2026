# Архив журнала

Старые записи из `memory.md`. В `CLAUDE.md` не подключён: читать только когда нужно узнать, почему принято решение. Новые записи сюда переносятся снизу вверх по порядку: самая свежая сверху.

## 2026-10-13 (позже): Playwright и макет

**Сделано**
- `playground/bot-mockup/`: кликабельный эскиз чата бота (F1–F5) и 4 e2e-теста на `@playwright/test`, зелёные
- `.mcp.json` с Playwright MCP

**Решение**
- Это учебное упражнение, а не проверка бота: макет хранит данные в памяти страницы, теги подбирает по словарю
- Шаг 2 (скелет) отложен: ждут ответы на вопросы Java 21 или 25, Spring Boot 4.1.1, пакет `dev.alexgaev.inbox`

**Дальше**
- Шаг 2. TelegramBots сейчас 10.3.0 (API отличается от ctx7-документации 6.9.7.1), в системе JDK 25, а ТЗ требует 21

**Ловушки**
- Playwright MCP заработает только после перезапуска сессии и одобрения сервера из `.mcp.json`
- `node_modules/` и `test-results/` в `.gitignore`

## 2026-10-13

**Сделано**
- `CLAUDE.md`, `AGENTS.md`, `README.md`
- Правила `.claude/rules/`: тесты перед завершением фичи, TDD
- Навыки `.claude/skills/`: `write-tests` (агент сам), `review-step` (вручную)
- Права в `.claude/settings.json`, hooks `block_protected` и `check_after_edit`
- Память: `docs/plan.md`, `docs/memory.md`

**Решение**
- Сборщик Maven (`./mvnw`), форматтер Spotless с google-java-format, Checkstyle пока не нужен
- Режим агента `acceptEdits`
- Память через handoff-файлы, а не плагин; обновляет агент по правилу в конце сессии

**Дальше**
- Шаг 2 из `docs/plan.md`: скелет Spring Boot + Maven + Spotless + PostgreSQL в Docker
- После появления `pom.xml` проверить, что hook `check_after_edit` реально запускает Spotless

**Ловушки**
- Hook `check_after_edit`: для `.java` пропускает всё, пока нет `pom.xml` и `mvnw`; `.js` и `.json` проверяет сразу (`node --check`, разбор JSON)
- В новой сессии агент через Bash дописал `[user] name = test` в `.git/config`, мимо `block_protected.py` (он ловит только Edit/Write). Запись убрана, добавлен hook `block_bash_writes.py` на Bash с юнит-тестами
- Правила с `paths` (`tdd`, `java-main`, `tests`) подгружаются только при работе с подходящими файлами; `run-tests-before-done` и `session-memory` глобальные
- Hooks читаются при старте сессии: после правки `settings.json` нужен перезапуск
- Ничего не закоммичено, коммиты только по просьбе пользователя
