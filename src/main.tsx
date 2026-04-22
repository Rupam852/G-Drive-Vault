import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import PrivacyPolicy from './pages/PrivacyPolicy.tsx';
import TermsOfService from './pages/TermsOfService.tsx';
import './index.css';

const path = window.location.pathname;

let ComponentToRender = App;

if (path === '/privacy-policy') {
  ComponentToRender = PrivacyPolicy;
} else if (path === '/terms-of-service') {
  ComponentToRender = TermsOfService;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ComponentToRender />
  </StrictMode>,
);
