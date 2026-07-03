// State Management
let appState = {
  villas: [], // Raw villa data (either live fetched or fallback)
  filteredVillas: [], // Filtered subset
  activeDay: 'monday', // Current active day for calculations and filtering
  currentView: 'table', // Default to table view
  sortColumn: 'house_name', // Default sort column
  sortDirection: 'asc', // Default sort direction
  filters: {
    searchQuery: '',
    maxPrice: 40000,
    guests: 0,
    bedrooms: 'any',
    bathrooms: 'any',
    floors: 'any',
    maxDistance: 15000
  },
  table: {
    currentPage: 1,
    pageSize: 15
  }
};

// CONSTANTS
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1_YYvs5VO4dgAsNNd26pgWKQhBgs3Va9QSQrYG5vIDOw/export?format=csv&gid=1964121033';

// DOM Element Selectors
const DOM = {
  logo: document.getElementById('app-logo'),
  statusBadge: document.getElementById('data-source-status'),
  statusText: document.getElementById('data-source-text'),
  btnListView: document.getElementById('btn-list-view'),
  btnTableView: document.getElementById('btn-table-view'),
  btnSync: document.getElementById('btn-sync'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  themeBtnIcon: document.getElementById('theme-btn-icon'),
  listViewContainer: document.getElementById('list-view'),
  tableViewContainer: document.getElementById('table-view'),
  tableBody: document.getElementById('table-body'),
  tableInfo: document.getElementById('table-info'),
  tablePagination: document.getElementById('table-pagination'),
  noResultsPanel: document.getElementById('no-results-panel'),
  btnResetEmpty: document.getElementById('btn-reset-empty'),
  
  // Filter Inputs
  searchBox: document.getElementById('search-box'),
  activeDayLabel: document.getElementById('lbl-active-day'),
  dayButtons: document.querySelectorAll('.day-btn'),
  filterPrice: document.getElementById('filter-price'),
  lblPrice: document.getElementById('lbl-price'),
  filterGuests: document.getElementById('filter-guests'),
  lblGuests: document.getElementById('lbl-guests'),
  filterBedrooms: document.getElementById('filter-bedrooms'),
  filterBathrooms: document.getElementById('filter-bathrooms'),
  filterFloors: document.getElementById('filter-floors'),
  filterDistance: document.getElementById('filter-distance'),
  lblDistance: document.getElementById('lbl-distance'),
  btnReset: document.getElementById('btn-reset'),
  
  // Stats
  statCount: document.getElementById('stat-count'),
  statAvgPrice: document.getElementById('stat-avg-price'),
  statAvgPerson: document.getElementById('stat-avg-person'),
  statMinPrice: document.getElementById('stat-min-price'),
  
  // Active Filter Badges
  activeBadges: document.getElementById('active-badges'),
  
  // Mobile Filter Sidebar Toggle
  btnMobileFilters: document.getElementById('btn-mobile-filters'),
  filterSidebar: document.getElementById('filter-sidebar')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initData();
  setupEventListeners();
});

// --- DATA LOADING & PARSING ---
async function initData() {
  updateStatus('loading', 'Loading data...');
  
  try {
    // Attempt to fetch from Google Sheets CSV export
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    const parsedData = parseCSV(csvText);
    
    if (parsedData && parsedData.length > 0) {
      appState.villas = parsedData;
      updateStatus('live', 'Live Data');
    } else {
      throw new Error('Parsed data was empty or invalid');
    }
  } catch (error) {
    console.warn('Could not fetch live Google Sheets data (CORS or network error). Falling back to pre-parsed cached data. Error:', error);
    // Use fallback data from data.js
    if (typeof villaData !== 'undefined') {
      appState.villas = villaData;
      updateStatus('fallback', 'Cached Data');
    } else {
      updateStatus('error', 'Error loading data');
      alert('Failed to load villa data. Please check your internet connection or data.js file.');
      return;
    }
  }

  // Calculate dynamic maximums for sliders based on dataset
  initSliderLimits();
  resetFilters();
  applyFilters();
}

function updateStatus(type, message) {
  DOM.statusBadge.className = 'data-source-badge';
  DOM.statusText.textContent = message;
  
  if (type === 'loading') {
    DOM.statusBadge.classList.add('fallback');
  } else if (type === 'live') {
    // defaults to default styling (green success)
  } else if (type === 'fallback') {
    DOM.statusBadge.classList.add('fallback');
  } else {
    DOM.statusBadge.style.background = 'rgba(244, 63, 94, 0.1)';
    DOM.statusBadge.style.borderColor = 'rgba(244, 63, 94, 0.2)';
    DOM.statusBadge.style.color = '#f43f5e';
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    DOM.logo.src = 'Logo_dark.png';
    DOM.themeBtnIcon.innerHTML = '<use href="#icon-moon"></use>';
  } else {
    document.body.classList.remove('light-mode');
    DOM.logo.src = 'Logo_light.png';
    DOM.themeBtnIcon.innerHTML = '<use href="#icon-sun"></use>';
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  if (isLight) {
    localStorage.setItem('theme', 'light');
    DOM.logo.src = 'Logo_dark.png';
    DOM.themeBtnIcon.innerHTML = '<use href="#icon-moon"></use>';
  } else {
    localStorage.setItem('theme', 'dark');
    DOM.logo.src = 'Logo_light.png';
    DOM.themeBtnIcon.innerHTML = '<use href="#icon-sun"></use>';
  }
}

async function syncData() {
  const syncIcon = DOM.btnSync.querySelector('svg');
  syncIcon.classList.add('spinning');
  DOM.btnSync.disabled = true;
  
  const prevStatusText = DOM.statusText.textContent;
  const prevStatusClass = DOM.statusBadge.className;
  updateStatus('loading', 'Syncing...');
  
  const startTime = Date.now();
  
  try {
    const cacheBuster = `&cb=${Date.now()}`;
    const response = await fetch(GOOGLE_SHEET_CSV_URL + cacheBuster);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    const parsedData = parseCSV(csvText);
    
    if (parsedData && parsedData.length > 0) {
      appState.villas = parsedData;
      updateStatus('live', 'Live Data');
      applyFilters();
    } else {
      throw new Error('Parsed data was empty or invalid');
    }
  } catch (error) {
    console.error('Sync failed:', error);
    alert('Sync failed: Could not fetch fresh data from Google Sheets. Using cached/offline data.');
    DOM.statusBadge.className = prevStatusClass;
    DOM.statusText.textContent = prevStatusText;
  } finally {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 600 - elapsed);
    
    setTimeout(() => {
      syncIcon.classList.remove('spinning');
      DOM.btnSync.disabled = false;
    }, remaining);
  }
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  let csvStartIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('house_name,')) {
      csvStartIndex = i;
      break;
    }
  }
  
  if (csvStartIndex === -1) return null;
  
  const headers = lines[csvStartIndex].trim().split(',');
  const villas = [];
  
  for (let i = csvStartIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parser handling quotes
    const values = [];
    let currentVal = '';
    let inQuotes = false;
    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());
    
    if (values.length < headers.length) continue;
    
    const villa = {};
    headers.forEach((header, idx) => {
      const val = values[idx];
      if (header === 'house_name') {
        villa[header] = val;
      } else {
        villa[header] = val === '' ? 0 : Number(val);
      }
    });
    
    // Calculate average price per person for each day
    DAYS.forEach(day => {
      const priceKey = `price_${day}`;
      const maxPeopleKey = `max_people_${day}`;
      const avgKey = `avg_price_per_person_${day}`;
      
      const price = villa[priceKey] || 0;
      const maxPeople = villa[maxPeopleKey] || 0;
      
      villa[avgKey] = maxPeople > 0 ? Math.round((price / maxPeople) * 100) / 100 : 0;
    });
    
    villas.push(villa);
  }
  return villas;
}

function initSliderLimits() {
  if (appState.villas.length === 0) return;
  
  // Find limits for prices and distances
  let maxPriceValue = 0;
  let maxDistanceValue = 0;
  
  appState.villas.forEach(v => {
    DAYS.forEach(day => {
      if (v[`price_${day}`] > maxPriceValue) maxPriceValue = v[`price_${day}`];
    });
    if (v.far_sea > maxDistanceValue) maxDistanceValue = v.far_sea;
  });
  
  // Set prices boundaries
  DOM.filterPrice.max = maxPriceValue;
  DOM.filterPrice.value = maxPriceValue;
  appState.filters.maxPrice = maxPriceValue;
  DOM.lblPrice.textContent = `${formatNumber(maxPriceValue)} THB`;
  
  // Set distance boundaries
  DOM.filterDistance.max = maxDistanceValue;
  DOM.filterDistance.value = maxDistanceValue;
  appState.filters.maxDistance = maxDistanceValue;
  DOM.lblDistance.textContent = maxDistanceValue === 0 ? '0 m' : `${formatNumber(maxDistanceValue)} m`;
}

// --- FILTER HANDLING ---
function resetFilters() {
  appState.filters.searchQuery = '';
  DOM.searchBox.value = '';
  
  // Find max values in dataset to set sliders back to max
  let maxPriceValue = 0;
  let maxDistanceValue = 0;
  appState.villas.forEach(v => {
    DAYS.forEach(day => {
      if (v[`price_${day}`] > maxPriceValue) maxPriceValue = v[`price_${day}`];
    });
    if (v.far_sea > maxDistanceValue) maxDistanceValue = v.far_sea;
  });
  
  appState.filters.maxPrice = maxPriceValue || 40000;
  DOM.filterPrice.value = appState.filters.maxPrice;
  DOM.lblPrice.textContent = `${formatNumber(appState.filters.maxPrice)} THB`;
  
  appState.filters.guests = 0;
  DOM.filterGuests.value = 0;
  DOM.lblGuests.textContent = '0 Persons';
  
  appState.filters.bedrooms = 'any';
  DOM.filterBedrooms.value = 'any';
  
  appState.filters.bathrooms = 'any';
  DOM.filterBathrooms.value = 'any';
  
  appState.filters.floors = 'any';
  DOM.filterFloors.value = 'any';
  
  appState.filters.maxDistance = maxDistanceValue || 15000;
  DOM.filterDistance.value = appState.filters.maxDistance;
  DOM.lblDistance.textContent = 'Any';
}

function applyFilters() {
  const { searchQuery, maxPrice, guests, bedrooms, bathrooms, floors, maxDistance } = appState.filters;
  const day = appState.activeDay;
  
  appState.filteredVillas = appState.villas.filter(villa => {
    // 1. Search Query
    if (searchQuery && !villa.house_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // 2. Price Filter (compares against selected day's price)
    const priceOnDay = villa[`price_${day}`] || 0;
    if (priceOnDay > maxPrice) {
      return false;
    }
    
    // 3. Guests Capacity (villa capacity on selected day must be >= requested guests)
    const capacityOnDay = villa[`max_people_${day}`] || 0;
    if (guests > 0 && capacityOnDay < guests) {
      return false;
    }
    
    // 4. Bedrooms
    if (bedrooms !== 'any' && villa.bed_room < Number(bedrooms)) {
      return false;
    }
    
    // 5. Bathrooms
    if (bathrooms !== 'any' && villa.toilet < Number(bathrooms)) {
      return false;
    }
    
    // 6. Floors
    if (floors !== 'any') {
      const fNum = Number(floors);
      if (fNum === 3) {
        if (villa.total_floor < 3) return false;
      } else {
        if (villa.total_floor !== fNum) return false;
      }
    }
    
    // 7. Distance from Sea
    if (villa.far_sea > maxDistance) {
      return false;
    }
    
    return true;
  });
  
  // Sort the filtered list
  const col = appState.sortColumn;
  const dir = appState.sortDirection === 'asc' ? 1 : -1;
  
  appState.filteredVillas.sort((a, b) => {
    let valA, valB;
    
    // Resolve dynamic keys
    if (col === 'price') {
      valA = a[`price_${day}`] || 0;
      valB = b[`price_${day}`] || 0;
    } else if (col === 'max_people') {
      valA = a[`max_people_${day}`] || 0;
      valB = b[`max_people_${day}`] || 0;
    } else if (col === 'avg_price_per_person') {
      valA = a[`avg_price_per_person_${day}`] || 0;
      valB = b[`avg_price_per_person_${day}`] || 0;
    } else {
      valA = a[col];
      valB = b[col];
    }
    
    if (typeof valA === 'string') {
      return valA.localeCompare(valB) * dir;
    } else {
      return (valA - valB) * dir;
    }
  });
  
  appState.table.currentPage = 1; // Reset pagination when filter changes
  
  updateUI();
}

// --- UI RENDERING ---
function updateUI() {
  // Update stats cards
  renderStats();
  
  // Render search badges
  renderActiveBadges();
  
  // Handle results visibility
  if (appState.filteredVillas.length === 0) {
    DOM.listViewContainer.classList.add('hidden');
    DOM.tableViewContainer.classList.add('hidden');
    DOM.noResultsPanel.classList.remove('hidden');
    return;
  }
  
  DOM.noResultsPanel.classList.add('hidden');
  
  if (appState.currentView === 'list') {
    DOM.listViewContainer.classList.remove('hidden');
    DOM.tableViewContainer.classList.add('hidden');
    renderListView();
  } else {
    DOM.listViewContainer.classList.add('hidden');
    DOM.tableViewContainer.classList.remove('hidden');
    renderTableView();
  }
}

function renderStats() {
  const count = appState.filteredVillas.length;
  const day = appState.activeDay;
  
  DOM.statCount.textContent = count;
  
  if (count === 0) {
    DOM.statAvgPrice.innerHTML = `0<span>THB</span>`;
    DOM.statAvgPerson.innerHTML = `0<span>THB</span>`;
    DOM.statMinPrice.innerHTML = `0<span>THB</span>`;
    return;
  }
  
  let totalPrice = 0;
  let totalAvgPerPerson = 0;
  let minPrice = Infinity;
  
  appState.filteredVillas.forEach(v => {
    const price = v[`price_${day}`] || 0;
    const avgPerPerson = v[`avg_price_per_person_${day}`] || 0;
    
    totalPrice += price;
    totalAvgPerPerson += avgPerPerson;
    if (price < minPrice) minPrice = price;
  });
  
  const avgPrice = Math.round(totalPrice / count);
  const avgPricePerson = Math.round((totalAvgPerPerson / count) * 100) / 100;
  
  DOM.statAvgPrice.innerHTML = `${formatNumber(avgPrice)}<span>THB</span>`;
  DOM.statAvgPerson.innerHTML = `${formatNumber(avgPricePerson)}<span>THB</span>`;
  DOM.statMinPrice.innerHTML = `${formatNumber(minPrice)}<span>THB</span>`;
}

function renderActiveBadges() {
  DOM.activeBadges.innerHTML = '';
  const filters = appState.filters;
  
  // Search badge
  if (filters.searchQuery) {
    createBadge(`Search: "${filters.searchQuery}"`, () => {
      appState.filters.searchQuery = '';
      DOM.searchBox.value = '';
      applyFilters();
    });
  }
  
  // Price badge
  let maxPriceInDataset = 0;
  appState.villas.forEach(v => {
    DAYS.forEach(day => {
      if (v[`price_${day}`] > maxPriceInDataset) maxPriceInDataset = v[`price_${day}`];
    });
  });
  if (filters.maxPrice < maxPriceInDataset) {
    createBadge(`Max Price: ${formatNumber(filters.maxPrice)} THB`, () => {
      appState.filters.maxPrice = maxPriceInDataset;
      DOM.filterPrice.value = maxPriceInDataset;
      DOM.lblPrice.textContent = `${formatNumber(maxPriceInDataset)} THB`;
      applyFilters();
    });
  }
  
  // Guests badge
  if (filters.guests > 0) {
    createBadge(`Guests: ${filters.guests}+`, () => {
      appState.filters.guests = 0;
      DOM.filterGuests.value = 0;
      DOM.lblGuests.textContent = '0 Persons';
      applyFilters();
    });
  }
  
  // Bedrooms badge
  if (filters.bedrooms !== 'any') {
    createBadge(`Bedrooms: ${filters.bedrooms}+`, () => {
      appState.filters.bedrooms = 'any';
      DOM.filterBedrooms.value = 'any';
      applyFilters();
    });
  }
  
  // Bathrooms badge
  if (filters.bathrooms !== 'any') {
    createBadge(`Bathrooms: ${filters.bathrooms}+`, () => {
      appState.filters.bathrooms = 'any';
      DOM.filterBathrooms.value = 'any';
      applyFilters();
    });
  }
  
  // Floors badge
  if (filters.floors !== 'any') {
    const lbl = filters.floors === '3' ? '3+ Floors' : `${filters.floors} Floor`;
    createBadge(`Floors: ${lbl}`, () => {
      appState.filters.floors = 'any';
      DOM.filterFloors.value = 'any';
      applyFilters();
    });
  }
  
  // Distance badge
  let maxDistanceInDataset = 0;
  appState.villas.forEach(v => {
    if (v.far_sea > maxDistanceInDataset) maxDistanceInDataset = v.far_sea;
  });
  if (filters.maxDistance < maxDistanceInDataset) {
    createBadge(`Sea Distance: <= ${formatNumber(filters.maxDistance)}m`, () => {
      appState.filters.maxDistance = maxDistanceInDataset;
      DOM.filterDistance.value = maxDistanceInDataset;
      DOM.lblDistance.textContent = 'Any';
      applyFilters();
    });
  }
}

function createBadge(text, onClear) {
  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = text;
  
  const clearBtn = document.createElement('button');
  clearBtn.className = 'clear-badge-btn';
  clearBtn.innerHTML = `<svg style="width:10px;height:10px;"><use href="#icon-close"></use></svg>`;
  clearBtn.addEventListener('click', onClear);
  
  badge.appendChild(clearBtn);
  DOM.activeBadges.appendChild(badge);
}

function renderListView() {
  DOM.listViewContainer.innerHTML = '';
  const day = appState.activeDay;
  
  appState.filteredVillas.forEach(villa => {
    const price = villa[`price_${day}`] || 0;
    const maxPeople = villa[`max_people_${day}`] || 0;
    const avgPerPerson = villa[`avg_price_per_person_${day}`] || 0;
    const distanceText = villa.far_sea === 0 ? 'Beachfront' : `${parseFloat((villa.far_sea / 1000).toFixed(2))} km`;
    
    // Create Villa Card element
    const card = document.createElement('div');
    card.className = 'villa-card';
    
    // Card header containing Title and quick badges
    let cardContent = `
      <div class="villa-card-header">
        <h3 class="villa-title">${villa.house_name}</h3>
        <div class="villa-specs">
          <div class="spec-badge" title="Distance to sea">
            <svg><use href="#icon-compass"></use></svg>
            <span>${distanceText}</span>
          </div>
          <div class="spec-badge" title="Bedrooms">
            <svg><use href="#icon-bed"></use></svg>
            <span>${villa.bed_room} Bed</span>
          </div>
          <div class="spec-badge" title="Bathrooms">
            <svg><use href="#icon-toilet"></use></svg>
            <span>${villa.toilet} Bath</span>
          </div>
          <div class="spec-badge" title="Floors">
            <svg><use href="#icon-layers"></use></svg>
            <span>${villa.total_floor} Fl</span>
          </div>
        </div>
      </div>
      
      <!-- Big Highlights: Selected Day Price and Max Capacity -->
      <div class="avg-price-highlight-box">
        <span class="box-label">Price per Person (${capitalizeFirstLetter(day)})</span>
        <span class="box-value">${formatNumber(avgPerPerson)} THB</span>
        <span class="box-sublabel">Calculated from ${formatNumber(price)} THB / ${maxPeople} Guests</span>
      </div>

      <!-- General Info Specifications Grid -->
      <div class="villa-details-grid">
        <div class="detail-row">
          <span class="detail-lbl">Pet Fee</span>
          <span class="detail-val">${villa.extra_fee_per_pet > 0 ? `${formatNumber(villa.extra_fee_per_pet)} THB` : 'No Pets / Free'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-lbl">Extra Guest Fee</span>
          <span class="detail-val">${villa.extra_fee_per_person > 0 ? `${formatNumber(villa.extra_fee_per_person)} THB / Person` : 'None'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-lbl">Standard Capacity</span>
          <span class="detail-val">${maxPeople} Persons</span>
        </div>
        <div class="detail-row">
          <span class="detail-lbl">Total Floors</span>
          <span class="detail-val">${villa.total_floor} Floor(s)</span>
        </div>
      </div>

      <!-- Collapsible Weekly rate table -->
      <div class="weekly-accordion" id="accordion-${sanitizeId(villa.house_name)}">
        <button class="accordion-trigger" onclick="toggleAccordion('accordion-${sanitizeId(villa.house_name)}')">
          <span>Weekly Rate Details</span>
          <svg><use href="#icon-chevron-down"></use></svg>
        </button>
        <div class="accordion-content">
          <table class="weekly-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Price</th>
                <th>Capacity</th>
                <th>Per Person</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    // Render weekly rates row inside accordion
    DAYS.forEach(d => {
      const p = villa[`price_${d}`] || 0;
      const m = villa[`max_people_${d}`] || 0;
      const avg = villa[`avg_price_per_person_${d}`] || 0;
      const isActive = d === day ? 'class="highlight-col"' : '';
      
      cardContent += `
        <tr ${d === day ? 'style="background: rgba(56,189,248,0.04);"' : ''}>
          <td class="day-col ${d === day ? 'highlight-col' : ''}">${d.substring(0, 3)}</td>
          <td>${formatNumber(p)} THB</td>
          <td>${m} pax</td>
          <td ${isActive}>${formatNumber(avg)} THB</td>
        </tr>
      `;
    });
    
    cardContent += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    card.innerHTML = cardContent;
    DOM.listViewContainer.appendChild(card);
  });
}

function renderTableView() {
  DOM.tableBody.innerHTML = '';
  
  const count = appState.filteredVillas.length;
  const page = appState.table.currentPage;
  const size = appState.table.pageSize;
  const day = appState.activeDay;
  
  const startIndex = (page - 1) * size;
  const endIndex = Math.min(startIndex + size, count);
  
  const pageItems = appState.filteredVillas.slice(startIndex, endIndex);
  
  DOM.tableInfo.textContent = `Showing ${count === 0 ? 0 : startIndex + 1}-${endIndex} of ${count} entries`;
  
  pageItems.forEach(villa => {
    const row = document.createElement('tr');
    
    const distanceText = villa.far_sea === 0 ? 'Beachfront' : `${parseFloat((villa.far_sea / 1000).toFixed(2))} km`;
    const selectedPrice = villa[`price_${day}`] || 0;
    const selectedMax = villa[`max_people_${day}`] || 0;
    const selectedAvg = villa[`avg_price_per_person_${day}`] || 0;
    
    let rowHTML = `
      <td class="sticky-col">${villa.house_name}</td>
      <td>${distanceText}</td>
      <td>${villa.bed_room}</td>
      <td>${villa.toilet}</td>
      <td>${villa.total_floor}</td>
      <td>${selectedMax}</td>
      <td style="color: var(--text-gold);">${formatNumber(selectedPrice)} THB</td>
      <td style="color: var(--text-cyan);">${formatNumber(selectedAvg)} THB</td>
      <td>${villa.extra_fee_per_pet > 0 ? `${formatNumber(villa.extra_fee_per_pet)} THB` : '0'}</td>
      <td>${villa.extra_fee_per_person > 0 ? `${formatNumber(villa.extra_fee_per_person)} THB` : '0'}</td>
    `;
    
    row.innerHTML = rowHTML;
    DOM.tableBody.appendChild(row);
  });
  
  renderPagination(count);
}

function renderPagination(totalCount) {
  DOM.tablePagination.innerHTML = '';
  
  const page = appState.table.currentPage;
  const size = appState.table.pageSize;
  const totalPages = Math.ceil(totalCount / size);
  
  if (totalPages <= 1) return;
  
  // Previous Button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.disabled = page === 1;
  prevBtn.innerHTML = `&lt;`;
  prevBtn.addEventListener('click', () => {
    if (appState.table.currentPage > 1) {
      appState.table.currentPage--;
      renderTableView();
    }
  });
  DOM.tablePagination.appendChild(prevBtn);
  
  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    // Basic pagination trimming to show only near pages if too many
    if (totalPages > 6 && Math.abs(i - page) > 1 && i !== 1 && i !== totalPages) {
      if (i === 2 && page > 3) {
        const dot = document.createElement('span');
        dot.textContent = '...';
        dot.style.color = 'var(--text-muted)';
        dot.style.padding = '0 5px';
        DOM.tablePagination.appendChild(dot);
      }
      if (i === totalPages - 1 && page < totalPages - 2) {
        const dot = document.createElement('span');
        dot.textContent = '...';
        dot.style.color = 'var(--text-muted)';
        dot.style.padding = '0 5px';
        DOM.tablePagination.appendChild(dot);
      }
      continue;
    }
    
    const pageBtn = document.createElement('button');
    pageBtn.className = `page-btn ${i === page ? 'active' : ''}`;
    pageBtn.textContent = i;
    pageBtn.addEventListener('click', () => {
      appState.table.currentPage = i;
      renderTableView();
    });
    DOM.tablePagination.appendChild(pageBtn);
  }
  
  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.disabled = page === totalPages;
  nextBtn.innerHTML = `&gt;`;
  nextBtn.addEventListener('click', () => {
    if (appState.table.currentPage < totalPages) {
      appState.table.currentPage++;
      renderTableView();
    }
  });
  DOM.tablePagination.appendChild(nextBtn);
}

// --- EVENT HANDLERS ---
function setupEventListeners() {
  // Search input
  DOM.searchBox.addEventListener('input', (e) => {
    appState.filters.searchQuery = e.target.value;
    applyFilters();
  });
  
  // Price Range slider
  DOM.filterPrice.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    appState.filters.maxPrice = val;
    DOM.lblPrice.textContent = `${formatNumber(val)} THB`;
    applyFilters();
  });
  
  // Guests slider
  DOM.filterGuests.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    appState.filters.guests = val;
    DOM.lblGuests.textContent = val === 0 ? '0 Persons' : `${val}+ Persons`;
    applyFilters();
  });
  
  // Dropdowns
  DOM.filterBedrooms.addEventListener('change', (e) => {
    appState.filters.bedrooms = e.target.value;
    applyFilters();
  });
  
  DOM.filterBathrooms.addEventListener('change', (e) => {
    appState.filters.bathrooms = e.target.value;
    applyFilters();
  });
  
  DOM.filterFloors.addEventListener('change', (e) => {
    appState.filters.floors = e.target.value;
    applyFilters();
  });
  
  // Distance to sea slider
  DOM.filterDistance.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    appState.filters.maxDistance = val;
    
    let maxDistanceInDataset = 0;
    appState.villas.forEach(v => {
      if (v.far_sea > maxDistanceInDataset) maxDistanceInDataset = v.far_sea;
    });
    
    if (val >= maxDistanceInDataset) {
      DOM.lblDistance.textContent = 'Any';
    } else {
      DOM.lblDistance.textContent = val === 0 ? 'Beachfront' : `<= ${formatNumber(val)} m`;
    }
    applyFilters();
  });
  
  // Day Selector Buttons
  DOM.dayButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      DOM.dayButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const selectedDay = btn.getAttribute('data-day');
      appState.activeDay = selectedDay;
      DOM.activeDayLabel.textContent = capitalizeFirstLetter(selectedDay);
      
      applyFilters();
    });
  });
  
  // View Toggle Buttons
  DOM.btnListView.addEventListener('click', () => {
    DOM.btnListView.classList.add('active');
    DOM.btnTableView.classList.remove('active');
    appState.currentView = 'list';
    updateUI();
  });
  
  DOM.btnTableView.addEventListener('click', () => {
    DOM.btnTableView.classList.add('active');
    DOM.btnListView.classList.remove('active');
    appState.currentView = 'table';
    updateUI();
  });
  
  // Reset buttons
  DOM.btnReset.addEventListener('click', () => {
    resetFilters();
    applyFilters();
  });
  
  DOM.btnResetEmpty.addEventListener('click', () => {
    resetFilters();
    applyFilters();
  });
  
  // Mobile drawer filter toggle
  DOM.btnMobileFilters.addEventListener('click', () => {
    DOM.filterSidebar.classList.toggle('mobile-open');
  });
  
  // Close mobile filter sidebar when clicking outside of it
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
      const isClickInsideSidebar = DOM.filterSidebar.contains(e.target);
      const isClickMobileBtn = DOM.btnMobileFilters.contains(e.target);
      
      if (!isClickInsideSidebar && !isClickMobileBtn && DOM.filterSidebar.classList.contains('mobile-open')) {
        DOM.filterSidebar.classList.remove('mobile-open');
      }
    }
  });
  
  // Sync Button
  DOM.btnSync.addEventListener('click', () => {
    syncData();
  });
  
  // Theme Toggle Button
  DOM.btnThemeToggle.addEventListener('click', () => {
    toggleTheme();
  });
  // Table sorting headers
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (appState.sortColumn === col) {
        appState.sortDirection = appState.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        appState.sortColumn = col;
        appState.sortDirection = 'asc';
      }
      
      // Update UI classes for headers
      document.querySelectorAll('th.sortable').forEach(t => {
        t.classList.remove('active-sort', 'asc', 'desc');
      });
      th.classList.add('active-sort', appState.sortDirection);
      
      applyFilters();
    });
  });
}

// --- GLOBAL ACCORDION FUNCTION ---
window.toggleAccordion = function(id) {
  const accordion = document.getElementById(id);
  if (!accordion) return;
  
  accordion.classList.toggle('open');
};

// --- HELPER FUNCTIONS ---
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function sanitizeId(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}
