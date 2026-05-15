import { HeadContent, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeProvider, CssBaseline, Container } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import theme from '../theme'
import createEmotionCache from '../createEmotionCache'
import { SkateparkProvider } from '../context/SkateparkContext'

const clientSideEmotionCache = createEmotionCache()

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <CacheProvider value={clientSideEmotionCache}>
      <HeadContent />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SkateparkProvider>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Outlet />
          </Container>
        </SkateparkProvider>
      </ThemeProvider>
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </CacheProvider>
  )
}
