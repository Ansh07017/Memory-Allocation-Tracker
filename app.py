import os
import logging
from flask import Flask, render_template, jsonify
from memory_tracker import MemoryTracker

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create the Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Initialize memory tracker
memory_tracker = MemoryTracker()

@app.route('/')
def index():
    """Render the main dashboard page."""
    return render_template('index.html')

@app.route('/api/memory/current')
def get_current_memory():
    """API endpoint to get current memory usage data."""
    try:
        data = memory_tracker.get_current_memory_data()
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting memory data: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory/history')
def get_memory_history():
    """API endpoint to get historical memory usage data."""
    try:
        data = memory_tracker.get_history()
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting memory history: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory/processes')
def get_memory_by_process():
    """API endpoint to get memory usage by process."""
    try:
        data = memory_tracker.get_process_memory_usage()
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting process memory data: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
