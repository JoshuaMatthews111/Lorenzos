type InsertOptions = {
  table: string;
  body: Record<string, unknown> | Record<string, unknown>[];
  returning?: "minimal" | "representation";
  onConflict?: string;
};

function credentials() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const serviceRoleKey = secretKeys ? JSON.parse(secretKeys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase backend credentials");
  return { supabaseUrl, serviceRoleKey };
}

function serviceHeaders(serviceRoleKey: string, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    ...extra
  };
  if (!serviceRoleKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceRoleKey}`;
  return headers;
}

export async function insertRows({ table, body, returning = "representation", onConflict }: InsertOptions) {
  const { supabaseUrl, serviceRoleKey } = credentials();
  const prefer = [`return=${returning}`];
  if (onConflict) prefer.push("resolution=merge-duplicates");

  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method: "POST",
    headers: serviceHeaders(serviceRoleKey, {
      "Content-Type": "application/json",
      Prefer: prefer.join(",")
    }),
    body: JSON.stringify(body)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${table} insert failed: ${response.status} ${text}`);
  }

  return data;
}

export async function selectRows({ table, select = "*", filters = {}, limit = 20 }: {
  table: string;
  select?: string;
  filters?: Record<string, string>;
  limit?: number;
}) {
  const { supabaseUrl, serviceRoleKey } = credentials();
  const params = new URLSearchParams({ select, limit: String(limit) });
  Object.entries(filters).forEach(([key, value]) => params.set(key, value));
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, {
    headers: serviceHeaders(serviceRoleKey)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${table} select failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : [];
}
