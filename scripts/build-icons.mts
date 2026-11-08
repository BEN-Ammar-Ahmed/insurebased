// Rebuilds the PNG and ICO icons from the brand SVGs in public/brand.
// Run after changing a brand color: npm run icons
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const pub = path.resolve("public");
const brand = (name: string) => readFileSync(path.join(pub, "brand", name));

async function png(svg: Buffer, width: number, height: number, out: string, background?: string) {
  let image = sharp(svg, { density: 400 }).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (background) image = image.flatten({ background });
  await image.png().toFile(path.join(pub, out));
  console.log("wrote", out);
}

// An .ico file can hold a PNG directly: 6-byte header, one 16-byte entry, PNG bytes.
function icoFromPng(pngBytes: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2); // no palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBytes.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, pngBytes]);
}

const mark = brand("insurebased-mark.svg");
for (const size of [16, 32, 48, 192, 512]) await png(mark, size, size, `icon-${size}.png`);
await png(mark, 180, 180, "apple-touch-icon.png", "#ffffff");
await png(brand("insurebased-logo.svg"), 360, 72, "brand/insurebased-logo.png");
await png(brand("share.svg"), 1200, 630, "brand/insurebased-social.png");
writeFileSync(path.join(pub, "favicon.ico"), icoFromPng(readFileSync(path.join(pub, "icon-32.png")), 32));
console.log("wrote favicon.ico");

// Next.js also serves icons from app/ by file name; keep those copies in sync.
const app = path.resolve("app");
writeFileSync(path.join(app, "icon.svg"), mark);
writeFileSync(path.join(app, "favicon.ico"), readFileSync(path.join(pub, "favicon.ico")));
writeFileSync(path.join(app, "apple-icon.png"), readFileSync(path.join(pub, "apple-touch-icon.png")));
console.log("synced app/icon.svg, app/favicon.ico, app/apple-icon.png");
