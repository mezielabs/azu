import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Render from the real brand assets and demo screenshot, with the bundled font.
// Run from the repository root: pnpm --filter docs og:generate
const asset = (path) => new URL(path, import.meta.url)
const width = 1200
const height = 630
const ink = '#1C1916'
const ground = '#F7F6F4'
const clay = '#B0472A'
const layers = []

function svg(markup) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${markup}</svg>`
  )
}

async function text(value, { x, y, size, weight = 400, colour = ink }) {
  const fontfile = fileURLToPath(
    asset(
      `../node_modules/@fontsource/instrument-sans/files/instrument-sans-latin-${weight}-normal.woff`
    )
  )
  const input = await sharp({
    text: {
      text: `<span foreground="${colour}">${value}</span>`,
      font: `Instrument Sans ${weight === 600 ? 'SemiBold' : 'Regular'} ${size}`,
      fontfile,
      dpi: 72,
      rgba: true,
    },
  })
    .png()
    .toBuffer()
  layers.push({ input, left: x, top: y })
}

layers.push({
  input: svg(`<rect width="1200" height="630" fill="${ground}"/>
    <rect x="600" width="600" height="630" fill="${clay}"/>
    <path d="M56 542H544" stroke="#DCD7D1"/>
    <rect x="624" y="148" width="664" height="464" rx="12" fill="${ink}" opacity=".14"/>
    <rect x="624" y="140" width="664" height="464" rx="12" fill="#FFFFFF"/>
    <circle cx="646" cy="160" r="4" fill="#D5CFC8"/>
    <circle cx="660" cy="160" r="4" fill="#D5CFC8"/>
    <circle cx="674" cy="160" r="4" fill="#D5CFC8"/>`),
  left: 0,
  top: 0,
})

const lockup = await sharp(await readFile(asset('../src/assets/brand/azu-lockup.svg')))
  .resize({ width: 152 })
  .png()
  .toBuffer()
layers.push({ input: lockup, left: 56, top: 56 })

await text('THE ADONISJS ADMIN PANEL', { x: 56, y: 184, size: 16, weight: 600, colour: clay })
await text('The back of', { x: 52, y: 232, size: 72, weight: 600 })
await text('your AdonisJS', { x: 52, y: 306, size: 72, weight: 600 })
await text('app.', { x: 52, y: 392, size: 72, weight: 600, colour: clay })
await text('Your models, policies, and validators.', { x: 56, y: 476, size: 24, colour: '#5A544E' })
await text('azuadmin.com', { x: 56, y: 568, size: 20, weight: 600 })
await text('Lucid · Bouncer · VineJS', { x: 322, y: 570, size: 18, colour: '#5A544E' })
await text('YOUR APP. YOUR RULES.', { x: 648, y: 70, size: 18, weight: 600, colour: ground })
await text('/admin/products', { x: 704, y: 153, size: 14, colour: '#5A544E' })

// Keep the actual interface intact; let the product preview bleed off the right edge.
const preview = await sharp(await readFile(asset('../../../docs/screenshots/list-light.png')))
  .resize({ width: 664 })
  .extract({ left: 0, top: 0, width: 576, height: 415 })
  .png()
  .toBuffer()
layers.push({ input: preview, left: 624, top: 180 })

const output = asset('../public/og/azu.png')
await mkdir(new URL('.', output), { recursive: true })
await sharp({ create: { width, height, channels: 3, background: ground } })
  .composite(layers)
  .png({ compressionLevel: 9 })
  .toFile(fileURLToPath(output))
console.log(`Generated ${fileURLToPath(output)} (${width}×${height})`)
