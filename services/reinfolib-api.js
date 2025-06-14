const axios = require('axios');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

class ReinfotLibAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://www.reinfolib.mlit.go.jp/ex-api/external';
    }

    async fetchPriceData(params) {
        try {
            const url = `${this.baseURL}/XIT001`;
            console.log('Fetching from URL:', url);
            console.log('With params:', params);
            console.log('API Key:', this.apiKey ? 'Present' : 'Missing');
            
            const response = await axios.get(url, {
                params,
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey
                },
                responseType: 'arraybuffer'
            });

            // Check if the response is gzipped or plain JSON
            let jsonData;
            const contentType = response.headers['content-type'];
            const contentEncoding = response.headers['content-encoding'];
            
            if (contentEncoding === 'gzip' || response.data[0] === 0x1f && response.data[1] === 0x8b) {
                // Data is gzipped
                console.log('Response is gzipped, decompressing...');
                const decompressed = await gunzip(response.data);
                jsonData = JSON.parse(decompressed.toString('utf8'));
            } else {
                // Data is plain JSON
                console.log('Response is plain JSON');
                jsonData = JSON.parse(response.data.toString('utf8'));
            }
            
            return this.formatPriceData(jsonData);
        } catch (error) {
            console.error('API Error:', error.response?.status, error.response?.statusText);
            throw error;
        }
    }

    async fetchCityList(prefectureCode) {
        try {
            const response = await axios.get(`${this.baseURL}/XIT002`, {
                params: { area: prefectureCode },
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey
                }
            });

            return response.data;
        } catch (error) {
            console.error('API Error:', error.response?.status, error.response?.statusText);
            throw error;
        }
    }

    formatPriceData(data) {
        if (!data || !data.data || !Array.isArray(data.data)) {
            return [];
        }

        return data.data.map(item => {
            // Log the first item to debug
            if (data.data.indexOf(item) === 0) {
                console.log('Sample API item:', item);
            }
            
            // Extract prefecture code from MunicipalityCode (first 2 digits)
            const municipalityCode = item.MunicipalityCode || '';
            const prefectureCode = municipalityCode.substring(0, 2);
            
            return {
                property_id: this.generatePropertyId(item),
                prefecture_code: prefectureCode || null,
                prefecture_name: item.Prefecture,
                city_code: item.MunicipalityCode,
                city_name: item.Municipality,
                district_name: item.DistrictName,
                type: item.Type,
                area: parseFloat(item.Area) || null,
                price: parseInt(item.TradePrice) || 0,
                price_per_area: item.PricePerUnit ? parseInt(item.PricePerUnit) : null,
                floor_plan: item.FloorPlan,
                building_year: item.BuildingYear ? parseInt(item.BuildingYear) : null,
                structure: item.Structure,
                transaction_date: this.formatTransactionDate(item.Period)
            };
        });
    }

    generatePropertyId(item) {
        const components = [
            item.PrefectureCode,
            item.MunicipalityCode,
            item.DistrictName,
            item.Type,
            item.Area,
            item.TradePrice,
            item.Period
        ].filter(Boolean);
        
        return components.join('_').replace(/\s+/g, '_');
    }

    formatTransactionDate(period) {
        if (!period) return null;
        
        const match = period.match(/(\d{4})年第(\d)四半期/);
        if (match) {
            const year = match[1];
            const quarter = parseInt(match[2]);
            const month = (quarter - 1) * 3 + 1;
            return `${year}-${month.toString().padStart(2, '0')}-01`;
        }
        
        return period;
    }
}

module.exports = ReinfotLibAPI;