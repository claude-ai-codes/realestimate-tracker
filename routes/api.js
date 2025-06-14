const express = require('express');
const router = express.Router();
const ReinfotLibAPI = require('../services/reinfolib-api');
const { savePropertyPrices, getPropertyPrices, getPriceStatistics, getExistingDataPeriods, getMissingPeriods } = require('../db/database');

const api = new ReinfotLibAPI(process.env.API_KEY);

router.get('/cities/:prefectureCode', async (req, res) => {
    try {
        const cities = await api.fetchCityList(req.params.prefectureCode);
        res.json(cities);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch city list' });
    }
});

router.post('/fetch-prices', async (req, res) => {
    try {
        const { year, quarter, prefectureCode, cityCode } = req.body;
        
        console.log('Request body:', req.body);
        
        const params = {
            year,
            quarter,
            area: prefectureCode,
            city: cityCode
        };
        
        console.log('API params:', params);

        const priceData = await api.fetchPriceData(params);
        
        const condoPrices = priceData.filter(item => item.type === '中古マンション等');
        
        await savePropertyPrices(condoPrices);
        
        res.json({
            success: true,
            count: condoPrices.length,
            message: `Fetched and saved ${condoPrices.length} property records`
        });
    } catch (error) {
        console.error('Error fetching prices:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch price data',
            message: error.message,
            details: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            } : undefined
        });
    }
});

router.get('/prices', async (req, res) => {
    try {
        const filters = {
            prefecture_code: req.query.prefecture_code,
            city_code: req.query.city_code,
            type: req.query.type || '中古マンション等',
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            min_price: req.query.min_price,
            max_price: req.query.max_price,
            min_area: req.query.min_area,
            max_area: req.query.max_area,
            min_building_year: req.query.min_building_year,
            max_building_year: req.query.max_building_year,
            floor_plan: req.query.floor_plan,
            structure: req.query.structure,
            page: req.query.page,
            limit: req.query.limit
        };

        const prices = await getPropertyPrices(filters);
        res.json(prices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get price data' });
    }
});

router.get('/statistics', async (req, res) => {
    try {
        const filters = {
            prefecture_code: req.query.prefecture_code,
            city_code: req.query.city_code,
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            min_price: req.query.min_price,
            max_price: req.query.max_price,
            min_area: req.query.min_area,
            max_area: req.query.max_area,
            min_building_year: req.query.min_building_year,
            max_building_year: req.query.max_building_year,
            floor_plan: req.query.floor_plan,
            structure: req.query.structure
        };

        const stats = await getPriceStatistics(filters);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

router.post('/fetch-missing-data', async (req, res) => {
    try {
        const { prefectureCode, cityCode } = req.body;
        
        if (!prefectureCode) {
            return res.status(400).json({ 
                success: false, 
                error: 'Prefecture code is required' 
            });
        }

        // Get existing data periods
        const existingPeriods = await getExistingDataPeriods(prefectureCode, cityCode);
        const missingPeriods = getMissingPeriods(existingPeriods);
        
        if (missingPeriods.length === 0) {
            return res.json({
                success: true,
                message: 'All data is already available',
                totalPeriods: 0,
                fetchedCount: 0
            });
        }

        let totalFetched = 0;
        let fetchedPeriods = 0;

        // Set up progress tracking
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked'
        });

        // Send initial progress
        res.write(JSON.stringify({
            type: 'progress',
            totalPeriods: missingPeriods.length,
            currentPeriod: 0,
            message: 'データ取得を開始します...'
        }) + '\n');

        for (let i = 0; i < missingPeriods.length; i++) {
            const period = missingPeriods[i];
            
            try {
                // Send progress update
                res.write(JSON.stringify({
                    type: 'progress',
                    totalPeriods: missingPeriods.length,
                    currentPeriod: i + 1,
                    message: `${period.year}年第${period.quarter}四半期のデータを取得中...`
                }) + '\n');

                const params = {
                    year: period.year,
                    quarter: period.quarter,
                    area: prefectureCode,
                    city: cityCode
                };

                const priceData = await api.fetchPriceData(params);
                const condoPrices = priceData.filter(item => item.type === '中古マンション等');
                
                if (condoPrices.length > 0) {
                    await savePropertyPrices(condoPrices);
                    totalFetched += condoPrices.length;
                }
                
                fetchedPeriods++;
                
                // Add delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Error fetching data for ${period.year}-Q${period.quarter}:`, error);
                // Continue with next period even if one fails
            }
        }

        // Send final result
        res.write(JSON.stringify({
            type: 'complete',
            success: true,
            totalPeriods: missingPeriods.length,
            fetchedPeriods: fetchedPeriods,
            totalRecords: totalFetched,
            message: `${fetchedPeriods}期間のデータ取得が完了しました（${totalFetched}件）`
        }) + '\n');
        
        res.end();

    } catch (error) {
        console.error('Error in fetch-missing-data:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: 'Failed to fetch missing data',
                message: error.message
            });
        } else {
            res.write(JSON.stringify({
                type: 'error',
                success: false,
                error: 'Failed to fetch missing data',
                message: error.message
            }) + '\n');
            res.end();
        }
    }
});

router.get('/prefectures', (req, res) => {
    const prefectures = [
        { code: '01', name: '北海道' },
        { code: '02', name: '青森県' },
        { code: '03', name: '岩手県' },
        { code: '04', name: '宮城県' },
        { code: '05', name: '秋田県' },
        { code: '06', name: '山形県' },
        { code: '07', name: '福島県' },
        { code: '08', name: '茨城県' },
        { code: '09', name: '栃木県' },
        { code: '10', name: '群馬県' },
        { code: '11', name: '埼玉県' },
        { code: '12', name: '千葉県' },
        { code: '13', name: '東京都' },
        { code: '14', name: '神奈川県' },
        { code: '15', name: '新潟県' },
        { code: '16', name: '富山県' },
        { code: '17', name: '石川県' },
        { code: '18', name: '福井県' },
        { code: '19', name: '山梨県' },
        { code: '20', name: '長野県' },
        { code: '21', name: '岐阜県' },
        { code: '22', name: '静岡県' },
        { code: '23', name: '愛知県' },
        { code: '24', name: '三重県' },
        { code: '25', name: '滋賀県' },
        { code: '26', name: '京都府' },
        { code: '27', name: '大阪府' },
        { code: '28', name: '兵庫県' },
        { code: '29', name: '奈良県' },
        { code: '30', name: '和歌山県' },
        { code: '31', name: '鳥取県' },
        { code: '32', name: '島根県' },
        { code: '33', name: '岡山県' },
        { code: '34', name: '広島県' },
        { code: '35', name: '山口県' },
        { code: '36', name: '徳島県' },
        { code: '37', name: '香川県' },
        { code: '38', name: '愛媛県' },
        { code: '39', name: '高知県' },
        { code: '40', name: '福岡県' },
        { code: '41', name: '佐賀県' },
        { code: '42', name: '長崎県' },
        { code: '43', name: '熊本県' },
        { code: '44', name: '大分県' },
        { code: '45', name: '宮崎県' },
        { code: '46', name: '鹿児島県' },
        { code: '47', name: '沖縄県' }
    ];
    res.json(prefectures);
});

module.exports = router;