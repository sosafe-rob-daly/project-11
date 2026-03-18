import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CostModel from './index.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CostModel />
  </StrictMode>,
)
