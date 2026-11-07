import { pageMeta, renderPage } from '@/lib/page'
import type { PageProps } from '@/lib/page'

export async function generateMetadata({ params, searchParams }: PageProps) {
  return pageMeta('en', (await params).slug, await searchParams)
}

export default async function Page({ params, searchParams }: PageProps) {
  return renderPage('en', decodeURIComponent((await params).slug), await searchParams)
}
