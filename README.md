# Wordle Board Portal

## Local setup

```bash
npm install
npm run dev
```

Required env vars:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BOT_API_TOKEN` (shared secret between bot and portal)

## Bot integration

The Telegram bot should call the portal endpoint to award letters when a Wordle
submission is validated.

Endpoint:

```
POST /api/award
```

Headers:

```
x-bot-token: <BOT_API_TOKEN>
```

Payload:

```json
{
  "telegram_user_id": "12345",
  "wordle_day": "2026-01-26",
  "answer": "crane",
  "score": 3
}
```

Response:

```json
{
  "success": true,
  "letter": "c",
  "score": 3
}
```

Notes:

- The endpoint rejects duplicate submissions per user/day.
- Scores accept 1-6 or "x" for failed attempts (treated as 7).
- The awarded letter is weighted by Scrabble value and the score tier.

## Connect flow

The bot inserts into `telegram_link_tokens` before sending the link. The portal
reads that row and creates a user account on `/connect`.
