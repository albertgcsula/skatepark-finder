# Frontend Specification & Roadmap

## Overview
Enhance the Skatepark Finder UI/UX with advanced features, improved state management, and personalized user experiences.

## Current State (Shipped)

The deployed frontend is a static Vite SPA (see `DEPLOYMENT_SPEC.md`) built on TanStack Router + React 19 + MUI v9, with the following features live in production:

### Search & data
- **Search by zipcode, city, or address.** URL-driven via TanStack Router `validateSearch` schema (Zod). Search params shareable via URL.
- **"Locate Me"** browser geolocation.
- **Adjustable radius** (5 / 10 / 15 / 25 / 50 mi).
- **Hybrid data query** (`src/services/skateparkService.ts`): AppSync (DynamoDB) primary, OSM Overpass fallback when DDB has no results for the region. App stays functional globally while incrementally seeding regions via `npm run ingest`.
- **Skatepark cards** display: name, address, distance, optional image (from Wikimedia Commons), optional description, optional website link, OSM map link, Google Maps directions. Image attribution + license rendered when present.
- **Unnamed-record filter:** records whose name resolved only to "Unnamed Skatepark" are hidden at the service boundary so users only see meaningfully-labeled parks. Records remain in DynamoDB so future ingest improvements can backfill names without re-creation.

### SEO
- **All meta tags inlined in static `index.html`** — title, description, keywords, Open Graph, Twitter card, canonical URL, JSON-LD structured data (`WebSite`, `WebApplication`, `Organization`).
- `<noscript>` fallback with H1 + description for non-JS crawlers.
- Per-query browser tab title updates client-side via TanStack Router `<HeadContent />` (e.g., "Skateparks near Brooklyn NY | Skatepark Finder").
- `robots.txt` allows all; `sitemap.xml` references the homepage with image annotation.

### Build & UX hygiene
- **MUI v9 Grid migration** — uses the `size={{ xs, sm, md }}` API (the v5 `item xs=...` API is silently ignored in v9 and led to inconsistent card widths).
- **Card layout hardening** — explicit `width: 100%` + `display: block` on images, `minWidth: 0` on cards (flexbox would otherwise grow to content), `wordBreak: 'break-word'` on text.
- **Google Analytics 4** wired via `react-ga4` (gated on `VITE_GA_MEASUREMENT_ID` env var).

The roadmap below describes future enhancements; nothing in it is built yet unless explicitly marked above.

## Core Feature Enhancements
- **Interactive Map View:** Integration with Mapbox or Google Maps for visual browsing of results.
- **Image Gallery:** Support for multiple user-uploaded photos per skatepark, with a prominent featured image in the card and detail view.
- **Metadata Editor:** A "Suggest an Edit" mode allowing users to update the park name, address, and description.
- **User Accounts:** Allow users to save "Favorite" parks and track "Visited" spots.
- **Reviews & Ratings:** User-generated content including photos, star ratings, and surface quality reports.
- **Advanced Filtering:** Filter by surface (concrete vs. wood), lights (night skating), and difficulty level.

## Future Vision: Community & Ecosystem
- **Live "Session" Check-ins:** See how many people are currently at a spot (using "Check-in" buttons) to gauge how crowded it is before you leave.
- **Spot Challenges:** Local "Best Trick" or "Line of the Month" competitions where users can upload short clips to specific park pages.
- **Weather & Lights Integration:** Real-time weather alerts on park pages and a "Lights" status (verified by users) to know if night sessions are possible.
- **Local Shop Support:** Highlight nearby skater-owned shops on the map to support the local ecosystem.
- **Accessibility & Amenities:** Tagging for "Restrooms," "Water Fountains," and "Shade" to help families and long-session skaters plan.

## Technical Improvements
- **Off-Main-Thread Processing:** Move heavy geohash calculations or data sorting to **Web Workers** to ensure the UI remains at 60fps during large search results.
- **Global State Persistence:** Use `localStorage` or `IndexedDB` sync with TanStack Query to ensure the app state (Favorites, Search History) persists even if the user clears their browser cache.
- **Micro-Animations:** Use `Framer Motion` for layout transitions between the list and detail views to provide a "native app" feel.
- **Automated Visual Testing:** Implement **Storybook** with **Chromatic** for visual regression testing. This ensures that UI changes don't accidentally break the responsive logo or card layouts across the 100+ simulated device sizes.

## Design Goals
- **Dark Mode Support:** Essential for night-time session planning.
- **Mobile-First Excellence:** Ensure all interactive elements are touch-friendly.
- **Social Sharing:** Deep-linking support to share specific skateparks with friends.

## State Management
- Transition complex UI state to a more robust pattern (e.g., using TanStack Store or specialized Context providers for Auth/Map state).
- Synchronize URL parameters for all filter and search combinations to ensure shareability.
