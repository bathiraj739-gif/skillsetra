import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.tsx'

const domain = import.meta.env.VITE_AUTH0_DOMAIN || 'dev-skillsetra.us.auth0.com'
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID || 'your_auth0_client_id'
const audience = import.meta.env.VITE_AUTH0_AUDIENCE || 'https://api.skillsetra.local'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
      }}
    >
      <App />
    </Auth0Provider>
  </StrictMode>,
)
