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
5. Deploy as **Web app**.
6. Set access to **Anyone with the link** so the website can post events.
7. Copy the Web App URL.
8. Paste it into the website's **Zero-cost Auto Email** card.
9. Enable auto sync and click **Sync Snapshot**.
10. In Apps Script, add time-driven triggers for:
    - `sendDailyReport`
    - `sendWeeklyReport`
    - `sendMonthlyReport`

## Cost

This path avoids Firebase Blaze, paid SMTP, paid email APIs, and paid databases. It uses only Google Sheets, Apps Script triggers, and MailApp/Gmail quotas.
