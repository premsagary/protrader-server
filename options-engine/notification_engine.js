// notification_engine.js — Telegram + email + webhook with retry queue.
// Reads channels from options_settings (notify_telegram, notify_email) +
// env vars TELEGRAM_BOT_TOKEN, NOTIFY_EMAIL_FROM, SMTP_*, NOTIFY_WEBHOOK_URL.
'use strict';

const https = require('https');
const http = require('http');
const eventLogger = require('./event_logger');

let pool = null;
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) {}  // optional

const queue = [];
let processing = false;

function init(pgPool) { pool = pgPool; }

async function getSettings() {
  if (!pool) return {};
  const { rows } = await pool.query(`SELECT notify_telegram, notify_email FROM options_settings ORDER BY id LIMIT 1`);
  return rows[0] || {};
}

// ---------- Telegram ----------
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return { skipped: 'no token or chat_id' };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data || '{}'));
        else reject(new Error(`telegram ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------- Email (via nodemailer if installed) ----------
async function sendEmail(to, subject, text) {
  if (!nodemailer || !to || !process.env.SMTP_HOST) return { skipped: 'no smtp config or nodemailer' };
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return await transporter.sendMail({
    from: process.env.NOTIFY_EMAIL_FROM || process.env.SMTP_USER,
    to, subject, text,
  });
}

// ---------- Webhook (with SSRF protection) ----------
function _isPrivateHost(host) {
  // Block loopback, RFC1918, link-local, metadata services
  if (!host) return true;
  if (host === 'localhost' || host.startsWith('127.') || host.startsWith('::1')) return true;
  if (host.startsWith('10.') || host.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host.startsWith('169.254.')) return true;  // AWS/GCP metadata
  if (host === '0.0.0.0' || host.startsWith('fc') || host.startsWith('fe80')) return true;
  return false;
}
async function sendWebhook(url, payload) {
  if (!url) return { skipped: 'no url' };
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('webhook: only https:// allowed');
  if (_isPrivateHost(u.hostname)) throw new Error(`webhook: private/loopback host blocked (${u.hostname})`);
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => res.statusCode < 300 ? resolve({ status: res.statusCode, body: data }) : reject(new Error(`webhook ${res.statusCode}`)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------- Queue + retry ----------
async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      await job.fn();
    } catch (e) {
      job.attempts = (job.attempts || 0) + 1;
      await eventLogger.warn('notify_failed', { channel: job.channel, attempt: job.attempts, error: e.message });
      if (job.attempts < 3) {
        setTimeout(() => { queue.push(job); processQueue(); }, 5000 * job.attempts);
      }
    }
  }
  processing = false;
}

function enqueue(channel, fn) {
  queue.push({ channel, fn, attempts: 0 });
  processQueue();
}

// ---------- High-level send: dispatch to all configured channels ----------
async function notify(message, data = {}) {
  const settings = await getSettings();
  const fullText = `*ProTrader Options*\n${message}\n\n${'```'}\n${JSON.stringify(data, null, 2).slice(0, 800)}\n${'```'}`;
  const subject = `[ProTrader Options] ${message.slice(0, 80)}`;
  const plainText = `${message}\n\n${JSON.stringify(data, null, 2)}`;

  if (settings.notify_telegram) enqueue('telegram', () => sendTelegram(settings.notify_telegram, fullText));
  if (settings.notify_email)    enqueue('email',    () => sendEmail(settings.notify_email, subject, plainText));
  if (process.env.NOTIFY_WEBHOOK_URL) enqueue('webhook', () => sendWebhook(process.env.NOTIFY_WEBHOOK_URL, { message, data, ts: new Date().toISOString() }));
  console.log(`[notify] ${message} → queued ${queue.length} job(s)`);
}

// ---------- Convenience helpers ----------
const tradePlaced  = (t) => notify(`✅ Trade placed: *${t.strategy}* credit ₹${t.credit}`, t);
const tradeExited  = (t) => notify(`📤 Trade closed: ${t.strategy} *P&L ₹${t.realized_pnl}* (${t.exit_reason})`, t);
const safeMode     = (r) => notify(`🚨 SAFE_MODE entered: ${r}`);
const killActivated= (r) => notify(`⛔ KILL SWITCH activated: ${r}`);
const dailySummary = (s) => notify(`📊 EOD summary: ${s.trades} trades, P&L ₹${s.pnl}`, s);
const orphanFound  = (o) => notify(`👻 Orphan position detected: ${o.symbol}`, o);
const partialFill  = (t) => notify(`⚠️ Partial fill — flattened: trade ${t.tradeId}`, t);

module.exports = {
  init, notify,
  sendTelegram, sendEmail, sendWebhook,
  tradePlaced, tradeExited, safeMode, killActivated, dailySummary, orphanFound, partialFill,
};
