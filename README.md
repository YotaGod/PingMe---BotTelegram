# Telegram Smart Reminder Interactive

A persistent, timezone-aware, fault-tolerant, interactive reminder bot for Telegram.

## Features (MVP)

- One-time and recurring reminders
- Natural language time parsing
- Interactive actions (Snooze, Complete, Skip)
- Weekday schedules (Monday-Friday)
- Delete one or multiple active reminders with `/delete`
- Telegram command menu with `/help`
- Timezone-aware
- Fault-tolerant scheduling

## Installation (Windows PowerShell)

1. Open PowerShell in the project root.
2. Create and activate a virtual environment (recommended):
   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
   If PowerShell blocks activation, run the commands below without activating and use
   `.\.venv\Scripts\python.exe` explicitly.
3. Install dependencies:
   ```bash
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` and set `BOT_TOKEN` to a new token from BotFather.
5. Apply database migrations:
   ```powershell
   .\.venv\Scripts\python.exe -m alembic upgrade head
   ```
6. Start the bot:
   ```bash
   .\.venv\Scripts\python.exe -m app.main
   ```

Keep the terminal open while the bot is running. Press `Ctrl+C` to stop it.

## Configuration

The bot reads these values from `.env`:

- `BOT_TOKEN`: required Telegram bot token.
- `DATABASE_URL`: defaults to `sqlite+aiosqlite:///data.db`.
- `TIMEZONE`: defaults to `Asia/Jakarta`.
- `LOG_LEVEL`: defaults to `INFO`.
- `BOT_MODE`: currently only `polling` is supported.

## Usage

- `/reminder`: create a reminder; choose `Hari Kerja (Senin-Jumat)` for weekday-only reminders.
- `/list`: list active reminders.
- `/delete`: select one or multiple reminders, then choose `Hapus Terpilih`.
- `/today`: show reminders scheduled for today.
- `/upcoming`: show the next active reminders.
- `/help`: show all commands. The same commands are available from Telegram's `/` menu.

To verify the environment before starting:

```powershell
.\.venv\Scripts\python.exe -m compileall -q app migrations
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m alembic current
```

## Deploy 24/7 on Oracle Cloud Free Tier

The simplest first deployment is one Ubuntu VM running the bot and its SQLite database. Polling does not require an open inbound application port; only SSH port 22 is needed.

1. In Oracle Cloud Console, create an Always Free Compute VM with Ubuntu, assign a public IPv4 address, and save an SSH key. Use an AMD micro shape if Ampere capacity is unavailable.
2. Connect to the VM:
   ```bash
   ssh ubuntu@YOUR_PUBLIC_IP
   ```
3. Install the runtime:
   ```bash
   sudo apt update
   sudo apt install -y python3-venv python3-pip git
   sudo mkdir -p /opt/pingme
   sudo chown ubuntu:ubuntu /opt/pingme
   ```
4. Copy the project to `/opt/pingme` using Git or `scp`. Do not copy `.venv`, `data.db`, or the local `.env` from the workstation.
5. On the VM, create the environment and configuration:
   ```bash
   cd /opt/pingme
   python3 -m venv .venv
   .venv/bin/python -m pip install -r requirements.txt
   cp .env.example .env
   nano .env
   ```
   Set a new `BOT_TOKEN`, keep `DATABASE_URL=sqlite+aiosqlite:///data.db`, and set `TIMEZONE=Asia/Jakarta`.
6. Initialize the database and test the bot:
   ```bash
   .venv/bin/python -m alembic upgrade head
   .venv/bin/python -m app.main
   ```
   Stop the foreground test with `Ctrl+C`.
7. Create `/etc/systemd/system/pingme.service`:

   ```ini
   [Unit]
   Description=PingMe Telegram Reminder Bot
   After=network-online.target
   Wants=network-online.target

   [Service]
   User=ubuntu
   WorkingDirectory=/opt/pingme
   EnvironmentFile=/opt/pingme/.env
   ExecStart=/opt/pingme/.venv/bin/python -m app.main
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

8. Enable the 24/7 service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now pingme
   sudo systemctl status pingme
   journalctl -u pingme -f
   ```

Back up `/opt/pingme/data.db` regularly. Never commit or paste `.env`; rotate the Telegram token immediately if it is exposed.
