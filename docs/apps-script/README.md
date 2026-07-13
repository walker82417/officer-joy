# Zero-cost Apps Script automation

This folder contains the Google Apps Script backend template for the personal study timetable automation.

## Why this exists

The website remains a desktop-first React dashboard, while Google Apps Script + Google Sheets provides a zero-cost backend for:

- storing daily study events
- generating analytics reports
- sending automated Gmail/MailApp reports on a time trigger
- adding animated-style HTML mission stat cards to email reports without paid services

## Sheet tabs to create

Create one Google Sheet with these tabs exactly:

1. `Events`
2. `DailyReports`
3. `EmailLog`
4. `Settings`

The script will add header rows automatically when it first writes data.

## How to create the private shared secret

The private shared secret must match in `Code.gs` and the website code. For this project, the website now embeds the configured Apps Script URL and shared secret so the wallpaper does not show setup fields.

Use a long random value, preferably 32+ characters. You can create one with a password manager or by running one of these commands locally:

```bash
openssl rand -base64 32
```

```bash
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

After generating it, replace this line in `Code.gs`:

```js
const SHARED_SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET";
```

with your private value, then update the website automation constants to match. Do not expose the secret in the visible wallpaper UI.

## If you accidentally commit the real secret

Treat any shared secret committed to GitHub or pasted in chat as exposed, even if the repository is private. Do not keep using it. Generate a new secret, replace `SHARED_SECRET` in Apps Script only, save, deploy a new web app version, and paste the new secret into the website setup field. Leave this repo's `Code.gs` with the placeholder value.

## Deployment steps

1. Open the Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Paste `Code.gs` into the Apps Script editor.
4. Update `REPORT_RECIPIENTS` in `Code.gs`.
5. Confirm `SHARED_SECRET` matches the website automation constant.
6. Click **Save** in Apps Script. Saving is required, but it is not enough by itself.
7. Deploy as **Web app**. For an existing deployment, click **Deploy → Manage deployments → pencil/edit → Version → New version → Deploy**. The existing `/exec` URL will keep serving the old code until you deploy a new version.
8. Set access to **Anyone with the link** so the website can post events.
9. Copy the Web App URL.
10. Open the website. The dashboard should show the compact auto-sync status instead of setup fields.
11. The website now sends an automatic snapshot immediately when due and continues syncing snapshots every 5 seconds while the page is open; **Sync Now** remains available only as a manual test button.
12. Check the Google Sheet `Events` tab for a new row. You should not need to repeatedly click **Sync Now** after setup.
13. In Apps Script, add time-driven triggers for:
    - `sendDailyReport`
    - `sendWeeklyReport`
    - `sendMonthlyReport`

## Troubleshooting paste errors

If Apps Script shows `SyntaxError: Unexpected end of input` around line 50, the code was almost certainly pasted incompletely. Line 50 is near the end of `doPost(e)`, but the full template continues with report, email, sheet, and JSON helper functions.

Fix it by copying the entire `Code.gs` file from the first comment at the top through the final `END OF FILE` comment at the bottom. The full file should be roughly 250 lines, not only the first 50 lines. After pasting all lines, replace only the `SHARED_SECRET` value with your private secret, save, and redeploy.

## Testing the Web App URL

Opening the Web App URL in a browser uses an HTTP GET request. The automation itself uses HTTP POST requests from the website, but the template includes a small `doGet()` health check so the `/exec` URL also shows a JSON success message in a browser.

If you see `Script function not found: doGet`, your browser is still hitting a deployment version that does not include the health-check function. Paste the latest `Code.gs`, click **Save**, then deploy a **new version** with **Deploy → Manage deployments → pencil/edit → Version → New version → Deploy**. After redeploying, opening the `/exec` URL should show `"ok": true`; then use the website's **Sync Snapshot** button for the real end-to-end test.

## Which Apps Script URL to use

Use only the deployed **Web App URL** that ends in `/exec`. Do not use or paste the Apps Script **Library URL**; that URL is only for reusing this script inside another Apps Script project.

This project embeds the Web App URL and private shared secret in the React source code at the user's request, while keeping those values hidden from the visible wallpaper UI.

## Persistence after restart

The website no longer needs local-storage setup for Apps Script automation because the URL and secret are configured in code.

If you run the dashboard inside Lively Wallpaper or another Edge/WebView host, use the normal Vercel URL. No secret-bearing wallpaper URL is needed.

## Fully automated sync behavior

After deployment, the website automatically syncs study events as you use the dashboard and sends a full snapshot every 5 seconds while the page is open. Apps Script time-driven triggers then send daily, weekly, and monthly emails without paid services.

Because this is a zero-cost browser + Apps Script setup, the website must be opened at least periodically to sync the latest local browser state to Google Sheets. The **Sync Now** button is only for manual testing or forcing an immediate sync.

The in-browser daily report request is sent automatically once the dashboard is open at or after 10:15 PM. If the page is asleep or closed at that time, the browser cannot send the event. Apps Script time-driven triggers remain the reliable email sender, but they can only report the events that already reached the Google Sheet.

## Animated email stats

The automated reports include zero-cost HTML/CSS mission stat cards and progress bars. Some email clients, including Gmail, may limit or strip CSS animation, so the report is designed to degrade safely: if animation is blocked, the same stat cards still show the final values.

## Cost

This path avoids Firebase Blaze, paid SMTP, paid email APIs, and paid databases. It uses only Google Sheets, Apps Script triggers, and MailApp/Gmail quotas. The Web App URL is public-by-link, so the shared secret gate is required; rotate/redeploy the Web App URL if it is accidentally shared.
