export type ChatResponse = {
  ok: boolean
  message?: string
  error?: string
}

// Read NEXT_PUBLIC_API_BASE directly so the client build uses the configured backend.
const ROOT = process.env.NEXT_PUBLIC_API_BASE ?? ""
// Backend mounts message routes under /api/messages. Default to that when not set.
const CHAT_API = ROOT ? `${ROOT}/messages` : "/api/messages"

async function tryFetch(path: string) {
  try {
    const res = await fetch(path, { method: "GET", credentials: "include" })
    if (!res.ok) return { ok: false, status: res.status, body: await res.text() }
    const json = await res.json()
    return { ok: true, json }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function getContacts(): Promise<{ ok: boolean; contacts?: any[]; error?: string }> {
  // primary route
  const paths = [`${CHAT_API}/contacts`, `${CHAT_API}/all`, `${CHAT_API}/users`, `${CHAT_API}/getAllContacts`]
  for (const p of paths) {
    const r = await tryFetch(p)
    if (r.ok) return { ok: true, contacts: r.json }
    // continue trying other paths
  }
  return { ok: false, error: "No contacts endpoint responded" }
}

export async function getChats(): Promise<{ ok: boolean; chats?: any[]; error?: string }> {
  // try several possible endpoints used in backend implementations
  const paths = [`${CHAT_API}/chats`, `${CHAT_API}/partners`, `${CHAT_API}/chatPartners`, `${CHAT_API}/getChatPartners`, `${CHAT_API}/conversations`]
  for (const p of paths) {
    const r = await tryFetch(p)
    if (r.ok) return { ok: true, chats: r.json }
    // continue trying other paths
  }
  return { ok: false, error: "No chats endpoint responded" }
}

export async function getMessagesByUserId(id: string): Promise<{ ok: boolean; messages?: any[]; error?: string }> {
  try {
    const res = await fetch(`${CHAT_API}/${encodeURIComponent(id)}`, { method: "GET", credentials: "include" })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: text || `Request failed ${res.status}` }
    }
    const json = await res.json()
    return { ok: true, messages: json }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function sendMessageToId(id: string, body: string | FormData | Record<string, any>): Promise<{ ok: boolean; message?: any; error?: string; status?: number }> {
  // If caller provides FormData (file + optional text), send it directly as multipart/form-data
  const url = `${CHAT_API}/send/${encodeURIComponent(id)}`
  try {
    let res: Response
    if (body instanceof FormData) {
      console.debug('Sending as FormData:', {
        hasText: !!body.get('text'),
        hasFile: !!body.get('file')
      })
      
      res = await fetch(url, {
        method: "POST",
        // FormData için Content-Type header'ı göndermiyoruz, browser otomatik ekleyecek
        body: body,
        credentials: "include"
      })
    } else if (typeof body === 'string') {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
        credentials: "include",
      })
    } else {
      // body is an object: send as JSON (allows sending { text, image: base64 })
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      })
    }

    if (!res.ok) {
      const txt = await res.text()
      // try parse JSON body for a better message
      let parsed: any = undefined
      try {
        parsed = txt ? JSON.parse(txt) : undefined
      } catch (e) {
        parsed = undefined
      }

      let errMsg = txt || `Request failed ${res.status}`
      if (parsed) {
        if (typeof parsed === "string") errMsg = parsed
        else if (parsed.error) errMsg = parsed.error
        else if (parsed.message) errMsg = parsed.message
        else {
          try {
            errMsg = JSON.stringify(parsed)
          } catch (e) {
            // keep txt
          }
        }
      }

      try {
        console.debug("sendMessageToId failed:", { status: res.status, body: parsed ?? txt })
      } catch (e) {
        // ignore
      }

      return { ok: false, error: errMsg, status: res.status }
    }
    const json = await res.json()
    return { ok: true, message: json }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

// Backwards-compatible wrapper for simple AI-like reply (if you still used sendMessage earlier)
export async function sendMessage(prompt: string): Promise<ChatResponse> {
  const res = await fetch(`${CHAT_API}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    credentials: "include",
  })
  return res.json()
}
