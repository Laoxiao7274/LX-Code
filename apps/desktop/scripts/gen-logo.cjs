// 生成 LXCode 图标:深色圆角方底 + 亮青渐变 LX(字体渲染,字形精致) + 光点。
// 用 canvas fillText 渲染,比手画 path 质量高得多。
const { createCanvas } = require('C:/Users/xzy/Desktop/my/lx-code-next/node_modules/.pnpm/@napi-rs+canvas@1.0.3/node_modules/@napi-rs/canvas');
const fs = require('fs');

const SIZE = 1024;
function makeLogo(transparent, outPath) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // 深色圆角方底(透明版跳过)
  if (!transparent) {
    const r = SIZE * 0.18, pad = SIZE * 0.06, x = pad, y = pad, w = SIZE - pad * 2, h = w;
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, '#2a2d33'); bg.addColorStop(1, '#15171a');
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath(); ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = SIZE * 0.006; ctx.stroke();
  }

  // LX 渐变
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, '#5eb5ff'); grad.addColorStop(0.5, '#3a8fe0'); grad.addColorStop(1, '#7fd4ff');
  ctx.fillStyle = grad;
  ctx.font = `bold ${Math.floor(SIZE * 0.5)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // LX 居中,稍上偏让光点有位置
  ctx.fillText('LX', SIZE / 2, SIZE / 2);

  // 右上角光点
  const dotR = SIZE * 0.03, dotX = SIZE * 0.82, dotY = SIZE * 0.2;
  const glow = ctx.createRadialGradient(dotX, dotY, dotR * 0.5, dotX, dotY, dotR * 2.8);
  glow.addColorStop(0, 'rgba(127,212,255,0.45)'); glow.addColorStop(1, 'rgba(127,212,255,0)');
  ctx.beginPath(); ctx.arc(dotX, dotY, dotR * 2.8, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
  ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2); ctx.fillStyle = '#7fd4ff'; ctx.fill();

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('saved', outPath, fs.statSync(outPath).size, 'bytes');
}

// 应用图标(深色方底)
makeLogo(false, 'scripts/tmp/icon-src-1024.png');
// 应用内 logo(透明,无方底)
makeLogo(true, 'src/assets/lx-logo.png');
