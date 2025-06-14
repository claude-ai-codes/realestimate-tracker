# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Japanese real estate price tracking web application that fetches and displays used condominium prices using Japan's Ministry of Land, Infrastructure, Transport and Tourism (MLIT) Real Estate Information Library API.

## Key Commands

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start development server with auto-reload (nodemon)
npm start            # Start production server
```

### Environment Setup
Create a `.env` file with:
```
API_KEY=YOUR_API_KEY_HERE
```
API keys can be obtained from https://www.reinfolib.mlit.go.jp/

## Architecture

### Backend Structure
- **server.js**: Express server entry point, handles CORS and routing
- **routes/api.js**: RESTful API endpoints
  - `/api/prefectures`: Returns Japanese prefecture list
  - `/api/cities/:prefectureCode`: Returns cities for a prefecture
  - `/api/fetch-prices`: Fetches data from MLIT API and saves to database
  - `/api/prices`: Queries saved price data with filters
  - `/api/statistics`: Returns price statistics (average, min/max, count)
- **services/reinfolib-api.js**: External API wrapper for MLIT Real Estate Information Library
- **db/database.js**: SQLite database layer with property_prices table

### Frontend Structure
- **public/index.html**: Single-page application
- **public/app.js**: Frontend logic for API calls, data visualization with Chart.js
- **public/styles.css**: Styling

### Database Schema
The `property_prices` table stores:
- Location data (prefecture/city codes and names, district)
- Property details (type, area, price, floor plan, building year, structure)
- Transaction information
- Indexed on prefecture_code, city_code, transaction_date, and property_type
git
## Important Notes

- No test framework is currently configured
- No linting tools are set up
- The application is designed specifically for Japanese real estate data
- All text and UI elements are in Japanese
- Data accuracy disclaimer: The application uses MLIT API data but accuracy is not guaranteed