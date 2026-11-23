import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AthletePage from './features/athlete/AthletePage';

// Pagina pubblica del link RPE: …/rpe/#<codice>
const token = /^#?\/?([A-Za-z0-9]{10,40})/.exec(location.hash)?.[1] ?? new URLSearchParams(location.search).get('c') ?? '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AthletePage token={token} />
  </React.StrictMode>,
);
