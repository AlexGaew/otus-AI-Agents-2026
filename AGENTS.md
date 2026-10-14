# AGENTS.md

## Проект

Личный Telegram-бот «входящие»: принимает заметки и ссылки, предлагает теги через LLM, хранит записи в PostgreSQL, ищет по словам и раз в день присылает дайджест. Один пользователь, доступ по белому списку Telegram ID. Стек: Java 21, Spring Boot, TelegramBots, PostgreSQL в Docker, Spring `@Scheduled`. Требования — в `ТЗ-telegram-bot.md`.

## Команды

Бот (Spring Boot, Maven) и макет интерфейса в `playground/bot-mockup/` (нужен Node.js):

- Java: только 21. `JAVA_HOME` на JDK 21 (macOS: `/usr/libexec/java_home -v 21`); на другой версии `./mvnw` падает по правилу enforcer. Spotless: google-java-format закреплён на 1.28.0 (1.37.0 падает).
- Установка макета: `cd playground/bot-mockup && npm install && npx playwright install chromium`
- Запуск макета: открыть `playground/bot-mockup/index.html` в браузере
- Все e2e-тесты макета: `cd playground/bot-mockup && npm test`
- Один e2e-тест: `cd playground/bot-mockup && npx playwright test -g "поиск без совпадений"`
- Юнит-тесты hooks: `python3 .claude/hooks/test_block_bash_writes.py`
- Бот, сборка и юнит-тесты: `./mvnw test` (полная проверка: `./mvnw verify`)
- Бот, линтер: `./mvnw spotless:check`; автоформат: `./mvnw spotless:apply`
- Бот, запуск с PostgreSQL в Docker: TODO, ждёт бота на TelegramBots и `compose.yaml` (шаг 2)

## Конвенции

- Код и идентификаторы — на английском; комментарии и сообщения пользователю бота — на русском.
- Стиль, именование и структуру пакетов фиксируем после появления скелета и линтера; до этого следуем стандартным соглашениям Java и Spring Boot.

## Правила работы

- Основная ветка `main`; разработчик один, поэтому работаем и пушим прямо в неё, без веток. Каждый шаг ТЗ (F1…F5, деплой) — отдельный коммит или серия коммитов.
- Коммиты — только по просьбе пользователя.
- Работать строго по порядку шагов из ТЗ; не реализовывать то, что в разделе «Вне рамок».
- Запрещено:
  - класть секреты (токен бота, ключ модели, пароль БД) в репозиторий, в том числе в `application.yml`, `.env` и compose-файлы под git; только переменные окружения;
  - отвечать пользователям не из белого списка;
  - удалять или пересоздавать тома PostgreSQL и данные без явного разрешения;
  - добавлять зависимости и менять стек из ТЗ без согласования.
