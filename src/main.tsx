import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Converter } from './components/converter/Converter.tsx';

/*
 * The page around the converter is static markup produced at build time, so this mounts an island
 * rather than the whole app. The guard is load-bearing: the guide pages ship this bundle's
 * stylesheet but not its script, and a future page might include neither.
 */
const slot = document.getElementById('converter-root');

if (slot) {
  createRoot(slot).render(
    <StrictMode>
      <Converter />
    </StrictMode>,
  );
}
