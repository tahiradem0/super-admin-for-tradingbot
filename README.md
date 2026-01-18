# Super Admin Panel

A premium control panel for managing trading bot users and operations.

## Features

### 1. User Management (God View)
- View all registered users with their trading stats
- Ban/Unban users with one click
- Edit user settings remotely (lot size, max lot, spreads, etc.)
- Impersonate users to see their dashboard
- Delete users

### 2. Global Analytics
- Total users count
- Aggregate net profit across all users
- Total trades executed
- Today's performance
- 30-day profit history chart

### 3. System Control
- **Global Kill Switch**: Emergency stop for all bots
- **Blocked Times**: Set global trading blackout periods

## Quick Start

### Option 1: Use the launcher
```bash
# Double-click or run:
start.bat
```

### Option 2: Manual start
```bash
# Terminal 1 - Backend
cd server
npm install
npm start

# Terminal 2 - Frontend
cd client
npm install
npm run dev
```

## Login Credentials

Default credentials (change in `server/.env`):
- **Email**: superadmin@trading.com
- **Password**: SuperAdmin123!

## URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5001

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (shared with main app)

## Architecture

This admin panel is completely independent from the main trading bot and dashboard:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Super Admin   │    │   PostgreSQL     │    │   Trading Bot   │
│     Panel       │───▶│    Database      │◀───│   + Dashboard   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

The Super Admin only reads/writes to the database. The trading bots read from the same database to check:
- If their user is banned (is_active = false)
- If the global kill switch is enabled
- If current time is in a blocked period

## Security Notes

1. Change the default admin credentials in `server/.env`
2. Use a strong JWT_SECRET
3. In production, ensure HTTPS is enabled
4. Restrict access to the admin panel via firewall/VPN
