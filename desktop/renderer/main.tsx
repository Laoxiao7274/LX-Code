import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import App from "./App.tsx";
import "./styles/globals.css";

// Electron 禁用 GPU 软件渲染下,GSAP 默认 translate3d 会失效。
// force3D:false 强制用 2D transform,软件渲染能正常跑动画。
gsap.config({ force3D: false });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
