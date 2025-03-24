import psutil
import time
from datetime import datetime
import logging
from collections import deque
import threading

logger = logging.getLogger(__name__)

class MemoryTracker:
    def __init__(self, history_minutes=5, sample_interval=1):
        """
        Initialize the memory tracker.
        
        Args:
            history_minutes: How many minutes of history to keep
            sample_interval: How often to sample memory (in seconds)
        """
        self.history_minutes = history_minutes
        self.sample_interval = sample_interval
        self.max_samples = int((history_minutes * 60) / sample_interval)
        
        # Initialize history storage
        self.memory_history = deque(maxlen=self.max_samples)
        self.swap_history = deque(maxlen=self.max_samples)
        self.timestamps = deque(maxlen=self.max_samples)
        
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
                self.memory_history.append({
                    'total': memory.total,
                    'available': memory.available,
                    'used': memory.used,
                    'free': memory.free,
                    'percent': memory.percent,
                    'buffers': getattr(memory, 'buffers', 0),
                    'cached': getattr(memory, 'cached', 0),
                })
                
                self.swap_history.append({
                    'total': swap.total,
                    'used': swap.used,
                    'free': swap.free,
                    'percent': swap.percent,
                })
                
                self.timestamps.append(now.strftime('%H:%M:%S'))
                
            except Exception as e:
                logger.error(f"Error collecting memory data: {str(e)}")
            
            # Sleep until next collection
            time.sleep(self.sample_interval)
    
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

    def __del__(self):
        """Cleanup when the object is destroyed."""
        self.running = False
        if hasattr(self, 'collector_thread') and self.collector_thread.is_alive():
            self.collector_thread.join(1)  # Wait for thread to finish
