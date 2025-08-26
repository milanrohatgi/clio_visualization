# CLIO: Hierarchical Cluster Analysis

An interactive web-based visualization tool for exploring hierarchical cluster data with UMAP embeddings, TikTok-style theming, and clickable item IDs.

## 🌟 Features

- **Hierarchical Navigation**: Explore clusters across multiple levels (Individual → Round 1 → Round 2 → Round 3)
- **Interactive UMAP Plots**: 2D visualizations with zoom, pan, and click-to-explore functionality
- **Keyword Search**: Highlight clusters by keywords with visual feedback
- **Clickable Item IDs**: Direct links to TikTok video details (configurable URL format)
- **Responsive Design**: TikTok-inspired styling with smooth animations
- **Multi-level Analysis**: Engagement tactics and redirection methods for meta-clusters

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- A CSV file with hierarchical cluster data (see [Data Format](#data-format))

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd clio-cluster-analysis
   ```

2. **Run the automated setup**
   ```bash
   ./setup.sh
   ```

3. **Prepare your data**
   - Place your CSV file in the project directory
   - Rename it to `data.csv`

4. **Run the processing pipeline**
   ```bash
   ./run_pipeline.sh
   ```

5. **Open the visualization**
   - The web server will start automatically
   - Open http://localhost:8000 in your browser

## 📊 Data Format

Your CSV file should have exactly 5 columns with the following structure:

| Column | Name | Description |
|--------|------|-------------|
| 1 | `cluster_name` | XML containing individual cluster analysis |
| 2 | `item_ids` | List of item IDs (e.g., TikTok video IDs) |
| 3 | `round_1_cluster` | XML containing Round 1 meta-cluster analysis |
| 4 | `round_2_cluster` | XML containing Round 2 meta-cluster analysis |
| 5 | `round_3_cluster` | XML containing Round 3 meta-cluster analysis |

### XML Format Examples

**Individual Cluster (cluster_name column):**
```xml
<cluster_analysis>
    <common_topic>Description of the common topic</common_topic>
    <keywords>keyword1, keyword2, keyword3</keywords>
    <common_engagement>Engagement patterns description</common_engagement>
    <common_redirection>Redirection methods description</common_redirection>
    <synthesis>Summary of the cluster</synthesis>
    <cluster_name>Human-readable cluster name</cluster_name>
</cluster_analysis>
```

**Meta-Cluster (round_X_cluster columns):**
```xml
<meta_cluster_analysis>
    <overarching_theme>Theme description</overarching_theme>
    <meta_keywords>meta-keyword1, meta-keyword2</meta_keywords>
    <engagement_tactics>Engagement tactics description</engagement_tactics>
    <redirection_methods>Redirection methods description</redirection_methods>
    <synthesis_of_clusters>Meta-cluster synthesis</synthesis_of_clusters>
    <meta_cluster_name>Meta-cluster name</meta_cluster_name>
</meta_cluster_analysis>
```

**Item IDs Format:**
```
['7522898183849069879', '7523456789012345678', '7524567890123456789']
```

## 🔧 Manual Setup (Alternative)

If you prefer manual setup:

1. **Create virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run processing steps individually**
   ```bash
   # Step 1: Parse CSV data
   python3 data_parser.py
   
   # Step 2: Build hierarchical structure
   python3 hierarchy_parser.py
   
   # Step 3: Generate UMAP embeddings
   python3 generate_embeddings.py
   
   # Step 4: Start web server
   python3 server.py
   ```

## 🎯 Usage

### Navigation
- **Level Buttons**: Switch between Individual Clusters, Level 1, Level 2, and Level 3 meta-clusters
- **Cluster Cards**: Click on any cluster card to view details
- **Back Button**: Navigate back through your exploration history

### UMAP Visualization
- **Plot Levels**: Toggle between different UMAP plot levels using the buttons above the plot
- **Zoom/Pan**: Use mouse wheel to zoom, click and drag to pan
- **Reset Zoom**: Click the "Reset Zoom" button to return to default view
- **Point Interaction**: 
  - Single-click points to view cluster details
  - Double-click meta-cluster points to drill down

### Search Features
- **General Search**: Search cluster names and descriptions (top search bar)
- **Keyword Search**: Highlight points by keywords in the UMAP plot (plot search bar)

### Item IDs
- **Clickable Links**: Item IDs are clickable and link to TikTok video details
- **Sample Display**: Shows up to 10 item IDs per cluster, with count indicator for more

## 🛠️ Customization

### Modifying Item ID Links
To change the URL format for item ID links, edit the `displayItemIds` function in `script.js`:

```javascript
idLink.href = `https://your-custom-domain.com/video?id=${id}&other=params`;
```

### Changing Color Scheme
The TikTok-inspired color scheme can be modified in `styles.css`. Key color variables:
- Primary: `#FF0050` (TikTok pink)
- Secondary: `#25D4ED` (TikTok cyan)
- Background: `#000` (Black)

### Adjusting UMAP Parameters
Modify UMAP settings in `generate_embeddings.py`:

```python
umap_reducer = umap.UMAP(
    n_components=2,
    n_neighbors=15,      # Adjust for cluster granularity
    min_dist=0.1,        # Adjust for point separation
    metric='cosine',     # Distance metric
    random_state=42      # For reproducibility
)
```

## 📁 Project Structure

```
├── data.csv                    # Your input data (not included)
├── data_parser.py             # CSV and XML parsing
├── hierarchy_parser.py        # Hierarchical structure building
├── generate_embeddings.py     # UMAP embedding generation
├── server.py                  # Web server
├── setup.sh                   # Automated setup script
├── run_pipeline.sh           # Complete processing pipeline
├── requirements.txt          # Python dependencies
├── index.html               # Web interface
├── script.js               # Frontend JavaScript
├── styles.css              # CSS styling
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔬 Technical Details

### Processing Pipeline
1. **Data Parsing**: Extracts XML content and item IDs from CSV
2. **Hierarchy Building**: Creates tree structure linking all cluster levels
3. **Text Embedding**: Uses SentenceTransformer (paraphrase-multilingual-mpnet-base-v2) to encode cluster text
4. **Dimensionality Reduction**: Applies UMAP to create 2D coordinates for visualization
5. **Web Interface**: Provides interactive exploration with D3.js and Canvas rendering

### Dependencies
- **pandas**: CSV data manipulation
- **sentence-transformers**: Text embedding generation
- **umap-learn**: Dimensionality reduction
- **scikit-learn**: Machine learning utilities
- **tqdm**: Progress bars
- **requests**: HTTP requests for model downloads

### Performance Features
- **Canvas Rendering**: High-performance point rendering for large datasets
- **Mouse Throttling**: Smooth hover interactions
- **Spatial Culling**: Efficient hit-testing for point interactions
- **Memory Management**: Optimized for datasets with 10k+ clusters

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Troubleshooting

### Common Issues

**"data.csv not found"**
- Ensure your CSV file is named exactly `data.csv` and placed in the project directory

**"Port 8000 is already in use"**
- Either stop the existing server or modify `server.py` to use a different port

**"Failed to install dependencies"**
- Ensure you have Python 3.8+ installed
- Try upgrading pip: `pip install --upgrade pip`
- On some systems, you may need `python3-dev` or `python3-devel` packages

**"UMAP embeddings look incorrect"**
- Check that your XML format matches the expected structure
- Verify that cluster names and meta-cluster names are properly extracted
- Consider adjusting UMAP parameters for your specific dataset

**Memory issues with large datasets**
- For datasets with >50k clusters, consider increasing system memory or adjusting batch sizes in `generate_embeddings.py`

### Getting Help

If you encounter issues:
1. Check that your data format matches the specification
2. Verify all dependencies are installed correctly
3. Look at the console output for specific error messages
4. Open an issue on GitHub with your error details and data format

---

**Built with ❤️ for hierarchical cluster analysis**