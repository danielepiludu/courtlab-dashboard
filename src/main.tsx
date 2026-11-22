import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Link per gli atleti (#/rpe/<codice>): pagina leggera, senza caricare l'app dello staff
const athleteToken = /^#\/rpe\/([A-Za-z0-9]{10,40})/.exec(location.hash)?.[1];
const App = lazy(() => import('./App'));
const AthletePage = lazy(() => import('./features/athlete/AthletePage'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={null}>{athleteToken ? <AthletePage token={athleteToken} /> : <App />}</Suspense>
  </React.StrictMode>,
);
