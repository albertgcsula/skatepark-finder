import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeProvider, CssBaseline, Container } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import theme from '../theme'
import createEmotionCache from '../createEmotionCache'
import { SkateparkProvider } from '../context/SkateparkContext'

import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import '../styles.css'

const emotionCache = createEmotionCache()

const SITE_URL = 'https://sk8finder.cloud'
const SITE_TITLE = 'Skatepark Finder - Find Skateparks Near Me | sk8finder.cloud'
const SITE_DESCRIPTION = 'Skatepark Finder helps you find skateparks near you. Search by zipcode, city, or address, or use your current location to discover local skateparks, plazas, and DIY shred spots worldwide.'
const OG_IMAGE = `${SITE_URL}/skatepark-finder.png`

const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'Skatepark Finder',
      description: SITE_DESCRIPTION,
      inLanguage: 'en-US',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#webapp`,
      name: 'Skatepark Finder',
      url: `${SITE_URL}/`,
      applicationCategory: 'TravelApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript. Requires HTML5.',
      description: 'A web application to find skateparks, plazas, and DIY shred spots near you, powered by OpenStreetMap data.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Skatepark Finder',
      url: `${SITE_URL}/`,
      logo: OG_IMAGE,
    },
  ],
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { name: 'theme-color', content: '#000000' },
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'keywords', content: 'skateparks, skateparks near me, skatepark finder, find skateparks, local skateparks, skate spots, skateboard parks, skate plazas, DIY skate spots, skatepark map, skatepark locator' },
      { name: 'author', content: 'Skatepark Finder' },
      { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' },
      { name: 'googlebot', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Skatepark Finder' },
      { property: 'og:title', content: 'Skatepark Finder - Find Skateparks Near Me' },
      { property: 'og:description', content: 'Find skateparks near you. Search by zipcode, city, or address to discover local skateparks, plazas, and DIY shred spots worldwide.' },
      { property: 'og:url', content: `${SITE_URL}/` },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:alt', content: 'Skatepark Finder - Find Skateparks Near You' },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Skatepark Finder - Find Skateparks Near Me' },
      { name: 'twitter:description', content: 'Find skateparks near you. Search by zipcode, city, or address to discover local skateparks, plazas, and DIY shred spots worldwide.' },
      { name: 'twitter:image', content: OG_IMAGE },
      { name: 'twitter:image:alt', content: 'Skatepark Finder - Find Skateparks Near You' },
    ],
    links: [
      { rel: 'canonical', href: `${SITE_URL}/` },
      { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'preconnect', href: 'https://overpass-api.de' },
      { rel: 'preconnect', href: 'https://nominatim.openstreetmap.org' },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON_LD,
      },
    ],
  }),
  component: RootComponent,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  return (
    <RootDocument>
      <CacheProvider value={emotionCache}>
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
    </RootDocument>
  )
}
