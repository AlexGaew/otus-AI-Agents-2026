# О проекте и настройке агента

## Стек

Java 21, Spring Boot, Maven (`./mvnw`), Spotless (google-java-format), TelegramBots, PostgreSQL в Docker, Spring `@Scheduled`. Скелет бота в `src/` (шаг 2 в `plan.md` ещё не закрыт: нет самого бота на TelegramBots и `compose.yaml`); есть `AccessPolicy` и `MessageHandler` с юнит-тестами. Отдельно лежит макет интерфейса на HTML с e2e-тестами Playwright (`playground/bot-mockup/`).

## Path-правила

| Файл | Когда подгружается |
|---|---|
| `.claude/rules/java-main.md` | `src/main/**/*.java`: белый список, секреты из окружения, изоляция LLM |
| `.claude/rules/tdd.md` | `src/**/*.java`, `playground/**/*.js`, `playground/**/*.html` |
| `.claude/rules/tests.md` | `src/test/**`, `playground/**/tests/**` |

Глобальные (без `paths`): `run-tests-before-done.md`, `session-memory.md`.

### Как проверяли

Проверка path-правила `java-main.md`: одна и та же задача в двух местах, затем вопрос агенту «какие правила проекта ты сейчас применяешь?».

1. Задача: работа с классом `AccessPolicy` (белый список Telegram ID).
2. Вариант А: файл в `src/main/java/notesbot/access/AccessPolicy.java`.
3. Вариант Б: соседняя папка с тем же пакетом, `src/test/java/notesbot/access/AccessPolicyTest.java`.

Результат (2026-10-14, чтение файлов через Read):

| Файл | Подгрузились правила |
|---|---|
| `src/test/.../AccessPolicyTest.java` | `tests.md`, `tdd.md` |
| `src/main/.../AccessPolicy.java` | `java-main.md` |

Самопроверка агента: на вопрос «какой у нас отчётный материал по п.1?» он сопоставил требования с разделами этого файла. Статус «1 из 4» по скриншотам на снимке устарел: сейчас они все на месте.

![Отчёт агента по п.1](screenshots/отчет-по-п1.png)

Запись нового файла (Write) правило не подгружает: оно пришло только после чтения файла из `src/main`. Для `java-main.md` это важно: правила про белый список и секреты применяются, когда агент открывает код, а не когда создаёт его с нуля.

## Навыки

- `write-tests`: агент сам пишет юнит-тесты до production-кода по схеме given / when / then.
- `review-step`: ручная проверка шага ТЗ перед слиянием, запускается только командой `/review-step`.

## Hooks

- `block_protected.py` (Edit/Write): блокирует правку защищённых файлов.
- `block_bash_writes.py` (Bash): блокирует запись в защищённые файлы и работу с файлами секретов через shell.
- `check_after_edit.py`: после правки проверяет `.js` (`node --check`), `.json` (разбор), `.java` (Spotless, когда появится `pom.xml`).

## Скриншоты

Нужны четыре, лежат в `docs/screenshots/`. Терминальные снимки делает пользователь:

1. Блок файла секретов: `screenshots/block-env.png`. Hook `block_bash_writes` остановил bash-команду, в тексте которой встретилось имя файла секретов.

   ![Блок команды с файлом секретов](screenshots/block-env.png)
2. Срабатывание линтера или форматтера: `screenshots/lint.png`. Hook `check_after_edit` после записи файла с битым JSON вернул «Невалидный JSON … Expecting value: line 1 column 37».

   ![Срабатывание hook проверки после правки](screenshots/lint.png)
3. Продолжение по memory во второй сессии: `screenshots/start_new_session.png`. На вопрос «На чём мы закончили?» агент без подсказок назвал шаг 2 и список «Дальше» из `docs/memory.md`.

   ![Продолжение по memory во второй сессии](screenshots/start_new_session.png)
4. Зелёный e2e: `screenshots/e2e-green-test.png`, терминал с `npm test` в `playground/bot-mockup`, 4 теста пройдены.

   ![Зелёный e2e в терминале](screenshots/e2e-green-test.png)

   Снимок страницы макета из теста:

![Макет, поиск (e2e)](screenshots/e2e-mockup-search.png)

### TDD на Java (шаг 2)

Красная фаза: тесты написаны раньше кода, IDE показывает 16 ошибок компиляции.

![Красная фаза](screenshots/error_tests.png)

Зелёная фаза: после `AccessPolicy` и `MessageHandler` в `src/main` все тесты проходят (`./mvnw test`: 6 из 6).

![AccessPolicyTest зелёный](screenshots/test_passed-1.png)
![MessageHandlerTest зелёный](screenshots/test_passed-2.png)
