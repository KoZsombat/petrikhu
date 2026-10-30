/**
 * Kliensoldali komponensek tesztje build nélkül: a Vite SSR-módban tölti be a .tsx modulokat (JSX, JSON-importok),
 * a react-dom/server pedig szöveggé rendereli őket. Nincs böngésző és nincs új függőség.
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
