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
