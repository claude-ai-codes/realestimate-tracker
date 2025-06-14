let priceChart = null;

async function loadPrefectures() {
    try {
        const response = await fetch('/api/prefectures');
        const prefectures = await response.json();
        
        const select = document.getElementById('prefectureSelect');
        prefectures.forEach(pref => {
            const option = document.createElement('option');
            option.value = pref.code;
            option.textContent = pref.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load prefectures:', error);
    }
}

async function loadCities(prefectureCode) {
    try {
        const response = await fetch(`/api/cities/${prefectureCode}`);
        const cities = await response.json();
        
        const select = document.getElementById('citySelect');
        select.innerHTML = '<option value="">市区町村を選択</option>';
        
        if (cities && cities.data) {
            cities.data.forEach(city => {
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = city.name;
                select.appendChild(option);
            });
            select.disabled = false;
        }
    } catch (error) {
        console.error('Failed to load cities:', error);
    }
}

async function fetchMissingData(prefectureCode, cityCode) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/fetch-missing-data');
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        let progressData = null;
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 3 || xhr.readyState === 4) {
                const lines = xhr.responseText.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        
                        if (data.type === 'progress') {
                            progressData = data;
                            showProgress(data);
                            showStatus(`${data.message} (${data.currentPeriod}/${data.totalPeriods})`, 'info');
                        } else if (data.type === 'complete') {
                            hideProgress();
                            showStatus(data.message, 'success');
                            resolve(data);
                            return;
                        } else if (data.type === 'error') {
                            hideProgress();
                            showStatus(`エラー: ${data.message}`, 'error');
                            reject(new Error(data.message));
                            return;
                        }
                    } catch (e) {
                        // Ignore parsing errors for incomplete JSON
                    }
                }
            }
        };
        
        xhr.onerror = function() {
            reject(new Error('Network error'));
        };
        
        xhr.send(JSON.stringify({ prefectureCode, cityCode }));
    });
}

async function fetchAndDisplayData() {
    const prefectureCode = document.getElementById('prefectureSelect').value;
    const cityCode = document.getElementById('citySelect').value;
    
    if (!prefectureCode) {
        showStatus('都道府県を選択してください', 'error');
        return;
    }
    
    try {
        showStatus('データベースをチェック中...', 'info');
        
        // First, try to fetch missing data from API
        await fetchMissingData(prefectureCode, cityCode);
        
        // Then load and display all data
        showStatus('データを表示中...', 'info');
        currentPage = 1;
        await loadPropertyData(1);
        await updateChart();
        
        showStatus('データの表示が完了しました', 'success');
    } catch (error) {
        console.error('Failed to load data:', error);
        showStatus('データ読み込み中にエラーが発生しました', 'error');
    }
}

let currentPage = 1;
const itemsPerPage = 50;

// Filter state
let currentFilters = {
    startDate: null,
    endDate: null,
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null,
    minBuildingYear: null,
    maxBuildingYear: null,
    floorPlan: null,
    structure: null
};

function getFiltersFromUI() {
    return {
        startDate: document.getElementById('startDateFilter').value || null,
        endDate: document.getElementById('endDateFilter').value || null,
        minPrice: parseFloat(document.getElementById('minPriceFilter').value) || null,
        maxPrice: parseFloat(document.getElementById('maxPriceFilter').value) || null,
        minArea: parseFloat(document.getElementById('minAreaFilter').value) || null,
        maxArea: parseFloat(document.getElementById('maxAreaFilter').value) || null,
        minBuildingYear: parseInt(document.getElementById('minBuildingYearFilter').value) || null,
        maxBuildingYear: parseInt(document.getElementById('maxBuildingYearFilter').value) || null,
        floorPlan: document.getElementById('floorPlanFilter').value || null,
        structure: document.getElementById('structureFilter').value || null
    };
}

function clearFilters() {
    document.getElementById('startDateFilter').value = '';
    document.getElementById('endDateFilter').value = '';
    document.getElementById('minPriceFilter').value = '';
    document.getElementById('maxPriceFilter').value = '';
    document.getElementById('minAreaFilter').value = '';
    document.getElementById('maxAreaFilter').value = '';
    document.getElementById('minBuildingYearFilter').value = '';
    document.getElementById('maxBuildingYearFilter').value = '';
    document.getElementById('floorPlanFilter').value = '';
    document.getElementById('structureFilter').value = '';
    
    currentFilters = {
        startDate: null,
        endDate: null,
        minPrice: null,
        maxPrice: null,
        minArea: null,
        maxArea: null,
        minBuildingYear: null,
        maxBuildingYear: null,
        floorPlan: null,
        structure: null
    };
}

async function loadPropertyData(page = 1) {
    const prefectureCode = document.getElementById('prefectureSelect').value;
    const cityCode = document.getElementById('citySelect').value;
    
    const params = new URLSearchParams();
    if (prefectureCode) params.append('prefecture_code', prefectureCode);
    if (cityCode) params.append('city_code', cityCode);
    params.append('page', page);
    params.append('limit', itemsPerPage);
    
    // Add filter parameters
    if (currentFilters.startDate) params.append('start_date', currentFilters.startDate + '-01');
    if (currentFilters.endDate) {
        const endDate = new Date(currentFilters.endDate + '-01');
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
        params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    if (currentFilters.minPrice) params.append('min_price', currentFilters.minPrice * 10000);
    if (currentFilters.maxPrice) params.append('max_price', currentFilters.maxPrice * 10000);
    if (currentFilters.minArea) params.append('min_area', currentFilters.minArea);
    if (currentFilters.maxArea) params.append('max_area', currentFilters.maxArea);
    if (currentFilters.minBuildingYear) params.append('min_building_year', currentFilters.minBuildingYear);
    if (currentFilters.maxBuildingYear) params.append('max_building_year', currentFilters.maxBuildingYear);
    if (currentFilters.floorPlan) params.append('floor_plan', currentFilters.floorPlan);
    if (currentFilters.structure) params.append('structure', currentFilters.structure);
    
    try {
        const response = await fetch(`/api/prices?${params.toString()}`);
        const result = await response.json();
        
        currentPage = page;
        displayPropertyTable(result.data, result.pagination);
    } catch (error) {
        console.error('Failed to load property data:', error);
    }
}

function displayPropertyTable(properties, pagination) {
    const tableDiv = document.getElementById('dataTable');
    
    if (!properties || properties.length === 0) {
        tableDiv.innerHTML = '<p>データがありません</p>';
        return;
    }
    
    const table = `
        <div class="table-container">
            <div class="pagination-info">
                ${pagination ? `${pagination.total}件中 ${((pagination.page - 1) * pagination.limit) + 1}-${Math.min(pagination.page * pagination.limit, pagination.total)}件を表示` : ''}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>取引時期</th>
                        <th>地区名</th>
                        <th>面積(㎡)</th>
                        <th>価格</th>
                        <th>㎡単価</th>
                        <th>間取り</th>
                        <th>築年</th>
                    </tr>
                </thead>
                <tbody>
                    ${properties.map(prop => `
                        <tr>
                            <td>${prop.transaction_date}</td>
                            <td>${prop.district_name || '-'}</td>
                            <td>${prop.area || '-'}</td>
                            <td class="price">${formatPrice(prop.price)}</td>
                            <td>${formatPricePerArea(prop.price_per_area, prop.price, prop.area)}</td>
                            <td>${prop.floor_plan || '-'}</td>
                            <td>${prop.building_year || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${pagination ? createPagination(pagination) : ''}
        </div>
    `;
    
    tableDiv.innerHTML = table;
}

async function updateChart() {
    const prefectureCode = document.getElementById('prefectureSelect').value;
    const cityCode = document.getElementById('citySelect').value;
    
    const params = new URLSearchParams();
    if (prefectureCode) params.append('prefecture_code', prefectureCode);
    if (cityCode) params.append('city_code', cityCode);
    
    // Add filter parameters for statistics
    if (currentFilters.startDate) params.append('start_date', currentFilters.startDate + '-01');
    if (currentFilters.endDate) {
        const endDate = new Date(currentFilters.endDate + '-01');
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(endDate.getDate() - 1);
        params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    if (currentFilters.minPrice) params.append('min_price', currentFilters.minPrice * 10000);
    if (currentFilters.maxPrice) params.append('max_price', currentFilters.maxPrice * 10000);
    if (currentFilters.minArea) params.append('min_area', currentFilters.minArea);
    if (currentFilters.maxArea) params.append('max_area', currentFilters.maxArea);
    if (currentFilters.minBuildingYear) params.append('min_building_year', currentFilters.minBuildingYear);
    if (currentFilters.maxBuildingYear) params.append('max_building_year', currentFilters.maxBuildingYear);
    if (currentFilters.floorPlan) params.append('floor_plan', currentFilters.floorPlan);
    if (currentFilters.structure) params.append('structure', currentFilters.structure);
    
    try {
        const response = await fetch(`/api/statistics?${params.toString()}`);
        const stats = await response.json();
        
        if (stats.length === 0) {
            return;
        }
        
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        if (priceChart) {
            priceChart.destroy();
        }
        
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: stats.map(s => s.month),
                datasets: [
                    {
                        label: '平均価格（万円）',
                        data: stats.map(s => s.avg_price / 10000),
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.1
                    },
                    {
                        label: '平均㎡単価（万円）',
                        data: stats.map(s => s.avg_price_per_area / 10000),
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '中古マンション価格推移'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '平均価格（万円）'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: '平均㎡単価（万円）'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Failed to update chart:', error);
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('fetchStatus');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    
    if (type !== 'info') {
        setTimeout(() => {
            statusDiv.className = 'status-message';
        }, 5000);
    }
}

function showProgress(data) {
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    progressContainer.style.display = 'block';
    
    const percentage = (data.currentPeriod / data.totalPeriods) * 100;
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${data.currentPeriod} / ${data.totalPeriods} 期間`;
}

function hideProgress() {
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
}

function formatPrice(price) {
    if (!price) return '-';
    return (price / 10000).toFixed(0) + '万円';
}

function formatPricePerArea(pricePerArea, price, area) {
    // If price_per_area is available and valid, use it
    if (pricePerArea && pricePerArea > 0) {
        return (pricePerArea / 10000).toFixed(1) + '万円/㎡';
    }
    
    // Otherwise calculate from price and area
    if (price && area && area > 0) {
        const calculatedPricePerArea = price / area;
        return (calculatedPricePerArea / 10000).toFixed(1) + '万円/㎡';
    }
    
    return '-';
}

function createPagination(pagination) {
    const { page, totalPages, hasPrev, hasNext } = pagination;
    
    let paginationHTML = '<div class="pagination">';
    
    // Previous button
    if (hasPrev) {
        paginationHTML += `<button data-page="${page - 1}" class="pagination-btn">‹ 前へ</button>`;
    } else {
        paginationHTML += `<button class="pagination-btn disabled">‹ 前へ</button>`;
    }
    
    // Page numbers
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button data-page="1" class="pagination-btn">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-dots">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === page) {
            paginationHTML += `<button class="pagination-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button data-page="${i}" class="pagination-btn">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-dots">...</span>`;
        }
        paginationHTML += `<button data-page="${totalPages}" class="pagination-btn">${totalPages}</button>`;
    }
    
    // Next button
    if (hasNext) {
        paginationHTML += `<button data-page="${page + 1}" class="pagination-btn">次へ ›</button>`;
    } else {
        paginationHTML += `<button class="pagination-btn disabled">次へ ›</button>`;
    }
    
    paginationHTML += '</div>';
    
    return paginationHTML;
}

document.getElementById('prefectureSelect').addEventListener('change', (e) => {
    const prefectureCode = e.target.value;
    if (prefectureCode) {
        loadCities(prefectureCode);
    } else {
        document.getElementById('citySelect').disabled = true;
        document.getElementById('citySelect').innerHTML = '<option value="">市区町村を選択</option>';
    }
});

async function applyFilters() {
    currentFilters = getFiltersFromUI();
    currentPage = 1;
    
    try {
        await loadPropertyData(1);
        await updateChart();
        showStatus('フィルターが適用されました', 'success');
    } catch (error) {
        console.error('Failed to apply filters:', error);
        showStatus('フィルター適用中にエラーが発生しました', 'error');
    }
}

async function clearAndReload() {
    clearFilters();
    currentPage = 1;
    
    try {
        await loadPropertyData(1);
        await updateChart();
        showStatus('フィルターがクリアされました', 'success');
    } catch (error) {
        console.error('Failed to clear filters:', error);
        showStatus('フィルタークリア中にエラーが発生しました', 'error');
    }
}

document.getElementById('fetchButton').addEventListener('click', fetchAndDisplayData);
document.getElementById('applyFiltersButton').addEventListener('click', applyFilters);
document.getElementById('clearFiltersButton').addEventListener('click', clearAndReload);

// Event delegation for pagination buttons
document.addEventListener('click', (e) => {
    // Find the closest pagination button (handles clicks on text inside buttons)
    const button = e.target.closest('.pagination-btn');
    
    if (button && button.dataset.page && !button.classList.contains('disabled')) {
        const page = parseInt(button.dataset.page);
        loadPropertyData(page);
    }
});

loadPrefectures();