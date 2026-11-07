import '../globals.css'
import type { ReactNode } from 'react'
import { RootLayout } from '@/components/RootLayout'
import { baseMetadata } from '@/lib/meta'

export const metadata = baseMetadata('hu')

export default function Layout({ children }: { children: ReactNode }) {
  return <RootLayout locale="hu">{children}</RootLayout>
}
