// Local proof for the practice flag on the public Edge Functions. No Supabase
// CLI needed: a fake PostgREST/Storage listens on a random port, Deno.serve is
// stubbed so each function hands over its handler instead of binding a port,
// and every request the handler makes is inspected.
//   deno test --allow-net --allow-env --allow-read supabase/functions/practice-flag.test.ts
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Seen = { method: string; path: string; headers: Record<string, string> };
const seen: Seen[] = [];
const fake = Deno.serve({ port: 0, onListen() {} }, async req => {
  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });
  await req.text();
  seen.push({ method: req.method, path: url.pathname, headers });
  if (url.pathname.startsWith("/storage/")) return new Response(JSON.stringify({ Key: "ok" }), { headers: { "content-type": "application/json" } });
  if (req.method === "GET") return new Response("[]", { headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify([{ id: "row-1" }]), { status: 201, headers: { "content-type": "application/json" } });
});
const port = (fake.addr as Deno.NetAddr).port;
Deno.env.set("SUPABASE_URL", `http://127.0.0.1:${port}`);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");

// Capture each function's handler instead of letting it listen.
const handlers: Record<string, (req: Request) => Promise<Response> | Response> = {};
let current = "";
const realServe = Deno.serve;
(Deno as unknown as { serve: unknown }).serve = (handler: (req: Request) => Promise<Response> | Response) => { handlers[current] = handler; return {} as unknown; };
for (const name of ["submit-contact", "submit-trainer-application", "track-site-event", "submit-content-review"]) {
  current = name;
  await import(`./${name}/index.ts`);
}
(Deno as unknown as { serve: unknown }).serve = realServe;

const bodies: Record<string, unknown> = {
  "submit-contact": { first_name: "Test", last_name: "Practice", email: "practice-test@example.com", phone: "5555555555", page_url: "https://x.vercel.app/contact", submission_id: "qa-1" },
  "submit-trainer-application": { first_name: "Test", last_name: "Practice", email: "practice-test@example.com", phone: "5555555555", page_url: "https://x.vercel.app/trainer-application", submission_id: "qa-2" },
  "track-site-event": { event_type: "page_view", page_path: "/", page_url: "https://x.vercel.app/", session_id: "s", timestamp: new Date().toISOString() },
  "submit-content-review": { reviewer_name: "Test", reviewer_email: "t@example.com", review_text: "Great", trainer_slug: "eric-beck", file: { name: "a.txt", type: "text/plain", data_url: "data:text/plain;base64,aGk=" } }
};

async function run(name: string, practice: boolean) {
  seen.length = 0;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (practice) headers["x-ldtt-practice"] = "1";
  const res = await handlers[name](new Request("http://edge.test/" + name, { method: "POST", headers, body: JSON.stringify(bodies[name]) }));
  assertEquals(res.status, 200, `${name} practice=${practice}: ${await res.text()}`);
  assert(seen.length > 0, `${name}: the function talked to Supabase`);
  return seen.slice();
}

for (const name of Object.keys(bodies)) {
  Deno.test(`${name}: with x-ldtt-practice: 1 every table call carries Accept-Profile + Content-Profile: practice`, async () => {
    const calls = await run(name, true);
    for (const call of calls.filter(c => c.path.startsWith("/rest/v1/"))) {
      assertEquals(call.headers["accept-profile"], "practice", `${call.method} ${call.path}`);
      assertEquals(call.headers["content-profile"], "practice", `${call.method} ${call.path}`);
    }
    for (const call of calls.filter(c => c.path.startsWith("/storage/v1/object/"))) {
      assert(call.path.startsWith("/storage/v1/object/practice-"), `upload goes to a practice-* bucket: ${call.path}`);
    }
  });
  Deno.test(`${name}: without the header no profile header is added and the path is unchanged (live untouched)`, async () => {
    const calls = await run(name, false);
    for (const call of calls) {
      assertEquals(call.headers["accept-profile"], undefined, `${call.method} ${call.path}`);
      assertEquals(call.headers["content-profile"], undefined, `${call.method} ${call.path}`);
      assert(!call.path.includes("practice"), call.path);
    }
  });
}
Deno.test("the flag is only honoured as exactly '1'", async () => {
  seen.length = 0;
  const res = await handlers["track-site-event"](new Request("http://edge.test/track-site-event", { method: "POST", headers: { "content-type": "application/json", "x-ldtt-practice": "yes" }, body: JSON.stringify(bodies["track-site-event"]) }));
  assertEquals(res.status, 200);
  for (const call of seen) assertEquals(call.headers["accept-profile"], undefined);
});
Deno.test("OPTIONS preflight allows the header", async () => {
  const res = await handlers["submit-contact"](new Request("http://edge.test/submit-contact", { method: "OPTIONS" }));
  assert((res.headers.get("access-control-allow-headers") || "").includes("x-ldtt-practice"));
  await res.text();
});
Deno.test({ name: "shutdown", fn: async () => { await fake.shutdown(); }, sanitizeOps: false, sanitizeResources: false });
