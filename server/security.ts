export type LoginAttemptDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type LoginAttemptState = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
};

export class LoginAttemptGuard {
  private readonly attempts = new Map<string, LoginAttemptState>();

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly blockMs = 15 * 60 * 1000
  ) {}

  check(key: string, now = Date.now()): LoginAttemptDecision {
    const normalizedKey = key.trim().toLowerCase();
    const state = this.attempts.get(normalizedKey);
    if (!state) return { allowed: true, retryAfterSeconds: 0 };

    if (state.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((state.blockedUntil - now) / 1000))
      };
    }

    if (now - state.windowStartedAt >= this.windowMs) {
      this.attempts.delete(normalizedKey);
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  registerFailure(key: string, now = Date.now()): LoginAttemptDecision {
    const normalizedKey = key.trim().toLowerCase();
    const existing = this.attempts.get(normalizedKey);
    const state = !existing || now - existing.windowStartedAt >= this.windowMs
      ? { failures: 0, windowStartedAt: now, blockedUntil: 0 }
      : existing;

    state.failures += 1;
    if (state.failures >= this.maxFailures) {
      state.blockedUntil = now + this.blockMs;
    }
    this.attempts.set(normalizedKey, state);

    return this.check(normalizedKey, now);
  }

  clear(key: string) {
    this.attempts.delete(key.trim().toLowerCase());
  }
}

export function buildAllowedOrigins(rawOrigins: string | undefined, isProduction: boolean) {
  const configured = (rawOrigins || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const defaults = [
    'https://admin.negis.online',
    'https://negisadmin.vercel.app'
  ];

  if (!isProduction) {
    defaults.push('http://localhost:5173', 'http://localhost:8787');
  }

  return new Set([...defaults, ...configured]);
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: Set<string>) {
  if (!origin) return true;
  return allowedOrigins.has(origin.replace(/\/$/, ''));
}

