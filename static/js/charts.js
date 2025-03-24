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
