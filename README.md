# TeleCloud Storage

**Live Demo**: [https://telecloud-storage.vercel.app](https://telecloud-storage.vercel.app)

Free unlimited S3-compatible storage using Telegram as backend.

## Features

- **Unlimited Storage**: Store unlimited files using Telegram as your backend
- **S3-Compatible API**: Use your existing S3 tools and SDKs
- **Web GUI**: Modern, responsive file management interface
- **URL Upload**: Upload files directly from URLs
- **Multi-user Support**: SaaS-ready with user authentication
- **Admin Panel**: Manage users and settings
- **Light/Dark Mode**: Follows system preference with manual toggle
- **User Telegram Bots**: Each user can configure their own Telegram bot for 100GB storage

## Architecture & Portability

### Vercel Dependency

**How much does this system depend on Vercel?**
- **Minimal dependency**: The app uses standard Next.js features that work anywhere
- **API Routes**: Can be deployed to any Node.js server, Netlify Functions, or Cloudflare Workers
- **Database**: Uses Supabase (independent of Vercel)
- **Storage**: Uses Telegram (independent of Vercel)

**What if Vercel closes or increases prices?**
- The code is 100% portable to:
  - **Netlify**: Change `vercel.json` to `netlify.toml`
  - **GitHub Pages**: Use `next export` for static export (requires API backend elsewhere)
  - **Cloudflare Pages/Workers**: Deploy with minimal changes
  - **Self-hosted**: Deploy to any VPS with `npm run build && npm start`
  - **Railway/Render/Fly.io**: Direct deployment supported

### Environment Variables

**Recommended approach:**
1. Store secrets in **GitHub Secrets** (for CI/CD)
2. Mirror to **Vercel Environment Variables** via CLI or dashboard
3. Use `.env.example` for documentation

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
TELEGRAM_BOT_TOKEN=your-bot-token (optional, for global fallback)
TELEGRAM_CHAT_ID=your-chat-id (optional, for global fallback)
```

### Deployment Options

#### 1. Vercel (Recommended)
```bash
vercel deploy
```

#### 2. Netlify
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

#### 3. Docker / Self-hosted
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### 4. Static Export (for GitHub Pages)
```bash
# Add to next.config.ts
output: 'export'

# Build
npm run build
# Output in 'out' directory
```

Note: Static export requires moving API routes to a separate backend service.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Storage**: Telegram Bot API
- **Deployment**: Vercel (portable to others)

## Getting Started

### Prerequisites

1. Create a Telegram Bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Create a channel/group and add your bot
4. Get the chat ID using [@userinfobot](https://t.me/userinfobot)

### Installation

```bash
# Clone the repo
git clone https://github.com/komputeks/telecloud-storage.git
cd telecloud-storage

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your values

# Run development server
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## S3 API Usage

Configure your S3 client to use the TeleCloud endpoint:

### rclone

```bash
rclone config create telecloud s3 \
  provider=Other \
  endpoint=https://your-domain.com/api/s3 \
  access_key_id=your-email \
  secret_access_key=your-token

rclone copy myfile.txt telecloud:my-bucket/
```

### AWS SDK (JavaScript)

```javascript
const S3 = require('aws-sdk/clients/s3');

const s3 = new S3({
  endpoint: 'https://your-domain.com/api/s3',
  accessKeyId: 'your-email',
  secretAccessKey: 'your-token',
  s3ForcePathStyle: true,
});

await s3.putObject({
  Bucket: 'my-bucket',
  Key: 'myfile.txt',
  Body: 'Hello World',
}).promise();
```

## Storage Tiers

| Tier | Storage | Requirements |
|------|---------|--------------|
| Free (Shared) | 10 GB | Uses site-wide Telegram bot |
| Free (Personal) | 100 GB | Configure your own Telegram bot |
| Premium | Unlimited | Coming soon |

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Files

- `GET /api/files` - List files
- `POST /api/files/upload` - Upload file
- `GET /api/files/download` - Download file
- `DELETE /api/files` - Delete file

### S3-Compatible API

- `GET /api/s3/{bucket}` - List objects
- `GET /api/s3/{bucket}/{key}` - Get object
- `PUT /api/s3/{bucket}/{key}` - Put object
- `DELETE /api/s3/{bucket}/{key}` - Delete object
- `HEAD /api/s3/{bucket}/{key}` - Head object

### Admin

- `GET /api/admin/users` - List users
- `PUT /api/admin/users` - Update user
- `DELETE /api/admin/users` - Delete user
- `GET /api/admin/settings` - Get settings
- `PUT /api/admin/settings` - Update settings
- `GET /api/admin/env` - Get environment variables
- `PUT /api/admin/env` - Update environment variables

### User Settings

- `GET /api/user/settings` - Get user settings
- `PUT /api/user/settings` - Update user settings (including Telegram bot)

## Demo Accounts

- **Admin**: admin@telecloud.io / admin123
- **User**: demo@telecloud.io / demo123

## Future Roadmap

- [ ] Multiple cloud storage backends (Google Drive, Dropbox, etc.)
- [ ] Server-side copy between clouds
- [ ] Backup redundancy (mirror files across multiple Telegram channels)
- [ ] Automatic backup if Telegram channel is closed
- [ ] Premium tier with unlimited storage
- [ ] File encryption at rest

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
