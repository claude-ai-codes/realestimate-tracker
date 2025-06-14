const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDatabase() {
    db = await open({
        filename: path.join(__dirname, '../realestate.db'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS property_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            property_id TEXT NOT NULL,
            prefecture_code TEXT NOT NULL,
            prefecture_name TEXT NOT NULL,
            city_code TEXT NOT NULL,
            city_name TEXT NOT NULL,
            district_name TEXT,
            type TEXT NOT NULL,
            area REAL,
            price INTEGER NOT NULL,
            price_per_area INTEGER,
            floor_plan TEXT,
            building_year INTEGER,
            structure TEXT,
            transaction_date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(property_id, transaction_date)
        );

        CREATE INDEX IF NOT EXISTS idx_prefecture_city ON property_prices(prefecture_code, city_code);
        CREATE INDEX IF NOT EXISTS idx_transaction_date ON property_prices(transaction_date);
        CREATE INDEX IF NOT EXISTS idx_type ON property_prices(type);
    `);

    return db;
}

async function savePropertyPrices(properties) {
    const stmt = await db.prepare(`
        INSERT OR REPLACE INTO property_prices (
            property_id, prefecture_code, prefecture_name, city_code, city_name,
            district_name, type, area, price, price_per_area, floor_plan,
            building_year, structure, transaction_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const property of properties) {
        try {
            await stmt.run(
                property.property_id,
                property.prefecture_code,
                property.prefecture_name,
                property.city_code,
                property.city_name,
                property.district_name,
                property.type,
                property.area,
                property.price,
                property.price_per_area,
                property.floor_plan,
                property.building_year,
                property.structure,
                property.transaction_date
            );
        } catch (error) {
            console.error('Error saving property:', error);
        }
    }

    await stmt.finalize();
}

async function getPropertyPrices(filters = {}) {
    let query = 'SELECT * FROM property_prices WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM property_prices WHERE 1=1';
    const params = [];
    const countParams = [];

    if (filters.prefecture_code) {
        query += ' AND prefecture_code = ?';
        countQuery += ' AND prefecture_code = ?';
        params.push(filters.prefecture_code);
        countParams.push(filters.prefecture_code);
    }

    if (filters.city_code) {
        query += ' AND city_code = ?';
        countQuery += ' AND city_code = ?';
        params.push(filters.city_code);
        countParams.push(filters.city_code);
    }

    if (filters.type) {
        query += ' AND type = ?';
        countQuery += ' AND type = ?';
        params.push(filters.type);
        countParams.push(filters.type);
    }

    if (filters.start_date) {
        query += ' AND transaction_date >= ?';
        countQuery += ' AND transaction_date >= ?';
        params.push(filters.start_date);
        countParams.push(filters.start_date);
    }

    if (filters.end_date) {
        query += ' AND transaction_date <= ?';
        countQuery += ' AND transaction_date <= ?';
        params.push(filters.end_date);
        countParams.push(filters.end_date);
    }

    // Additional filter parameters
    if (filters.min_price) {
        query += ' AND price >= ?';
        countQuery += ' AND price >= ?';
        params.push(filters.min_price);
        countParams.push(filters.min_price);
    }

    if (filters.max_price) {
        query += ' AND price <= ?';
        countQuery += ' AND price <= ?';
        params.push(filters.max_price);
        countParams.push(filters.max_price);
    }

    if (filters.min_area) {
        query += ' AND area >= ?';
        countQuery += ' AND area >= ?';
        params.push(filters.min_area);
        countParams.push(filters.min_area);
    }

    if (filters.max_area) {
        query += ' AND area <= ?';
        countQuery += ' AND area <= ?';
        params.push(filters.max_area);
        countParams.push(filters.max_area);
    }

    if (filters.min_building_year) {
        query += ' AND building_year >= ?';
        countQuery += ' AND building_year >= ?';
        params.push(filters.min_building_year);
        countParams.push(filters.min_building_year);
    }

    if (filters.max_building_year) {
        query += ' AND building_year <= ?';
        countQuery += ' AND building_year <= ?';
        params.push(filters.max_building_year);
        countParams.push(filters.max_building_year);
    }

    if (filters.floor_plan) {
        query += ' AND floor_plan = ?';
        countQuery += ' AND floor_plan = ?';
        params.push(filters.floor_plan);
        countParams.push(filters.floor_plan);
    }

    if (filters.structure) {
        query += ' AND structure = ?';
        countQuery += ' AND structure = ?';
        params.push(filters.structure);
        countParams.push(filters.structure);
    }

    query += ' ORDER BY transaction_date DESC';

    // Add pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const offset = (page - 1) * limit;

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [data, countResult] = await Promise.all([
        db.all(query, params),
        db.get(countQuery, countParams)
    ]);

    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}

async function getPriceStatistics(filters = {}) {
    let query = `
        SELECT 
            strftime('%Y-%m', transaction_date) as month,
            AVG(price) as avg_price,
            AVG(CASE 
                WHEN price_per_area IS NOT NULL AND price_per_area > 0 THEN price_per_area
                WHEN area > 0 THEN price / area
                ELSE NULL 
            END) as avg_price_per_area,
            COUNT(*) as count,
            MIN(price) as min_price,
            MAX(price) as max_price
        FROM property_prices 
        WHERE type = '中古マンション等'
    `;
    
    const params = [];

    if (filters.prefecture_code) {
        query += ' AND prefecture_code = ?';
        params.push(filters.prefecture_code);
    }

    if (filters.city_code) {
        query += ' AND city_code = ?';
        params.push(filters.city_code);
    }

    // Additional filter parameters for statistics
    if (filters.start_date) {
        query += ' AND transaction_date >= ?';
        params.push(filters.start_date);
    }

    if (filters.end_date) {
        query += ' AND transaction_date <= ?';
        params.push(filters.end_date);
    }

    if (filters.min_price) {
        query += ' AND price >= ?';
        params.push(filters.min_price);
    }

    if (filters.max_price) {
        query += ' AND price <= ?';
        params.push(filters.max_price);
    }

    if (filters.min_area) {
        query += ' AND area >= ?';
        params.push(filters.min_area);
    }

    if (filters.max_area) {
        query += ' AND area <= ?';
        params.push(filters.max_area);
    }

    if (filters.min_building_year) {
        query += ' AND building_year >= ?';
        params.push(filters.min_building_year);
    }

    if (filters.max_building_year) {
        query += ' AND building_year <= ?';
        params.push(filters.max_building_year);
    }

    if (filters.floor_plan) {
        query += ' AND floor_plan = ?';
        params.push(filters.floor_plan);
    }

    if (filters.structure) {
        query += ' AND structure = ?';
        params.push(filters.structure);
    }

    query += ' GROUP BY month ORDER BY month';

    return await db.all(query, params);
}

async function getExistingDataPeriods(prefectureCode, cityCode) {
    let query = `
        SELECT DISTINCT 
            strftime('%Y', transaction_date) as year,
            CASE 
                WHEN strftime('%m', transaction_date) IN ('01', '02', '03') THEN '1'
                WHEN strftime('%m', transaction_date) IN ('04', '05', '06') THEN '2'
                WHEN strftime('%m', transaction_date) IN ('07', '08', '09') THEN '3'
                WHEN strftime('%m', transaction_date) IN ('10', '11', '12') THEN '4'
            END as quarter
        FROM property_prices 
        WHERE type = '中古マンション等'
    `;
    
    const params = [];
    
    if (prefectureCode) {
        query += ' AND prefecture_code = ?';
        params.push(prefectureCode);
    }
    
    if (cityCode) {
        query += ' AND city_code = ?';
        params.push(cityCode);
    }
    
    query += ' ORDER BY year, quarter';
    
    const existingPeriods = await db.all(query, params);
    return existingPeriods.map(row => `${row.year}-Q${row.quarter}`);
}

function getAllPossiblePeriods() {
    const periods = [];
    for (let year = 2005; year <= 2024; year++) {
        for (let quarter = 1; quarter <= 4; quarter++) {
            periods.push({ year: year.toString(), quarter: quarter.toString() });
        }
    }
    return periods;
}

function getMissingPeriods(existingPeriods) {
    const allPeriods = getAllPossiblePeriods();
    const existingSet = new Set(existingPeriods);
    
    return allPeriods.filter(period => 
        !existingSet.has(`${period.year}-Q${period.quarter}`)
    );
}

module.exports = {
    initDatabase,
    savePropertyPrices,
    getPropertyPrices,
    getPriceStatistics,
    getExistingDataPeriods,
    getMissingPeriods
};