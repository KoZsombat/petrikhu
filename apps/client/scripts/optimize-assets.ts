/**
 * One-off: turns the original (heavy) design assets into the small files in public/img.
 *   bun scripts/optimize-assets.ts <folder with carousel1.png, logo_nagy_ed8ce51ced.png, partners/>
 * The originals are in the git history (src/assets before the monorepo rewrite); the outputs are committed.
 */
import { mkdir, readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const input = process.argv[2]
if (!input) throw new Error('usage: bun scripts/optimize-assets.ts <assets folder>')
const out = join(import.meta.dir, '../public/img')
await mkdir(join(out, 'partners'), { recursive: true })

// Hero: full-width cover image.
for (const width of [640, 1280, 1920]) {
  const base = sharp(join(input, 'carousel1.png')).resize({ width, withoutEnlargement: true })
  await base.clone().avif({ quality: 50 }).toFile(join(out, `hero-${width}.avif`))
  await base.clone().webp({ quality: 72 }).toFile(join(out, `hero-${width}.webp`))
  await base.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(join(out, `hero-${width}.jpg`))
}

// Logo: shown 200-208 px wide; 1x and 2x.
for (const width of [208, 416]) {
  const base = sharp(join(input, 'logo_nagy_ed8ce51ced.png')).resize({ width })
  await base.clone().webp({ quality: 90 }).toFile(join(out, `logo-${width}.webp`))
  await base.clone().png({ compressionLevel: 9, palette: true }).toFile(join(out, `logo-${width}.png`))
}

// Partner logos: shown up to ~160 px wide, 128 px high.
for (const file of await readdir(join(input, 'partners'))) {
  if (extname(file) !== '.png') continue
  const name = basename(file, '.png')
  const base = sharp(join(input, 'partners', file)).resize({ width: 320, height: 256, fit: 'inside', withoutEnlargement: true })
  await base.clone().webp({ quality: 88 }).toFile(join(out, 'partners', `${name}.webp`))
  await base.clone().png({ compressionLevel: 9, palette: true }).toFile(join(out, 'partners', `${name}.png`))
}
console.log('done')
