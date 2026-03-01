const crypto = require('node:crypto');
const config = require('./config');

const COOKIE_NAME = 'presenter_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const sessions = new Map();

function parseCookies(headerValue) {
  if (!headerValue) {
    return {};
  }

  return headerValue
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const index = item.indexOf('=');
      if (index < 0) {
        return acc;
      }

      const key = item.slice(0, index).trim();
      const value = decodeURIComponent(item.slice(index + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function issueSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function cleanupExpiredSessions() {
  const currentTime = Date.now();
  for (const [token, expiresAt] of sessions) {
    if (expiresAt < currentTime) {
      sessions.delete(token);
    }
  }
}

function createSessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

function authenticatePresenter(request, response) {
  cleanupExpiredSessions();

  const expectedPin = config.presenterPin;
  const suppliedPin = typeof request.body.pin === 'string' ? request.body.pin.trim() : '';

  if (!expectedPin) {
    return response.status(500).json({ ok: false, message: 'Presenter PIN is not configured.' });
  }

  if (!suppliedPin || suppliedPin !== expectedPin) {
    return response.status(401).json({ ok: false, message: 'Invalid PIN.' });
  }

  const token = issueSession();
  response.setHeader('Set-Cookie', createSessionCookie(token));
  return response.json({ ok: true });
}

function logoutPresenter(request, response) {
  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (token) {
    sessions.delete(token);
  }

  response.setHeader('Set-Cookie', clearSessionCookie());
  return response.json({ ok: true });
}

function requirePresenterAuth(request, response, next) {
  cleanupExpiredSessions();

  const cookies = parseCookies(request.headers.cookie);
  const token = cookies[COOKIE_NAME];

  if (!token) {
    return response.status(401).json({ ok: false, message: 'Authentication required.' });
  }

  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(token);
    response.setHeader('Set-Cookie', clearSessionCookie());
    return response.status(401).json({ ok: false, message: 'Session expired.' });
  }

  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return next();
}

module.exports = {
  authenticatePresenter,
  logoutPresenter,
  requirePresenterAuth
};
