// Client-side hardening for the training build. This is defence-in-depth for a
// browser-only prototype; it is NOT a substitute for server-side authentication,
// accreditation or a formal security review (see the notes shown in the Security panel).

export interface AuditEntry {
  seq: number;
  wall: string; // ISO time, for the audit trail only
  simT: number;
  actor: string;
  action: string;
  detail: string;
  prev: string;
  hash: string;
}

const enc = new TextEncoder();

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const GENESIS = "0".repeat(64);

/** Append-only, hash-chained log: each entry commits to the previous one. */
export class AuditChain {
  entries: AuditEntry[] = [];
  private seen = new Set<string>();
  private queue: Promise<void> = Promise.resolve();
  onChange?: () => void;

  /** commandId makes appends idempotent: a repeated id is ignored (no duplicate log lines). */
  append(commandId: string, simT: number, actor: string, action: string, detail: string): void {
    if (this.seen.has(commandId)) return;
    this.seen.add(commandId);
    this.queue = this.queue.then(async () => {
      const prev = this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS;
      const seq = this.entries.length + 1;
      const wall = new Date().toISOString();
      const hash = await sha256Hex([prev, seq, wall, simT.toFixed(3), actor, action, detail].join("|"));
      this.entries.push({ seq, wall, simT, actor, action, detail, prev, hash });
      this.onChange?.();
    });
  }

  async verify(): Promise<{ ok: boolean; brokenAt?: number }> {
    await this.queue;
    let prev = GENESIS;
    for (const e of this.entries) {
      const h = await sha256Hex([prev, e.seq, e.wall, e.simT.toFixed(3), e.actor, e.action, e.detail].join("|"));
      if (e.prev !== prev || e.hash !== h) return { ok: false, brokenAt: e.seq };
      prev = e.hash;
    }
    return { ok: true };
  }

  head(): string { return this.entries.length ? this.entries[this.entries.length - 1].hash : GENESIS; }

  async exportJson(meta: Record<string, unknown>): Promise<string> {
    await this.queue;
    const body = { meta: { ...meta, synthetic: true, unvalidated: true, note: "Illustrative simulation · scripted exercise" }, chainHead: this.head(), entries: this.entries };
    const seal = await sha256Hex(JSON.stringify(body));
    return JSON.stringify({ ...body, seal }, null, 2);
  }

  wipe(): void { this.entries = []; this.seen.clear(); this.onChange?.(); }
}

// ---------- session passphrase (kept in memory only) ----------
export interface PassVault { salt: Uint8Array; hash: string }

async function derive(pass: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 150_000 }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function sealPassphrase(pass: string): Promise<PassVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt, hash: await derive(pass, salt) };
}
export async function checkPassphrase(pass: string, vault: PassVault): Promise<boolean> {
  return (await derive(pass, vault.salt)) === vault.hash;
}

export function newSessionId(): string {
  const a = crypto.getRandomValues(new Uint8Array(5));
  return "SR-" + [...a].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Only these roles may fire injects or see truth: enforced in the command path, not only in the UI. */
export const ROLE_CAN: Record<string, { inject: boolean; truth: boolean; decide: boolean; pause: boolean }> = {
  Instructor: { inject: true, truth: true, decide: false, pause: true },
  T1: { inject: false, truth: false, decide: true, pause: false },
  T2: { inject: false, truth: false, decide: false, pause: false },
  T3: { inject: false, truth: false, decide: false, pause: false },
};
