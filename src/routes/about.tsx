import { createFileRoute, Link } from '@tanstack/react-router'
import { Box, Typography, Stack, Divider, Button, Paper, Link as MuiLink } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export const Route = createFileRoute('/about')({
  component: About,
  head: () => ({
    meta: [
      { title: 'About Skatepark Finder | sk8finder.cloud' },
      {
        name: 'description',
        content:
          'Learn how Skatepark Finder works and where it sources skatepark data — OpenStreetMap, Wikimedia Commons, Wikipedia, and Wikidata.',
      },
    ],
  }),
})

function About() {
  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Button component={Link} to="/" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Back to search
      </Button>

      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        About Skatepark Finder
      </Typography>

      <Typography variant="h6" color="text.secondary" sx={{ mb: 4, fontWeight: 400, lineHeight: 1.6 }}>
        A free, open tool for finding skateparks — by zipcode, city, address, or your current
        location. No accounts, no ads, no tracking beyond basic page analytics.
      </Typography>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
        What it does
      </Typography>
      <Typography sx={{ mb: 2, lineHeight: 1.7 }}>
        Type in a location and Skatepark Finder shows the skateparks, plazas, and DIY shred spots
        nearby. Results include the park name, address, distance from your search center, and (when
        available) a photo, description, and a link to its website. Each result has a one-click
        directions link and a map view.
      </Typography>
      <Typography sx={{ mb: 4, lineHeight: 1.7 }}>
        Search results are shareable via URL — copy the address bar after a search and you can send
        it to a friend. The radius defaults to 10 miles but is adjustable up to 50.
      </Typography>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
        Where the data comes from
      </Typography>
      <Typography sx={{ mb: 3, lineHeight: 1.7 }}>
        Every piece of information in this app comes from <strong>free, openly-licensed sources</strong>.
        No paid APIs, no proprietary databases. Specifically:
      </Typography>

      <Stack spacing={2} sx={{ mb: 4 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            OpenStreetMap (OSM)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            The primary source. Skatepark locations, names, addresses, surfaces, and operator info
            come from OSM contributors worldwide via the{' '}
            <MuiLink href="https://wiki.openstreetmap.org/wiki/Overpass_API" target="_blank" rel="noopener noreferrer">
              Overpass API
            </MuiLink>
            . OSM is community-maintained — if a park is missing or wrong, you can{' '}
            <MuiLink href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">
              edit it directly
            </MuiLink>{' '}
            and we'll pick up the change on our next ingest. Data is licensed under the{' '}
            <MuiLink href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              ODbL
            </MuiLink>
            .
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Wikimedia Commons
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Photos. When a skatepark has a Wikimedia Commons image — either tagged on its OSM record
            or geotagged nearby — we display it with photographer credit and license. All images are
            CC-licensed and redistributable.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Wikipedia
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Descriptions and lead images for the handful of skateparks notable enough to have their
            own Wikipedia article (think Burnside, Venice, FDR).
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Wikidata
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Structured facts (canonical names, type-of relationships, official images) for parks
            with a Wikidata entry. Used as a fallback when OSM/Wikipedia coverage is thin.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Nominatim
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            Geocoding (turning "Brooklyn NY" into a lat/lng) and reverse-geocoding (filling in
            missing addresses). Also run by the OpenStreetMap project.
          </Typography>
        </Paper>
      </Stack>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
        How fresh is the data?
      </Typography>
      <Typography sx={{ mb: 4, lineHeight: 1.7 }}>
        For regions we've ingested (NYC, LA, Portland, SF Bay, Seattle, Austin, Chicago, Denver,
        San Diego, Boston, Philadelphia), search results come from our database and update on each
        ingest pass. For anywhere else, results come from OpenStreetMap live and are as fresh as the
        last contributor edit. New regions get added to the database over time.
      </Typography>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
        Know a place we're missing?
      </Typography>
      <Typography sx={{ mb: 3, lineHeight: 1.7 }}>
        Suggest a skatepark, skate spot, or skate shop and we'll review it for inclusion. No
        account required.
      </Typography>
      <Button component={Link} to="/submit" variant="outlined" sx={{ mb: 2 }}>
        Suggest a spot
      </Button>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
        Open source
      </Typography>
      <Typography sx={{ mb: 4, lineHeight: 1.7 }}>
        The code lives on{' '}
        <MuiLink href="https://github.com/albertgcsula/skatepark-finder" target="_blank" rel="noopener noreferrer">
          GitHub
        </MuiLink>
        . Issues, pull requests, and feature suggestions welcome.
      </Typography>

      <Box sx={{ mt: 6, mb: 4, textAlign: 'center' }}>
        <Button component={Link} to="/" variant="contained" size="large">
          Find skateparks near me
        </Button>
      </Box>
    </Box>
  )
}
