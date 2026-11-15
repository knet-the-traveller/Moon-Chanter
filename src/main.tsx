import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AniTalaRoot from './AniTalaRoot.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AniTalaRoot />
  </StrictMode>,
)
