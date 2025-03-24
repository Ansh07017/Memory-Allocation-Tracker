/**
 * Charts module for the Memory Tracker
 * Handles initialization and updating of all charts
 */

// Global chart objects
let memoryPieChart = null;
let memoryHistoryChart = null;

/**
 * Initialize all charts with default/empty data
 */
function initCharts() {
    // Initialize memory distribution pie chart
    const pieCtx = document.getElementById('memoryPieChart').getContext('2d');
    memoryPieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['Used', 'Free', 'Cached', 'Buffers'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });

    // Initialize memory history line chart
    const historyCtx = document.getElementById('memoryHistoryChart').getContext('2d');
    memoryHistoryChart = new Chart(historyCtx, {
        type: 'line',
        data: {
            labels: [], // Timeline labels will be populated from the API
            datasets: [
                {
                    label: 'RAM Usage %',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    tension: 0.2,
                    fill: true
                },
                {
                    label: 'Swap Usage %',
                    data: [],
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 2,
                    tension: 0.2,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Usage %'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    position: 'top',
                }
            },
            interaction: {
                mode: 'nearest',
                intersect: false,
            }
        }
    });
}

/**
 * Update the pie chart with current memory distribution data
 * @param {Object} memoryData - Memory data from the API
 */
function updateMemoryPieChart(memoryData) {
    if (!memoryPieChart) return;
    
    // Extract values for the pie chart
    // Note: We use the actual byte values, not percentages
    const used = memoryData.used - (memoryData.buffers + memoryData.cached);
    const free = memoryData.free;
    const cached = memoryData.cached;
    const buffers = memoryData.buffers;
    
    // Update chart data
    memoryPieChart.data.datasets[0].data = [used, free, cached, buffers];
    memoryPieChart.update();
}

/**
 * Update the history chart with timeline data
 * @param {Object} historyData - History data from the API
 */
function updateMemoryHistoryChart(historyData) {
    if (!memoryHistoryChart) return;
    
    // Extract data for the memory history chart
    const timestamps = historyData.timestamps;
    const memoryPercents = historyData.memory.map(m => m.percent);
    const swapPercents = historyData.swap.map(s => s.percent);
    
    // Update chart data
    memoryHistoryChart.data.labels = timestamps;
    memoryHistoryChart.data.datasets[0].data = memoryPercents;
    memoryHistoryChart.data.datasets[1].data = swapPercents;
    memoryHistoryChart.update();
}

/**
 * Create a bar chart showing top process memory usage
 * This function is kept separate as it might be used in a modal or separate view
 * @param {Array} processData - Process memory usage data
 * @param {String} canvasId - ID of the canvas element
 */
function createProcessMemoryChart(processData, canvasId) {
    // Sort processes by memory percentage in descending order
    processData.sort((a, b) => b.memory_percent - a.memory_percent);
    
    // Take only top 10 processes
    const topProcesses = processData.slice(0, 10);
    
    // Prepare data for chart
    const labels = topProcesses.map(p => p.name);
    const memoryPercents = topProcesses.map(p => p.memory_percent);
    
    // Get the canvas context
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Create the chart
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Memory Usage (%)',
                data: memoryPercents,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',  // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Memory Usage (%)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * Create and update memory growth chart for potential leaks
 * @param {Array} leakData - Process memory growth data
 * @param {String} canvasId - ID of the canvas element
 */
function createMemoryGrowthChart(leakData, canvasId) {
    // Sort processes by growth percentage in descending order
    leakData.sort((a, b) => b.growth_percent - a.growth_percent);
    
    // Take only top 8 processes with highest growth
    const topLeaks = leakData.slice(0, 8);
    
    // Prepare data for chart
    const labels = topLeaks.map(p => `${p.name} (${p.pid})`);
    const growthPercents = topLeaks.map(p => p.growth_percent);
    
    // Color coding based on growth percentage
    const backgroundColors = growthPercents.map(percent => 
        percent > 50 ? 'rgba(255, 99, 132, 0.6)' : 
        percent > 30 ? 'rgba(255, 159, 64, 0.6)' : 
        'rgba(54, 162, 235, 0.6)'
    );
    
    const borderColors = growthPercents.map(percent => 
        percent > 50 ? 'rgba(255, 99, 132, 1)' : 
        percent > 30 ? 'rgba(255, 159, 64, 1)' : 
        'rgba(54, 162, 235, 1)'
    );
    
    // Get the canvas context
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Create the chart
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Memory Growth (%)',
                data: growthPercents,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',  // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Growth Rate (%)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const leak = topLeaks[context.dataIndex];
                            const startMemory = formatBytes(leak.start_memory_mb * 1024 * 1024);
                            const currentMemory = formatBytes(leak.current_memory_mb * 1024 * 1024);
                            return [
                                `Growth: ${leak.growth_percent.toFixed(1)}%`,
                                `Initial: ${startMemory}`,
                                `Current: ${currentMemory}`,
                                `Time: ${Math.round(leak.tracking_seconds / 60)} min`
                            ];
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create and update memory allocation heatmap
 * @param {Array} allocationData - Memory allocation history data
 * @param {String} canvasId - ID of the canvas element
 */
function createMemoryHeatmap(allocationData, canvasId) {
    // This is a placeholder for a more complex heatmap visualization
    // We'll use a basic line chart with gradient coloring for now
    
    // Extract data for the chart
    const timestamps = allocationData.map(item => item.timestamp);
    const allocValues = allocationData.map(item => item.allocation_mb);
    
    // Get min/max for color scaling
    const minValue = Math.min(...allocValues);
    const maxValue = Math.max(...allocValues);
    
    // Get the canvas context
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Create gradient based on memory pressure
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(255, 99, 132, 1)');   // High pressure (red)
    gradient.addColorStop(0.5, 'rgba(255, 205, 86, 1)'); // Medium pressure (yellow)
    gradient.addColorStop(1, 'rgba(75, 192, 192, 1)');   // Low pressure (green)
    
    // Create the chart
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [{
                label: 'Memory Allocation (MB)',
                data: allocValues,
                borderColor: gradient,
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: function(context) {
                    const value = context.dataset.data[context.dataIndex];
                    const ratio = (value - minValue) / (maxValue - minValue);
                    if (ratio > 0.66) return 'rgba(255, 99, 132, 1)';
                    if (ratio > 0.33) return 'rgba(255, 205, 86, 1)';
                    return 'rgba(75, 192, 192, 1)';
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Memory (MB)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            }
        }
    });
}

/**
 * Format bytes to human-readable format (imported from dashboard.js)
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
 * Create a column chart displaying memory usage for common applications
 * @param {Array} appData - Data for common applications memory usage
 * @param {String} canvasId - ID of the canvas element
 */
function createApplicationsMemoryChart(appData, canvasId) {
    // The application data we want to display
    const targetApps = ['chrome', 'firefox', 'msedge', 'word', 'excel', 'outlook', 'teams', 'code', 'spotify', 'zoom', 'slack', 'discord'];
    
    // Filter and aggregate data for target applications
    const appMemoryData = {};
    const chartData = [];
    const chartLabels = [];
    const chartColors = [];
    
    // Map of app name patterns to display names and colors
    const appDisplayNames = {
        'chrome': { name: 'Chrome', color: 'rgba(66, 133, 244, 0.8)' },
        'firefox': { name: 'Firefox', color: 'rgba(255, 117, 24, 0.8)' },
        'msedge': { name: 'Edge', color: 'rgba(0, 120, 212, 0.8)' },
        'word': { name: 'MS Word', color: 'rgba(43, 87, 154, 0.8)' },
        'excel': { name: 'MS Excel', color: 'rgba(33, 115, 70, 0.8)' },
        'outlook': { name: 'Outlook', color: 'rgba(0, 120, 212, 0.8)' },
        'teams': { name: 'MS Teams', color: 'rgba(92, 45, 145, 0.8)' },
        'code': { name: 'VS Code', color: 'rgba(0, 122, 204, 0.8)' },
        'spotify': { name: 'Spotify', color: 'rgba(30, 215, 96, 0.8)' },
        'zoom': { name: 'Zoom', color: 'rgba(74, 144, 226, 0.8)' },
        'slack': { name: 'Slack', color: 'rgba(74, 21, 75, 0.8)' },
        'discord': { name: 'Discord', color: 'rgba(114, 137, 218, 0.8)' },
        'linkedin': { name: 'LinkedIn', color: 'rgba(0, 119, 181, 0.8)' }
    };
    
    // Add LinkedIn to the targetApps
    targetApps.push('linkedin');
    
    // First pass - find all process names that match our targets
    appData.forEach(process => {
        const processNameLower = process.name.toLowerCase();
        
        // Check if this process matches any of our target apps
        for (const app of targetApps) {
            if (processNameLower.includes(app)) {
                // If we haven't seen this app yet, initialize it
                if (!appMemoryData[app]) {
                    appMemoryData[app] = {
                        totalMemoryMb: 0,
                        processCount: 0,
                        displayName: appDisplayNames[app]?.name || app.charAt(0).toUpperCase() + app.slice(1),
                        color: appDisplayNames[app]?.color || 'rgba(128, 128, 128, 0.8)'
                    };
                }
                
                // Add this process's memory to the app's total
                appMemoryData[app].totalMemoryMb += process.memory_mb;
                appMemoryData[app].processCount += 1;
                
                // We found a match, no need to check other app names
                break;
            }
        }
    });
    
    // Convert our aggregated data into arrays for the chart
    for (const [app, data] of Object.entries(appMemoryData)) {
        if (data.totalMemoryMb > 0) {
            chartLabels.push(data.displayName);
            chartData.push(data.totalMemoryMb);
            chartColors.push(data.color);
        }
    }
    
    // If no target apps were found, add the top 5 most memory-intensive processes
    if (chartLabels.length === 0) {
        // Copy and sort processes by memory usage (descending)
        const sortedProcesses = [...appData].sort((a, b) => b.memory_mb - a.memory_mb);
        
        // Take the top 5
        const topProcesses = sortedProcesses.slice(0, 5);
        
        // Add them to our chart data
        topProcesses.forEach((process, index) => {
            // Generate a unique color based on index
            const hue = (index * 50) % 360;
            const color = `hsla(${hue}, 70%, 60%, 0.8)`;
            
            chartLabels.push(process.name);
            chartData.push(process.memory_mb);
            chartColors.push(color);
            
            // Also add to appMemoryData for tooltip access
            appMemoryData[process.name] = {
                totalMemoryMb: process.memory_mb,
                processCount: 1,
                displayName: process.name,
                color: color
            };
        });
    }
    
    // Sort data by memory usage (descending)
    const sortedIndices = chartData.map((value, index) => index)
        .sort((a, b) => chartData[b] - chartData[a]);
    
    const sortedLabels = sortedIndices.map(index => chartLabels[index]);
    const sortedData = sortedIndices.map(index => chartData[index]);
    const sortedColors = sortedIndices.map(index => chartColors[index]);
    
    // Get the canvas context
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Create the chart
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedLabels,
            datasets: [{
                label: 'Memory Usage (MB)',
                data: sortedData,
                backgroundColor: sortedColors,
                borderColor: sortedColors.map(color => color.replace('0.8', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Memory (MB)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            // Map sorted index back to app name
                            const appName = sortedLabels[context.dataIndex];
                            
                            // Find the app data
                            let appData = null;
                            for (const [app, data] of Object.entries(appMemoryData)) {
                                if (data.displayName === appName) {
                                    appData = data;
                                    break;
                                }
                            }
                            
                            if (appData) {
                                return [
                                    `Memory: ${formatBytes(appData.totalMemoryMb * 1024 * 1024)}`,
                                    `Processes: ${appData.processCount}`
                                ];
                            } else {
                                return `Memory: ${formatBytes(context.raw * 1024 * 1024)}`;
                            }
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create and update memory fragmentation chart
 * @param {Object} fragmentationData - Memory fragmentation data
 * @param {String} canvasId - ID of the canvas element
 */
function createFragmentationChart(fragmentationData, canvasId) {
    // Prepare data for chart
    const labels = ['Small (<1KB)', 'Medium (1KB-1MB)', 'Large (>1MB)'];
    const counts = [
        fragmentationData.small_blocks_count,
        fragmentationData.medium_blocks_count,
        fragmentationData.large_blocks_count
    ];
    const sizes = [
        fragmentationData.small_blocks_mb,
        fragmentationData.medium_blocks_mb,
        fragmentationData.large_blocks_mb
    ];
    
    // Get the canvas context
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Create the chart
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Block Count',
                    data: counts,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Total Size (MB)',
                    data: sizes,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Block Count'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Size (MB)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}
