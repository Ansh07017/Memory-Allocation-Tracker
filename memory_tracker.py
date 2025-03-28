import psutil
import time
import os
import json
import platform
import csv
import random
from datetime import datetime, timedelta
import logging
from collections import deque, defaultdict
import threading
import statistics
import math

logger = logging.getLogger(__name__)

class MemoryTracker:
    def __init__(self, history_minutes=5, sample_interval=1, 
                 long_term_history_days=7, alert_threshold=80,
                 export_dir='./exports'):
        """
        Initialize the memory tracker.
        
        Args:
            history_minutes: How many minutes of history to keep in real-time display
            sample_interval: How often to sample memory (in seconds)
            long_term_history_days: How many days of history to keep for trend analysis
            alert_threshold: Percentage threshold for memory alerts
            export_dir: Directory to store exported data
        """
        self.history_minutes = history_minutes
        self.sample_interval = sample_interval
        self.max_samples = int((history_minutes * 60) / sample_interval)
        self.alert_threshold = alert_threshold
        self.export_dir = export_dir
        self.long_term_history_days = long_term_history_days
        
        # Create export directory if it doesn't exist
        if not os.path.exists(export_dir):
            os.makedirs(export_dir)
        
        # Initialize history storage
        self.memory_history = deque(maxlen=self.max_samples)
        self.swap_history = deque(maxlen=self.max_samples)
        self.timestamps = deque(maxlen=self.max_samples)
        
        # Initialize process history tracking - for memory leak detection
        self.process_history = {}  # pid -> {timestamps: [], memory_usage: []}
        
        # Long-term storage (hourly averages)
        self.hourly_memory_data = []
        self.daily_memory_data = []
        self.last_hourly_store = datetime.now()
        self.last_daily_store = datetime.now()
        
        # System information
        self.system_info = {
            'platform': platform.system(),
            'platform_version': platform.version(),
            'cpu_count': psutil.cpu_count(logical=True),
            'hostname': platform.node()
        }
        
        # Alert history
        self.active_alerts = []
        self.alert_history = deque(maxlen=100)
        
        # Virtual memory types available
        self.virtual_memory_available = True
        
        # Start background collection thread
        self.running = True
        self.collector_thread = threading.Thread(target=self._collector_loop)
        self.collector_thread.daemon = True
        self.collector_thread.start()
        
        logger.debug(f"Memory tracker initialized with {history_minutes} min history and {sample_interval}s interval")

    def _collector_loop(self):
        """Background thread that collects memory data at regular intervals."""
        while self.running:
            try:
                # Get memory data
                memory = psutil.virtual_memory()
                swap = psutil.swap_memory()
                now = datetime.now()
                
                # Store in history
                mem_data = {
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'free': memory.free,
                    'percent': memory.percent,
                    'buffers': getattr(memory, 'buffers', 0),
                    'cached': getattr(memory, 'cached', 0),
                }
                self.memory_history.append(mem_data)
                
                swap_data = {
                    'total': swap.total,
                    'used': swap.used,
                    'free': swap.free,
                    'percent': swap.percent,
                }
                self.swap_history.append(swap_data)
                
                self.timestamps.append(now.strftime('%H:%M:%S'))
                
                # Check for alerts based on thresholds
                self._check_alerts(memory, swap)
                
                # Collect top process data for memory leak detection
                if len(self.timestamps) % 5 == 0:  # Every 5 intervals to reduce overhead
                    self._update_process_history()
                
                # Store hourly averages (for long-term history)
                if (now - self.last_hourly_store).total_seconds() >= 3600:  # 1 hour
                    self._store_hourly_average(now)
                    
                # Store daily averages
                if (now - self.last_daily_store).total_seconds() >= 86400:  # 1 day
                    self._store_daily_average(now)
                    self._cleanup_old_data()
                
            except Exception as e:
                logger.error(f"Error collecting memory data: {str(e)}")
            
            # Sleep until next collection
            time.sleep(self.sample_interval)
            
    def _check_alerts(self, memory, swap):
        """Check memory and swap usage against thresholds and generate alerts."""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Check RAM usage
        if memory.percent >= self.alert_threshold:
            alert = {
                'type': 'memory',
                'level': 'warning' if memory.percent < 90 else 'critical',
                'message': f'RAM usage at {memory.percent}%',
                'value': memory.percent,
                'timestamp': timestamp
            }
            
            # Check if this alert is already active (to avoid duplicates)
            if not any(a['type'] == 'memory' for a in self.active_alerts):
                self.active_alerts.append(alert)
                self.alert_history.append(alert)
                logger.warning(f"Alert: {alert['message']}")
        else:
            # Clear memory alerts if they exist
            self.active_alerts = [a for a in self.active_alerts if a['type'] != 'memory']
        
        # Check swap usage
        if swap.percent >= self.alert_threshold:
            alert = {
                'type': 'swap',
                'level': 'warning' if swap.percent < 90 else 'critical',
                'message': f'Swap usage at {swap.percent}%',
                'value': swap.percent,
                'timestamp': timestamp
            }
            
            # Check if this alert is already active
            if not any(a['type'] == 'swap' for a in self.active_alerts):
                self.active_alerts.append(alert)
                self.alert_history.append(alert)
                logger.warning(f"Alert: {alert['message']}")
        else:
            # Clear swap alerts if they exist
            self.active_alerts = [a for a in self.active_alerts if a['type'] != 'swap']
            
    def _update_process_history(self):
        """Update process history for memory leak detection."""
        timestamp = datetime.now()
        try:
            # Get top processes by memory usage
            processes = self.get_process_memory_usage(top_n=20)
            
            # Update history for each process
            for proc in processes:
                pid = proc['pid']
                memory_mb = proc.get('memory_mb', 0)
                
                # Initialize if new process
                if pid not in self.process_history:
                    self.process_history[pid] = {
                        'name': proc['name'],
                        'timestamps': [],
                        'memory_usage': [],
                        'start_time': timestamp,
                        'username': proc.get('username', '')
                    }
                
                # Update process data
                history = self.process_history[pid]
                history['timestamps'].append(timestamp)
                history['memory_usage'].append(memory_mb)
                
                # Limit history to prevent excessive memory use
                max_points = 60  # Keep about 5 minutes at 5 second intervals
                if len(history['timestamps']) > max_points:
                    history['timestamps'] = history['timestamps'][-max_points:]
                    history['memory_usage'] = history['memory_usage'][-max_points:]
                
            # Clean up old process entries
            current_pids = {p['pid'] for p in processes}
            for pid in list(self.process_history.keys()):
                if pid not in current_pids:
                    # Keep for a while in case process restarts
                    last_time = self.process_history[pid]['timestamps'][-1] if self.process_history[pid]['timestamps'] else datetime.now()
                    if (timestamp - last_time).total_seconds() > 300:  # 5 minutes
                        del self.process_history[pid]
                        
        except Exception as e:
            logger.error(f"Error updating process history: {str(e)}")
            
    def _store_hourly_average(self, now):
        """Store hourly average memory usage for long-term history."""
        if not self.memory_history or not self.swap_history:
            return
            
        # Calculate averages
        memory_percent_avg = statistics.mean([m['percent'] for m in self.memory_history])
        swap_percent_avg = statistics.mean([s['percent'] for s in self.swap_history])
        
        # Store data
        hour_data = {
            'timestamp': now.strftime('%Y-%m-%d %H:00:00'),
            'memory_percent': round(memory_percent_avg, 2),
            'swap_percent': round(swap_percent_avg, 2),
        }
        
        self.hourly_memory_data.append(hour_data)
        self.last_hourly_store = now
        
        # Log the data
        logger.debug(f"Stored hourly average: Memory {hour_data['memory_percent']}%, Swap {hour_data['swap_percent']}%")
        
    def _export_daily_data_to_csv(self):
        """Export daily memory data to a CSV file."""
        if not self.daily_memory_data:
            return
            
        try:
            filename = os.path.join(self.export_dir, 'memory_history.csv')
            with open(filename, 'w', newline='') as csvfile:
                fieldnames = ['date', 'memory_percent', 'swap_percent']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                writer.writeheader()
                for day_data in self.daily_memory_data:
                    writer.writerow(day_data)
                    
            logger.debug(f"Exported daily memory data to {filename}")
            
        except Exception as e:
            logger.error(f"Error exporting daily data: {str(e)}")
            
    def _store_daily_average(self, now):
        """Store daily average memory usage for long-term trends."""
        if not self.hourly_memory_data:
            return
            
        # Get hourly data from the past day
        day_ago = now - timedelta(days=1)
        day_data = [d for d in self.hourly_memory_data if 
                    datetime.strptime(d['timestamp'], '%Y-%m-%d %H:00:00') >= day_ago]
        
        if not day_data:
            return
            
        # Calculate daily averages
        memory_percent_avg = statistics.mean([d['memory_percent'] for d in day_data])
        swap_percent_avg = statistics.mean([d['swap_percent'] for d in day_data])
        
        # Store data
        daily_avg = {
            'date': now.strftime('%Y-%m-%d'),
            'memory_percent': round(memory_percent_avg, 2),
            'swap_percent': round(swap_percent_avg, 2),
        }
        
        self.daily_memory_data.append(daily_avg)
        self.last_daily_store = now
        
        # Export to file
        self._export_daily_data_to_csv()
        
    def _cleanup_old_data(self):
        """Clean up old data to prevent memory overflow."""
        # Keep only the last 7 days of hourly data (or as configured)
        if self.hourly_memory_data:
            cutoff = datetime.now() - timedelta(days=self.long_term_history_days)
            self.hourly_memory_data = [d for d in self.hourly_memory_data if 
                                     datetime.strptime(d['timestamp'], '%Y-%m-%d %H:00:00') >= cutoff]
            
        # Keep only the last year of daily data
        if self.daily_memory_data:
            cutoff = datetime.now() - timedelta(days=365)
            self.daily_memory_data = [d for d in self.daily_memory_data if 
                                   datetime.strptime(d['date'], '%Y-%m-%d') >= cutoff]
    
    def get_current_memory_data(self):
        """Get the current memory usage data."""
        try:
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()
            
            return {
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'free': memory.free,
                    'percent': memory.percent,
                    'buffers': getattr(memory, 'buffers', 0),
                    'cached': getattr(memory, 'cached', 0),
                },
                'swap': {
                    'total': swap.total,
                    'used': swap.used,
                    'free': swap.free,
                    'percent': swap.percent,
                },
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
        except Exception as e:
            logger.error(f"Error getting current memory data: {str(e)}")
            raise
    
    def get_history(self):
        """Get the historical memory usage data."""
        if not self.memory_history:
            return {'memory': [], 'swap': [], 'timestamps': []}
        
        return {
            'memory': list(self.memory_history),
            'swap': list(self.swap_history),
            'timestamps': list(self.timestamps)
        }
    
    def get_process_memory_usage(self, top_n=10):
        """
        Get memory usage by process, sorted by memory usage.
        
        Args:
            top_n: Number of top processes to return
            
        Returns:
            List of dictionaries with process info
        """
        try:
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'username', 'memory_percent']):
                try:
                    pinfo = proc.info
                    pinfo['memory_mb'] = round(proc.memory_info().rss / (1024 * 1024), 2)  # Convert to MB
                    processes.append(pinfo)
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
            
            # Sort by memory usage (descending) and take top N
            processes.sort(key=lambda x: x.get('memory_percent', 0), reverse=True)
            return processes[:top_n]
            
        except Exception as e:
            logger.error(f"Error getting process memory data: {str(e)}")
            raise

    # New methods for memory leak detection
    def get_possible_memory_leaks(self, min_growth_percent=20, min_time_seconds=120):
        """
        Identify processes that might be leaking memory.
        
        Args:
            min_growth_percent: Minimum percent growth to consider a leak
            min_time_seconds: Minimum tracking time to consider valid
            
        Returns:
            List of processes with possible memory leaks
        """
        potential_leaks = []
        now = datetime.now()
        
        for pid, history in self.process_history.items():
            # Need at least 2 data points and minimum tracking duration
            if len(history['memory_usage']) < 2:
                continue
                
            # Check if process has been tracked long enough
            first_time = history['timestamps'][0]
            if (now - first_time).total_seconds() < min_time_seconds:
                continue
                
            # Calculate growth
            first_mem = history['memory_usage'][0]
            last_mem = history['memory_usage'][-1]
            
            # Avoid division by zero
            if first_mem <= 0:
                continue
                
            growth_percent = ((last_mem - first_mem) / first_mem) * 100
            
            # Check if growth exceeds threshold
            if growth_percent >= min_growth_percent:
                leak_info = {
                    'pid': pid,
                    'name': history['name'],
                    'username': history['username'],
                    'start_memory_mb': round(first_mem, 2),
                    'current_memory_mb': round(last_mem, 2),
                    'growth_percent': round(growth_percent, 2),
                    'tracking_seconds': round((now - first_time).total_seconds(), 0)
                }
                potential_leaks.append(leak_info)
        
        # Sort by growth percent descending
        potential_leaks.sort(key=lambda x: x['growth_percent'], reverse=True)
        return potential_leaks
        
    def get_system_info(self):
        """Get system information including platform and memory configuration."""
        memory = psutil.virtual_memory()
        system_info = self.system_info.copy()
        
        # Add memory information
        system_info.update({
            'total_memory_gb': round(memory.total / (1024**3), 2),
            'memory_technology': 'Virtual',
            'python_version': platform.python_version(),
            'psutil_version': psutil.__version__
        })
        
        return system_info
        
    def get_alerts(self, active_only=False):
        """
        Get memory and swap usage alerts.
        
        Args:
            active_only: If True, returns only active alerts
            
        Returns:
            List of alerts
        """
        if active_only:
            return self.active_alerts
        else:
            return list(self.alert_history)
            
    def get_long_term_history(self, period='daily'):
        """
        Get long-term memory usage history.
        
        Args:
            period: 'hourly' or 'daily'
            
        Returns:
            Dictionary with historical data
        """
        if period == 'hourly':
            return self.hourly_memory_data
        else:
            return self.daily_memory_data

    # This method was moved above to fix circular reference issues
    def export_current_state(self, format='json'):
        """
        Export the current memory state to a file.
        
        Args:
            format: 'json' or 'csv'
        
        Returns:
            Path to the exported file
        """
        now = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = None
        
        try:
            # Get current data
            memory_data = self.get_current_memory_data()
            processes = self.get_process_memory_usage(top_n=30)
            
            if format == 'json':
                filename = os.path.join(self.export_dir, f'memory_snapshot_{now}.json')
                export_data = {
                    'system_info': self.get_system_info(),
                    'memory': memory_data,
                    'processes': processes,
                    'export_time': now
                }
                
                with open(filename, 'w') as f:
                    json.dump(export_data, f, indent=2)
                    
            elif format == 'csv':
                # Export memory data
                mem_filename = os.path.join(self.export_dir, f'memory_snapshot_{now}.csv')
                with open(mem_filename, 'w', newline='') as csvfile:
                    fieldnames = ['type', 'total', 'used', 'free', 'percent']
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                    
                    writer.writeheader()
                    writer.writerow({
                        'type': 'RAM',
                        'total': memory_data['memory']['total'],
                        'used': memory_data['memory']['used'],
                        'free': memory_data['memory']['free'],
                        'percent': memory_data['memory']['percent']
                    })
                    writer.writerow({
                        'type': 'Swap',
                        'total': memory_data['swap']['total'],
                        'used': memory_data['swap']['used'],
                        'free': memory_data['swap']['free'],
                        'percent': memory_data['swap']['percent']
                    })
                
                # Export process data
                proc_filename = os.path.join(self.export_dir, f'processes_snapshot_{now}.csv')
                with open(proc_filename, 'w', newline='') as csvfile:
                    fieldnames = ['pid', 'name', 'username', 'memory_percent', 'memory_mb']
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                    
                    writer.writeheader()
                    for proc in processes:
                        writer.writerow({
                            'pid': proc['pid'],
                            'name': proc['name'],
                            'username': proc.get('username', ''),
                            'memory_percent': proc.get('memory_percent', 0),
                            'memory_mb': proc.get('memory_mb', 0)
                        })
                filename = f"{mem_filename} and {proc_filename}"
            else:
                # Default to JSON if format is not supported
                filename = os.path.join(self.export_dir, f'memory_snapshot_{now}.json')
                export_data = {
                    'system_info': self.get_system_info(),
                    'memory': memory_data,
                    'processes': processes,
                    'export_time': now
                }
                
                with open(filename, 'w') as f:
                    json.dump(export_data, f, indent=2)
            
            if filename:
                logger.info(f"Exported memory snapshot to {filename}")
            return filename
            
        except Exception as e:
            logger.error(f"Error exporting memory snapshot: {str(e)}")
            return None
            
    def filter_processes(self, username=None, min_memory_mb=None, name_contains=None):
        """
        Filter process list based on criteria.
        
        Args:
            username: Filter by username
            min_memory_mb: Minimum memory usage in MB
            name_contains: Filter by substring in process name
            
        Returns:
            Filtered list of processes
        """
        try:
            # Get all processes first
            processes = self.get_process_memory_usage(top_n=100)
            filtered = processes
            
            # Apply filters
            if username:
                filtered = [p for p in filtered if p.get('username') == username]
                
            if min_memory_mb:
                filtered = [p for p in filtered if p.get('memory_mb', 0) >= min_memory_mb]
                
            if name_contains:
                filtered = [p for p in filtered if name_contains.lower() in p.get('name', '').lower()]
                
            return filtered
            
        except Exception as e:
            logger.error(f"Error filtering processes: {str(e)}")
            return []

    # Paging simulation methods
    def simulate_paging(self, page_size_kb=4):
        """
        Simulate memory paging based on current process data.
        
        Args:
            page_size_kb: Size of each page in KB (default 4KB)
            
        Returns:
            Dictionary with paging simulation data
        """
        # Get current memory data
        memory = psutil.virtual_memory()
        total_memory_kb = memory.total / 1024
        
        # Calculate total pages
        total_pages = int(total_memory_kb / page_size_kb)
        
        # Get top processes
        processes = self.get_process_memory_usage(top_n=20)
        
        # Simulate page table
        page_table = {}
        allocated_pages = 0
        
        for proc in processes:
            # Calculate how many pages this process would use
            proc_memory_kb = proc['memory_mb'] * 1024
            pages_needed = int(math.ceil(proc_memory_kb / page_size_kb))
            
            # Limit to 70% of total pages to show some free space
            max_pages = int(total_pages * 0.7)
            if allocated_pages + pages_needed > max_pages:
                pages_needed = max(1, max_pages - allocated_pages)
                
            if pages_needed <= 0:
                continue
                
            # Simulate page allocation
            page_table[proc['pid']] = {
                'process_name': proc['name'],
                'total_pages': pages_needed,
                'memory_mb': proc['memory_mb'],
                'page_locations': [],
                'has_page_fault': random.random() < 0.2,  # Random chance of page fault
                'page_fault_count': random.randint(0, int(pages_needed/10) + 1)
            }
            
            # Simulate page locations (some contiguous, some fragmented)
            remaining_pages = pages_needed
            fragmentation = random.random() < 0.4  # 40% chance of fragmentation
            
            if fragmentation and pages_needed > 1:
                # Fragmented allocation - pages scattered
                fragment_size = max(1, int(pages_needed / 3))
                
                while remaining_pages > 0:
                    # Allocate in small chunks to simulate fragmentation
                    chunk_size = min(fragment_size, remaining_pages)
                    start_page = random.randint(0, total_pages - chunk_size) 
                    page_locations = list(range(start_page, start_page + chunk_size))
                    page_table[proc['pid']]['page_locations'].extend(page_locations)
                    remaining_pages -= chunk_size
            else:
                # Contiguous allocation
                start_page = random.randint(0, total_pages - pages_needed)
                page_table[proc['pid']]['page_locations'] = list(range(start_page, start_page + pages_needed))
            
            allocated_pages += pages_needed
        
        # Calculate memory usage statistics
        used_pages = allocated_pages
        free_pages = total_pages - used_pages
        
        # Sometimes simulate page faults
        page_faults = {}
        for pid, data in page_table.items():
            if data['has_page_fault']:
                fault_type = random.choice(['read', 'write', 'execute'])
                fault_page = random.choice(data['page_locations']) if data['page_locations'] else 0
                page_faults[pid] = {
                    'process_name': data['process_name'],
                    'fault_type': fault_type,
                    'page_number': fault_page,
                    'fault_count': data['page_fault_count']
                }
        
        # Simulate page swapping (if swap is enabled and memory is under pressure)
        swap = psutil.swap_memory()
        swap_used_percent = swap.percent
        swap_used_kb = swap.used / 1024
        swap_status = {
            'active': swap_used_percent > 0,  # True if swap is being used
            'pages_swapped': int(swap_used_kb / page_size_kb),
            'recently_swapped_in': [],
            'recently_swapped_out': []
        }
        
        if swap_status['active']:
            # Simulate recent swap activity
            for _ in range(min(5, len(page_table))):
                if page_table:
                    random_pid = random.choice(list(page_table.keys()))
                    process_name = page_table[random_pid]['process_name']
                    page_count = random.randint(1, 5)
                    
                    # 70% chance of swap out, 30% chance of swap in
                    if random.random() < 0.7:
                        swap_status['recently_swapped_out'].append({
                            'pid': random_pid,
                            'process_name': process_name,
                            'pages': page_count,
                            'time': datetime.now().strftime('%H:%M:%S')
                        })
                    else:
                        swap_status['recently_swapped_in'].append({
                            'pid': random_pid,
                            'process_name': process_name,
                            'pages': page_count,
                            'time': datetime.now().strftime('%H:%M:%S')
                        })
        
        return {
            'page_size_kb': page_size_kb,
            'total_pages': total_pages,
            'used_pages': used_pages,
            'free_pages': free_pages,
            'page_table': page_table,
            'page_faults': page_faults,
            'swap_status': swap_status,
            'memory_pressure': memory.percent,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
    # Segmentation simulation methods
    def simulate_segmentation(self):
        """
        Simulate memory segmentation based on current process data.
        
        Returns:
            Dictionary with segmentation simulation data
        """
        # Get current memory data
        memory = psutil.virtual_memory()
        total_memory_mb = memory.total / (1024 * 1024)
        
        # Get top processes
        processes = self.get_process_memory_usage(top_n=15)
        
        # Segment types
        segment_types = ['code', 'data', 'stack', 'heap']
        
        # Simulate segmentation table
        segmentation_table = {}
        
        # Track fragmentation
        fragments = []
        allocated_memory = 0
        
        for proc in processes:
            proc_memory_mb = proc['memory_mb']
            
            # Skip processes with negligible memory
            if proc_memory_mb < 1:
                continue
                
            # Distribute memory across segments based on typical distribution
            segments = {}
            
            # Typical distribution varies by process type but follows patterns
            # Simulate approximate distribution
            is_computation_heavy = random.random() < 0.3
            is_memory_heavy = random.random() < 0.4
            
            if is_computation_heavy:
                # Code-heavy process
                code_percent = random.uniform(0.3, 0.5)
                data_percent = random.uniform(0.1, 0.3)
                stack_percent = random.uniform(0.1, 0.2)
                heap_percent = 1 - code_percent - data_percent - stack_percent
            elif is_memory_heavy:
                # Heap-heavy process
                heap_percent = random.uniform(0.4, 0.7)
                code_percent = random.uniform(0.1, 0.2)
                data_percent = random.uniform(0.1, 0.2)
                stack_percent = 1 - heap_percent - code_percent - data_percent
            else:
                # Balanced process
                code_percent = random.uniform(0.2, 0.3)
                data_percent = random.uniform(0.2, 0.3)
                stack_percent = random.uniform(0.1, 0.2)
                heap_percent = 1 - code_percent - data_percent - stack_percent
            
            # Assign memory to segments
            segments = {
                'code': {
                    'size_mb': round(proc_memory_mb * code_percent, 2),
                    'base_address': hex(random.randint(0x10000000, 0x20000000)),
                    'protection': 'read-execute'
                },
                'data': {
                    'size_mb': round(proc_memory_mb * data_percent, 2),
                    'base_address': hex(random.randint(0x30000000, 0x40000000)),
                    'protection': 'read-write'
                },
                'stack': {
                    'size_mb': round(proc_memory_mb * stack_percent, 2),
                    'base_address': hex(random.randint(0x70000000, 0x80000000)),
                    'protection': 'read-write',
                    'growth_direction': 'downward',
                    'current_usage_percent': random.randint(30, 90)
                },
                'heap': {
                    'size_mb': round(proc_memory_mb * heap_percent, 2),
                    'base_address': hex(random.randint(0x50000000, 0x60000000)),
                    'protection': 'read-write',
                    'growth_direction': 'upward',
                    'current_usage_percent': random.randint(40, 95),
                    'fragmentation_percent': random.randint(5, 40)
                }
            }
            
            # Add some shared libraries
            num_libraries = random.randint(1, 4)
            shared_libs_memory = round(proc_memory_mb * random.uniform(0.05, 0.15), 2)
            segments['shared_libraries'] = {
                'count': num_libraries,
                'size_mb': shared_libs_memory,
                'protection': 'read-execute'
            }
            
            # Track allocation for fragmentation calculation
            segmentation_table[proc['pid']] = {
                'process_name': proc['name'],
                'total_memory_mb': proc_memory_mb,
                'segments': segments
            }
            
            allocated_memory += proc_memory_mb
            
            # Simulate fragmentation
            base_address = 0
            for segment_type, segment_data in segments.items():
                if segment_type == 'shared_libraries':
                    continue
                    
                size_mb = segment_data['size_mb']
                end_address = base_address + size_mb
                
                # Decide if we'll leave a fragment after this segment
                if random.random() < 0.3 and end_address < total_memory_mb * 0.9:
                    fragment_size = round(random.uniform(0.1, 2.0), 2)  # 0.1 to 2 MB fragment
                    
                    fragments.append({
                        'start_address': end_address,
                        'size_mb': fragment_size,
                        'location': f"After {proc['name']} {segment_type} segment"
                    })
                    
                    base_address = end_address + fragment_size
                else:
                    base_address = end_address
        
        # Calculate external fragmentation
        total_fragmentation_mb = sum(f['size_mb'] for f in fragments)
        external_fragmentation_percent = (total_fragmentation_mb / total_memory_mb) * 100 if total_memory_mb > 0 else 0
        
        return {
            'total_memory_mb': total_memory_mb,
            'allocated_memory_mb': allocated_memory,
            'free_memory_mb': total_memory_mb - allocated_memory,
            'segmentation_table': segmentation_table,
            'external_fragmentation': {
                'fragments': fragments,
                'total_fragmentation_mb': round(total_fragmentation_mb, 2),
                'fragmentation_percent': round(external_fragmentation_percent, 2)
            },
            'memory_pressure': memory.percent,
            'largest_free_block_mb': round(total_memory_mb - allocated_memory - total_fragmentation_mb, 2),
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    
    def __del__(self):
        """Cleanup when the object is destroyed."""
        self.running = False
        if hasattr(self, 'collector_thread') and self.collector_thread.is_alive():
            self.collector_thread.join(1)  # Wait for thread to finish
