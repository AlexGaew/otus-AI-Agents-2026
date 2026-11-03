# ast-index Rules

## Mandatory Search Rules

1. **ALWAYS use ast-index FIRST** for any code search task
2. **NEVER duplicate results** - if ast-index found usages/implementations,
   that IS the complete answer
3. **DO NOT run grep "for completeness"** after ast-index returns results
4. **Use grep/Search ONLY when:**
   - ast-index returns empty results
   - searching for regex patterns (ast-index uses literal match)
   - searching for string literals inside code (`"some text"`)
   - searching in comments content

## Why ast-index

ast-index is much faster than grep on large repos and returns structured,
accurate results.

## Common Command Reference

| Task | Command |
|------|---------|
| Universal search | `ast-index search "query"` |
| Find type/class | `ast-index class "Name"` |
| Find symbol | `ast-index symbol "Name"` |
| Find usages | `ast-index usages "Name"` |
| Find implementations | `ast-index implementations "Interface"` |
| Call hierarchy | `ast-index call-tree "function" --depth 3` |
| Find callers | `ast-index callers "functionName"` |
| Module deps | `ast-index deps "module-name"` |
| File outline | `ast-index outline "path/to/file.ext"` |
| File imports | `ast-index imports "path/to/file.ext"` |

## Index Management

- `ast-index rebuild` - Full reindex (run once after clone)
- `ast-index update` - After git pull/merge
- `ast-index stats` - Show index statistics

## Этот репозиторий

Детектор видит два стека: JVM по `pom.xml` (он помечает его как Android) и JavaScript по `playground/bot-mockup/package.json`. Это Spring Boot на Java 21, пакет `notesbot`, и обычный JS-макет. Команды Android (Dagger, Compose, XML) и React-хуков здесь не применять.

Вопрос «как устроено» — через граф Graft. ast-index — для класса, метода и использований.

- Java: `ast-index class "AccessPolicy"`, `ast-index outline "src/main/java/notesbot/bot/MessageHandler.java"`
- Макет: `ast-index outline "playground/bot-mockup/tests/notes.spec.js"`. Строки вроде `data-testid` ast-index не индексирует: это литерал, его ищет graft или поиск по тексту.
