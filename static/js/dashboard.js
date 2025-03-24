/**
 * Memory Tracker Dashboard
 * Main JavaScript file for the dashboard functionality
 */

// Global variables
let refreshInterval = 3000; // Default refresh rate: 3 seconds
let refreshTimer = null;
let autoSortProcesses = true; // Default: auto-sort enabled

// DOM elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshRateLinks = document.querySelectorAll('.refresh-rate');
const lastUpdateTime = document.getElementById('last-update-time');
const autoSortCheckbox = document.getElementById('auto-sort-processes');

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
    
    // Auto-sort checkbox event listener
    if (autoSortCheckbox) {
        autoSortCheckbox.addEventListener('change', function() {
            autoSortProcesses = this.checked;
            
            // Show a toast notification
            if (this.checked) {
                showToast('Auto-sorting processes enabled', 'info');
            } else {
                showToast('Auto-sorting processes disabled', 'info');
            }
            
            // Refresh data immediately to apply the sorting
            refreshData();
        });
    }
    
    // Add a custom class to the body for animation purposes
    document.body.classList.add('animated-dashboard');
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
    
    // Update the refresh status indicator
    const refreshStatus = document.getElementById('refresh-status');
    
    if (seconds > 0) {
        // Start new timer
        startAutoRefresh();
        
        // Update the refresh status with animation
        refreshStatus.innerHTML = `<i class="fas fa-circle-notch fa-spin me-1"></i>Auto-refresh: ${seconds}s`;
        refreshStatus.className = 'badge bg-success';
        
        // Show a toast notification
        showToast(`Auto-refresh set to ${seconds} seconds`, 'success');
    } else {
        // Update the refresh status for paused state
        refreshStatus.innerHTML = `<i class="fas fa-pause me-1"></i>Auto-refresh: Paused`;
        refreshStatus.className = 'badge bg-secondary';
        
        // Show a toast notification
        showToast('Auto-refresh paused', 'info');
        
        console.log('Auto-refresh paused');
    }
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Bootstrap alert type (success, danger, warning, info)
 */
function showToast(message, type = 'info') {
    // Get the toast container, create it if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create a new toast
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast bg-${type} text-white border-0` ;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="toast-header bg-${type} text-white">
            <strong class="me-auto">Memory Tracker</strong>
            <small>Just now</small>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Add the toast to the container
    toastContainer.appendChild(toast);
    
    // Initialize and show the toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 2000
    });
    bsToast.show();
    
    // Remove the toast after it's hidden
    toast.addEventListener('hidden.bs.toast', function () {
        toast.remove();
    });
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
 * Apply pulse animation to an element
 * @param {HTMLElement} element - Element to animate
 */
function pulseElement(element) {
    // Remove any existing animation class
    element.classList.remove('pulse-animation');
    
    // Trigger reflow to restart animation
    void element.offsetWidth;
    
    // Add animation class
    element.classList.add('pulse-animation');
}

/**
 * Create and show a memory alert if threshold is exceeded
 * @param {number} percent - Memory usage percentage
 * @param {string} type - 'ram' or 'swap'
 */
function checkMemoryThreshold(percent, type) {
    const alertsContainer = document.getElementById('memory-alerts');
    const alertId = `${type}-alert`;
    
    // Remove existing alert if it exists
    const existingAlert = document.getElementById(alertId);
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // Show alert if memory usage is high
    if (percent > 85) {
        const alert = document.createElement('div');
        alert.id = alertId;
        alert.className = 'alert alert-danger alert-dismissible fade show mt-2';
        alert.innerHTML = `
            <strong>Warning!</strong> ${type.toUpperCase()} usage is critically high (${percent.toFixed(1)}%).
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add alert to container
        alertsContainer.appendChild(alert);
        
        // Animate the alert
        alert.style.animation = 'slideIn 0.5s ease-out';
    } else if (percent > 70) {
        const alert = document.createElement('div');
        alert.id = alertId;
        alert.className = 'alert alert-warning alert-dismissible fade show mt-2';
        alert.innerHTML = `
            <strong>Notice:</strong> ${type.toUpperCase()} usage is elevated (${percent.toFixed(1)}%).
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add alert to container
        alertsContainer.appendChild(alert);
        
        // Animate the alert
        alert.style.animation = 'slideIn 0.5s ease-out';
    }
}

/**
 * Update the UI with current memory data
 * @param {Object} data - Memory data from the API
 */
function updateMemoryStats(data) {
    // Store previous values for animation
    const prevMemoryPercent = document.getElementById('memory-percent').textContent;
    const prevSwapPercent = document.getElementById('swap-percent').textContent;
    
    // Update RAM stats
    const memory = data.memory;
    const memoryPercentElement = document.getElementById('memory-percent');
    memoryPercentElement.textContent = `${memory.percent.toFixed(1)}%`;
    
    // Animate if value changed significantly
    if (Math.abs(parseFloat(prevMemoryPercent) - memory.percent) > 1) {
        pulseElement(memoryPercentElement);
    }
    
    // Animate progress bar change
    const memoryBar = document.getElementById('memory-bar');
    memoryBar.style.transition = 'width 0.5s ease-in-out';
    memoryBar.style.width = `${memory.percent}%`;
    memoryBar.setAttribute('aria-valuenow', memory.percent);
    
    document.getElementById('memory-total').textContent = formatBytes(memory.total);
    
    // Animate memory used value if it changes
    const memoryUsedEl = document.getElementById('memory-used');
    const newMemoryUsed = formatBytes(memory.used);
    if (memoryUsedEl.textContent !== newMemoryUsed) {
        memoryUsedEl.textContent = newMemoryUsed;
        pulseElement(memoryUsedEl);
    }
    
    document.getElementById('memory-free').textContent = formatBytes(memory.free);
    
    // Update swap stats
    const swap = data.swap;
    const swapPercentElement = document.getElementById('swap-percent');
    swapPercentElement.textContent = `${swap.percent.toFixed(1)}%`;
    
    // Animate if value changed significantly
    if (Math.abs(parseFloat(prevSwapPercent) - swap.percent) > 1) {
        pulseElement(swapPercentElement);
    }
    
    // Animate swap bar change
    const swapBar = document.getElementById('swap-bar');
    swapBar.style.transition = 'width 0.5s ease-in-out';
    swapBar.style.width = `${swap.percent}%`;
    swapBar.setAttribute('aria-valuenow', swap.percent);
    
    document.getElementById('swap-total').textContent = formatBytes(swap.total);
    
    // Animate swap used value if it changes
    const swapUsedEl = document.getElementById('swap-used');
    const newSwapUsed = formatBytes(swap.used);
    if (swapUsedEl.textContent !== newSwapUsed) {
        swapUsedEl.textContent = newSwapUsed;
        pulseElement(swapUsedEl);
    }
    
    document.getElementById('swap-free').textContent = formatBytes(swap.free);
    
    // Update progress bar color based on usage with transition
    if (memory.percent < 60) {
        memoryBar.className = 'progress-bar bg-success';
    } else if (memory.percent < 85) {
        memoryBar.className = 'progress-bar bg-warning';
    } else {
        memoryBar.className = 'progress-bar bg-danger';
    }
    
    // Check thresholds and show alerts if needed
    checkMemoryThreshold(memory.percent, 'ram');
    checkMemoryThreshold(swap.percent, 'swap');
    
    // Update last update time with animation
    const lastUpdateEl = document.getElementById('last-update-time');
    lastUpdateEl.textContent = data.timestamp;
    pulseElement(lastUpdateEl);
}

// Store previous process data for comparison
let previousProcesses = [];

/**
 * Update the process table with current data
 * @param {Array} processes - List of process data objects
 */
function updateProcessTable(processes) {
    const tableBody = document.getElementById('process-table-body');
    
    // Create a map of previous processes for quick lookup
    const previousProcessMap = {};
    previousProcesses.forEach(proc => {
        previousProcessMap[proc.pid] = proc;
    });
    
    // Clear current table content
    tableBody.innerHTML = '';
    
    // Sort processes by memory usage (descending) if auto-sort is enabled
    if (autoSortProcesses) {
        processes.sort((a, b) => b.memory_percent - a.memory_percent);
    }
    
    // Add processes to table
    processes.forEach(process => {
        const row = document.createElement('tr');
        row.dataset.pid = process.pid;
        
        // Check if this process existed in the previous data
        const previousProcess = previousProcessMap[process.pid];
        const isNew = !previousProcess;
        
        // Determine if memory usage changed significantly
        let memoryChanged = false;
        if (previousProcess) {
            const memoryDiff = Math.abs(process.memory_percent - previousProcess.memory_percent);
            memoryChanged = memoryDiff > 1; // 1% change threshold
        }
        
        // Add memory usage class based on percentage
        if (process.memory_percent > 10) {
            row.classList.add('table-danger');
        } else if (process.memory_percent > 5) {
            row.classList.add('table-warning');
        }
        
        // Add animation classes for new or changed processes
        if (isNew) {
            row.classList.add('new-process');
        } else if (memoryChanged) {
            row.classList.add('memory-changed');
        }
        
        // Create a progress bar color based on memory usage
        let progressBarClass = 'bg-success';
        if (process.memory_percent > 10) {
            progressBarClass = 'bg-danger';
        } else if (process.memory_percent > 5) {
            progressBarClass = 'bg-warning';
        }
        
        // Create a trend indicator if this process existed before
        let trendIndicator = '';
        if (previousProcess) {
            if (process.memory_percent > previousProcess.memory_percent + 0.5) {
                trendIndicator = '<i class="fas fa-arrow-up text-danger ms-1"></i>';
            } else if (process.memory_percent < previousProcess.memory_percent - 0.5) {
                trendIndicator = '<i class="fas fa-arrow-down text-success ms-1"></i>';
            }
        }
        
        row.innerHTML = `
            <td>${process.pid}</td>
            <td>
                <div class="d-flex align-items-center">
                    <span>${process.name}</span>
                    ${isNew ? '<span class="badge bg-info ms-2">New</span>' : ''}
                </div>
            </td>
            <td>${process.username}</td>
            <td>${formatBytes(process.memory_mb * 1024 * 1024)}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress flex-grow-1 me-2" style="height: 6px;">
                        <div class="progress-bar ${progressBarClass}" role="progressbar" 
                            style="width: ${process.memory_percent}%; transition: width 0.5s ease-in-out;" 
                            aria-valuenow="${process.memory_percent}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <span class="small">
                        ${process.memory_percent.toFixed(1)}%
                        ${trendIndicator}
                    </span>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // Update the process counter
    const processCounter = document.getElementById('process-counter');
    if (processCounter) {
        processCounter.textContent = processes.length;
        
        // Animate the counter if the number changed
        if (previousProcesses.length !== processes.length) {
            pulseElement(processCounter);
        }
    }
    
    // Store current processes for next comparison
    previousProcesses = [...processes];
}

/**
 * Show a loading overlay during data fetching operations
 * @param {boolean} show - Whether to show or hide the overlay
 */
function toggleLoadingOverlay(show) {
    let overlay = document.getElementById('loading-overlay');
    
    // Create overlay if it doesn't exist
    if (!overlay && show) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Add fade-in animation
        setTimeout(() => {
            overlay.classList.add('show');
        }, 10);
    } else if (overlay && !show) {
        // Fade out animation before removing
        overlay.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

/**
 * Refresh all data from the API
 */
function refreshData() {
    // Show loading spinner on refresh button
    refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...';
    refreshBtn.disabled = true;
    
    // Show quick pulse on the refresh status indicator
    const refreshStatus = document.getElementById('refresh-status');
    if (refreshStatus) {
        pulseElement(refreshStatus);
    }
    
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
