/** The admin's only way to the server: same-origin `/api` calls with the session cookie. */

export class ApiError extends Error {
  status: number
  code: string
  issues: { path: string; message: string }[]
  constructor(status: number, code: string, issues: { path: string; message: string }[] = []) {
    super(messageFor(code, issues))
    this.status = status
    this.code = code
    this.issues = issues
  }
}

/** Hungarian messages for the API's error codes. */
const MESSAGES: Record<string, string> = {
  not_logged_in: 'Lejárt a bejelentkezés. Jelentkezz be újra.',
  forbidden: 'Ehhez nincs jogosultságod.',
  not_found: 'Nem található.',
  invalid_credentials: 'Hibás felhasználónév vagy jelszó.',
  empty_fields: 'Add meg a felhasználónevet és a jelszót.',
  too_many_attempts: 'Túl sok sikertelen próbálkozás. Próbáld újra később.',
  too_many_requests: 'Túl sok kérés. Várj egy kicsit.',
  bad_origin: 'A kérés nem a webhelyről érkezett.',
  missing_fields: 'A cím és a szöveg kötelező.',
  category_required: 'Válassz legalább egy kategóriát.',
  rejection_note_required: 'A visszaküldéshez írj üzenetet a szerzőnek.',
  schedule_invalid: 'Az időzítés legalább egy perccel későbbi időpont legyen.',
  not_in_review: 'A hír már nem vár jóváhagyásra.',
  invalid_slug: 'Ez a webcím nem használható (foglalt útvonal, csak számjegy, vagy hibás formátum).',
  slug_taken: 'Ezen a webcímen már van oldal.',
  in_trash: 'Az oldal a lomtárban van; előbb állítsd vissza.',
  username_taken: 'Ez a felhasználónév már foglalt.',
  last_manager: 'Legalább egy adminisztrátornak maradnia kell.',
  cannot_delete_self: 'A saját fiókodat nem törölheted.',
  wrong_password: 'A jelenlegi jelszó nem stimmel.',
  password_too_short: 'A jelszó legalább 10 karakter legyen.',
  term_exists: 'Ilyen nevű kategória / címke már van.',
  not_an_image: 'Ez nem kép, vagy nem támogatott formátum (JPG, PNG, GIF, WebP, AVIF, SVG).',
  unsupported_file: 'Nem támogatott fájltípus.',
  file_too_large: 'A fájl túl nagy (képeknél 8 MB, dokumentumoknál 9 MB a határ).',
  payload_too_large: 'A tartalom túl nagy.',
  upload_failed: 'A feltöltés nem sikerült.',
  invalid_body: 'Hibás vagy hiányzó mezők.',
  server_error: 'Szerverhiba. Próbáld újra később.',
  network: 'Nem érhető el a szerver.',
}

function messageFor(code: string, issues: { path: string; message: string }[]): string {
  const base = MESSAGES[code] ?? `Hiba: ${code}`
  if (code === 'invalid_body' && issues.length) {
    const first = issues[0]
    return `${base} (${first.path || 'tartalom'}: ${MESSAGES[first.message] ?? first.message})`
  }
  return base
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined
  if (init.body instanceof FormData) body = init.body
  else if (init.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(init.body)
  }
  let res: Response
  try {
    res = await fetch(`/api${path}`, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'network')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: { path: string; message: string }[] }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'server_error', data.issues)
  return data as T
}

export const get = <T,>(path: string) => api<T>(path)
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} })
export const put = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body })
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' })

export function upload(path: string, file: File): Promise<{ url: string; id?: string }> {
  const form = new FormData()
  form.append('file', file)
  return api(path, { method: 'POST', body: form })
}

/** Sends unsaved content to /api/preview and opens it on the public site. */
export async function openPreview(body: unknown): Promise<void> {
  const win = window.open('about:blank', '_blank')
  try {
    const { url } = await post<{ url: string }>('/preview', body)
    if (win) win.location.href = url
    else window.open(url, '_blank')
  } catch (error) {
    win?.close()
    throw error
  }
}
