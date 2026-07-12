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
// Change this before deploying in Apps Script only. Do not commit your real secret to GitHub.
// It must match the private secret saved in the website.
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
    if (!SHARED_SECRET || SHARED_SECRET === "officierjoy2027-28") {
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
  const checklist = latestSnapshot.checklist || {};
  const examDates = latestSnapshot.examDates || {};
  const subject = `${OWNER_NAME} ${period} Mission Report — ${dateKey}`;
  const html = [
    buildEmailStyle_(),
    `<div class="oj-shell">`,
    `<h2>${subject}</h2>`,
    `<p>Jai Hind, ${OWNER_NAME}. Your automated zero-cost mission report is ready.</p>`,
    buildStatsHtml_(events, completed, completedMinutes, extensionMinutes, pending, checklist),
    buildExamHtml_(examDates),
    buildExtensionHtml_(extended),
    `<p class="oj-command"><b>Tomorrow's command:</b> Protect core subject time first, recover pending missions, and keep the chain alive.</p>`,
    `<p><b>Discipline today. Selection tomorrow.</b></p>`,
    `</div>`,
  ].join("\n");
  const plain = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { period, dateKey, subject, html, plain, eventCount: events.length };
}

function buildEmailStyle_() {
  return [
    `<style>`,
    `@keyframes ojFill{from{width:0}to{width:var(--oj-width)}}`,
    `.oj-shell{font-family:Arial,sans-serif;background:#fff8df;border:2px solid #f0b429;border-radius:18px;padding:18px;color:#1f2937}`,
    `.oj-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}`,
    `.oj-card{background:#ffffff;border:1px solid #f5d565;border-radius:14px;padding:12px;box-shadow:0 3px 10px rgba(31,41,55,.08)}`,
    `.oj-label{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280}`,
    `.oj-value{font-size:28px;font-weight:800;color:#92400e;margin-top:4px}`,
    `.oj-bar{height:12px;background:#fef3c7;border-radius:999px;overflow:hidden;margin-top:10px}`,
    `.oj-fill{height:12px;background:linear-gradient(90deg,#f59e0b,#22c55e);border-radius:999px;animation:ojFill 1.2s ease-out both}`,
    `.oj-command{background:#ecfeff;border-left:4px solid #06b6d4;padding:10px;border-radius:10px}`,
    `</style>`,
  ].join("\n");
}

function buildStatsHtml_(
  events,
  completed,
  completedMinutes,
  extensionMinutes,
  pending,
  checklist,
) {
  const checklistKeys = Object.keys(checklist || {});
  const checklistDone = checklistKeys.filter((key) => checklist[key]).length;
  const checklistTotal = checklistKeys.length || 1;
  const checklistPct = Math.round((checklistDone / checklistTotal) * 100);
  const pendingCount = Array.isArray(pending) ? pending.length : 0;
  const studyHours = (completedMinutes / 60).toFixed(1);
  return [
    `<h3>Animated Mission Stats</h3>`,
    `<p>These zero-cost email stats use HTML/CSS progress bars. If an email client blocks animation, the same bars still show the final values.</p>`,
    `<div class="oj-grid">`,
    renderStatCard_("Events captured", events.length, 100),
    renderStatCard_("Completed sessions", completed.length, Math.min(100, completed.length * 10)),
    renderStatCard_(
      "Completed study time",
      `${studyHours}h`,
      Math.min(100, Number(studyHours) * 10),
    ),
    renderStatCard_("Checklist complete", `${checklistDone}/${checklistKeys.length}`, checklistPct),
    renderStatCard_(
      "Extended focus time",
      `${extensionMinutes} min`,
      Math.min(100, extensionMinutes),
    ),
    renderStatCard_("Pending missions", pendingCount, Math.max(0, 100 - pendingCount * 15)),
    `</div>`,
  ].join("\n");
}

function renderStatCard_(label, value, percent) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return [
    `<div class="oj-card">`,
    `<div class="oj-label">${label}</div>`,
    `<div class="oj-value">${value}</div>`,
    `<div class="oj-bar"><div class="oj-fill" style="--oj-width:${safePercent}%;width:${safePercent}%"></div></div>`,
    `</div>`,
  ].join("\n");
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
