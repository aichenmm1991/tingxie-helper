import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

// GitHub Pages 部署在 /tingxie-helper/ 子路径下，本地开发在 / —— 按实际路径自动选择 basename
const basename = window.location.pathname.startsWith('/tingxie-helper')
  ? '/tingxie-helper'
  : '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
