# ☁️ TeleCloud Storage

**Cloud storage powered by Telegram** — S3-compatible API, web file manager, and unlimited storage for premium users.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?style=flat-square&logo=supabase)

## Features

- **50MB Free Storage** — Get started instantly, no credit card required
- **Unlimited Storage (Premium)** — Upgrade and connect your own Telegram bot for unlimited storage
- **S3-Compatible API** — Works with rclone, AWS CLI, and any S3-compatible tool
- **Web File Manager** — Upload, download, preview, and organize files in the browser
- **Bucket Management** — Create and manage storage buckets
- **API Key Management** — Generate API keys with granular permissions and expiry
- **Telegram Bot Integration** — Files stored securely on Telegram servers
- **URL Upload** — Upload files directly from URLs
- **File Preview** — Preview images, videos, and documents in the browser
- **Dark/Light Theme** — System-aware theme with manual override
- **Admin Panel** — User management, environment config, and system settings

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Storage Backend:** Telegram Bot API
- **Auth:** Custom JWT + bcrypt
- **Deployment:** Vercel

## Pricing

| Feature | Free | Premium |
|---------|------|---------|
| Storage | 50MB | Unlimited |
| Telegram Bot | Shared | Your own private bot |
| S3 API | ✅ | ✅ |
| Web UI | ✅ | ✅ |
| API Keys | ✅ | ✅ |
| Priority Support | ❌ | ✅ |

Premium upgrade via M-Pesa (Lipia) — coming soon.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A Telegram Bot (create via [@BotFather](https://t.me/BotFather))

### Installation

```bash
# Clone the repo
git clone https://github.com/komputeks/telecloud-storage.git
cd telecloud-storage

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run the development server
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Database Tables

The app uses the following Supabase tables (all prefixed with `telecloud_`):

- `telecloud_users` — User accounts with storage limits
- `telecloud_files` — File metadata and Telegram message IDs
- `telecloud_api_keys` — API key management
- `telecloud_metadata_changes` — File metadata change tracking

## API Usage

```bash
# Upload a file
curl -X PUT \
  -H "Authorization: Bearer tc_YOUR_KEY" \
  -T myfile.txt \
  https://your-domain.com/api/s3/mybucket/myfile.txt

# List files
curl -H "Authorization: Bearer tc_YOUR_KEY" \
  https://your-domain.com/api/s3/mybucket/

# Download a file
curl -H "Authorization: Bearer tc_YOUR_KEY" \
  https://your-domain.com/api/s3/mybucket/myfile.txt
```

### rclone Configuration

```bash
rclone config create telecloud s3 \
  provider=Other \
  endpoint=https://your-domain.com/api/s3 \
  access_key_id=your-email \
  secret_access_key=your-api-key
```

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Or use the Vercel dashboard to import from GitHub.

## License

MIT
