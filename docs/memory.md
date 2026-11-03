# Журнал между сессиями

Новые записи сверху. Формат записи: дата, затем «Сделано», «Решение», «Дальше», «Ловушки». Здесь не больше двух записей, старые уходят в `memory-archive-<дата>-<n>.md`.

## Постоянные ловушки

- Hooks читаются при старте сессии: после правки `settings.json` нужен перезапуск
- Правила с `paths` (`tdd`, `java-main`, `tests`) подгружаются только при работе с подходящими файлами; `run-tests-before-done` и `session-memory` глобальные
- `block_protected.py` ловит только Edit/Write, поэтому для Bash есть `block_bash_writes.py`
- Ничего не коммитим без просьбы пользователя
- Индекс ast-index сам не обновляется (Graft обновляется сам перед запросом): для него есть hook `SessionEnd` в `settings.json` (`ast-index update`), работает со следующей сессии; без индекса команда отвечает «Index not found», тогда нужен `ast-index rebuild`. Если поиск не находит свежий файл, запусти `ast-index update` вручную. Индекс лежит в кэше пользователя, не в репозитории
- `block_bash_writes` блокирует любую bash-команду, в тексте которой есть `.env`, даже в heredoc; такой текст писать через Write/Edit
- Maven в терминале и в hooks берёт `JAVA_HOME`; после правки `~/.zshrc` уже открытые окна нужно перезапустить
- TelegramBots 10.3.0 отличается от документации ctx7 для 6.9.7.1: API сверять по jar. Класс бота в 10.3.0 — `SpringLongPollingBot`, не `TelegramLongPollingBot` из старых примеров
- `ast-index search` не индексирует строковые литералы вроде `data-testid`
- Команды GSD писать в каталог `/Users/aleksandrgaev/Developer_materials/Otus/otus-AI-Agents-2026`. Сессия Grok — отдельный клон, её `.planning` другие агенты не видят
- Образ `postgres:latest` сейчас линия 18 с другим путём данных. Том не удалять: `docker compose down -v` его стирает

## 2026-11-03: GSD Discovery

**Сделано**
- В этом каталоге, ветка `hw2`: `.planning/PROJECT.md`, `.planning/config.json` и `.planning/research/` (`STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md`). Проверка `verify-summary` для `SUMMARY.md` прошла
- Коммиты: `f28ff79`, `294d2c2`, `e83fe92`, затем `4cf0f24` убрал `.planning/research/.cache/` из дерева и дописал его в `.gitignore`. `origin/hw2` указывает на `4cf0f24`. В истории `e83fe92` кэш ещё есть
- В `README.md` дописаны Discovery, список файлов `.planning/` и снимки `usage/` (Context usage до и после compact). Коммита нет

**Решение**
- Этап Discovery здесь — исследование домена до требований, каталог `.planning/research/`. Отдельного `DISCOVERY.md` нет: его пишет планирование уже существующей фазы, а фаз ещё нет
- Стек из ТЗ не менялся. Предложенные фазы совпадают с шагами 2–7 `docs/plan.md`
- Настройки GSD взяты как запуск без опроса: режим yolo, исследование включено, модель сессии (`inherit`), документы планирования коммитятся

**Дальше**
- Если продолжать GSD: требования и roadmap, не повторное исследование. Шаг 2 бота по-прежнему открыт
- `.planning/codebase/` всё ещё не в git

**Ловушки**
- Стартер TelegramBots 10.3.0 собран против Boot 3.5.5. Классы на Boot 4.1.1 проверены по jar, живой запуск не делался
- Часовой пояс и час дайджеста в ТЗ не заданы

## 2026-11-02: навигация для Grok

**Сделано**
- Индекс ast-index собран: 6 файлов, 26 символов. Правило `.claude/rules/ast-index.md`. В `.claude/settings.json` добавлены marketplace, плагин и разрешение `Bash(ast-index *)`
- Graft подключён к Grok: `.grok/skills/graft/SKILL.md` и `.grok/config.toml` с MCP. Граф уже был, `graft check` совпадает с кодом

**Решение**
- `AGENTS.md`, `CLAUDE.md`, правила, навыки и hooks не переписывал: Grok их уже читает
- `graft init` только для grok и без пересборки графа: файлы Claude уже были, `--deep` не запускал (это платный проход LLM, структурного графа хватает)
- Детектор ast-index помечает `pom.xml` как Android. Это Spring Boot, поэтому в правило не попали команды Dagger, Compose и React

**Дальше**
- Шаг 2 плана всё ещё открыт: бот на TelegramBots, конфигурация из переменных окружения, `compose.yaml` с PostgreSQL. Отметить шаг после тестов
- Новая сессия Grok подхватит `.grok/config.toml` после перезапуска
- Ничего не закоммичено. В коммит, если попросят: `.claude/rules/ast-index.md`, правка `.claude/settings.json`, каталог `.grok/`. Каталог `graft/` в git не класть

**Ловушки**
- `ast-index search "data-testid"` пустой: это литерал, не символ
- Обновление graft с 0.21.1 до 0.28.1 не ставил


