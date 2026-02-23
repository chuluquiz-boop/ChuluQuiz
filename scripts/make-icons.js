import sharp from "sharp";
import { readFileSync } from "fs";

const svg = readFileSync("public/icon.svg");

await sharp(svg).resize(192, 192).png().toFile("public/pwa-192.png");
await sharp(svg).resize(512, 512).png().toFile("public/pwa-512.png");

console.log("Done: pwa-192.png & pwa-512.png created in /public");
