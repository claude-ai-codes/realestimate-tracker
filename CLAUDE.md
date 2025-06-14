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
  - `/api/prices`: Queries saved price data with pagination and filters
  - `/api/statistics`: Returns price statistics with filter support
  - `/api/fetch-missing-data`: Streaming endpoint for auto-fetching missing data
- **services/reinfolib-api.js**: External API wrapper for MLIT Real Estate Information Library
- **db/database.js**: SQLite database layer with comprehensive filter support

### Frontend Structure
- **public/index.html**: Single-page application with comprehensive filter UI
- **public/app.js**: Frontend logic with filter management, pagination, and progress tracking
- **public/styles.css**: Responsive styling with filter and pagination components

### Database Schema
The `property_prices` table stores:
- Location data (prefecture/city codes and names, district)
- Property details (type, area, price, floor plan, building year, structure)
- Transaction information
- Indexed on prefecture_code, city_code, transaction_date, and property_type
git
## Key Features

- **Auto Data Fetching**: Automatically detects and fetches missing historical data (2005-2024)
- **Streaming Progress**: Real-time progress updates during data fetching operations
- **Advanced Filtering**: Comprehensive filter system for date ranges, price, area, building year, floor plan, and structure
- **Synchronized Views**: Filters are synchronized between chart and table views
- **Pagination**: Efficient pagination system for browsing large datasets
- **Dynamic Calculations**: Price per square meter calculated dynamically when not available in raw data

## Important Notes

- No test framework is currently configured
- No linting tools are set up
- The application is designed specifically for Japanese real estate data
- All text and UI elements are in Japanese
- Data accuracy disclaimer: The application uses MLIT API data but accuracy is not guaranteed
- Comprehensive error handling for API response format variations (gzip vs plain JSON)