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

## How to create the private shared secret

The private shared secret is not provided by Apps Script. You create it yourself, keep it private, and paste the exact same value in two places: `Code.gs` and the website setup field.

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

with your private value, then paste that same value into the website field labeled **Paste private shared secret**. Do not send the secret in chat and do not commit your real secret to this repo.

## Deployment steps

1. Open the Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Paste `Code.gs` into the Apps Script editor.
4. Update `REPORT_RECIPIENTS` in `Code.gs`.
5. Create your private shared secret using the section above, then replace `SHARED_SECRET` with that value.
6. Click **Save** in Apps Script. Saving is required, but it is not enough by itself.
7. Deploy as **Web app**. For an existing deployment, click **Deploy → Manage deployments → pencil/edit → Version → New version → Deploy**. The existing `/exec` URL will keep serving the old code until you deploy a new version.
8. Set access to **Anyone with the link** so the website can post events.
9. Copy the Web App URL.
10. Open the website and look near the top of the dashboard, directly below the quote, for **ZERO-COST AUTO EMAIL SETUP**. If you are lower on the page, the same controls also appear in the **Zero-cost Auto Email** card.
11. Paste the Web App URL into **Paste Apps Script Web App URL here** and paste the same shared secret into **Paste private shared secret**.
12. Tick **Enable**, then click **Sync Snapshot**.
13. Check the Google Sheet `Events` tab for a new row.
14. In Apps Script, add time-driven triggers for:
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

Do not hardcode the Web App URL or private shared secret in the React source code. The website saves both values in browser local storage after you paste them into the setup controls.

## Cost

This path avoids Firebase Blaze, paid SMTP, paid email APIs, and paid databases. It uses only Google Sheets, Apps Script triggers, and MailApp/Gmail quotas. The Web App URL is public-by-link, so the shared secret gate is required; rotate/redeploy the Web App URL if it is accidentally shared.
