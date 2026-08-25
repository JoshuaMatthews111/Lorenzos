(() => {
  const config = window.LDTT_SUPABASE || {};
  const STORAGE_KEY = "ldttPortalAuth.v1";
  const RECOVERABLE_CACHE_KEYS = [
    "ldttOperationalSnapshot.v1",
    "ldttTrainerSiteEvents.v1",
    "lorenzoBackOfficePrototype.v9",
    "ldttContactSubmissions.v2",
    "ldttTrainerApplications.v1",
    "ldttTrainerApplicationOverrides.v1"
  ];

  const enabled = Boolean(config.enabled && config.projectUrl && config.publishableKey);
  const baseUrl = String(config.projectUrl || "").replace(/\/$/, "");
  let refreshPromise = null;
  let persistSession = Boolean(readStoredSession(localStorage));

  function readSession() {
    return readStoredSession(localStorage) || readStoredSession(sessionStorage);
  }

  function readStoredSession(storage) {
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function isQuotaError(error) {
    return error?.name === "QuotaExceededError" ||
      error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      /quota|exceeded/i.test(error?.message || "");
  }

  function clearRecoverableCache(exceptKey = "") {
    RECOVERABLE_CACHE_KEYS.forEach(key => {
      if (key === exceptKey) return;
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage cleanup is best effort only.
      }
    });
  }

  function writeSession(session, remember = persistSession) {
    if (!session) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    }
    const value = JSON.stringify(session);
    persistSession = Boolean(remember);
    if (!persistSession) {
      try {
        sessionStorage.setItem(STORAGE_KEY, value);
        localStorage.removeItem(STORAGE_KEY);
        return;
      } catch (error) {
        if (!isQuotaError(error)) throw error;
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, value);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    } catch (error) {
      if (isQuotaError(error)) {
        clearRecoverableCache(STORAGE_KEY);
        try {
          localStorage.setItem(STORAGE_KEY, value);
          try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
          return;
        } catch {
          // Fall through to tab-scoped auth storage.
        }
      }
      try {
        sessionStorage.setItem(STORAGE_KEY, value);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        console.warn("LDTT portal auth is using tab storage because browser storage is full.", error);
        return;
      } catch {
        throw error;
      }
    }
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

  async function signIn(username, password, options = {}) {
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
    writeSession(session, options.remember === true);
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
      writeSession(refreshed, persistSession);
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

  function storageObjectUrl(bucket, path) {
    return `${baseUrl}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  function signedUploadUrlFromResponse(result, bucket, path) {
    if (result?.signedUrl || result?.signedURL) return result.signedUrl || result.signedURL;
    if (result?.token) {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      return `${baseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath}?token=${encodeURIComponent(result.token)}`;
    }
    return "";
  }

  async function createTrainerMediaUploadUrl(bucket, path, file) {
    const token = accessToken();
    if (!token || !["trainer-page-assets", "trainer-page-videos"].includes(bucket)) return null;
    const response = await fetch("/api/trainer-media-upload-url", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bucket,
        path,
        content_type: file.type || "application/octet-stream",
        size: file.size || 0
      })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404 || response.status === 405) return null;
    if (!response.ok) throw new Error(data.message || "Trainer media upload could not be authorized.");
    return data;
  }

  function uploadToSignedUrl(signedUrl, file, options = {}) {
    const methods = ["PUT", "POST"];
    function attempt(index = 0) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(methods[index], signedUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = event => {
          if (!event.lengthComputable) return;
          const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
          options.onProgress?.({ loaded: event.loaded, total: event.total, percent });
        };
        xhr.onload = async () => {
          let data = {};
          try {
            data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          } catch {
            data = { message: xhr.responseText };
          }
          if ((xhr.status === 405 || xhr.status === 404) && index + 1 < methods.length) {
            try {
              resolve(await attempt(index + 1));
            } catch (error) {
              reject(error);
            }
            return;
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(data.message || data.error || "Signed media upload failed"));
            return;
          }
          options.onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
          resolve(data);
        };
        xhr.onerror = () => reject(new Error("Signed media upload failed. Check your connection and try again."));
        xhr.send(file);
      });
    }
    return attempt();
  }

  async function uploadWithSignedTrainerMediaUrl(bucket, path, file, options = {}) {
    const signed = await createTrainerMediaUploadUrl(bucket, path, file);
    if (!signed) return null;
    const signedUrl = signedUploadUrlFromResponse(signed, signed.bucket || bucket, signed.path || path);
    if (!signedUrl) throw new Error("Trainer media upload could not be authorized.");
    await uploadToSignedUrl(signedUrl, file, options);
    return { signed: true, path: signed.path || path, bucket: signed.bucket || bucket, publicUrl: signed.publicUrl || publicStorageUrl(bucket, path) };
  }

  function uploadWithProgress(bucket, path, file, options = {}, retryAuth = true) {
    return new Promise((resolve, reject) => {
      const session = readSession();
      const xhr = new XMLHttpRequest();
      xhr.open("POST", storageObjectUrl(bucket, path), true);
      xhr.setRequestHeader("apikey", config.publishableKey);
      xhr.setRequestHeader("Authorization", `Bearer ${session?.access_token || ""}`);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
        options.onProgress?.({ loaded: event.loaded, total: event.total, percent });
      };
      xhr.onload = async () => {
        let data = {};
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          data = { message: xhr.responseText };
        }
        if (xhr.status === 401 && retryAuth && session?.refresh_token) {
          try {
            await refreshSession();
            resolve(await uploadWithProgress(bucket, path, file, options, false));
          } catch (error) {
            reject(error);
          }
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data.message || data.error || "Upload failed"));
          return;
        }
        options.onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
        resolve(data);
      };
      xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
      xhr.send(file);
    });
  }

  async function upload(bucket, path, file, options = {}) {
    if (typeof options.onProgress === "function" && ["trainer-page-assets", "trainer-page-videos"].includes(bucket)) {
      const signedUpload = await uploadWithSignedTrainerMediaUrl(bucket, path, file, options).catch(error => {
        if (/not found|method not allowed|failed to fetch/i.test(error.message || "")) return null;
        throw error;
      });
      if (signedUpload) return signedUpload;
    }
    if (typeof options.onProgress === "function" && typeof XMLHttpRequest !== "undefined") {
      return uploadWithProgress(bucket, path, file, options);
    }
    async function uploadOnce(retryAuth = true) {
      const session = readSession();
      const response = await fetch(storageObjectUrl(bucket, path), {
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

  /* Signed links used to last an hour, so leaving the portal open past that
     turned every submission thumbnail into a broken-image question mark.
     Twelve hours outlives a working day without making the link permanent. */
  async function signedStorageUrl(bucket, path, expiresIn = 43200) {
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
    if (!session?.access_token) throw new Error("Your staff session has expired. Sign in again to load live records.");
    const response = await fetch("/api/operational-data", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !data?.canonical) {
      throw new Error(data?.message || "Live staff records are temporarily unavailable. No cached records were shown.");
    }
    return {
      canonical: true,
      syncedAt: data.syncedAt,
      serverRevision: data.serverRevision,
      unavailableCapabilities: data.unavailableCapabilities || [],
      trainers: data.trainers || [],
      pages: data.pages || [],
      leads: data.leads || [],
      leadEvents: data.leadEvents || [],
      clients: data.clients || [],
      dogs: data.dogs || [],
      applications: data.applications || [],
      submissions: data.submissions || [],
      events: data.events || [],
      portalUsers: data.portalUsers || [],
      officeNotes: data.officeNotes || [],
      auditEvents: data.auditEvents || [],
      noteRevisions: data.noteRevisions || [],
      deliveryAttempts: data.deliveryAttempts || [],
      reviewPublications: data.reviewPublications || [],
      lifecycleEvents: data.lifecycleEvents || [],
      sheets: data.sheets || { leads: [], applications: [], clients: [] }
    };
  }

  async function operationalMutation(payload) {
    const session = readSession();
    if (!session?.access_token) throw new Error("Your staff session has expired. Sign in again before saving.");
    const response = await fetch("/api/operational-mutation", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || "The live record could not be saved.");
      error.status = response.status;
      error.conflict = data.conflict === true;
      error.record = data.record || null;
      throw error;
    }
    return data;
  }

  function subscribeOperationalChanges(onChange) {
    if (!enabled || typeof onChange !== "function" || !window.supabase?.createClient) return () => {};
    const session = readSession();
    if (!session?.access_token) return () => {};
    const realtimeClient = window.supabase.createClient(baseUrl, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 4 } }
    });
    realtimeClient.realtime.setAuth(session.access_token);
    const tables = ["leads", "trainer_applications", "clients", "office_notes", "audit_events", "review_publications"];
    const channel = tables.reduce((current, table) => current.on("postgres_changes", { event: "*", schema: "public", table }, payload => onChange(payload)), realtimeClient.channel(`office-sync-${session.user?.id || "staff"}-${Date.now()}`));
    channel.subscribe();
    return () => { realtimeClient.removeChannel(channel).catch(() => {}); };
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

  // ---- Sandbox lock -------------------------------------------------------
  // Everything the portal saves through /api is refused server-side on the
  // sandbox deployment. These calls, though, talk straight to Supabase from the
  // browser, so they need their own stop or the sandbox could still change a
  // real record. app.js turns this on after asking /api/environment.
  const SANDBOX_WRITE_METHODS = ["insert", "update", "updateBy", "remove", "rpc", "upload", "changePassword"];
  const SANDBOX_MESSAGE = "Sandbox: this was not saved. The sandbox shows the real live records so you can check the layout and the numbers, but it is not allowed to change them.";
  let sandboxLocked = false;

  function lockForSandbox() {
    if (sandboxLocked) return;
    sandboxLocked = true;
    SANDBOX_WRITE_METHODS.forEach(name => {
      window.LDTT_PORTAL[name] = async () => { throw new Error(SANDBOX_MESSAGE); };
    });
  }

  window.LDTT_PORTAL = {
    enabled,
    lockForSandbox,
    sandboxMessage: SANDBOX_MESSAGE,
    readSession,
    signIn,
    signOut,
    changePassword,
    currentPortalUser,
    currentAuthUser,
    accessToken,
    loadOperationalData,
    operationalMutation,
    subscribeOperationalChanges,
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
