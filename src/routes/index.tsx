import { createFileRoute } from '@tanstack/react-router'
import { Box, Divider } from '@mui/material'
import { SearchForm } from '../components/SearchForm'
import { SkateparkList } from '../components/SkateparkList'
import { z } from 'zod'

const searchSchema = z.object({
  q: z.union([z.string(), z.number()]).optional().transform((v) => (v == null ? undefined : String(v))),
  radius: z.coerce.number().catch(10).optional(),
})

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (search) => searchSchema.parse(search),
  head: ({ match }) => {
    const query = (match?.search as { q?: string } | undefined)?.q
    if (!query) return {}
    const title = `Skateparks near ${query} | Skatepark Finder`
    const description = `Discover the best skateparks near ${query}. View directions, map locations, and details for local shred spots.`
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
      ],
    }
  },
})

function Home() {
  return (
    <Box>
      <Box sx={{ mb: 6, textAlign: 'center' }}>
        <Box
          component="img"
          src="/skatepark-finder.png"
          alt="Skatepark Finder Logo"
          sx={{
            display: 'block',
            mx: 'auto',
            width: { xs: '80%', sm: '60%', md: '450px' },
            height: 'auto',
            maxWidth: '100%',
            mb: 2,
            filter: 'drop-shadow(0px 4px 12px rgba(0,0,0,0.1))'
          }}
        />
      </Box>

      <SearchForm />

      <Divider sx={{ my: 4 }} />

      <SkateparkList />
    </Box>
  )
}
