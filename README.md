# 🛹 Skatepark Finder

A modern, full-stack web application built with **TanStack Start** and **Material UI** to help skaters find the best shred spots near them.

## 🚀 Features

- **Global Sourcing**: Leverages the **OpenStreetMap (OSM) Overpass API** to find skateparks worldwide, including municipal parks, DIY spots, and plazas.
- **Intelligent Search**: 
  - Search by Zipcode, City, or Full Address.
  - "Locate Me" support using the browser's Geolocation API.
  - Adjustable search radius (5, 10, 15, 25, or 50 miles).
- **URL-Driven State**: Type-safe search parameters powered by **TanStack Router** and **Zod**. Share your search results simply by copying the URL.
- **Smart Naming**: Automated naming fallback that uses location and operator data for unnamed spots in the OSM database.
- **Responsive Design**: A sleek, mobile-first interface built with **Material UI v6** and **Emotion**.
- **Performance Focused**: Built-in **SSR (Server-Side Rendering)** and optimized loading states with **MUI Skeletons**.

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **UI Components**: [Material UI (MUI)](https://mui.com/)
- **Data Source**: [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- **Geocoding**: [Nominatim OSM](https://nominatim.org/)
- **Validation**: [Zod](https://zod.dev/)
- **Styling**: Vanilla CSS + Emotion

## 🏃 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm, pnpm, or bun

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

### Building for Production

Create an optimized production build:
```bash
npm run build
```
Preview the production build:
```bash
npm run preview
```

## 📂 Project Structure

- `src/routes/`: TanStack Router file-based routing.
- `src/components/`: Modular UI components (SearchForm, List, Cards, Skeletons).
- `src/context/`: Global state management for search logic.
- `src/services/`: API integration services for geocoding and OSM lookups.
- `src/theme.ts`: MUI theme configuration.

## 🗺️ Data Attribution

Data is sourced from [OpenStreetMap](https://www.openstreetmap.org/) contributors and queried via the [Overpass API](https://overpass-api.de/).
