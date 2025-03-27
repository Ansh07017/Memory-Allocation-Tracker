import os
import logging
from datetime import datetime
from flask import Flask, render_template, jsonify, request, send_file
from memory_tracker import MemoryTracker

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create the Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")

# Initialize memory tracker with expanded parameters
memory_tracker = MemoryTracker(
    history_minutes=10,             # 10 minutes of real-time history 
    sample_interval=1,              # 1 second sampling
    long_term_history_days=7,       # 7 days of history
    alert_threshold=75,             # Alert at 75% usage
    export_dir='./exports'          # Directory for exports
)

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

@app.route('/api/memory/system-info')
def get_system_information():
    """API endpoint to get system information."""
    try:
        data = memory_tracker.get_system_info()
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting system information: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory/alerts')
def get_memory_alerts():
    """API endpoint to get memory usage alerts."""
    try:
        active_only = request.args.get('active_only', 'false').lower() == 'true'
        data = memory_tracker.get_alerts(active_only=active_only)
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting alerts: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory/long-term')
def get_long_term_memory_history():
    """API endpoint to get long-term memory usage history."""
    try:
        period = request.args.get('period', 'daily')
        data = memory_tracker.get_long_term_history(period=period)
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting long-term history: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory/leaks')
def get_memory_leaks():
    """API endpoint to get potential memory leaks."""
    try:
        min_growth = int(request.args.get('min_growth', 20))
        min_time = int(request.args.get('min_time', 120))
        data = memory_tracker.get_possible_memory_leaks(
            min_growth_percent=min_growth,
            min_time_seconds=min_time
        )
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error getting memory leaks: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory/filter-processes')
def filter_processes():
    """API endpoint to filter processes."""
    try:
        username = request.args.get('username')
        name_contains = request.args.get('name_contains')
        min_memory = request.args.get('min_memory')
        
        # Convert min_memory to float if provided
        if min_memory:
            min_memory = float(min_memory)
            
        data = memory_tracker.filter_processes(
            username=username,
            name_contains=name_contains,
            min_memory_mb=min_memory
        )
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error filtering processes: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory/export')
def export_memory_data():
    """API endpoint to export memory data to a file."""
    try:
        format_type = request.args.get('format', 'json')
        if format_type not in ['json', 'csv']:
            return jsonify({"error": "Invalid format. Use 'json' or 'csv'"}), 400
            
        filename = memory_tracker.export_current_state(format=format_type)
        if not filename:
            return jsonify({"error": "Failed to create export file"}), 500
            
        # Return a success message with the filename
        return jsonify({
            "message": "Export created successfully", 
            "filename": filename
        })
    except Exception as e:
        logger.error(f"Error exporting memory data: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory/exports')
def list_exports():
    """List all exported files."""
    try:
        if not os.path.exists('exports'):
            return jsonify([])
        files = []
        for f in os.listdir('exports'):
            file_path = os.path.join('exports', f)
            if os.path.isfile(file_path):
                files.append({
                    'name': f,
                    'date': datetime.fromtimestamp(os.path.getctime(file_path)).strftime('%Y-%m-%d %H:%M:%S'),
                    'size': os.path.getsize(file_path)
                })
        return jsonify(sorted(files, key=lambda x: x['date'], reverse=True))
    except Exception as e:
        logger.error(f"Error listing exports: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/download/<path:filename>')
def download_export(filename):
    """Download an exported file."""
    try:
        file_path = os.path.join(memory_tracker.export_dir, filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404
            
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        logger.error(f"Error downloading export file: {str(e)}")
        return jsonify({"error": "Download failed"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
