# Журнал между сессиями

Новые записи сверху. Формат записи: дата, затем «Сделано», «Решение», «Дальше», «Ловушки». Здесь не больше двух записей, старые уходят в `memory-archive-<дата>-<n>.md`.

## Постоянные ловушки

- Hooks читаются при старте сессии: после правки `settings.json` нужен перезапуск
- Правила с `paths` (`tdd`, `java-main`, `tests`) подгружаются только при работе с подходящими файлами; `run-tests-before-done` и `session-memory` глобальные
- `block_protected.py` ловит только Edit/Write, поэтому для Bash есть `block_bash_writes.py`
- Ничего не коммитим без просьбы пользователя
- Индекс ast-index сам не обновляется (Graft обновляется сам перед запросом): для него есть hook `SessionEnd` в `settings.json` (`ast-index update`), работает со следующей сессии; без индекса команда отвечает «Index not found», тогда нужен `ast-index rebuild`. Если поиск не находит свежий файл, запусти `ast-index update` вручную

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

