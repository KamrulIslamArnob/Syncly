// ====================================================================
// AI Quota Tracker — backend smoke test (Phase 0 acceptance)
// Doc §10 Phase 0: "curl the snapshot endpoint with the Bearer header
// and get the two seeded Claude Code policies back; unauthenticated
// curl is rejected."
//
// Manual run (NOT part of `npm test` — needs live project + env vars).
// File is named `smoke-*` rather than `test-*` so `node --test` does
// not auto-discover it (would fail without env vars).
//
//   pwsh>  $env:SUPABASE_URL="https://xxxx.supabase.co"
//   pwsh>  $env:SUPABASE_ANON_KEY="ey..."
//   pwsh>  $env:SUPABASE_PAT="sbp_..."   # personal access token
//   pwsh>  node scripts/smoke-ai-quota-backend.mjs
//
// Pre-req: schema.sql + seed.sql applied; SELECT seed_default_providers();
// has been run once under the same user that owns SUPABASE_PAT.
// ====================================================================

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_PAT,
} = process.env;

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PAT"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  console.error("Example (PowerShell):");
  console.error('  $env:SUPABASE_URL="https://xxxx.supabase.co"');
  console.error('  $env:SUPABASE_ANON_KEY="ey..."');
  console.error('  $env:SUPABASE_PAT="sbp_..."');
  process.exit(1);
}

const baseUrl = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

/** PostgREST headers. authed=true adds the Bearer PAT. */
function headers(authed) {
  const h = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (authed) h["Authorization"] = `Bearer ${SUPABASE_PAT}`;
  return h;
}

async function req(path, opts = {}) {
  const authed = opts.authed ?? false;
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers: headers(authed),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = text; }
  }
  return { status: res.status, body };
}

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} — ${detail}`);
  }
}

console.log("AI Quota Tracker — backend smoke test\n");

// --------------------------------------------------------------------
// 1. Unauthenticated read of snapshot MUST be rejected
//    (RLS denies anonymous access to other users' rows)
// --------------------------------------------------------------------
{
  console.log("1. Unauthenticated access");
  const { status, body } = await req("/v_provider_status?select=*");
  check("unauthenticated snapshot rejected (401 or empty 200)",
        status === 401 || status === 403 ||
        (status === 200 && Array.isArray(body) && body.length === 0),
        `got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
}

// --------------------------------------------------------------------
// 2. Authenticated snapshot returns seeded Claude Code policies
// --------------------------------------------------------------------
{
  console.log("\n2. Authenticated snapshot");
  const { status, body } = await req("/v_provider_status?select=*", { authed: true });
  check("snapshot returns 200", status === 200, `got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
  check("snapshot is array", Array.isArray(body), `got ${typeof body}`);

  if (status === 200 && Array.isArray(body)) {
    check("snapshot non-empty (run SELECT seed_default_providers() first)",
          body.length > 0, "empty result — did seed_default_providers() run?");

    if (body.length > 0) {
      const p = body[0];
      check("provider has id",           typeof p.id === "string", `got ${p.id}`);
      check("provider has name",          typeof p.name === "string", `got ${p.name}`);
      check("provider has kind",          typeof p.kind === "string", `got ${p.kind}`);
      check("provider has effective_state",
            typeof p.effective_state === "string", `got ${p.effective_state}`);
      check("effective_state is valid enum",
            ["active", "cooling", "paused", "depleted"].includes(p.effective_state),
            `got ${p.effective_state}`);
      check("provider has policies array",
            Array.isArray(p.policies), `got ${typeof p.policies}`);
      check("NO api_key field in response (defense in depth)",
            p.api_key === undefined, `LEAKED: ${p.api_key}`);

      const cc = body.find((x) => x.name === "Claude Code");
      if (cc) {
        check("Claude Code has 2 policies (Session + Weekly)",
              Array.isArray(cc.policies) && cc.policies.length === 2,
              `got ${cc.policies?.length}`);
        const session = cc.policies?.find((q) => q.label === "Session window");
        if (session) {
          check("Session window is rolling_hours / 5h / requests",
                session.window_type === "rolling_hours" &&
                session.window_hours === 5 &&
                session.metric === "requests",
                `got ${JSON.stringify(session)}`);
          check("Session has window_start / window_end keys",
                "window_start" in session && "window_end" in session,
                `keys: ${Object.keys(session).join(",")}`);
          check("Session used is a number",
                typeof session.used === "number", `got ${session.used}`);
        }
      }
    }
  }
}

// --------------------------------------------------------------------
// 3. Direct providers table MUST NOT leak api_key column
//    (column-level REVOKE enforces this)
// --------------------------------------------------------------------
{
  console.log("\n3. Column-level api_key protection");
  const { status, body } = await req("/providers?select=*", { authed: true });
  if (status === 200 && Array.isArray(body) && body.length > 0) {
    check("api_key column absent from /providers?select=*",
          body[0].api_key === undefined,
          `LEAKED: ${body[0].api_key}`);
  } else {
    check("providers table readable", false,
          `got ${status}: ${JSON.stringify(body).slice(0, 200)}`);
  }

  // Explicit select on api_key column should error (column revoked)
  const { status: s2, body: b2 } = await req("/providers?select=api_key", { authed: true });
  check("explicit select=api_key rejected or empty",
        s2 === 400 || s2 === 401 || s2 === 403 ||
        (s2 === 200 && Array.isArray(b2) && b2.every((r) => r.api_key === undefined)),
        `got ${s2}: ${JSON.stringify(b2).slice(0, 200)}`);
}

// --------------------------------------------------------------------
// 4. Derived-state round-trip: set a 1-minute cooldown, verify
//    effective_state flips to 'cooling' and seconds_until_active is
//    positive. (Teardown: PATCH back to null.)
// --------------------------------------------------------------------
{
  console.log("\n4. Derived state (cooldown)");
  const { status, body: snap } = await req("/v_provider_status?select=*&limit=1", { authed: true });
  if (status === 200 && Array.isArray(snap) && snap.length > 0) {
    const target = snap[0];
    const cooldownUntil = new Date(Date.now() + 60_000).toISOString();
    const { status: pStat } = await req(
      `/provider_state?provider_id=eq.${target.id}`,
      { method: "PATCH", authed: true,
        body: { is_manually_paused: false, cooldown_until: cooldownUntil } }
    );
    check("PATCH provider_state to set cooldown", pStat === 204, `got ${pStat}`);

    if (pStat === 204) {
      const { body: snap2 } = await req("/v_provider_status?select=*&limit=1", { authed: true });
      const updated = Array.isArray(snap2) ? snap2[0] : null;
      check("snapshot now reports 'cooling'",
            updated?.effective_state === "cooling",
            `got ${updated?.effective_state}`);
      check("seconds_until_active is positive",
            typeof updated?.seconds_until_active === "number" &&
            updated.seconds_until_active > 0,
            `got ${updated?.seconds_until_active}`);

      // Teardown: clear cooldown so the test is repeatable
      await req(
        `/provider_state?provider_id=eq.${target.id}`,
        { method: "PATCH", authed: true,
          body: { is_manually_paused: false, cooldown_until: null } }
      );
    }
  } else {
    check("snapshot reachable for cooldown test", false,
          `got ${status}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
