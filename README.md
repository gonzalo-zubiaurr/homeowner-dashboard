# 🏠 Homeowner Onboarding Dashboard

A live, real-time dashboard for tracking homeowner payment readiness. Built with Next.js + Supabase + Vercel.

---

## ✅ Features

- **Real-time sync** — when anyone checks a box, everyone sees it instantly
- **Google Sheets import** — sync your homeowner list from a Google Sheet
- **5 checklist items** per homeowner: Insurance, W9, Dwolla Verified, Payment Method, ID Verified
- **Filter & search** — filter by Ready / In Progress / Not Started
- **Progress overview** — see overall team completion at a glance
- **No login required** — just share the URL with your team

---

## 🚀 Setup (takes ~10 minutes)

### Step 1: Set up Supabase

1. Go to [supabase.com](https://supabase.com) and open your project
2. Click **SQL Editor** in the left sidebar
3. Paste the contents of `SUPABASE_SETUP.sql` and click **Run**
4. Go to **Project Settings → API** and copy:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 2: Set up Google Sheets (optional but recommended)

**Make your spreadsheet:**
- Column A: Homeowner Name
- Column B: Unit (optional)
- Column C: Lease Start Date (optional)
- Row 1 is the header row (it will be skipped automatically)

**Get API access:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Google Sheets API**
4. Go to **APIs & Services → Credentials → Create Credentials → API Key**
5. Copy that API key → this is your `GOOGLE_SHEETS_API_KEY`
6. **Make your Google Sheet public**: Share → Anyone with the link → Viewer
7. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit`
   → this is your `GOOGLE_SHEET_ID`

### Step 3: Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. In the deployment settings, add these **Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL        = your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   = your Supabase anon key
GOOGLE_SHEETS_API_KEY           = your Google API key
GOOGLE_SHEET_ID                 = your Google Sheet ID
```

4. Click **Deploy** — done! 🎉

### Step 4: Load your homeowners

Once deployed, click **"↻ Sync Google Sheets"** in the top right to import your homeowner list.

---

## 📋 How to use

- **Click a homeowner row** to expand their checklist
- **Click any checklist item** to mark it complete/incomplete
- Changes appear **live for everyone** — no refresh needed
- Use the **stat cards at the top** to filter by status
- Use the **search bar** to find a specific homeowner
- Click **"Sync Google Sheets"** each morning to pull in new homeowners

---

## 🔄 Google Sheets format

| A (Name)      | B (Unit) | C (Lease Start) |
|---------------|----------|-----------------|
| John Smith    | 101      | 2024-02-01      |
| Maria Garcia  | 204      | 2024-02-15      |

- Row 1 = header (skipped)
- Only Column A (Name) is required
- The sync is **additive** — it won't overwrite existing checklist progress

---

## 🛠 Tech Stack

- **Next.js 14** — React framework
- **Supabase** — Database + real-time WebSockets
- **Vercel** — Hosting (free tier)
- **Google Sheets API** — Homeowner list sync

---

## 💡 Tips

- Bookmark the Vercel URL and share it with your whole team
- The dashboard works on mobile too
- You can add the URL to your phone's home screen for quick access
- Want to add login/auth? Supabase Auth can be added later
