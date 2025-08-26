#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import os
import threading
import time

def start_server():
    """Start a simple HTTP server to serve the visualization"""
    PORT = 8000
    
    # Change to the current directory (where the script is located)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    Handler = http.server.SimpleHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"🚀 TikTok Cluster Visualization Server starting...")
            print(f"📊 Server running at http://localhost:{PORT}")
            print(f"🌐 Opening in your default web browser...")
            print(f"📁 Serving files from: {os.getcwd()}")
            print(f"⚡ Press Ctrl+C to stop the server")
            print("-" * 50)
            
            # Open browser after a short delay
            def open_browser():
                time.sleep(1)
                webbrowser.open(f'http://localhost:{PORT}')
            
            browser_thread = threading.Thread(target=open_browser)
            browser_thread.daemon = True
            browser_thread.start()
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Port {PORT} is already in use. Try a different port or stop the existing server.")
        else:
            print(f"❌ Error starting server: {e}")

if __name__ == "__main__":
    start_server()

