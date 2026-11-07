import { pageMeta, renderPage } from '@/lib/page'
import type { PageProps } from '@/lib/page'

export async function generateMetadata({ params, searchParams }: PageProps) {
  return pageMeta('hu', (await params).slug, await searchParams)
}

export default async function Page({ params, searchParams }: PageProps) {
  return renderPage('hu', decodeURIComponent((await params).slug), await searchParams)
}
