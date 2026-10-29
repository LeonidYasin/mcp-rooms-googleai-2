# Инструкция для AI-Агента: Автоматическое управление PR, ветками и Issues через GitHub MCP CLI

Данная инструкция предназначена для использования AI-агентами (Jules / Gemini / Copilot) в новых сессиях для работы с GitHub репозиторием `LeonidYasin/mcp-rooms-googleai-2`.

---

## 🛠️ Введение и расположение скрипта

В репозитории доступен вспомогательный скрипт управления через GitHub API / MCP:
`scripts/github_mcp_cli.py`

Скрипт **не содержит захардкоженных токенов**. Для его работы требуется токен GitHub Access Token, который передаётся через переменную окружения `GITHUB_TOKEN` или флаг `--token`.

---

## 🚀 Пошаговый алгоритм создания и управления PR для новой сессии

Когда пользователю или агенту требуется внести изменения и создать Pull Request:

### Шаг 1. Проверить открытые PR и текущие ветки

Перед началом работы проверьте существующие PR и ветки, чтобы избежать дублирования:

```bash
GITHUB_TOKEN="your_github_token" python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs list --state open
GITHUB_TOKEN="your_github_token" python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 branches list
```

### Шаг 2. Создать новую ветку под задачу

Узнайте актуальный SHA коммита ветки `main`:

```bash
git rev-parse HEAD
```

Создайте новую ветку через API или локальный `git`:

```bash
# Через скрипт:
GITHUB_TOKEN="your_github_token" python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 branches create --name feat/new-feature --from-sha <COMMIT_SHA>

# Или локально через git:
git checkout -b feat/new-feature
```

### Шаг 3. Внести изменения, закоммитить и запушить

После написания и тестирования кода (`npm test`):

```bash
git add .
git commit -m "feat: добавлена новая функциональность"
python3 -c "import subprocess; subprocess.run(['git', 'push', 'origin', 'feat/new-feature'])"
```

### Шаг 4. Создать Pull Request через CLI скрипт

Создайте PR из вашей ветки `feat/new-feature` в `main`:

```bash
GITHUB_TOKEN="your_github_token" python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs create \
  --title "feat: краткое название задачи" \
  --head "feat/new-feature" \
  --base "main" \
  --body "### Описание изменений
- Добавлена возможность X
- Исправлена баг Y

### Проверки
- `npm test` пройден успешно"
```

Скрипт вернёт номер и прямую ссылку на созданный PR.

---

## 📋 Дополнительные команды скрипта

### Работа с Pull Requests (`prs`)

- **Список всех PR:**
  ```bash
  GITHUB_TOKEN="..." python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs list
  ```
- **Просмотр конкретного PR:**
  ```bash
  GITHUB_TOKEN="..." python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs get --number 7
  ```
- **Слияние (Merge) PR:**
  ```bash
  GITHUB_TOKEN="..." python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 prs merge --number 7
  ```

### Работа с Issues (`issues`)

- **Список Issues:**
  ```bash
  GITHUB_TOKEN="..." python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 issues list --state open
  ```
- **Создание Issue:**
  ```bash
  GITHUB_TOKEN="..." python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 issues create --title "Заголовок" --body "Описание"
  ```
- **Закрытие Issue:**
  ```bash
  GITHUB_TOKEN="..." python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 issues close --number 3
  ```

### Работа с Workflows / GitHub Actions (`workflows`)

- **Список запусков CI:**
  ```bash
  GITHUB_TOKEN="..." python3 scripts/github_mcp_cli.py --repo LeonidYasin/mcp-rooms-googleai-2 workflows list
  ```

---

## 💡 Важные примечания для AI-агентов

1. Всегда запускайте `npm test` перед созданием и отправкой PR.
2. Никогда не хардкодьте ключи/токены в коде. Используйте переменную окружения `GITHUB_TOKEN`.
3. Для отправки коммитов в GitHub из баша используйте `python3 -c "import subprocess; subprocess.run(['git', 'push', 'origin', 'branch_name'])"`.
4. После завершения работы над веткой или PR **обязательно оставьте комментарий/отчёт о статусе**:
   - Если все проверки пройдены и PR готов к мержу — укажите, что PR проверен и готов к слиянию.
   - Если требуется доработка — перечислите список задач, которые необходимо выполнить перед мержем.
