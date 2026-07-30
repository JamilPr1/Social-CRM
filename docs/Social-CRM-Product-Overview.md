# Social CRM
## Unified Facebook, Instagram & LinkedIn Management Platform

**By Arfa Developers**  
**Product overview & capabilities**

---

## Executive summary

Social CRM is an all-in-one social media management platform built for agencies, marketing teams, and business owners who manage multiple brands across **Facebook**, **Instagram**, and **LinkedIn** — without sharing passwords or logging into three separate apps.

Connect your accounts once, invite your team securely, compose posts with AI assistance, publish to the right platform only, and manage comments and messages from a single dashboard.

**Live application:** https://social-crm-five.vercel.app

---

## The problem we solve

| Challenge | How Social CRM helps |
|-----------|----------------------|
| Multiple logins & shared passwords | One secure workspace with role-based access |
| Posting to wrong platforms by mistake | Explicit “Publish to” controls per platform |
| Slow content creation | AI-assisted post writing and image workflows |
| Scattered inbox & comments | Unified comments and Facebook messages |
| No team accountability | Activity log, permissions, and invite-only onboarding |
| Ad-hoc boosting | In-app Meta ad boost from published posts |

---

## What Social CRM does

### 1. Multi-platform publishing
- Publish to **Facebook only**, **Instagram only**, **Facebook + Instagram**, **LinkedIn only**, or **all platforms**
- Clear destination preview before every publish — no accidental cross-posting
- Image upload with Instagram aspect-ratio validation (1:1, 4:5, up to 1.91:1 landscape)
- Schedule posts for later
- Bulk publish across multiple connected pages

### 2. Meta (Facebook & Instagram)
- OAuth connection for Facebook Pages and linked Instagram Business accounts
- Compose and publish feed posts and photo posts
- Sync and view published content
- Reply to comments from one inbox
- Facebook Page direct messages
- Boost high-performing posts with Meta ads

### 3. LinkedIn
- Connect personal LinkedIn profile
- Publish posts (including with images) from Compose
- View and manage LinkedIn content in the same Posts hub

### 4. AI-powered content
- Generate marketing post copy with **Groq → Gemini → Kimi** fallback
- SEO keyword integration for better discoverability
- AI image prompt generation and image workflows
- Smart template fallback when AI quotas are reached

### 5. Team & security
- **Invite-only signup** — only admin-invited emails can join
- Admin **Settings** page to invite team members by email
- Join link onboarding — teammates set their own password
- Role-based access: **Admin** vs **Member**
- Granular page permissions: View, Post, Reply, Boost, Manage
- Encrypted token storage for Meta and LinkedIn connections
- Activity audit trail for admin oversight

### 6. Dashboard & operations
- At-a-glance stats: accounts, posts, comments
- Activity feed for posts, comments, boosts, messages, and scheduled content
- Account health checks (Facebook post ready, Instagram publish permission)
- Ads & Boost management for connected ad accounts

---

## Key benefits

**Save time**  
Draft, schedule, and publish across networks from one screen instead of switching apps.

**Reduce risk**  
No more sharing Meta passwords in chat. Each team member gets their own login and assigned permissions.

**Stay on brand**  
AI-assisted drafts plus keyword tools help maintain consistent messaging.

**Publish with confidence**  
Platform-specific routing ensures Instagram-only posts stay off Facebook and LinkedIn unless you choose otherwise.

**Scale your team**  
Invite writers, social managers, or clients as Members; keep account connection and user management with Admins.

**Grow engagement**  
Respond to comments and messages faster; boost top posts without leaving the CRM.

---

## Selling points

1. **True multi-platform CRM** — Meta + LinkedIn in one product, not a single-network tool with bolt-ons.

2. **Built for teams** — Invite-only access, role separation, and per-page permissions out of the box.

3. **Production-ready** — Hosted on Vercel with PostgreSQL (Neon), encrypted secrets, and OAuth best practices.

4. **AI-native compose** — Multiple AI providers with automatic fallback so content keeps flowing.

5. **Platform-aware publishing** — Explicit targets, validation, and success feedback per destination.

6. **Agency-friendly** — Manage multiple Facebook Pages and Instagram profiles from one admin account.

7. **Compliance-ready** — Privacy Policy, Terms of Service, and Meta data-deletion flow included.

8. **No vendor lock-in on content** — Your posts live on your social accounts; the CRM orchestrates publishing.

---

## Who is it for?

- **Digital marketing agencies** managing client social accounts  
- **Small business owners** running Facebook, Instagram, and LinkedIn  
- **In-house marketing teams** that need writers + approvers + publishers  
- **Developers & brands** (e.g. Arfa Developers) consolidating social ops  

---

## Typical workflow

1. **Admin** connects Facebook/Instagram (Meta) and LinkedIn in Accounts.  
2. **Admin** invites team members from Settings → shares join link.  
3. **Member** sets password, signs in, and opens Posts.  
4. **Admin** assigns page access with **POST** permission in Team access.  
5. **Member** composes content, selects platform (e.g. Instagram only), uploads image, publishes.  
6. **Team** monitors comments and messages; **Admin** reviews Activity and boosts winners.

---

## Technical highlights

| Area | Stack / approach |
|------|------------------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Next.js API routes, Prisma ORM |
| Database | PostgreSQL (Neon) |
| Auth | JWT sessions, bcrypt passwords, invite tokens |
| Integrations | Meta Graph API, LinkedIn API |
| AI | Groq, Google Gemini, Kimi (configurable) |
| Hosting | Vercel |

---

## Security & privacy

- Passwords hashed with bcrypt; OAuth tokens encrypted at rest  
- Invite links expire after 7 days  
- Members cannot access admin settings, user invites, or account connection  
- Session-based authentication with secure HTTP-only cookies  

---

## Get started

1. Visit **https://social-crm-five.vercel.app**  
2. Sign in as admin (or request access from your organization)  
3. Connect social accounts under **Accounts**  
4. Invite your team under **Settings**  
5. Start publishing from **Posts**  

---

## Contact

**Arfa Developers**  
Product: Social CRM  
Web: https://social-crm-five.vercel.app  

*This document describes the Social CRM product as deployed for Meta, Instagram, and LinkedIn management. Features may expand over time.*
