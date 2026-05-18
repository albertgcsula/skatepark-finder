import { HeadContent, Outlet, Link, useLocation, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeProvider, CssBaseline, Container, Box, Link as MuiLink, IconButton } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import getTheme from '../theme'
import createEmotionCache from '../createEmotionCache'
import { SkateparkProvider } from '../context/SkateparkContext'
import { ThemeProvider as DarkModeProvider, useTheme as useThemeMode } from '../context/ThemeContext'

const clientSideEmotionCache = createEmotionCache()

export const Route = createRootRoute({
  component: RootComponent,
})

function TopNav() {
  const { pathname } = useLocation()
  const { mode, toggleTheme } = useThemeMode()

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 2 }}>
      {pathname === '/about' ? (
        <MuiLink component={Link} to="/" underline="hover" sx={{ fontWeight: 500 }}>
          Home
        </MuiLink>
      ) : (
        <MuiLink component={Link} to="/about" underline="hover" sx={{ fontWeight: 500 }}>
          About
        </MuiLink>
      )}
      <IconButton
        onClick={toggleTheme}
        color="inherit"
        aria-label="toggle dark mode"
      >
        {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
      </IconButton>
    </Box>
  )
}

function RootLayout() {
  const { mode } = useThemeMode()
  const theme = getTheme(mode)

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

function RootComponent() {
  return (
    <DarkModeProvider>
      <RootLayout />
    </DarkModeProvider>
  )
}
