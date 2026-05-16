import { HeadContent, Outlet, Link, useLocation, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeProvider, CssBaseline, Container, Box, Link as MuiLink } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import theme from '../theme'
import createEmotionCache from '../createEmotionCache'
import { SkateparkProvider } from '../context/SkateparkContext'

const clientSideEmotionCache = createEmotionCache()

export const Route = createRootRoute({
  component: RootComponent,
})

function TopNav() {
  const { pathname } = useLocation()
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
      {pathname === '/about' ? (
        <MuiLink component={Link} to="/" underline="hover" sx={{ fontWeight: 500 }}>
          Home
        </MuiLink>
      ) : (
        <MuiLink component={Link} to="/about" underline="hover" sx={{ fontWeight: 500 }}>
          About
        </MuiLink>
      )}
    </Box>
  )
}

function RootComponent() {
  return (
    <CacheProvider value={clientSideEmotionCache}>
      <HeadContent />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SkateparkProvider>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <TopNav />
            <Outlet />
          </Container>
        </SkateparkProvider>
      </ThemeProvider>
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </CacheProvider>
  )
}
