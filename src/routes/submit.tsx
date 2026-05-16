import React, { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Box,
  Typography,
  Stack,
  Button,
  Paper,
  TextField,
  MenuItem,
  Alert,
  Divider,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import {
  submitRecommendation,
  isRecommendationSubmissionAvailable,
  type RecommendationType,
} from '../services/recommendationService'

export const Route = createFileRoute('/submit')({
  component: Submit,
  head: () => ({
    meta: [
      { title: 'Suggest a spot | Skatepark Finder' },
      {
        name: 'description',
        content:
          'Suggest a skatepark, skate spot, or skate shop to add to Skatepark Finder. Submissions are reviewed before going live.',
      },
    ],
  }),
})

const TYPE_OPTIONS: { value: RecommendationType; label: string }[] = [
  { value: 'skatepark', label: 'Skatepark' },
  { value: 'spot', label: 'Skate spot' },
  { value: 'shop', label: 'Skate shop' },
]

function Submit() {
  const available = isRecommendationSubmissionAvailable()
  const [type, setType] = useState<RecommendationType>('skatepark')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // Honeypot tripped — pretend success without writing to the DB.
    if (honeypot.trim() !== '') {
      setSuccess(true)
      return
    }
    setSubmitting(true)
    try {
      await submitRecommendation({
        type,
        name,
        address,
        description,
        website,
        submitterEmail: email,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <Box sx={{ maxWidth: 640, mx: 'auto', textAlign: 'center', py: 6 }}>
        <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Thanks for the suggestion!
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
          We'll review your submission and add it to the map if it checks out. New places usually
          show up within a few days.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button component={Link} to="/" variant="contained" size="large">
            Back to search
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              setSuccess(false)
              setName('')
              setAddress('')
              setDescription('')
              setWebsite('')
              setEmail('')
              setHoneypot('')
            }}
          >
            Submit another
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Button component={Link} to="/about" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Back to about
      </Button>

      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        Suggest a spot
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 4, fontWeight: 400, lineHeight: 1.6 }}>
        Know a skatepark, spot, or shop we're missing? Tell us about it. All submissions are
        reviewed before they go live.
      </Typography>

      <Divider sx={{ mb: 4 }} />

      {!available && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Submissions aren't available in this environment. The backend isn't configured.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 } }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              select
              required
              label="What is it?"
              value={type}
              onChange={(e) => setType(e.target.value as RecommendationType)}
              disabled={submitting || !available}
              fullWidth
            >
              {TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              required
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stoner Skate Plaza"
              disabled={submitting || !available}
              fullWidth
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />

            <TextField
              required
              label="Address or location"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address, intersection, or 'behind the Walgreens on 5th'"
              disabled={submitting || !available}
              fullWidth
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 300 } }}
            />

            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes it worth visiting? Bowls, ledges, smooth concrete, etc."
              disabled={submitting || !available}
              fullWidth
              multiline
              minRows={3}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />

            <TextField
              label="Website (optional)"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              type="url"
              disabled={submitting || !available}
              fullWidth
            />

            <TextField
              label="Your email (optional)"
              helperText="Only used if we need to follow up. Never shown publicly."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              disabled={submitting || !available}
              fullWidth
            />

            {/*
              Honeypot field. Visually and assistive-tech hidden so real users
              never fill it; bots auto-fill every input. Any non-empty value
              causes the form to skip the API call and show a fake success.
            */}
            <TextField
              label="Website URL"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              sx={{
                position: 'absolute',
                left: '-10000px',
                width: 1,
                height: 1,
                overflow: 'hidden',
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting || !available || !name.trim() || !address.trim()}
                sx={{ minWidth: 160 }}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}
