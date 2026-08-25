// Shared sandbox edits.
//
// The office wants every tester to see everyone else's practice changes, and
// the sandbox must still never write to the real tables. There is no SQL access
// to add a scratch table, but the service key can write Storage objects — so
// the practice layer is one JSON file of operations in the existing
// trainer-page-assets bucket. Mutations append to it; the data endpoint lays it
// over the live rows it just fetched. Deleting the file resets the sandbox.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET = "trainer-page-assets";
const OBJECT_PATH = "sandbox/ops-log.txt";
const MAX_OPS = 2000;

function storageUrl() {
  return `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJECT_PATH}`;
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra
  };
}

async function readOps() {
  const response = await fetch(storageUrl(), { headers: headers() });
  if (response.status === 400 || response.status === 404) return [];
  if (!response.ok) throw new Error(`Sandbox op log could not be read (${response.status})`);
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  return Array.isArray(data?.ops) ? data.ops : [];
}

async function writeOps(ops) {
  const body = JSON.stringify({ version: 1, ops: ops.slice(-MAX_OPS) });
  const response = await fetch(storageUrl(), {
    method: "POST",
    headers: headers({ "Content-Type": "text/plain", "x-upsert": "true", "Cache-Control": "no-store" }),
    body
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Sandbox op log could not be written (${response.status}): ${detail.slice(0, 200)}`);
  }
}

async function appendOp(op) {
  // Two testers saving in the same second can race this read-modify-write and
  // one op can be lost. For a four-person practice copy that is acceptable;
  // the loser simply saves again.
  const ops = await readOps();
  ops.push({ ...op, at: new Date().toISOString() });
  await writeOps(ops);
  return op;
}

async function clearOps() {
  const response = await fetch(storageUrl(), { method: "DELETE", headers: headers() });
  if (!response.ok && response.status !== 404 && response.status !== 400) {
    throw new Error(`Sandbox op log could not be cleared (${response.status})`);
  }
}

// Lay the shared practice edits over the live rows the data endpoint fetched.
// The payload is mutated in place.
const ENTITY_COLLECTIONS = {
  lead: "leads",
  application: "applications",
  client: "clients",
  trainer: "trainers",
  trainer_page: "pages",
  submission: "submissions",
  portal_user: "portalUsers"
};

function applyOps(payload, ops) {
  const rowsFor = entityType => payload[ENTITY_COLLECTIONS[entityType]] || null;
  ops.forEach(op => {
    try {
      if (op.operation === "update" || op.operation === "archive") {
        const rows = rowsFor(op.entity_type);
        const row = rows?.find(item => String(item.id) === String(op.id));
        if (row) Object.assign(row, op.changes || {});
      } else if (op.operation === "create") {
        const rows = rowsFor(op.entity_type);
        if (rows) rows.unshift(op.record);
      } else if (op.operation === "save_note") {
        if (op.note_id) {
          const note = payload.officeNotes.find(item => String(item.id) === String(op.note_id));
          if (note) { note.note = op.note; note.updated_at = op.at; }
        } else {
          payload.officeNotes.unshift(op.record);
        }
      } else if (op.operation === "delete_note") {
        payload.officeNotes = payload.officeNotes.filter(item => String(item.id) !== String(op.note_id));
      }
    } catch {
      // A malformed op must never take the whole portal down; skip it.
    }
  });
  return payload;
}

module.exports = { readOps, appendOp, clearOps, applyOps };
