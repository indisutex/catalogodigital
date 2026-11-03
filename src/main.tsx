import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CartProvider } from './context/CartContext'
import { CurrencyProvider } from './context/CurrencyContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrencyProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </CurrencyProvider>
  </StrictMode>,
)
