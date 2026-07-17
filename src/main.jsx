import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import GreenWavePage from './GreenWavePage.jsx'
import { ConfirmProvider } from './components/ConfirmProvider'
import { MicroVariablesProvider } from './components/MicroVariablesProvider.jsx'
import ReloadPrompt from './components/ReloadPrompt.jsx'
import { installErrorInterceptor } from './utils/errorInterceptor'
import './index.css'

installErrorInterceptor();

// Check URL parameters to decide which component to render
const urlParams = new URLSearchParams(window.location.search);
const isGreenWavePage = urlParams.has('greenwave');

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ConfirmProvider>
            <MicroVariablesProvider>
                {isGreenWavePage ? <GreenWavePage /> : <App />}
                <ReloadPrompt />
            </MicroVariablesProvider>
        </ConfirmProvider>
    </StrictMode>,
)
