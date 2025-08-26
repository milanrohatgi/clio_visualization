#!/bin/bash

# CLIO: Hierarchical Cluster Analysis - Processing Pipeline
# This script runs the complete data processing pipeline

echo "🔄 Running CLIO Processing Pipeline"
echo "===================================="

# Check if data.csv exists
if [ ! -f "data.csv" ]; then
    echo "❌ data.csv not found!"
    echo "   Please place your CSV file in this directory and rename it to 'data.csv'"
    echo ""
    echo "📋 Expected CSV format:"
    echo "   - Column 1: cluster_name (XML with cluster analysis)"
    echo "   - Column 2: item_ids (list of item IDs)"
    echo "   - Column 3: round_1_cluster (XML with meta-cluster analysis)"
    echo "   - Column 4: round_2_cluster (XML with meta-cluster analysis)"
    echo "   - Column 5: round_3_cluster (XML with meta-cluster analysis)"
    exit 1
fi

# Activate virtual environment
if [ -d "venv" ]; then
    echo "🔄 Activating virtual environment..."
    source venv/bin/activate
else
    echo "❌ Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# Step 1: Parse the CSV data
echo ""
echo "📊 Step 1/3: Parsing CSV data..."
python3 data_parser.py
if [ $? -ne 0 ]; then
    echo "❌ Data parsing failed"
    exit 1
fi

# Step 2: Build hierarchical structure
echo ""
echo "🌳 Step 2/3: Building hierarchical structure..."
python3 hierarchy_parser.py
if [ $? -ne 0 ]; then
    echo "❌ Hierarchy building failed"
    exit 1
fi

# Step 3: Generate UMAP embeddings
echo ""
echo "🎯 Step 3/3: Generating UMAP embeddings..."
python3 generate_embeddings.py
if [ $? -ne 0 ]; then
    echo "❌ Embedding generation failed"
    exit 1
fi

echo ""
echo "✅ Pipeline completed successfully!"
echo ""
echo "🚀 Starting web server..."
echo "   Open http://localhost:8000 in your browser"
echo "   Press Ctrl+C to stop the server"
echo ""

# Start the web server
python3 server.py

