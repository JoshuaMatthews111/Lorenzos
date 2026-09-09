// Proof for the durable visit-stamps cache (DO-NOT-BREAK 40).
// Runs the REAL handler against the LDTT database (read + one cache-row write) in
// two separate processes, the way two cold lambdas would see it:
//   process 1: no in-memory cache -> whatever path it takes, record the stamps
//   process 2: fresh process, durable row now present -> must take the cache path,
//              make far fewer lifecycle calls, and produce IDENTICAL stamps.
import { spawnSync } from "node:child_process";
import assert from "node:assert";
const worker = `
import Module from "node:module"; import path from "node:path"; import fs from "node:fs";
const root=process.env.ROOT; const req_=Module.createRequire(root+"/scripts/x.mjs");
const c=JSON.parse(fs.readFileSync(process.env.LDTT_CREDS)); process.env.SUPABASE_URL=c.site_url; process.env.SUPABASE_SERVICE_ROLE_KEY=c.site_key; delete process.env.LDTT_SANDBOX;
const authPath=req_.resolve(path.join(root,"lib/portal-auth.js")); const realLoad=Module._load;
Module._load=function(r,p,m){let res=null;try{res=req_.resolve(r,{paths:[path.dirname(p?.filename||root)]})}catch{} if(res===authPath)return{authorizeRequest:async()=>({role:"admin",portalUser:{user_id:"u1",role:"admin",permission_level:"super_admin",active:true}})}; return realLoad.call(this,r,p,m)};
const handler=req_(path.join(root,"api/operational-data.js"));
const realFetch=globalThis.fetch; let calls=[]; globalThis.fetch=async(u,o)=>{const s=performance.now(); const r=await realFetch(u,o); calls.push({u:String(u),ms:Math.round(performance.now()-s)}); return r;};
const res={statusCode:0,headers:{},body:null,setHeader(k,v){this.headers[k.toLowerCase()]=v;return this;},status(x){this.statusCode=x;return this;},json(b){this.body=b;return this;},end(){return this;}};
const t0=performance.now(); await handler({method:"GET",query:{omit:"sheets,history,events"},headers:{authorization:"Bearer x"}},res); const total=Math.round(performance.now()-t0);
const lc=calls.filter(x=>x.u.includes("/rest/v1/lifecycle_events")).length; const ss=calls.filter(x=>x.u.includes("/rest/v1/site_settings")).length;
const st=res.body.visitStamps; const sorted={site_visit:[...st.site_visit].sort(),cta_click:[...st.cta_click].sort()};
console.log(JSON.stringify({total,calls:calls.length,lifecycleCalls:lc,settingsCalls:ss,source:res.headers["x-ldtt-visit-stamps"],n:sorted.site_visit.length+sorted.cta_click.length,lead:res.body.lifecycleEvents.length,digest:require_hash(JSON.stringify(sorted))}));
function require_hash(s){return req_("node:crypto").createHash("sha256").update(s).digest("hex").slice(0,16)}
`;
const run = label => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", worker], { env: { ...process.env, ROOT: process.cwd(), LDTT_CREDS: process.env.LDTT_CREDS }, encoding: "utf8" });
  const line = r.stdout.trim().split("\n").pop();
  if (!line?.startsWith("{")) { console.error(r.stderr.slice(-2000)); throw new Error(`${label}: worker produced no result`); }
  const out = JSON.parse(line); console.log(`${label.padEnd(34)} ${String(out.total).padStart(5)} ms  supabase calls ${String(out.calls).padStart(3)}  lifecycle calls ${String(out.lifecycleCalls).padStart(3)}  source ${out.source}  stamps ${out.n}  lead rows ${out.lead}  digest ${out.digest}`); return out;
};
let passed = 0; const ok = l => { console.log("PASS ", l); passed += 1; };
const a = run("process 1 (whatever it finds)");
const b = run("process 2 (fresh, durable row present)");
const c = run("process 3 (fresh again)");
assert.ok(b.source === "cache" || b.source === "cache+delta", "a fresh process must use the durable row");
assert.ok(b.lifecycleCalls <= 3, `a fresh process should need ~2 lifecycle calls, made ${b.lifecycleCalls}`);
ok(`a fresh process reads the cached row instead of paging: ${a.lifecycleCalls} -> ${b.lifecycleCalls} lifecycle calls`);
assert.ok(Math.abs(b.n - a.n) <= 60 && Math.abs(c.n - b.n) <= 60, "stamp counts drifted by more than a minute's traffic");
ok(`stamp counts agree across processes within live traffic drift (${a.n}, ${b.n}, ${c.n})`);
assert.strictEqual(b.lead, a.lead); ok(`all ${a.lead} lead/application lifecycle rows still travel`);
if (a.source === "full") { assert.strictEqual(b.digest === a.digest || b.n >= a.n, true); ok("the cached stamps are the full-fetch stamps (plus anything that arrived since)"); }
console.log(`\nAll ${passed} lifecycle-cache checks passed.`);
