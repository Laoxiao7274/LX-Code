// 生成 LXCode 应用图标源 PNG(1024x1024),供 tauri icon 生成全套尺寸。
// 设计:深色圆角方形背景(匹配 LXCode 暖褐黑 #1a1714)+ 六边形 LX 标志(蓝色渐变)。
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";

const SIZE = 1024;
const HALF = SIZE / 2;
const SCALE = (SIZE / 32) * 0.74;

// 应用图标用的 SVG:圆角方形背景 + 居中的 LX 几何标志
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#221d18"/>
      <stop offset="1" stop-color="#15110d"/>
    </linearGradient>
    <linearGradient id="lx" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4a93e0" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#2f7ad6" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="220" ry="220" fill="url(#bg)"/>
  <g transform="translate(${HALF} ${HALF}) scale(${SCALE})">
    <g transform="translate(-16 -16)">
      <path d="M16 2.5l11.5 6.5v14L16 29.5 4.5 23V9L16 2.5z" fill="url(#lx)" fill-opacity="0.16" stroke="url(#lx)" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M10.5 10.5v9.5h5.5" stroke="url(#lx)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M17.5 10.5l5 9.5M22.5 10.5l-5 9.5" stroke="url(#lx)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
  </g>
</svg>
`;

mkdirSync("scripts/tmp", { recursive: true });
const outPath = "scripts/tmp/lxcode-icon-1024.png";

await sharp(Buffer.from(svg))
  .png()
  .toFile(outPath);

console.log("生成:", outPath);
