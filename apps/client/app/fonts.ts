/**
 * The three typefaces, self-hosted (files from @fontsource, in ./fonts). Each comes as a Latin and a Latin
 * Extended file (ő, ű) with its unicode-range; the CSS variables list both, so the browser downloads only what
 * a page needs. next/font requires literal options, hence the repetition.
 */
import localFont from 'next/font/local'

export const archivo = localFont({
  src: './fonts/archivo-latin-wght-normal.woff2',
  display: 'swap',
  variable: '--font-archivo',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
  weight: '100 900',
  fallback: ['system-ui', 'sans-serif'],
})
export const archivoExt = localFont({
  src: './fonts/archivo-latin-ext-wght-normal.woff2',
  display: 'swap',
  variable: '--font-archivo-ext',
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
  weight: '100 900',
  preload: false,
})
export const newsreader = localFont({
  src: './fonts/newsreader-latin-opsz-normal.woff2',
  display: 'swap',
  variable: '--font-newsreader',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
  weight: '200 800',
  fallback: ['Georgia', 'serif'],
})
export const newsreaderExt = localFont({
  src: './fonts/newsreader-latin-ext-opsz-normal.woff2',
  display: 'swap',
  variable: '--font-newsreader-ext',
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
  weight: '200 800',
  preload: false,
})
export const plexMono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500' },
    { path: './fonts/ibm-plex-mono-latin-600-normal.woff2', weight: '600' },
  ],
  display: 'swap',
  variable: '--font-plex',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
  fallback: ['Consolas', 'monospace'],
})
export const plexMonoExt = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-ext-400-normal.woff2', weight: '400' },
    { path: './fonts/ibm-plex-mono-latin-ext-500-normal.woff2', weight: '500' },
    { path: './fonts/ibm-plex-mono-latin-ext-600-normal.woff2', weight: '600' },
  ],
  display: 'swap',
  variable: '--font-plex-ext',
  declarations: [{ prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
  preload: false,
})

export const fontVariables = [archivo, archivoExt, newsreader, newsreaderExt, plexMono, plexMonoExt].map((font) => font.variable).join(' ')
