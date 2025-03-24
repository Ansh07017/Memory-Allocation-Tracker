/**
 * Memory Tracker Dashboard
 * Main JavaScript file for the dashboard functionality
 */

// Global variables
let refreshInterval = 3000; // Default refresh rate: 3 seconds
let refreshTimer = null;

// DOM elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshRateLinks = document.querySelectorAll('.refresh-rate');
const lastUpdateTime = document.getElementById('last-update-time');

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    initCharts();
    
    // Load initial data
    refreshData();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Event listeners
    refreshBtn.addEventListener('click', refreshData);
    
    // Refresh rate dropdown event listeners
    refreshRateLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active state in dropdown
            refreshRateLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Get new refresh rate
            const rate = parseInt(this.dataset.rate);
            
            // Update refresh interval
            setRefreshRate(rate);
        });
    });
});

/**
 * Set the data refresh rate
 * @param {number} seconds - Refresh interval in seconds (0 to pause)
 */
function setRefreshRate(seconds) {
    // Clear existing timer
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    
    // Update refresh interval
    refreshInterval = seconds * 1000;
    
    // Start new timer if rate is not 0 (paused)
    if (seconds > 0) {
        startAutoRefresh();
    } else {
        console.log('Auto-refresh paused');
    }
}

/**
 * Start the auto-refresh timer
 */
function startAutoRefresh() {
    if (refreshInterval > 0) {
        refreshTimer = setInterval(refreshData, refreshInterval);
        console.log(`Auto-refresh started: ${refreshInterval/1000}s interval`);
    }
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Update the UI with current memory data
 * @param {Object} data - Memory data from the API
 */
function updateMemoryStats(data) {
    // Update RAM stats
    const memory = data.memory;
    document.getElementById('memory-percent').textContent = `${memory.percent.toFixed(1)}%`;
    document.getElementById('memory-bar').style.width = `${memory.percent}%`;
    document.getElementById('memory-bar').setAttribute('aria-valuenow', memory.percent);
    document.getElementById('memory-total').textContent = formatBytes(memory.total);
    document.getElementById('memory-used').textContent = formatBytes(memory.used);
    document.getElementById('memory-free').textContent = formatBytes(memory.free);
    
    // Update swap stats
    const swap = data.swap;
    document.getElementById('swap-percent').textContent = `${swap.percent.toFixed(1)}%`;
    document.getElementById('swap-bar').style.width = `${swap.percent}%`;
    document.getElementById('swap-bar').setAttribute('aria-valuenow', swap.percent);
    document.getElementById('swap-total').textContent = formatBytes(swap.total);
    document.getElementById('swap-used').textContent = formatBytes(swap.used);
    document.getElementById('swap-free').textContent = formatBytes(swap.free);
    
    // Update progress bar color based on usage
    const memoryBar = document.getElementById('memory-bar');
    if (memory.percent < 60) {
        memoryBar.className = 'progress-bar bg-success';
    } else if (memory.percent < 85) {
        memoryBar.className = 'progress-bar bg-warning';
    } else {
        memoryBar.className = 'progress-bar bg-danger';
    }
    
    // Update last update time
    document.getElementById('last-update-time').textContent = data.timestamp;
}

/**
 * Update the process table with current data
 * @param {Array} processes - List of process data objects
 */
function updateProcessTable(processes) {
    const tableBody = document.getElementById('process-table-body');
    
    // Clear current table content
    tableBody.innerHTML = '';
    
    // Add processes to table
    processes.forEach(process => {
        const row = document.createElement('tr');
        
        // Add memory usage class based on percentage
        if (process.memory_percent > 10) {
            row.classList.add('table-danger');
        } else if (process.memory_percent > 5) {
            row.classList.add('table-warning');
        }
        
        row.innerHTML = `
            <td>${process.pid}</td>
            <td>${process.name}</td>
            <td>${process.username}</td>
            <td>${formatBytes(process.memory_mb * 1024 * 1024)}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress flex-grow-1 me-2" style="height: 6px;">
                        <div class="progress-bar" role="progressbar" style="width: ${process.memory_percent}%;" 
                            aria-valuenow="${process.memory_percent}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <span class="small">${process.memory_percent.toFixed(1)}%</span>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

/**
 * Refresh all data from the API
 */
function refreshData() {
    // Show loading spinner on refresh button
    refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...';
    refreshBtn.disabled = true;
    
    // Fetch current memory data
    fetch('/api/memory/current')
        .then(response => response.json())
        .then(data => {
            updateMemoryStats(data);
            updateMemoryPieChart(data.memory);
        })
        .catch(error => {
            console.error('Error fetching current memory data:', error);
        });
    
    // Fetch memory history
    fetch('/api/memory/history')
        .then(response => response.json())
        .then(data => {
            updateMemoryHistoryChart(data);
        })
        .catch(error => {
            console.error('Error fetching memory history:', error);
        });
    
    // Fetch processes
    fetch('/api/memory/processes')
        .then(response => response.json())
        .then(data => {
            updateProcessTable(data);
        })
        .catch(error => {
            console.error('Error fetching process data:', error);
        })
        .finally(() => {
            // Reset refresh button
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            refreshBtn.disabled = false;
        });
}
