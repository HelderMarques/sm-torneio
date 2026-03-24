import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Register service worker for PWA (network-first — always fresh content)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Pull-to-refresh for iOS standalone PWA (OS disables the native gesture)
const isStandalone =
  window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

if (isStandalone) {
  let startY = 0;
  let pulling = false;
  const THRESHOLD = 80;

  const indicator = document.createElement('div');
  indicator.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;' +
    'justify-content:center;height:0;overflow:hidden;background:#9B2D3E;color:#fff;' +
    'font-size:13px;font-family:sans-serif;transition:height 0.1s;';
  indicator.textContent = '↓ Solte para atualizar';
  document.body.appendChild(indicator);

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 10) {
      indicator.style.height = Math.min(dy, THRESHOLD) + 'px';
      indicator.textContent = dy >= THRESHOLD ? '↑ Solte para atualizar' : '↓ Puxe para atualizar';
    }
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    indicator.style.height = '0';
    if (dy >= THRESHOLD) window.location.reload();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
