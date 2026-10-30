/**
 * Client-side component tests without a build: loads the .tsx modules in Vite SSR mode (JSX, JSON imports),
 * and react-dom/server renders them to text. No browser and no new dependency.
 */
import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'

let vite: ViteDevServer | undefined

export async function loadClientModule<T = Record<string, unknown>>(path: string): Promise<T> {
  vite ??= await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  return (await vite.ssrLoadModule(path)) as T
}

export async function closeVite(): Promise<void> {
  await vite?.close()
  vite = undefined
}
