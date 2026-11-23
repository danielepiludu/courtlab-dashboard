import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { useCloud } from './cloud/client';
import { cloudConfigured } from './cloud/config';
import { LockScreen } from './cloud/LockScreen';

// Link per gli atleti in formato vecchio (#/rpe/<codice>): solo la pagina di voto
const athleteToken = /^#\/rpe\/([A-Za-z0-9]{10,40})/.exec(location.hash)?.[1];
const App = lazy(() => import('./App'));
const AthletePage = lazy(() => import('./features/athlete/AthletePage'));

/** L'app dello staff si carica solo dopo l'accesso (Courtlab Cloud). */
function StaffGate() {
  const logged = useCloud((s) => !!s.session);
  if (cloudConfigured() && !logged) return <LockScreen />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={null}>{athleteToken ? <AthletePage token={athleteToken} /> : <StaffGate />}</Suspense>
  </React.StrictMode>,
);
