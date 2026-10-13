#!/usr/bin/env python3
"""PostToolUse: проверка файла после правки.

- .java: ./mvnw -q spotless:apply, если есть pom.xml и mvnw (иначе пропуск, скелета ещё нет)
- .js: node --check (синтаксис)
- .json: разбор JSON
Ошибка: код выхода 2 и текст в stderr, агент видит его и исправляет файл.
"""
import json
import os
import subprocess
import sys


def fail(message):
    print(message, file=sys.stderr)
    return 2


def check_java(root):
    mvnw = os.path.join(root, "mvnw")
    if not os.path.isfile(os.path.join(root, "pom.xml")) or not os.path.isfile(mvnw):
        return 0
    try:
        result = subprocess.run([mvnw, "-q", "spotless:apply"], cwd=root,
                                capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return fail("spotless:apply не уложился в 120 секунд")
    if result.returncode != 0:
        return fail("spotless:apply завершился с ошибкой:\n" + (result.stdout + result.stderr)[-2000:])
    return 0


def check_js(path):
    try:
        result = subprocess.run(["node", "--check", path], capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        return 0  # node не установлен, проверять нечем
    if result.returncode != 0:
        return fail(f"Синтаксическая ошибка в {path}:\n{result.stderr[-2000:]}")
    return 0


def check_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            json.load(f)
    except (ValueError, OSError) as e:
        return fail(f"Невалидный JSON в {path}: {e}")
    return 0


def main():
    data = json.load(sys.stdin)
    path = data.get("tool_input", {}).get("file_path", "")
    if not path or not os.path.isfile(path) or "node_modules" in path.split(os.sep):
        return 0
    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    if path.endswith(".java"):
        return check_java(root)
    if path.endswith(".js"):
        return check_js(path)
    if path.endswith(".json"):
        return check_json(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
