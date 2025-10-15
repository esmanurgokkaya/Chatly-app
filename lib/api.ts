export type AuthResponse = {
  ok: boolean
  user?: {
    id?: string
    fullname: string
    email: string
  }
  accessToken?: string
  error?: string
}
// Read NEXT_PUBLIC_API_BASE directly — Next will replace this at build-time.
// Avoid checking `typeof window` here because module evaluation can run on the server
// and would incorrectly disable the external backend route.
const ROOT = process.env.NEXT_PUBLIC_API_BASE ?? ""
// If NEXT_PUBLIC_API_BASE is set, expect external backend with routes mounted at /auth
// otherwise fall back to local demo Next.js routes under /api/auth
const API_BASE = ROOT ? `${ROOT}/auth` : "/api/auth"

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  })

  const text = await res.text()
  let data: any = undefined
  try {
    data = text ? JSON.parse(text) : undefined
  } catch (e) {
    // not JSON
    data = undefined
  }

  if (!res.ok) {
    const errorMessage = (data && data.error) || text || `Request failed with status ${res.status}`
  // Use debug instead of error to avoid Next.js dev overlay converting console.error
  // into runtime exceptions during development. The error is still returned below
  // so callers can handle it.
  console.debug(`API POST ${path} failed:`, { status: res.status, body: text })
    return { ok: false, error: errorMessage }
  }

  return data ?? { ok: true }
}

export async function authLogin(email: string, password: string): Promise<AuthResponse> {
  // Ensure keys are exactly `email` and `password` to match backend expectations
  const payload = { email: email, password: password }
  console.debug("authLogin payload:", payload)
  const res = await postJson(`${API_BASE}/login`, payload)

  // If postJson returned a normalized response (has ok flag), pass it through
  if (res && typeof res === "object" && Object.prototype.hasOwnProperty.call(res, "ok")) {
    return res as AuthResponse
  }

  // Otherwise the backend returned the user object directly. Normalize it.
  const data: any = res
  return {
    ok: true,
    user: {
      id: data?._id ?? data?.id,
      // backend uses `fullName` while our UI expects `fullname`
      fullname: data?.fullName ?? data?.fullname ?? "",
      email: data?.email,
    },
  }
}

export async function authSignup(fullname: string, email: string, password: string): Promise<AuthResponse> {
  // backend expects `fullName` (camelCase)
  const res = await postJson(`${API_BASE}/signup`, { fullName: fullname, email, password })

  if (res && typeof res === "object" && Object.prototype.hasOwnProperty.call(res, "ok")) {
    return res as AuthResponse
  }

  const data: any = res
  return {
    ok: true,
    user: {
      id: data?._id ?? data?.id,
      fullname: data?.fullName ?? data?.fullname ?? "",
      email: data?.email,
    },
  }
}

export async function authLogout(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/logout`, { 
      method: "POST", 
      credentials: "include"
    })

    // Try to parse response as JSON
    const text = await res.text()
    let data
    try {
      data = text ? JSON.parse(text) : undefined
    } catch (e) {
      data = undefined
    }

    if (!res.ok) {
      console.debug("Logout failed:", { status: res.status, body: text })
      return { 
        ok: false, 
        error: (data && data.error) || text || `Logout failed with status ${res.status}` 
      }
    }

    // Successfully logged out
    return data ?? { ok: true }
  } catch (err: any) {
    console.debug("Logout error:", err)
    return { ok: false, error: err.message }
  }
}

export async function authCheck(): Promise<{ ok: boolean; user?: { id?: string; fullname?: string; email?: string }; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/check`, { method: "GET", credentials: "include" })
    const text = await res.text()
    let data: any = undefined
    try {
      data = text ? JSON.parse(text) : undefined
    } catch (e) {
      data = undefined
    }

    if (!res.ok) {
      return { ok: false, error: (data && data.error) || text || `Request failed ${res.status}` }
    }

    // normalize backend user -> include id
    if (data && data.user) {
      const u = data.user
      return { ok: true, user: { id: u._id ?? u.id, fullname: u.fullName ?? u.fullname ?? u.name, email: u.email } }
    }

    // sometimes backend returns the user object directly
    if (data && (data._id || data.email)) {
      return { ok: true, user: { id: data._id ?? data.id, fullname: data.fullName ?? data.fullname ?? data.name, email: data.email } }
    }

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
