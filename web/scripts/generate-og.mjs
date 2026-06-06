// Rasterizes public/og-image.svg → public/og-image.png (1200x630) for social
// link previews. Run with: npm run og   (after editing the SVG).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
await sharp(join(dir, "og-image.svg"), { density: 96 })
  .resize(1200, 630, { fit: "fill" })
  .png()
  .toFile(join(dir, "og-image.png"));
console.log("✓ wrote public/og-image.png (1200x630)");
