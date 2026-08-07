// 生成透明背景版 LX logo(只留 LX 字标 + 光点,无深色方底),用于应用内 UI。
const { createCanvas } = require('C:/Users/xzy/Desktop/my/lx-code-next/node_modules/.pnpm/@napi-rs+canvas@1.0.3/node_modules/@napi-rs/canvas');
const fs = require('fs');

const SIZE = 1024;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// 透明背景,只画 LX 字标 + 光点
const lxGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
lxGrad.addColorStop(0, '#5eb5ff');
lxGrad.addColorStop(0.5, '#3a8fe0');
lxGrad.addColorStop(1, '#7fd4ff');
ctx.fillStyle = lxGrad;

const pad = SIZE * 0.06;
const lxSize = SIZE - pad * 2;
const lxX = pad;
const lxY = pad;
const stroke = lxSize * 0.16;

// L
ctx.beginPath();
ctx.moveTo(lxX, lxY);
ctx.lineTo(lxX + stroke, lxY);
ctx.lineTo(lxX + stroke, lxY + lxSize - stroke);
ctx.lineTo(lxX + lxSize * 0.55, lxY + lxSize - stroke);
ctx.lineTo(lxX + lxSize * 0.55, lxY + lxSize);
ctx.lineTo(lxX, lxY + lxSize);
ctx.closePath();
ctx.fill();

// X
const xX = lxX + lxSize * 0.42;
const xW = lxSize * 0.58;
const xStroke = stroke * 0.92;
ctx.beginPath();
ctx.moveTo(xX, lxY);
ctx.lineTo(xX + xW * 0.5, lxY + lxSize * 0.5);
ctx.lineTo(xX + xW, lxY);
ctx.lineTo(xX + xW - xStroke * 1.4, lxY);
ctx.lineTo(xX + xW * 0.5, lxY + lxSize * 0.5 - xStroke * 0.7);
ctx.lineTo(xX + xStroke * 1.4, lxY);
ctx.closePath();
ctx.fill();
ctx.beginPath();
ctx.moveTo(xX + xW, lxY);
ctx.lineTo(xX + xW * 0.5, lxY + lxSize * 0.5);
ctx.lineTo(xX + xW, lxY + lxSize);
ctx.lineTo(xX + xW - xStroke * 1.4, lxY + lxSize);
ctx.lineTo(xX + xW * 0.5, lxY + lxSize * 0.5 + xStroke * 0.7);
ctx.lineTo(xX + xStroke * 1.4, lxY + lxSize);
ctx.lineTo(xX, lxY + lxSize);
ctx.lineTo(xX + xW * 0.5, lxY + lxSize * 0.5);
ctx.closePath();
ctx.fill();

// 光点
const dotR = SIZE * 0.028;
const dotX = SIZE - SIZE * 0.13;
const dotY = SIZE * 0.13;
const glowGrad = ctx.createRadialGradient(dotX, dotY, dotR * 0.5, dotX, dotY, dotR * 2.5);
glowGrad.addColorStop(0, 'rgba(127,212,255,0.5)');
glowGrad.addColorStop(1, 'rgba(127,212,255,0)');
ctx.beginPath();
ctx.arc(dotX, dotY, dotR * 2.5, 0, Math.PI * 2);
ctx.fillStyle = glowGrad;
ctx.fill();
ctx.beginPath();
ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
ctx.fillStyle = '#7fd4ff';
ctx.fill();

const out = 'C:/Users/xzy/Desktop/my/lx-code-next/apps/desktop/src/assets/lx-logo.png';
fs.writeFileSync(out, canvas.toBuffer('image/png'));
console.log('saved transparent logo', fs.statSync(out).size, 'bytes');
