# S&Co. Investors

Calling and portfolio app for Abu Dhabi property investors. Built with Next.js and Postgres, made to deploy on Vercel.

## Deploy on Vercel

1. **Push this folder to a private GitHub repository.**
   Investor data is never committed: `.gitignore` excludes `data/` and every `.xlsx` file.
2. **Import the repository in Vercel** (Add New → Project). Keep the default settings.
3. **Add the database.** In the project, open **Storage → Create Database → Neon (Postgres)** and connect it to the project.
   This adds `DATABASE_URL` automatically.
4. **Add environment variables** (Settings → Environment Variables):

   | Name | Value |
   | --- | --- |
   | `ADMIN_EMAIL` | the first admin's email |
   | `ADMIN_PASSWORD` | a temporary password (you'll change it on first sign-in) |
   | `APP_TIMEZONE` | `Asia/Dubai` |

5. **Deploy** (or Redeploy). Every build creates or updates the tables first, so the database sets itself up.
6. **Sign in** with the admin email and password, set your name and a new password.
7. **Load the investors:** Admin → Import → drop `S&Co_Initial_Import.xlsx` → Check file → Import.
   This takes about 15 seconds for the full list.

## Daily use

- **Investors**: search by name, phone or ref; filter by category, nationality (from the phone number, or as confirmed by a caller), name origin, community, value, profile, status and who is handling them.
- **Investor page**: portfolio value, units by project, buying pattern, connections (co-owners and shared phone numbers), and the full contact journey.
- **Calling**: tap *Call*, then pick the outcome, an optional follow-up date and a note, and save.
  The first person to call or message an investor becomes their handler. Others can still view the investor but can't contact them. Admins can reassign or unlock.
- **WhatsApp**: choose a template; the investor's name, project and your name are filled in, and you can edit the text. It opens WhatsApp Web (or the app on a phone) with the message ready to send, and the message is logged.
- **Follow-ups**: overdue, today, this week.

## Admin

- **Overview**: calls, WhatsApp messages, outcomes, team activity and coverage, for today, 7 days or 30 days. Export all investors to Excel.
- **Activity**: every call, message and note, with filters and Excel export.
- **Team**: add members (they get a temporary password), reset passwords, disable accounts, change roles.
- **Sign-ins**: who is online, and every sign-in, failed attempt and sign-out, with device and IP.
- **Allocation**: hand investors to callers in bulk by filters, or release them.
  The *Callers only see investors allocated to them* switch is off by default, so everyone sees everyone.
- **WhatsApp templates**: write, reorder, hide and preview templates.
- **Import**: bulk-add investors from Excel. Download the format from the page.
  Duplicates are skipped; spellings and phone numbers are merged into existing investors; companies are skipped; values are recalculated.

## How values are estimated

Each unit is valued at its project's average asking price for that bedroom count, or at the project's typical price when the bedroom count is unknown (benchmarks: Property Finder / Bayut, Nov 2026).

- Co-owned units are split between their owners.
- Units in projects without a benchmark are shown as *Not priced* and are not counted. Every value shows how many units it is based on.
- To improve accuracy, import a **Projects** sheet with newer prices. All portfolios are recalculated.

**Name origin** is an estimate made from the name. It is meant for choosing the language and approach of a call, not as a fact about the person. When a caller learns an investor's nationality, they set it on the investor page.

## Run locally

```bash
cp .env.example .env.local      # point DATABASE_URL at a local Postgres
npm install
npm run db:migrate
npm run db:import -- path/to/S&Co_Initial_Import.xlsx   # optional, same as the admin import
npm run dev
```

## Personal data

The investor list contains names and phone numbers of private individuals. Keep the repository private and the app behind sign-in. Outreach is subject to UAE PDPL and TDRA telemarketing rules. The *Do not call* outcome hides an investor's numbers from callers.
