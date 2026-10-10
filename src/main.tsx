import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ConfigErrorScreen } from './components/ConfigErrorScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { API_CONFIG_ERROR } from './lib/api';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{API_CONFIG_ERROR ? <ConfigErrorScreen message={API_CONFIG_ERROR} /> : <App />}</ErrorBoundary>
  </StrictMode>,
);
