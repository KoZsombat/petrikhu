import { pageMeta, renderPage } from '@/lib/page'
import type { PageProps } from '@/lib/page'

/** The news page: an editable page whose news list block shows the live posts (?kategoria=, ?oldal=). */
export async function generateMetadata({ searchParams }: Omit<PageProps, 'params'>) {
  return pageMeta('hu', 'hirek', await searchParams)
}

export default async function Page({ searchParams }: Omit<PageProps, 'params'>) {
  return renderPage('hu', 'hirek', await searchParams)
}
