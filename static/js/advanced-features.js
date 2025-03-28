/**
 * Memory Tracker Advanced Features
 * Additional JavaScript functionality for the enhanced memory tracking features
 */

/**
 * Update the system information display
 * @param {Object} data - System information data from the API
 */
function updateSystemInfo(data) {
    // Update platform information
    const platformInfo = document.getElementById('platform-info');
    if (platformInfo) {
        platformInfo.textContent = `${data.platform} ${data.platform_version}`;
    }
    
    // Update CPU count
    const cpuCount = document.getElementById('cpu-count');
    if (cpuCount) {
        cpuCount.textContent = data.cpu_count;
    }
    
    // Update total memory
    const totalMemory = document.getElementById('total-memory-gb');
    if (totalMemory) {
        totalMemory.textContent = `${data.total_memory_gb} GB`;
    }
    
    // Update hostname
    const hostname = document.getElementById('hostname');
    if (hostname) {
        hostname.textContent = data.hostname;
    }
}

/**
 * Update the alerts display
 * @param {Array} alerts - Alerts from the API
 */
function updateAlerts(alerts) {
    const alertsContainer = document.getElementById('alerts-container');
    const alertsCounter = document.getElementById('alerts-counter');
    
    if (!alertsContainer) return;
    
    // Clear current alerts
    alertsContainer.innerHTML = '';
    
    // Update counter
    if (alertsCounter) {
        const activeAlerts = alerts.filter(alert => alert.level === 'critical');
        alertsCounter.textContent = activeAlerts.length;
        
        // Hide counter if no alerts
        if (activeAlerts.length === 0) {
            alertsCounter.style.display = 'none';
        } else {
            alertsCounter.style.display = 'inline-block';
            pulseElement(alertsCounter);
        }
    }
    
    // If no alerts, show a message
    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i> No alerts to display
            </div>
        `;
        return;
    }
    
    // Add alerts to container
    alerts.forEach(alert => {
        const alertElement = document.createElement('div');
        
        // Set alert class based on level
        let alertClass = 'alert-info';
        let icon = 'info-circle';
        
        if (alert.level === 'warning') {
            alertClass = 'alert-warning';
            icon = 'exclamation-circle';
        } else if (alert.level === 'critical') {
            alertClass = 'alert-danger';
            icon = 'exclamation-triangle';
        }
        
        alertElement.className = `alert ${alertClass} mb-3`;
        
        alertElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-${icon} me-2"></i>
                    <strong>${alert.type.toUpperCase()}:</strong> ${alert.message}
                </div>
                <small class="text-muted">${alert.timestamp}</small>
            </div>
        `;
        
        alertsContainer.appendChild(alertElement);
    });
}

/**
 * Check for potential memory leaks
 */
function checkMemoryLeaks() {
    const minGrowth = document.getElementById('min-growth').value || 20;
    const leaksTableBody = document.getElementById('leaks-table-body');
    
    if (!leaksTableBody) return;
    
    // Show loading indicator
    leaksTableBody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                Scanning for memory leaks...
            </td>
        </tr>
    `;
    
    // Fetch potential memory leaks
    fetch(`/api/memory/leaks?min_growth=${minGrowth}&min_time=120`)
        .then(response => response.json())
        .then(data => {
            // Clear table
            leaksTableBody.innerHTML = '';
            
            // If no leaks found, show a message
            if (data.length === 0) {
                leaksTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center">
                            <i class="fas fa-check-circle text-success me-2"></i>
                            No memory leaks detected with current settings.
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Add leak data to table
            data.forEach(leak => {
                const row = document.createElement('tr');
                
                // Add warning class for significant leaks
                if (leak.growth_percent > 50) {
                    row.className = 'table-danger';
                } else if (leak.growth_percent > 30) {
                    row.className = 'table-warning';
                }
                
                const timeInMinutes = Math.round(leak.tracking_seconds / 60);
                
                row.innerHTML = `
                    <td>${leak.pid}</td>
                    <td>${leak.name}</td>
                    <td>${leak.username}</td>
                    <td>${formatBytes(leak.start_memory_mb * 1024 * 1024)}</td>
                    <td>${formatBytes(leak.current_memory_mb * 1024 * 1024)}</td>
                    <td>
                        <span class="badge bg-danger">+${leak.growth_percent.toFixed(1)}%</span>
                    </td>
                    <td>${timeInMinutes} min</td>
                `;
                
                leaksTableBody.appendChild(row);
            });
            
            // Show toast notification
            showToast(`Found ${data.length} potential memory leaks`, 'warning');
        })
        .catch(error => {
            console.error('Error fetching memory leak data:', error);
            leaksTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Error scanning for memory leaks
                    </td>
                </tr>
            `;
        });
}

/**
 * Filter processes based on criteria
 */
function filterProcesses() {
    const username = document.getElementById('filter-username').value;
    const processName = document.getElementById('filter-process-name').value;
    const minMemory = document.getElementById('filter-min-memory').value;
    const filteredTableBody = document.getElementById('filtered-process-table-body');
    
    if (!filteredTableBody) return;
    
    // Show loading indicator
    filteredTableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                Filtering processes...
            </td>
        </tr>
    `;
    
    // Build query params
    let queryParams = [];
    if (username) queryParams.push(`username=${encodeURIComponent(username)}`);
    if (processName) queryParams.push(`name_contains=${encodeURIComponent(processName)}`);
    if (minMemory) queryParams.push(`min_memory=${encodeURIComponent(minMemory)}`);
    
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    
    // Fetch filtered processes
    fetch(`/api/memory/filter-processes${queryString}`)
        .then(response => response.json())
        .then(data => {
            // Clear table
            filteredTableBody.innerHTML = '';
            
            // If no processes found, show a message
            if (data.length === 0) {
                filteredTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center">
                            No processes match the filter criteria
                        </td>
                    </tr>
                `;
                return;
            }
            
            // Add processes to table
            data.forEach(process => {
                const row = document.createElement('tr');
                
                // Add class based on memory usage
                if (process.memory_percent > 10) {
                    row.className = 'table-danger';
                } else if (process.memory_percent > 5) {
                    row.className = 'table-warning';
                }
                
                row.innerHTML = `
                    <td>${process.pid}</td>
                    <td>${process.name}</td>
                    <td>${process.username}</td>
                    <td>${formatBytes(process.memory_mb * 1024 * 1024)}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="progress flex-grow-1 me-2" style="height: 6px;">
                                <div class="progress-bar ${process.memory_percent > 10 ? 'bg-danger' : process.memory_percent > 5 ? 'bg-warning' : 'bg-success'}"
                                    role="progressbar" style="width: ${process.memory_percent}%;" 
                                    aria-valuenow="${process.memory_percent}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                            <span>${process.memory_percent.toFixed(1)}%</span>
                        </div>
                    </td>
                `;
                
                filteredTableBody.appendChild(row);
            });
            
            // Show toast notification
            showToast(`Found ${data.length} processes matching criteria`, 'info');
        })
        .catch(error => {
            console.error('Error filtering processes:', error);
            filteredTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Error filtering processes
                    </td>
                </tr>
            `;
        });
}

/**
 * Fetch and display long-term history data
 * @param {string} period - 'daily' or 'hourly'
 */
function fetchLongTermHistory(period = 'daily') {
    const chart = document.getElementById('longTermHistoryChart');
    
    if (!chart) return;
    
    // Show loading state
    if (window.longTermHistoryChart) {
        window.longTermHistoryChart.data.datasets[0].data = [];
        window.longTermHistoryChart.data.datasets[1].data = [];
        window.longTermHistoryChart.data.labels = [];
        window.longTermHistoryChart.update();
    }
    
    // Fetch long-term history data
    fetch(`/api/memory/long-term?period=${period}`)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                // Show message if no data
                if (!window.longTermHistoryChart) {
                    window.longTermHistoryChart = new Chart(chart, {
                        type: 'line',
                        data: {
                            labels: ['No Data'],
                            datasets: [{
                                label: 'Memory Usage',
                                data: [0],
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                                borderWidth: 2,
                                tension: 0.3
                            }, {
                                label: 'Swap Usage',
                                data: [0],
                                borderColor: 'rgba(255, 159, 64, 1)',
                                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                                borderWidth: 2,
                                tension: 0.3
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'No long-term data available yet'
                                }
                            }
                        }
                    });
                }
                return;
            }
            
            // Prepare data for chart
            const labels = period === 'daily' 
                ? data.map(item => item.date)
                : data.map(item => item.timestamp);
                
            const memoryData = data.map(item => item.memory_percent);
            const swapData = data.map(item => item.swap_percent);
            
            // Create or update chart
            if (!window.longTermHistoryChart) {
                window.longTermHistoryChart = new Chart(chart, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Memory Usage',
                            data: memoryData,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true
                        }, {
                            label: 'Swap Usage',
                            data: swapData,
                            borderColor: 'rgba(255, 159, 64, 1)',
                            backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: period === 'daily' ? 'Daily Memory Usage Trends' : 'Hourly Memory Usage Trends'
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                ticks: {
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            }
                        }
                    }
                });
            } else {
                // Update existing chart
                window.longTermHistoryChart.data.labels = labels;
                window.longTermHistoryChart.data.datasets[0].data = memoryData;
                window.longTermHistoryChart.data.datasets[1].data = swapData;
                window.longTermHistoryChart.options.plugins.title.text = 
                    period === 'daily' ? 'Daily Memory Usage Trends' : 'Hourly Memory Usage Trends';
                window.longTermHistoryChart.update();
            }
        })
        .catch(error => {
            console.error(`Error fetching ${period} history:`, error);
        });
}

/**
 * Export memory data
 * @param {string} format - 'json' or 'csv'
 */
function exportMemoryData(format) {
    // Show export modal
    const exportModal = new bootstrap.Modal(document.getElementById('exportModal'));
    exportModal.show();
    
    // Reset modal state
    document.getElementById('export-status').classList.remove('d-none');
    document.getElementById('export-result').classList.add('d-none');
    document.getElementById('export-error').classList.add('d-none');
    
    // Perform export
    fetch(`/api/memory/export?format=${format}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Hide status, show result
            document.getElementById('export-status').classList.add('d-none');
            document.getElementById('export-result').classList.remove('d-none');
            
            // Update result message
            document.getElementById('export-message').textContent = data.message;
            
            // Set download link
            const downloadBtn = document.getElementById('download-export-btn');
            downloadBtn.href = `/exports/${data.filename.split('/').pop()}`;
            
            // Set filename for download
            downloadBtn.setAttribute('download', data.filename.split('/').pop());
        })
        .catch(error => {
            console.error('Error exporting data:', error);
            
            // Hide status, show error
            document.getElementById('export-status').classList.add('d-none');
            document.getElementById('export-error').classList.remove('d-none');
            
            // Update error message
            document.getElementById('export-error-message').textContent = 
                error.message || 'An error occurred during export';
        });
}

// Initialize advanced features
document.addEventListener('DOMContentLoaded', function() {
    // Tab change handling
    const memoryTabs = document.getElementById('memoryTabs');
    if (memoryTabs) {
        memoryTabs.addEventListener('shown.bs.tab', function(event) {
            // Get the newly activated tab
            const activeTab = event.target.id;
            
            // Handle specific tabs
            if (activeTab === 'longterm-tab') {
                fetchLongTermHistory('daily');
            }
        });
    }
    
    // Export buttons
    const exportJsonBtn = document.getElementById('export-json-btn');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', function(e) {
            e.preventDefault();
            exportMemoryData('json');
        });
    }
    
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', function(e) {
            e.preventDefault();
            exportMemoryData('csv');
        });
    }
    
    // Memory leak check button
    const checkLeaksBtn = document.getElementById('check-leaks-btn');
    if (checkLeaksBtn) {
        checkLeaksBtn.addEventListener('click', checkMemoryLeaks);
    }
    
    // Process filter button
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', filterProcesses);
    }
    
    // Long-term history period buttons
    const dailyViewBtn = document.getElementById('daily-view-btn');
    const hourlyViewBtn = document.getElementById('hourly-view-btn');
    
    if (dailyViewBtn && hourlyViewBtn) {
        dailyViewBtn.addEventListener('click', function() {
            dailyViewBtn.classList.add('btn-primary');
            dailyViewBtn.classList.remove('btn-secondary');
            hourlyViewBtn.classList.add('btn-secondary');
            hourlyViewBtn.classList.remove('btn-primary');
            fetchLongTermHistory('daily');
        });
        
        hourlyViewBtn.addEventListener('click', function() {
            hourlyViewBtn.classList.add('btn-primary');
            hourlyViewBtn.classList.remove('btn-secondary');
            dailyViewBtn.classList.add('btn-secondary');
            dailyViewBtn.classList.remove('btn-primary');
            fetchLongTermHistory('hourly');
        });
    }
    
    // Alert filter toggle
    const showActiveAlertsOnly = document.getElementById('show-active-alerts-only');
    if (showActiveAlertsOnly) {
        showActiveAlertsOnly.addEventListener('change', function() {
            // Refresh alerts data
            const showActive = this.checked;
            
            fetch(`/api/memory/alerts?active_only=${showActive}`)
                .then(response => response.json())
                .then(data => {
                    updateAlerts(data);
                })
                .catch(error => {
                    console.error('Error fetching alerts data:', error);
                });
        });
    }
    
    // Initialize paging and segmentation tabs if present
    initMemorySimulations();
});

/**
 * Initialize memory management simulation UI
 */
function initMemorySimulations() {
    // Set up event listeners for simulation tabs
    const pagingTabButton = document.getElementById('paging-simulation-tab');
    const segmentationTabButton = document.getElementById('segmentation-simulation-tab');
    
    if (pagingTabButton) {
        pagingTabButton.addEventListener('click', function() {
            fetchPagingSimulation();
        });
    }
    
    if (segmentationTabButton) {
        segmentationTabButton.addEventListener('click', function() {
            fetchSegmentationSimulation();
        });
    }
    
    // Set up page size selector for paging simulation
    const pageSizeSelector = document.getElementById('page-size-selector');
    if (pageSizeSelector) {
        pageSizeSelector.addEventListener('change', function() {
            fetchPagingSimulation(this.value);
        });
    }
}

/**
 * Fetch paging simulation data from the API
 * @param {number} pageSize - Size of memory pages in KB
 */
function fetchPagingSimulation(pageSize = 4) {
    const pagingContainer = document.getElementById('paging-simulation-container');
    
    if (!pagingContainer) return;
    
    // Show loading state
    pagingContainer.innerHTML = `
        <div class="text-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading paging simulation...</p>
        </div>
    `;
    
    // Fetch simulation data
    fetch(`/api/memory/paging?page_size=${pageSize}`)
        .then(response => response.json())
        .then(data => {
            renderPagingSimulation(data, pagingContainer);
        })
        .catch(error => {
            console.error('Error fetching paging simulation:', error);
            pagingContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error loading paging simulation
                </div>
            `;
        });
}

/**
 * Render paging simulation data
 * @param {Object} data - Paging simulation data from API
 * @param {HTMLElement} container - Container element to render into
 */
function renderPagingSimulation(data, container) {
    // Create summary
    const summary = `
        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="card-title mb-0">Memory Paging Overview</h5>
                <span class="badge bg-primary">${data.timestamp}</span>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-3">
                        <div class="card text-white bg-info mb-3">
                            <div class="card-body text-center">
                                <h5 class="card-title">Page Size</h5>
                                <p class="card-text display-6">${data.page_size_kb} KB</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-primary mb-3">
                            <div class="card-body text-center">
                                <h5 class="card-title">Total Pages</h5>
                                <p class="card-text display-6">${data.total_pages.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-success mb-3">
                            <div class="card-body text-center">
                                <h5 class="card-title">Used Pages</h5>
                                <p class="card-text display-6">${data.used_pages.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-secondary mb-3">
                            <div class="card-body text-center">
                                <h5 class="card-title">Free Pages</h5>
                                <p class="card-text display-6">${data.free_pages.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="progress mt-3" style="height: 30px;">
                    <div class="progress-bar bg-success" role="progressbar" 
                         style="width: ${(data.used_pages / data.total_pages) * 100}%;" 
                         aria-valuenow="${data.used_pages}" aria-valuemin="0" aria-valuemax="${data.total_pages}">
                        Used: ${Math.round((data.used_pages / data.total_pages) * 100)}%
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Create page table visualization
    let pageTableHTML = `
        <div class="card mb-4">
            <div class="card-header">
                <h5 class="card-title mb-0">Page Table</h5>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-hover">
                        <thead>
                            <tr>
                                <th>Process</th>
                                <th>PID</th>
                                <th>Memory</th>
                                <th>Pages</th>
                                <th>Allocation</th>
                                <th>Page Faults</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    // Add rows for each process
    for (const [pid, process] of Object.entries(data.page_table)) {
        const hasFault = data.page_faults[pid] ? true : false;
        
        pageTableHTML += `
            <tr class="${hasFault ? 'table-warning' : ''}">
                <td>${process.process_name}</td>
                <td>${pid}</td>
                <td>${process.memory_mb.toFixed(2)} MB</td>
                <td>${process.total_pages}</td>
                <td>
                    ${process.page_locations.length > 10 
                        ? `${process.page_locations.length} locations (${process.page_locations.length === process.total_pages ? 'contiguous' : 'fragmented'})`
                        : process.page_locations.join(', ')
                    }
                </td>
                <td>
                    ${hasFault 
                        ? `<span class="badge bg-warning text-dark">
                            <i class="fas fa-exclamation-triangle me-1"></i>
                            ${data.page_faults[pid].fault_count} faults (${data.page_faults[pid].fault_type})
                           </span>` 
                        : '<span class="badge bg-success">None</span>'
                    }
                </td>
            </tr>
        `;
    }
    
    pageTableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    // Create page fault visualization
    const pageFaultCount = Object.keys(data.page_faults).length;
    let pageFaultHTML = '';
    
    if (pageFaultCount > 0) {
        pageFaultHTML = `
            <div class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">Page Faults</h5>
                    <span class="badge bg-warning text-dark">${pageFaultCount} processes with faults</span>
                </div>
                <div class="card-body">
                    <div class="row">
                        ${Object.entries(data.page_faults).map(([pid, faultData]) => `
                            <div class="col-md-4 mb-3">
                                <div class="card">
                                    <div class="card-header bg-warning text-dark">
                                        <strong>${faultData.process_name}</strong> (PID: ${pid})
                                    </div>
                                    <div class="card-body">
                                        <p><strong>Fault type:</strong> ${faultData.fault_type}</p>
                                        <p><strong>Page number:</strong> ${faultData.page_number}</p>
                                        <p><strong>Fault count:</strong> ${faultData.fault_count}</p>
                                        <div class="progress mt-2" style="height: 5px;">
                                            <div class="progress-bar bg-danger" style="width: ${Math.min(100, faultData.fault_count * 10)}%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Create swap space visualization
    let swapHTML = '';
    if (data.swap_status.active) {
        swapHTML = `
            <div class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">Swap Space Activity</h5>
                    <span class="badge bg-info">${data.swap_status.pages_swapped.toLocaleString()} pages swapped</span>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6 class="border-bottom pb-2">Recently Swapped Out</h6>
                            <ul class="list-group">
                                ${data.swap_status.recently_swapped_out.map(swap => `
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        ${swap.process_name} (PID: ${swap.pid})
                                        <span class="badge bg-danger rounded-pill">${swap.pages} pages</span>
                                    </li>
                                `).join('') || '<li class="list-group-item">No recent swap-out activity</li>'}
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <h6 class="border-bottom pb-2">Recently Swapped In</h6>
                            <ul class="list-group">
                                ${data.swap_status.recently_swapped_in.map(swap => `
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        ${swap.process_name} (PID: ${swap.pid})
                                        <span class="badge bg-success rounded-pill">${swap.pages} pages</span>
                                    </li>
                                `).join('') || '<li class="list-group-item">No recent swap-in activity</li>'}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Assemble complete visualization
    container.innerHTML = summary + pageTableHTML + pageFaultHTML + swapHTML + 
        `<div class="text-muted small mt-4">
            <i class="fas fa-info-circle me-1"></i>
            This simulation is based on actual system memory data but uses simulated paging structures
            for educational purposes. Page faults are randomly simulated.
        </div>`;
}

/**
 * Fetch segmentation simulation data from the API
 */
function fetchSegmentationSimulation() {
    const segmentationContainer = document.getElementById('segmentation-simulation-container');
    
    if (!segmentationContainer) return;
    
    // Show loading state
    segmentationContainer.innerHTML = `
        <div class="text-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading segmentation simulation...</p>
        </div>
    `;
    
    // Fetch simulation data
    fetch('/api/memory/segmentation')
        .then(response => response.json())
        .then(data => {
            renderSegmentationSimulation(data, segmentationContainer);
        })
        .catch(error => {
            console.error('Error fetching segmentation simulation:', error);
            segmentationContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    Error loading segmentation simulation
                </div>
            `;
        });
}

/**
 * Render segmentation simulation data
 * @param {Object} data - Segmentation simulation data from API
 * @param {HTMLElement} container - Container element to render into
 */
function renderSegmentationSimulation(data, container) {
    // Create summary card
    const summary = `
        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="card-title mb-0">Memory Segmentation Overview</h5>
                <span class="badge bg-primary">${data.timestamp}</span>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-3">
                        <div class="card text-white bg-primary mb-3">
                            <div class="card-body text-center">
                                <h5 class="card-title">Total Memory</h5>
                                <p class="card-text display-6">${data.total_memory_mb.toFixed(1)} MB</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-success mb-3">
                            <div class="card-body text-center">
                                <h5 class="card-title">Allocated</h5>
                                <p class="card-text display-6">${data.allocated_memory_mb.toFixed(1)} MB</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-secondary mb-3">
                            <div class="card-body text-center">
                                <h5 class="card-title">Free Memory</h5>
                                <p class="card-text display-6">${data.free_memory_mb.toFixed(1)} MB</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-white bg-warning mb-3">
                            <div class="card-body text-center">
                                <h5 class="card-title">Fragmentation</h5>
                                <p class="card-text display-6">${data.external_fragmentation.fragmentation_percent.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="progress mt-3" style="height: 30px;">
                    <div class="progress-bar bg-success" role="progressbar" 
                         style="width: ${(data.allocated_memory_mb / data.total_memory_mb) * 100}%;" 
                         aria-valuenow="${data.allocated_memory_mb}" aria-valuemin="0" aria-valuemax="${data.total_memory_mb}">
                        Allocated: ${Math.round((data.allocated_memory_mb / data.total_memory_mb) * 100)}%
                    </div>
                    <div class="progress-bar bg-warning" role="progressbar" 
                         style="width: ${(data.external_fragmentation.total_fragmentation_mb / data.total_memory_mb) * 100}%;" 
                         aria-valuenow="${data.external_fragmentation.total_fragmentation_mb}" aria-valuemin="0" aria-valuemax="${data.total_memory_mb}">
                        Fragments: ${Math.round((data.external_fragmentation.total_fragmentation_mb / data.total_memory_mb) * 100)}%
                    </div>
                </div>
                
                <div class="mt-3 text-center">
                    <div class="d-flex justify-content-between mb-1 small">
                        <span>Largest Free Block: ${data.largest_free_block_mb.toFixed(1)} MB</span>
                        <span>Memory Pressure: ${data.memory_pressure.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Create segmentation visualization
    let processSegmentsHTML = '';
    
    // Build process segments
    for (const [pid, processData] of Object.entries(data.segmentation_table)) {
        const segments = processData.segments;
        
        const segmentBars = `
            <div class="segments-visualization mb-3">
                <div class="d-flex">
                    ${segments.code ? `
                        <div class="segment-block code-segment" style="width: ${(segments.code.size_mb / processData.total_memory_mb) * 100}%;">
                            <div class="segment-label">Code: ${segments.code.size_mb} MB</div>
                        </div>
                    ` : ''}
                    
                    ${segments.data ? `
                        <div class="segment-block data-segment" style="width: ${(segments.data.size_mb / processData.total_memory_mb) * 100}%;">
                            <div class="segment-label">Data: ${segments.data.size_mb} MB</div>
                        </div>
                    ` : ''}
                    
                    ${segments.stack ? `
                        <div class="segment-block stack-segment" style="width: ${(segments.stack.size_mb / processData.total_memory_mb) * 100}%;">
                            <div class="segment-label">Stack: ${segments.stack.size_mb} MB</div>
                        </div>
                    ` : ''}
                    
                    ${segments.heap ? `
                        <div class="segment-block heap-segment" style="width: ${(segments.heap.size_mb / processData.total_memory_mb) * 100}%;">
                            <div class="segment-label">Heap: ${segments.heap.size_mb} MB</div>
                        </div>
                    ` : ''}
                    
                    ${segments.shared_libraries ? `
                        <div class="segment-block shared-segment" style="width: ${(segments.shared_libraries.size_mb / processData.total_memory_mb) * 100}%;">
                            <div class="segment-label">Shared Libs (${segments.shared_libraries.count}): ${segments.shared_libraries.size_mb} MB</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Create segment tables
        const segmentDetails = `
            <div class="mt-2 small">
                <table class="table table-sm table-bordered">
                    <thead>
                        <tr>
                            <th>Segment</th>
                            <th>Size (MB)</th>
                            <th>Base Address</th>
                            <th>Protection</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${segments.code ? `
                            <tr>
                                <td>Code</td>
                                <td>${segments.code.size_mb}</td>
                                <td>${segments.code.base_address}</td>
                                <td><span class="badge bg-info">${segments.code.protection}</span></td>
                                <td>-</td>
                            </tr>
                        ` : ''}
                        
                        ${segments.data ? `
                            <tr>
                                <td>Data</td>
                                <td>${segments.data.size_mb}</td>
                                <td>${segments.data.base_address}</td>
                                <td><span class="badge bg-primary">${segments.data.protection}</span></td>
                                <td>-</td>
                            </tr>
                        ` : ''}
                        
                        ${segments.stack ? `
                            <tr>
                                <td>Stack</td>
                                <td>${segments.stack.size_mb}</td>
                                <td>${segments.stack.base_address}</td>
                                <td><span class="badge bg-primary">${segments.stack.protection}</span></td>
                                <td>
                                    ${segments.stack.growth_direction} growth,
                                    ${segments.stack.current_usage_percent}% used
                                </td>
                            </tr>
                        ` : ''}
                        
                        ${segments.heap ? `
                            <tr>
                                <td>Heap</td>
                                <td>${segments.heap.size_mb}</td>
                                <td>${segments.heap.base_address}</td>
                                <td><span class="badge bg-primary">${segments.heap.protection}</span></td>
                                <td>
                                    ${segments.heap.growth_direction} growth,
                                    ${segments.heap.current_usage_percent}% used,
                                    ${segments.heap.fragmentation_percent}% fragmented
                                </td>
                            </tr>
                        ` : ''}
                        
                        ${segments.shared_libraries ? `
                            <tr>
                                <td>Shared Libraries</td>
                                <td>${segments.shared_libraries.size_mb}</td>
                                <td>various</td>
                                <td><span class="badge bg-info">${segments.shared_libraries.protection}</span></td>
                                <td>${segments.shared_libraries.count} libraries</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
        
        processSegmentsHTML += `
            <div class="card mb-3">
                <div class="card-header">
                    <h6 class="mb-0">${processData.process_name} (PID: ${pid})</h6>
                </div>
                <div class="card-body">
                    ${segmentBars}
                    ${segmentDetails}
                </div>
            </div>
        `;
    }
    
    // Create fragmentation visualization
    let fragmentationHTML = '';
    if (data.external_fragmentation.fragments.length > 0) {
        fragmentationHTML = `
            <div class="card mb-4">
                <div class="card-header">
                    <h5 class="card-title mb-0">Memory Fragmentation</h5>
                </div>
                <div class="card-body">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>External Fragmentation: ${data.external_fragmentation.fragmentation_percent.toFixed(1)}%</strong>
                        (${data.external_fragmentation.total_fragmentation_mb.toFixed(1)} MB in ${data.external_fragmentation.fragments.length} fragments)
                    </div>
                    
                    <h6>Fragment Details:</h6>
                    <div class="table-responsive">
                        <table class="table table-striped table-sm">
                            <thead>
                                <tr>
                                    <th>Start Address</th>
                                    <th>Size (MB)</th>
                                    <th>Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.external_fragmentation.fragments.map(fragment => `
                                    <tr>
                                        <td>${fragment.start_address.toFixed(1)}</td>
                                        <td>${fragment.size_mb}</td>
                                        <td>${fragment.location}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Combine all HTML
    container.innerHTML = `
        <style>
            .segment-block {
                height: 40px;
                margin-right: 2px;
                border-radius: 3px;
                position: relative;
                min-width: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 0.75rem;
                overflow: hidden;
            }
            
            .segment-label {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding: 0 5px;
            }
            
            .code-segment { background-color: #6610f2; }
            .data-segment { background-color: #0d6efd; }
            .stack-segment { background-color: #198754; }
            .heap-segment { background-color: #dc3545; }
            .shared-segment { background-color: #6c757d; }
        </style>
        
        ${summary}
        
        <div class="mb-4">
            <h5>Process Segmentation</h5>
            ${processSegmentsHTML}
        </div>
        
        ${fragmentationHTML}
        
        <div class="text-muted small mt-4">
            <i class="fas fa-info-circle me-1"></i>
            This simulation uses real memory data but creates a simulated segmentation structure 
            for educational purposes. Segment sizes are approximate and based on typical distributions.
        </div>
    `;
}