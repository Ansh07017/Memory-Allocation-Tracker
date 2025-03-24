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
});