import '../../globals.css'
import type { ReactNode } from 'react'
import { RootLayout } from '@/components/RootLayout'
import { baseMetadata } from '@/lib/meta'

export const metadata = baseMetadata('en')

export default function Layout({ children }: { children: ReactNode }) {
  return <RootLayout locale="en">{children}</RootLayout>
}
