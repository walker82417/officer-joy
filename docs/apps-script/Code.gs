/**
 * Zero-cost personal backend for Officer Rohan's study timetable.
 *
 * Deploy as a Google Apps Script Web App connected to a Google Sheet.
 * The React website posts plain JSON events to doPost(e). Scheduled
 * triggers call the report functions and MailApp sends the analytics email.
 */

const REPORT_RECIPIENTS = ["rohandoiphode1@gmail.com", "rohand11072004@gmail.com"];
const OWNER_NAME = "Officer Rohan";
const TIMEZONE = "Asia/Kolkata";
// Change this before deploying. It must match the private secret saved in the website.
const SHARED_SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_SECRET";

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      service: "Officer Joy Apps Script automation",
      message:
        "Web app is deployed. Paste this /exec URL into the website, then use Sync Snapshot to test POST automation.",
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const event = JSON.parse(raw);
    if (!SHARED_SECRET || SHARED_SECRET === "CHANGE_ME_TO_A_LONG_RANDOM_SECRET") {
      throw new Error("Set SHARED_SECRET before deploying the web app.");
    }
    if (event.secret !== SHARED_SECRET) {
      throw new Error("Unauthorized automation request.");
    }
    delete event.secret;
    appendEvent_(event);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (error) {
    appendEmailLog_("ingest_error", String(error));
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(error) }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function sendDailyReport() {
  const dateKey = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  const events = getEventsForDate_(dateKey);
  const report = buildReport_("Daily", dateKey, events);
  sendReport_(report);
  appendReport_(report);
}

function sendWeeklyReport() {
  const now = new Date();
  const dateKey = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const events = getRecentEvents_(7);
  const report = buildReport_("Weekly", dateKey, events);
  sendReport_(report);
  appendReport_(report);
}

function sendMonthlyReport() {
  const now = new Date();
  const dateKey = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
  const events = getRecentEvents_(31);
  const report = buildReport_("Monthly", dateKey, events);
  sendReport_(report);
  appendReport_(report);
}

function appendEvent_(event) {
  const sheet = getSheet_("Events", [
    "receivedAt",
    "eventDate",
    "type",
    "sentAt",
    "activity",
    "category",
    "status",
    "minutes",
    "payloadJson",
  ]);
  const payload = event.payload || {};
  const row = payload.row || {};
  sheet.appendRow([
    new Date(),
    event.date || "",
    event.type || "unknown",
    event.sentAt || "",
    row.act || payload.activity || "",
    row.cat || payload.category || "",
    payload.status || "",
    payload.minutes || row.dur || "",
    JSON.stringify(payload),
  ]);
}

function buildReport_(period, dateKey, events) {
  const completed = events.filter((event) => String(event.type).indexOf("completed") !== -1);
  const extended = events.filter((event) => event.type === "session_extended");
  const manualSnapshots = events.filter((event) => event.type === "manual_snapshot");
  const latestSnapshot = manualSnapshots.length
    ? manualSnapshots[manualSnapshots.length - 1].payload
    : {};
  const completedMinutes = completed.reduce((sum, event) => {
    const row = event.payload && event.payload.row ? event.payload.row : {};
    return sum + Number(row.dur || 0);
  }, 0);
  const extensionMinutes = extended.reduce(
    (sum, event) => sum + Number(event.payload.minutes || 0),
    0,
  );
  const pending = latestSnapshot.pending || [];
  const examDates = latestSnapshot.examDates || {};
  const subject = `${OWNER_NAME} ${period} Mission Report — ${dateKey}`;
  const html = [
    `<h2>${subject}</h2>`,
    `<p>Jai Hind, ${OWNER_NAME}. Your automated zero-cost mission report is ready.</p>`,
    `<h3>Mission Analytics</h3>`,
    `<ul>`,
    `<li><b>Events captured:</b> ${events.length}</li>`,
    `<li><b>Completed sessions:</b> ${completed.length}</li>`,
    `<li><b>Completed study time:</b> ${(completedMinutes / 60).toFixed(1)}h</li>`,
    `<li><b>Extended core/focus time:</b> ${extensionMinutes} min</li>`,
    `<li><b>Pending missions:</b> ${Array.isArray(pending) ? pending.length : 0}</li>`,
    `</ul>`,
    buildExamHtml_(examDates),
    buildExtensionHtml_(extended),
    `<p><b>Tomorrow's command:</b> Protect core subject time first, recover pending missions, and keep the chain alive.</p>`,
    `<p>Discipline today. Selection tomorrow.</p>`,
  ].join("\n");
  const plain = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { period, dateKey, subject, html, plain, eventCount: events.length };
}

function buildExamHtml_(examDates) {
  const keys = Object.keys(examDates || {});
  if (!keys.length) return "<h3>Exam Countdown</h3><p>No exam targets synced yet.</p>";
  const rows = keys.map((key) => {
    const exam = examDates[key];
    const date = exam.date || "";
    const days = date
      ? Math.max(0, Math.ceil((new Date(date + "T00:00:00") - new Date()) / 86400000))
      : "—";
    const risk = typeof days === "number" && days < 120 ? "High focus" : "On track";
    return `<li><b>${exam.label || key}:</b> ${days} days left — ${risk}</li>`;
  });
  return `<h3>Exam Countdown Intelligence</h3><ul>${rows.join("")}</ul>`;
}

function buildExtensionHtml_(extended) {
  if (!extended.length) return "<h3>Adjustments</h3><p>No extensions recorded.</p>";
  const rows = extended.map((event) => {
    const row = event.payload.row || {};
    return `<li>${row.act || "Focus session"}: +${event.payload.minutes || 0} min; deduction target: ${event.payload.deductionTarget || "not set"}</li>`;
  });
  return `<h3>Core Priority Adjustments</h3><ul>${rows.join("")}</ul>`;
}

function sendReport_(report) {
  MailApp.sendEmail({
    to: REPORT_RECIPIENTS.join(","),
    subject: report.subject,
    body: report.plain,
    htmlBody: report.html,
  });
  appendEmailLog_("sent", `${report.subject} (${report.eventCount} events)`);
}

function appendReport_(report) {
  const sheet = getSheet_("DailyReports", [
    "createdAt",
    "period",
    "date",
    "subject",
    "eventCount",
    "html",
  ]);
  sheet.appendRow([
    new Date(),
    report.period,
    report.dateKey,
    report.subject,
    report.eventCount,
    report.html,
  ]);
}

function appendEmailLog_(status, message) {
  const sheet = getSheet_("EmailLog", ["createdAt", "status", "message"]);
  sheet.appendRow([new Date(), status, message]);
}

function getEventsForDate_(dateKey) {
  return getAllEvents_().filter((event) => event.date === dateKey);
}

function getRecentEvents_(days) {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  const sinceKey = Utilities.formatDate(since, TIMEZONE, "yyyy-MM-dd");
  return getAllEvents_().filter((event) => event.date >= sinceKey);
}

function getAllEvents_() {
  const sheet = getSheet_("Events", [
    "receivedAt",
    "eventDate",
    "type",
    "sentAt",
    "activity",
    "category",
    "status",
    "minutes",
    "payloadJson",
  ]);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  return values.slice(1).map((row) => ({
    date: row[1],
    type: row[2],
    payload: safeJson_(row[8]),
  }));
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function safeJson_(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (error) {
    return { parseError: String(error), raw: value };
  }
}

// END OF FILE - paste through this line into Apps Script.
