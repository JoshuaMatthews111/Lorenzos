(() => {
  const config = window.LDTT_SUPABASE || {};
  const STORAGE_KEY = "ldttPortalAuth.v1";

  const enabled = Boolean(config.enabled && config.projectUrl && config.publishableKey);
  const baseUrl = String(config.projectUrl || "").replace(/\/$/, "");
  let refreshPromise = null;

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function currentAuthUser() {
    return readSession()?.user || null;
  }

  function accessToken() {
    return readSession()?.access_token || "";
  }

  function authHeaders(session = readSession()) {
    const headers = {
      apikey: config.publishableKey,
      "Content-Type": "application/json"
    };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }

  async function request(path, options = {}) {
    if (!enabled) throw new Error("Supabase is not configured");
    const {
      session: requestedSession,
      retryAuth = true,
      ...fetchOptions
    } = options;
    const currentSession = readSession();
    if (
      requestedSession !== null &&
      retryAuth &&
      currentSession?.refresh_token &&
      Number(currentSession.expires_at || 0) <= Math.floor(Date.now() / 1000) + 30
    ) {
      await refreshSession();
    }
    const response = await fetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      headers: {
        ...authHeaders(requestedSession),
        ...(options.headers || {})
      }
    });
    if (response.status === 401 && requestedSession !== null && retryAuth && readSession()?.refresh_token) {
      await refreshSession();
      return request(path, { ...options, retryAuth: false });
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) {
      const message = data?.msg || data?.message || data?.error_description || data?.error || text || `Request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  }

  async function signIn(username, password) {
    const aliases = {
      admin: "production@lorenzosdogtrainingteam.com",
      trainer: "trainer-demo@lorenzosdogtrainingteam.com"
    };
    const email = aliases[String(username).trim().toLowerCase()] || String(username).trim().toLowerCase();
    const session = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      session: null
    });
    writeSession(session);
    return session;
  }

  async function refreshSession() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const current = readSession();
      if (!current?.refresh_token) return null;
      const refreshed = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: current.refresh_token }),
        session: null,
        retryAuth: false
      });
      writeSession(refreshed);
      return refreshed;
    })();
    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function currentPortalUser() {
    const session = readSession();
    if (!session?.access_token) return null;
    try {
      const rows = await request(`/rest/v1/portal_users?select=*&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
      return Array.isArray(rows) ? rows[0] || null : null;
    } catch (error) {
      if (/jwt|token|expired/i.test(error.message)) {
        await refreshSession();
        const next = readSession();
        const rows = await request(`/rest/v1/portal_users?select=*&user_id=eq.${encodeURIComponent(next.user.id)}&limit=1`);
        return Array.isArray(rows) ? rows[0] || null : null;
      }
      throw error;
    }
  }

  async function signOut() {
    const session = readSession();
    try {
      if (session?.access_token) await request("/auth/v1/logout", { method: "POST" });
    } finally {
      writeSession(null);
    }
  }

  async function changePassword(password, profile = {}) {
    const result = await request("/auth/v1/user", {
      method: "PUT",
      body: JSON.stringify({ password })
    });
    const session = readSession();
    const firstName = String(profile.firstName || "").trim();
    const lastName = String(profile.lastName || "").trim();
    const displayName = [firstName, lastName].filter(Boolean).join(" ");
    if (session?.user?.id && displayName) {
      try {
        await updateBy("portal_users", "user_id", session.user.id, { display_name: displayName });
      } catch (error) {
        console.warn("Portal display name could not be updated during password setup", error);
      }
    }
    await rpc("complete_portal_password_change");
    return result;
  }

  async function select(table, query = "select=*") {
    return request(`/rest/v1/${table}?${query}`);
  }

  async function insert(table, body, options = {}) {
    const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
    const prefer = ["return=representation"];
    if (options.onConflict) prefer.push("resolution=merge-duplicates");
    return request(`/rest/v1/${table}${query}`, {
      method: "POST",
      headers: { Prefer: prefer.join(",") },
      body: JSON.stringify(body)
    });
  }

  async function update(table, id, body) {
    return request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
  }

  async function updateBy(table, column, value, body) {
    return request(`/rest/v1/${table}?${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
  }

  async function remove(table, id) {
    return request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" }
    });
  }

  async function rpc(name, body = {}) {
    return request(`/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async function upload(bucket, path, file) {
    async function uploadOnce(retryAuth = true) {
      const session = readSession();
      const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${session?.access_token || ""}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "false"
        },
        body: file
      });
      if (response.status === 401 && retryAuth && session?.refresh_token) {
        await refreshSession();
        return uploadOnce(false);
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Upload failed");
      return data;
    }
    return uploadOnce();
  }

  async function signedStorageUrl(bucket, path, expiresIn = 3600) {
    if (!path || /^(data:|blob:|https?:|\/)/i.test(path)) return path || "";
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const result = await request(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
      method: "POST",
      body: JSON.stringify({ expiresIn })
    });
    const signedPath = result?.signedURL || result?.signedUrl || "";
    if (!signedPath) return "";
    return signedPath.startsWith("http") ? signedPath : `${baseUrl}/storage/v1${signedPath}`;
  }

  function publicStorageUrl(bucket, path) {
    if (!path) return "";
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

  async function loadOperationalData() {
    const session = readSession();
    if (session?.access_token) {
      try {
        const response = await fetch("/api/operational-data", {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.ok) {
          return {
            trainers: data.trainers || [],
            pages: data.pages || [],
            leads: data.leads || [],
            clients: data.clients || [],
            dogs: data.dogs || [],
            applications: data.applications || [],
            submissions: data.submissions || [],
            events: data.events || [],
            portalUsers: data.portalUsers || [],
            officeNotes: data.officeNotes || []
          };
        }
        if (response.status !== 403) {
          console.warn("LDTT operational API unavailable; falling back to direct Supabase reads.", data?.message || response.status);
        }
      } catch (error) {
        console.warn("LDTT operational API failed; falling back to direct Supabase reads.", error);
      }
    }
    const [
      trainers,
      pages,
      leads,
      clients,
      dogs,
      applications,
      submissions,
      events,
      portalUsers,
      officeNotes
    ] = await Promise.all([
      select("trainers", "select=*&order=full_name.asc"),
      select("trainer_pages", "select=*&order=updated_at.desc"),
      select("leads", "select=*&order=created_at.desc"),
      select("clients", "select=*&order=created_at.desc"),
      select("dogs", "select=*&order=created_at.desc"),
      select("trainer_applications", "select=*&order=created_at.desc"),
      select("content_submissions", "select=*&order=created_at.desc"),
      select("site_events", "select=*&order=created_at.desc&limit=5000"),
      select("portal_users", "select=*&order=created_at.desc"),
      select("office_notes", "select=*&order=created_at.desc&limit=5000")
    ]);
    return { trainers, pages, leads, clients, dogs, applications, submissions, events, portalUsers, officeNotes };
  }

  async function loadPublishedTrainer(slug, options = {}) {
    const requested = String(slug || "").trim();
    const looksLikeId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requested);
    let trainers = looksLikeId
      ? await select("trainers", `select=*&id=eq.${encodeURIComponent(requested)}&limit=1`)
      : await select("trainers", `select=*&slug=eq.${encodeURIComponent(requested)}&limit=1`);
    let trainer = trainers?.[0];
    if (!trainer && requested) {
      const compact = requested.replaceAll("-", "").toLowerCase();
      trainers = await select("trainers", "select=*");
      const slugify = value => String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      trainer = trainers.find(item => {
        const itemSlug = String(item.slug || "").replaceAll("-", "").toLowerCase();
        const itemNameSlug = slugify(item.full_name).replaceAll("-", "");
        return itemSlug === compact || itemNameSlug === compact;
      }) || null;
    }
    if (!trainer) return null;
    const visibility = options.includeDraft ? "" : "&page_status=eq.published&locked=eq.true";
    const pages = await select("trainer_pages", `select=*&trainer_id=eq.${encodeURIComponent(trainer.id)}${visibility}&order=updated_at.desc&limit=1`);
    return { trainer, page: pages?.[0] || null };
  }

  window.LDTT_PORTAL = {
    enabled,
    readSession,
    signIn,
    signOut,
    changePassword,
    currentPortalUser,
    currentAuthUser,
    accessToken,
    loadOperationalData,
    loadPublishedTrainer,
    select,
    insert,
    update,
    updateBy,
    remove,
    rpc,
    upload,
    signedStorageUrl,
    publicStorageUrl
  };
})();
