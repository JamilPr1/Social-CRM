# Meta Automation CRM

A full-featured CRM for managing Meta (Facebook & Instagram) accounts without sharing login credentials with your team. Connect your Meta accounts once, then assign role-based access so team members can post, reply, and view engagement from a single dashboard.

## Features

- **Meta OAuth Integration** — Connect Facebook Pages and linked Instagram Business accounts
- **Role-Based Access Control** — Admin, Manager, and Member roles with granular permissions (View, Post, Reply, Manage)
- **Account Assignment** — Admins control which users can access which Meta accounts
- **Posts** — View and publish to Facebook and Instagram
- **Comments** — Unified inbox to view and reply to comments
- **Messages** — Facebook Page inbox for DMs
- **Activity Logging** — Track team actions
- **Encrypted Tokens** — Page access tokens stored encrypted at rest

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Generate a secure `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set up the database

```bash
npm run db:push
npm run db:seed
```

This creates the database and a default admin user:
- **Email:** `admin@metacrm.local`
- **Password:** `admin123`

Change this password after first login.

### 4. Create a Meta Developer App

1. Go to [Meta for Developers](https://developers.facebook.com/apps/)
2. Create a new app (type: Business)
3. Add **Facebook Login** and **Instagram Graph API** products
4. Under Facebook Login → Settings, add redirect URI:
   ```
   http://localhost:3000/api/meta/callback
   ```
5. Copy App ID and App Secret to your `.env` file
6. Request the required permissions (some need App Review for production)

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the admin credentials.

## Usage Flow

1. **Admin** signs in and connects Meta accounts via Accounts → Connect Account
2. **Admin** creates team members under Admin → Team
3. **Admin** assigns account access with specific permissions (View, Post, Reply)
4. **Team members** sign in and only see accounts they have access to
5. Team can post, reply to comments, and manage messages without Meta passwords

## Permission Levels

| Permission | Description |
|-----------|-------------|
| VIEW | See posts, comments, and messages |
| POST | Create new posts on Facebook/Instagram |
| REPLY | Reply to comments and send messages |
| MANAGE | Full control over the assigned account |

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Prisma** + SQLite (swap to PostgreSQL for production)
- **Tailwind CSS**
- **Meta Graph API v21.0**

## Production Deployment

1. Switch `DATABASE_URL` to PostgreSQL in `.env` and update `schema.prisma` provider
2. Set strong values for `AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY`
3. Update `META_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` to your production domain
4. Complete Meta App Review for required permissions
5. Deploy to Vercel, Railway, or your preferred host

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/     # Protected CRM pages
│   ├── api/             # REST API routes
│   └── login/           # Auth page
├── components/          # UI components
└── lib/                 # Auth, Meta API, encryption, utilities
prisma/
├── schema.prisma        # Database schema
└── seed.ts              # Default admin user
```

## License

Private — All rights reserved.
