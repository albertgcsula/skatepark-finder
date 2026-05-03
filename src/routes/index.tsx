import { createFileRoute } from '@tanstack/react-router'
import { Box, Divider } from '@mui/material'
import { SearchForm } from '../components/SearchForm'
import { SkateparkList } from '../components/SkateparkList'
import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().optional(),
  radius: z.number().catch(10).optional(),
})

export const Route = createFileRoute('/')({
  component: Home,
  validateSearch: (search) => searchSchema.parse(search),
  head: ({ search }) => {
    const query = (search as any)?.q
    const title = query 
      ? `Skateparks near ${query} | Skatepark Finder` 
      : 'Skatepark Finder | Find Skateparks Near You'
    const description = query
      ? `Discover the best skateparks near ${query}. View directions, map locations, and details for local shred spots.`
      : 'Find the best skateparks and shred spots in your area. Search by zipcode or address and get instant results with directions.'
    
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { name: 'keywords', content: 'skateparks, skateparks near me, find skateparks, local skate spots, skateboard parks' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
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
