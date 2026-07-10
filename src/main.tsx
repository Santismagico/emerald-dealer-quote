import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Señal para la red de seguridad de index.html: el script principal arrancó.
(window as unknown as { __EDQ_STARTED?: boolean }).__EDQ_STARTED = true;

registerSW({ immediate: true });

const rootElement = document.getElementById('root')!;
// Si la red de seguridad alcanzó a pintar el mensaje de error, se limpia.
rootElement.textContent = '';

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
