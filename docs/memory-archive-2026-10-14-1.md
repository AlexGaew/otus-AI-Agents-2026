# Архив журнала

Старые записи из `memory.md`. В `CLAUDE.md` не подключён: читать только когда нужно узнать, почему принято решение. Новые записи сюда переносятся снизу вверх по порядку: самая свежая сверху.

## 2026-10-14 (позже): AccessPolicy, MessageHandler, правки по обратной связи

**Сделано**
- Green: `src/main/java/notesbot/access/AccessPolicy.java`, `src/main/java/notesbot/bot/MessageHandler.java`; `./mvnw test` 6 из 6, `spotless:check` чистый
- `docs/about.md`: «Как проверяли» (`java-main.md` подгружается при Read файла из `src/main`, `tests.md` и `tdd.md` при Read из `src/test`), скриншоты 1, 2, 4 вписаны, красная и зелёная фазы TDD
- В `docs/screenshots/` добавлены `lint.png`, `e2e-green-test.png`, `error_tests.png`, `test_passed-1.png`, `test_passed-2.png`, `отчет-по-п1.png`

**Решение**
- `MessageHandler` пока отвечает «Принято: <текст>» только пользователю из белого списка; сохранения и теги будут на шагах 3–4
- Скриншот lint получен записью битого `playground/scratch.json` (hook `check_after_edit`), файл удалён

**Дальше**
- Скриншот 3 (`memory-session2.png`): в новой сессии спросить «на чём мы закончили?» и снять ответ
- Бот на TelegramBots с настройкой из переменных окружения, `compose.yaml` с PostgreSQL; после этого отметить шаг 2 в `plan.md`
- `AGENTS.md`, «Команды»: заполнить сборку, тесты, линтер бота (`./mvnw test`, `./mvnw spotless:check`, `./mvnw spotless:apply`); запуск с PostgreSQL ждёт `compose.yaml`
- В `about.md`: убрать «Скелета бота пока нет», вписать или переименовать `отчет-по-п1.png`
- Добавить `target/` в `.gitignore`; заменить остатки `inbox` в `playground/bot-mockup/tests/inbox.spec.js`
- Ничего не закоммичено

**Ловушки**
- Правила с `paths` подгружаются при Read подходящего файла, а Write их не подгружает
- `./mvnw test` падает целиком, пока у любого теста нет production-класса (тесты компилируются вместе)

## 2026-10-14: начало скелета, Java 21

**Сделано**
- `pom.xml` (Spring Boot 4.1.1, Java 21, JDBC + PostgreSQL, TelegramBots 10.3.0, Spotless), Maven Wrapper `mvnw`
- Тесты первыми (red): `AccessPolicyTest`, `MessageHandlerTest` в `src/test/java/notesbot/`; production-кода ещё нет
- По обратной связи: `docs/about.md` (с TODO), команды макета в `AGENTS.md`, `docs/screenshots/e2e-mockup-search.png`
- Поставлен JDK 21 (Temurin) в `~/Library/Java/JavaVirtualMachines/temurin-21`

**Решение**
- Пакет `notesbot` (без имени автора), groupId и artifactId `notesbot`; имя `inbox` убрано
- Только Java 21: `JAVA_HOME` в `~/.zshrc` и `.claude/settings.local.json`, maven-enforcer валит сборку на другой версии
- Форматер остаётся google-java-format, версия закреплена на 1.28.0: 1.37.0 падает с `InvocationTargetException` (причина не выяснена, на JDK 25 дело не было)

**Дальше**
- Шаг 2 дальше по TDD: `AccessPolicy` и `MessageHandler` в `src/main/java/notesbot/` (green), затем бот на TelegramBots, конфигурация из переменных окружения, `compose.yaml` с PostgreSQL
- После зелёных тестов: заполнить команды бота в `AGENTS.md`, раздел «Как проверяли» и скриншоты в `docs/about.md`
- Поменять остатки старого имени: `playground/bot-mockup/tests/inbox.spec.js`, строка про пакет в старой записи ниже
- Добавить `target/` в `.gitignore`; выяснить, что за папка `screens/`
- Ничего не закоммичено

**Ловушки**
- Hook `block_bash_writes` блокирует любую bash-команду, где в тексте встречается `.env`, даже в heredoc; такой текст писать через Write/Edit
- Maven в терминале и в hooks берёт `JAVA_HOME`; уже открытые окна нужно перезапустить после правки `~/.zshrc`
- Отложенные вопросы: TelegramBots 10.3.0 отличается от ctx7-документации 6.9.7.1 (проверять API по jar)

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
