import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import { ThemeProvider, CssBaseline, Container } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import theme from './theme'
import createEmotionCache from './createEmotionCache'
import { SkateparkProvider } from './context/SkateparkContext'

import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import './styles.css'

const router = getRouter()
const emotionCache = createEmotionCache()

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <CacheProvider value={emotionCache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <SkateparkProvider>
            <Container maxWidth="lg" sx={{ py: 4 }}>
              <RouterProvider router={router} />
            </Container>
          </SkateparkProvider>
        </ThemeProvider>
      </CacheProvider>
    </React.StrictMode>,
  )
}
