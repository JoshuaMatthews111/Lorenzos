// Audit 2026-09-24 (rule 41): operationalMutation sent whatever access token was stored. After a laptop wake
// or a tab hidden for over an hour (the 30 s poll pauses while hidden, so nothing renewed the token), the first
// office save went out expired, lib/portal-auth answered 403, and runRemoteMutation signed the office out and
// reloaded — the edit was lost. It now renews a token that is expired or about to expire BEFORE sending, the
// same way loadOperationalData already does. Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(import.meta.dirname, "..", "trainer-backoffice/supabase.js"), "utf8");

function portal({ expiresIn }) {
  const store = new Map();
  const now = Math.floor(Date.now() / 1000);
  store.set("ldttPortalAuth.v1", JSON.stringify({ access_token: "OLD", refresh_token: "r1", expires_at: now + expiresIn, user: { id: "u" } }));
  const storage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const calls = [];
  const fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ u, auth: opts.headers?.Authorization || "" });
    const json = body => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });
    if (u.includes("/api/environment")) return json({ ok: true, schema: "public" });
    if (u.includes("/auth/v1/token?grant_type=refresh_token")) return json({ access_token: "NEW", refresh_token: "r2", expires_in: 3600, expires_at: now + 3600, user: { id: "u" } });
    if (u.includes("/api/operational-mutation")) return json({ ok: true, record: {}, version: 2 });
    return json({});
  };
  const window = { LDTT_SUPABASE: { enabled: true, projectUrl: "https://example.supabase.co", publishableKey: "pk" }, location: { search: "", hostname: "x" }, setTimeout, clearTimeout };
  const ctx = { window, localStorage: storage, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, document: { body: null }, fetch, URLSearchParams, console, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Promise, Error, Object, Array, Boolean };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { api: window.LDTT_PORTAL, calls };
}

test("an expired token is renewed before the save is sent", async () => {
  const { api, calls } = portal({ expiresIn: -60 });
  await api.operationalMutation({ operation: "update", entity_type: "lead", id: "x", changes: { status: "new_inquiry" } });
  const save = calls.find(c => c.u.includes("/api/operational-mutation"));
  assert.ok(calls.some(c => c.u.includes("grant_type=refresh_token")), "renewed first");
  assert.equal(save.auth, "Bearer NEW");
});

test("a fresh token goes straight out, no renewal", async () => {
  const { api, calls } = portal({ expiresIn: 1800 });
  await api.operationalMutation({ operation: "update", entity_type: "lead", id: "x", changes: { status: "new_inquiry" } });
  assert.ok(!calls.some(c => c.u.includes("grant_type=refresh_token")));
  assert.equal(calls.find(c => c.u.includes("/api/operational-mutation")).auth, "Bearer OLD");
});
