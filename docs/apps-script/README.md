# Zero-cost Apps Script automation

This folder contains the Google Apps Script backend template for the personal study timetable automation.

## Why this exists

The website remains a desktop-first React dashboard, while Google Apps Script + Google Sheets provides a zero-cost backend for:

- storing daily study events
- generating analytics reports
- sending automated Gmail/MailApp reports on a time trigger

## Sheet tabs to create

Create one Google Sheet with these tabs exactly:

1. `Events`
2. `DailyReports`
3. `EmailLog`
4. `Settings`

The script will add header rows automatically when it first writes data.

## Deployment steps

1. Open the Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Paste `Code.gs` into the Apps Script editor.
4. Update `REPORT_RECIPIENTS` in `Code.gs`.
5. Replace `SHARED_SECRET` with a long private random value, for example 32+ mixed characters.
6. Deploy as **Web app**.
7. Set access to **Anyone with the link** so the website can post events.
8. Copy the Web App URL.
9. Paste the Web App URL and the same shared secret into the website's **Zero-cost Auto Email** card.
10. Enable auto sync and click **Sync Snapshot**.
11. In Apps Script, add time-driven triggers for:
    - `sendDailyReport`
    - `sendWeeklyReport`
    - `sendMonthlyReport`

## Cost

This path avoids Firebase Blaze, paid SMTP, paid email APIs, and paid databases. It uses only Google Sheets, Apps Script triggers, and MailApp/Gmail quotas. The Web App URL is public-by-link, so the shared secret gate is required; rotate/redeploy the Web App URL if it is accidentally shared.
