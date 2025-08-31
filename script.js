// Global variables
let hierarchyData = null;
let embeddingsData = null;
let currentLevel = 3; // Start at highest level
let currentView = null; // Current view data (meta-clusters or individual clusters)
let selectedItemIndex = 0;
let navigationStack = []; // Stack for back navigation
let currentPCALevel = 2; // Start with Level 2 PCA
let pcaSvg = null;
let pcaG = null;
let pcaZoom = null;
let pcaCanvas = null;
let pcaContext = null;
let selectedPCAPoint = null;
let pcaXScale = null;
let pcaYScale = null;
let pcaColorScale = null;
let currentPCAData = [];
let currentTransform = d3.zoomIdentity;
let mouseThrottleTimeout = null;
let lastClickTime = 0;
let lastClickedPoint = null;
let pcaSearchQuery = '';
let pcaSearchMatches = new Set();
let highlightedParentGroup = null;

// DOM elements
const levelBtns = document.querySelectorAll('.level-btn');


const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resetViewBtn = document.getElementById('resetView');
const backBtn = document.getElementById('backBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const currentClusterSpan = document.getElementById('currentCluster');
const clusterGrid = document.getElementById('clusterGrid');
const clusterListTitle = document.getElementById('clusterListTitle');
const viewStats = document.getElementById('viewStats');

// PCA elements
const pcaLevelBtns = document.querySelectorAll('.pca-level-btn');
const resetZoomBtn = document.getElementById('resetZoom');
const pcaPlot = document.getElementById('pcaPlot');
const pcaVariance = document.getElementById('pcaVariance');
const pcaClusters = document.getElementById('pcaClusters');
const pcaParents = document.getElementById('pcaParents');
const pcaLegend = document.getElementById('pcaLegend');
const pcaSearchInput = document.getElementById('pcaSearchInput');
const pcaSearchClear = document.getElementById('pcaSearchClear');

// Cluster detail elements
const clusterId = document.getElementById('clusterId');
const clusterName = document.getElementById('clusterName');
const clusterTopic = document.getElementById('clusterTopic');
const clusterDescription = document.getElementById('clusterDescription');
const clusterKeywords = document.getElementById('clusterKeywords');
const clusterEngagement = document.getElementById('clusterEngagement');
const clusterRedirection = document.getElementById('clusterRedirection');

// Copy button element
const copyItemIdsBtn = document.getElementById('copyItemIdsBtn');



// Initialize the application
async function init() {
    try {
        showLoading();
        await Promise.all([loadHierarchyData(), loadEmbeddingsData()]);
        setupEventListeners();
        setupPCAVisualization();
        
        // Ensure data is loaded before showing UI
        console.log('Data loaded, initializing UI...');
        showLevel(3); // Start at level 3 (top level)
        showPCALevel(2); // Start PCA at level 2 (most interesting default)
        
        // Force a small delay to ensure everything is rendered properly
        setTimeout(() => {
            console.log('Forcing UI refresh...');
            renderCurrentView();
            displaySelectedItem();
            hideLoading();
        }, 100);
        
    } catch (error) {
        console.error('Failed to initialize:', error);
        hideLoading();
        // Data loading will be retried automatically on user interaction
    }
}

// Load hierarchical cluster data
async function loadHierarchyData() {
    try {
        const response = await fetch('hierarchical_clusters.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        hierarchyData = await response.json();
        console.log(`Loaded hierarchical data:`, hierarchyData.hierarchy_stats);
        updateLevelButtonCounts();
    } catch (error) {
        console.error('Error loading hierarchy data:', error);
        throw error;
    }
}

// Load embeddings data
async function loadEmbeddingsData() {
    try {
        const response = await fetch('cluster_embeddings.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        embeddingsData = await response.json();
        console.log(`UMAP embeddings loaded for ${Object.keys(embeddingsData).length} levels`);
    } catch (error) {
        console.error('Error loading embeddings data:', error);
        throw error;
    }
}

// Update level button counts with actual data
function updateLevelButtonCounts() {
    if (!hierarchyData) return;
    
    // Get actual counts from the loaded data
    const level0Count = hierarchyData.individual_clusters ? hierarchyData.individual_clusters.length : 0;
    const level1Count = hierarchyData.meta_clusters?.round_1 ? hierarchyData.meta_clusters.round_1.length : 0;
    const level2Count = hierarchyData.meta_clusters?.round_2 ? hierarchyData.meta_clusters.round_2.length : 0;
    const level3Count = hierarchyData.meta_clusters?.round_3 ? hierarchyData.meta_clusters.round_3.length : 0;
    
    // Format numbers for display
    const formatCount = (count) => {
        if (count >= 1000) {
            return (count / 1000).toFixed(count >= 10000 ? 0 : 1) + 'k';
        }
        return count.toString();
    };
    
    // Update button text
    const level3Btn = document.getElementById('level3Btn');
    const level2Btn = document.getElementById('level2Btn');
    const level1Btn = document.getElementById('level1Btn');
    const level0Btn = document.getElementById('level0Btn');
    
    if (level3Btn) level3Btn.textContent = `Level 3 (${level3Count} groups)`;
    if (level2Btn) level2Btn.textContent = `Level 2 (${level2Count} groups)`;
    if (level1Btn) level1Btn.textContent = `Level 1 (${formatCount(level1Count)} groups)`;
    if (level0Btn) level0Btn.textContent = `Level 0 (${formatCount(level0Count)} clusters)`;
}

// Setup PCA visualization with D3.js and Canvas
function setupPCAVisualization() {
    // Clear loading content
    pcaPlot.innerHTML = '';
    
    const rect = pcaPlot.getBoundingClientRect();
    
    // Create Canvas for data points (faster rendering)
    const canvas = d3.select('#pcaPlot')
        .append('canvas')
        .attr('class', 'pca-canvas')
        .attr('width', rect.width)
        .attr('height', rect.height)
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)
        .style('background', 'transparent');
    
    pcaCanvas = canvas.node();
    pcaContext = pcaCanvas.getContext('2d');
    
    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    pcaCanvas.width = rect.width * dpr;
    pcaCanvas.height = rect.height * dpr;
    pcaContext.scale(dpr, dpr);
    canvas.style('width', rect.width + 'px').style('height', rect.height + 'px');
    
    // Create SVG overlay for axes and interactions
    pcaSvg = d3.select('#pcaPlot')
        .append('svg')
        .attr('class', 'pca-svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)
        .style('pointer-events', 'none'); // Let canvas handle point interactions
    
    // Create main group for zoom/pan
    pcaG = pcaSvg.append('g');
    
    // Setup zoom behavior
    pcaZoom = d3.zoom()
        .scaleExtent([1, 10]) // Min zoom = 1 (reset level), Max zoom = 10x
        .on('zoom', function(event) {
            pcaG.attr('transform', event.transform);
            // Redraw canvas with new transform
            redrawCanvas(event.transform);
        });
    
    // Apply zoom to canvas for mouse interactions
    d3.select(pcaCanvas).call(pcaZoom);
    
    // Add canvas mouse interactions
    canvas.on('mousemove', handleCanvasMouseMove)
          .on('click', handleCanvasClick);
    
    // Add reset zoom functionality
    resetZoomBtn.addEventListener('click', resetZoom);
    
    // Handle window resize
    window.addEventListener('resize', debounce(resizePCAPlot, 250));
}

// Reset zoom to fit all points
function resetZoom() {
    if (!pcaSvg || !embeddingsData) return;
    
    const levelKey = `level_${currentPCALevel}`;
    const levelData = embeddingsData[levelKey];
    if (!levelData) return;
    
    pcaSvg.transition()
        .duration(750)
        .call(pcaZoom.transform, d3.zoomIdentity);
    
    // Also reset canvas if it exists
    if (pcaCanvas) {
        currentTransform = d3.zoomIdentity;
        drawCanvasPoints();
    }
}

// Debounce function for resize events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Resize PCA plot
function resizePCAPlot() {
    if (embeddingsData && currentPCALevel !== null) {
        drawPCAPlot(currentPCALevel);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Level navigation
    levelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const level = parseInt(btn.dataset.level);
            showLevel(level);
        });
    });
    
    // PCA level navigation
    pcaLevelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const level = parseInt(btn.dataset.level);
            clearPCASearch(); // Clear search when switching levels
            showPCALevel(level); // This will update buttons AND draw the plot
        });
    });
    
    // Navigation
    prevBtn.addEventListener('click', () => navigateItem(-1));
    nextBtn.addEventListener('click', () => navigateItem(1));
    
    // Controls
    
    searchBtn.addEventListener('click', searchItems);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchItems();
    });
    
    resetViewBtn.addEventListener('click', resetView);
    backBtn.addEventListener('click', goBack);
    
    // Copy button for item IDs
    copyItemIdsBtn.addEventListener('click', copyAllItemIds);
    
    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
}

// Show specific level
function showLevel(level) {
    currentLevel = level;
    
    // Update level buttons
    levelBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
    });
    
    // Clear navigation stack
    navigationStack = [];
    backBtn.style.display = 'none';
    
    // Load appropriate data
    switch(level) {
        case 3:
            currentView = hierarchyData.meta_clusters.round_3;
            clusterListTitle.textContent = 'Level 3 Meta-Clusters';
            break;
        case 2:
            currentView = hierarchyData.meta_clusters.round_2;
            clusterListTitle.textContent = 'Level 2 Meta-Clusters';
            break;
        case 1:
            currentView = hierarchyData.meta_clusters.round_1;
            clusterListTitle.textContent = 'Level 1 Meta-Clusters';
            break;
        case 0:
            currentView = hierarchyData.individual_clusters;
            clusterListTitle.textContent = 'Individual Clusters';
            break;
    }
    
    selectedItemIndex = 0;
    renderCurrentView();
    displaySelectedItem();
    
    // Scroll to cluster cards section
    setTimeout(() => {
        const clusterListSection = document.querySelector('.cluster-list');
        if (clusterListSection) {
            clusterListSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }, 100); // Small delay to ensure content is rendered
}

// Navigate between items in current view
function navigateItem(direction) {
    const newIndex = selectedItemIndex + direction;
    if (newIndex >= 0 && newIndex < currentView.length) {
        selectedItemIndex = newIndex;
        displaySelectedItem();
        updateActiveCard();
        
        // Highlight corresponding point in PCA plot
        const selectedItem = currentView[selectedItemIndex];
        if (selectedItem) {
            highlightSelectedPoint(selectedItem);
        }
    }
}

// Display currently selected item
function displaySelectedItem() {
    if (!currentView || currentView.length === 0) return;
    
    const item = currentView[selectedItemIndex];
    
    // Update cluster info panel
    if (currentLevel === 0) {
        // Individual cluster
        displayIndividualCluster(item);
    } else {
        // Meta-cluster
        displayMetaCluster(item);
    }
    
    // Update navigation
    const itemIdentifier = currentLevel === 0 ? `Cluster ${item.id}` : item.name;
    currentClusterSpan.textContent = `${itemIdentifier} (${selectedItemIndex + 1} of ${currentView.length})`;
    prevBtn.disabled = selectedItemIndex === 0;
    nextBtn.disabled = selectedItemIndex === currentView.length - 1;
    
    updateActiveCard();
    
    // Highlight corresponding point in PCA plot
    if (item) {
        highlightSelectedPoint(item);
    }
}

// Display individual cluster
function displayIndividualCluster(cluster) {
    // Update section headers for individual cluster
    document.querySelector('.section:nth-of-type(5) h3').textContent = 'Engagement Pattern';
    document.querySelector('.section:nth-of-type(6) h3').textContent = 'Redirection Methods';
    
    clusterId.textContent = `ID: ${cluster.id}`;
    clusterName.textContent = cluster.name || `Cluster ${cluster.id}`;
    clusterTopic.textContent = cluster.topic || 'No topic information available';
    clusterDescription.textContent = cluster.description || 'No description available';
    clusterEngagement.textContent = cluster.engagement || 'No engagement information available';
    clusterRedirection.textContent = cluster.redirection || 'No redirection information available';
    
    displayKeywords(cluster.keywords, clusterKeywords);
    
    // Display all item IDs as clickable buttons
    displayItemIds(cluster.item_ids);
}

// Display meta-cluster
function displayMetaCluster(metaCluster) {
    // Update section headers for meta-cluster
    document.querySelector('.section:nth-of-type(5) h3').textContent = 'Engagement Tactics';
    document.querySelector('.section:nth-of-type(6) h3').textContent = 'Redirection Methods';
    
    clusterId.textContent = `Level ${currentLevel} Meta-Cluster`;
    clusterName.textContent = metaCluster.name;
    clusterTopic.textContent = metaCluster.topic || 'No theme information available';
    clusterDescription.textContent = metaCluster.description || 'No synthesis available';
    clusterEngagement.textContent = metaCluster.tactics || 'No tactics information available';
    clusterRedirection.textContent = metaCluster.redirection || `Contains ${metaCluster.child_count} child clusters`;
    
    displayKeywords(metaCluster.keywords, clusterKeywords);
    
    // Hide item IDs for meta-clusters
    hideItemIds();
}



// Render current view in grid
function renderCurrentView() {
    clusterGrid.innerHTML = '';
    
    if (!currentView || currentView.length === 0) {
        clusterGrid.innerHTML = '<div style="text-align: center; color: #666;">No items to display</div>';
        viewStats.textContent = 'Showing 0 items';
        return;
    }
    
    viewStats.textContent = `Showing ${currentView.length} items`;
    
    currentView.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'cluster-card';
        if (currentLevel > 0) {
            card.classList.add('meta-cluster');
        }
        
        card.onclick = () => {
            selectedItemIndex = index;
            displaySelectedItem();
            
            // Highlight corresponding point in PCA plot
            const selectedItem = currentView[selectedItemIndex];
            if (selectedItem) {
                highlightSelectedPoint(selectedItem);
            }
        };
        
        // Double-click to drill down
        card.ondblclick = () => {
            if (currentLevel > 0) {
                drillDown(item);
            }
        };
        
        const title = document.createElement('h4');
        if (currentLevel === 0) {
            title.textContent = `${item.id}: ${item.name}`;
        } else {
            title.textContent = item.name;
        }
        
        const description = document.createElement('p');
        const content = currentLevel === 0 ? item.description : item.topic;
        const shortDesc = content && content.length > 100 ? 
            content.substring(0, 100) + '...' : 
            (content || 'No description available');
        description.textContent = shortDesc;
        
        card.appendChild(title);
        card.appendChild(description);
        
        // Add stats for meta-clusters
        if (currentLevel > 0) {
            const stats = document.createElement('div');
            stats.className = 'cluster-stats';
            
            const childCount = document.createElement('span');
            childCount.className = 'child-count';
            childCount.textContent = `${item.child_count} clusters`;
            
            const drillHint = document.createElement('span');
            drillHint.textContent = 'Double-click to drill down';
            drillHint.style.fontSize = '10px';
            drillHint.style.opacity = '0.6';
            
            stats.appendChild(childCount);
            stats.appendChild(drillHint);
            card.appendChild(stats);
        }
        
        clusterGrid.appendChild(card);
    });
}

// Drill down into a meta-cluster
function drillDown(metaCluster) {
    if (currentLevel === 0) return; // Can't drill down from individual clusters
    
    // Save current state to navigation stack
    navigationStack.push({
        level: currentLevel,
        view: currentView,
        selectedIndex: selectedItemIndex,
        title: clusterListTitle.textContent
    });
    
    // Show back button
    backBtn.style.display = 'block';
    
    // Get child clusters
    const childIds = metaCluster.children;
    if (currentLevel === 1) {
        // Drilling down from level 1 to individual clusters
        currentView = hierarchyData.individual_clusters.filter(cluster => 
            childIds.includes(cluster.id)
        );
        currentLevel = 0;

        clusterListTitle.textContent = `Clusters in: ${metaCluster.name}`;
        
        // PCA stays independent - no update needed
    } else {
        // Drilling down between meta-cluster levels
        const targetLevel = currentLevel - 1;
        const targetRound = `round_${targetLevel}`;
        currentView = hierarchyData.meta_clusters[targetRound].filter(mc =>
            mc.children.some(childId => childIds.includes(childId))
        );
        currentLevel = targetLevel;

        clusterListTitle.textContent = `Level ${targetLevel} clusters in: ${metaCluster.name}`;
        
        // PCA stays independent - no update needed
    }
    
    selectedItemIndex = 0;
    renderCurrentView();
    displaySelectedItem();
}

// Go back to previous view
function goBack() {
    if (navigationStack.length === 0) return;
    
    const previousState = navigationStack.pop();
    currentLevel = previousState.level;
    currentView = previousState.view;
    selectedItemIndex = previousState.selectedIndex;
    clusterListTitle.textContent = previousState.title;
    
    // Update level buttons
    levelBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === currentLevel);
    });
    
    if (navigationStack.length === 0) {
        backBtn.style.display = 'none';
        // Reset breadcrumb to level view
        const levelName = currentLevel === 0 ? 'Individual Clusters' : 'Meta-Clusters';

    } else {
        // Update breadcrumb for intermediate level

        
        // PCA stays independent - no update needed
    }
    
    renderCurrentView();
    displaySelectedItem();
}

// Breadcrumb function removed - no longer needed

// Update active card in grid
function updateActiveCard() {
    const cards = document.querySelectorAll('.cluster-card');
    cards.forEach((card, index) => {
        card.classList.toggle('active', index === selectedItemIndex);
    });
    
    // Scroll active card into view
    if (cards[selectedItemIndex]) {
        cards[selectedItemIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}



// Search items
function searchItems() {
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        showLevel(currentLevel); // Reset to current level
        return;
    }
    
    let filteredView = [];
    if (currentLevel === 0) {
        // Search individual clusters
        filteredView = hierarchyData.individual_clusters.filter(cluster =>
            cluster.name.toLowerCase().includes(query) ||
            cluster.description.toLowerCase().includes(query) ||
            cluster.topic.toLowerCase().includes(query) ||
            cluster.keywords.toLowerCase().includes(query)
        );
    } else {
        // Search meta-clusters
        const targetRound = `round_${currentLevel}`;
        filteredView = hierarchyData.meta_clusters[targetRound].filter(metaCluster =>
            metaCluster.name.toLowerCase().includes(query) ||
            metaCluster.description.toLowerCase().includes(query) ||
            metaCluster.topic.toLowerCase().includes(query) ||
            metaCluster.keywords.toLowerCase().includes(query)
        );
    }
    
    if (filteredView.length === 0) {
        showError('No items found matching your search criteria');
        return;
    }
    
    // Update view with search results
    currentView = filteredView;
    selectedItemIndex = 0;

    clusterListTitle.textContent = `Search results for: ${query}`;
    
    // PCA stays independent - no update needed
    
    renderCurrentView();
    displaySelectedItem();
}

// Reset view
function resetView() {
    searchInput.value = '';
    showLevel(3); // Reset to top level
}

// Handle keyboard navigation
function handleKeyboardNavigation(e) {
    if (e.target.tagName.toLowerCase() === 'input') return;
    
    switch(e.key) {
        case 'ArrowLeft':
            navigateItem(-1);
            break;
        case 'ArrowRight':
            navigateItem(1);
            break;
        case 'Enter':
            // Drill down if possible
            if (currentLevel > 0 && currentView[selectedItemIndex]) {
                drillDown(currentView[selectedItemIndex]);
            }
            break;
        case 'Backspace':
        case 'Escape':
            if (navigationStack.length > 0) {
                goBack();
            }
            break;
        case '1':
            showLevel(1);
            break;
        case '2':
            showLevel(2);
            break;
        case '3':
            showLevel(3);
            break;
        case '0':
            showLevel(0);
            break;
    }
}

// Display keywords as tags
function displayKeywords(keywordsStr, container) {
    container.innerHTML = '';
    
    if (!keywordsStr || keywordsStr.trim() === '') {
        container.innerHTML = '<span style="opacity: 0.6; font-style: italic;">No keywords available</span>';
        return;
    }
    
    const keywords = keywordsStr.split(',').map(k => k.trim()).filter(k => k);
    keywords.forEach(keyword => {
        const tag = document.createElement('span');
        tag.className = 'keyword';
        tag.textContent = keyword;
        container.appendChild(tag);
    });
}

// Show loading state
function showLoading() {
    clusterName.innerHTML = '<span class="loading"></span> Loading...';
    clusterGrid.innerHTML = '<div style="text-align: center;"><span class="loading"></span> Loading clusters...</div>';
}

// Hide loading state
function hideLoading() {
    // Loading is hidden when actual content is displayed
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(244, 67, 54, 0.3);
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        document.body.removeChild(errorDiv);
    }, 5000);
}

// PCA Visualization Functions

// Show specific PCA level
function showPCALevel(level) {
    currentPCALevel = level;
    
    // Update PCA level buttons
    pcaLevelBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
    });
    
    // Draw the PCA plot
    drawPCAPlot(level);
    updatePCAInfo(level);
}

// Draw PCA plot for given level using D3.js
function drawPCAPlot(level) {
    if (!embeddingsData || !pcaSvg) return;
    
    const levelKey = `level_${level}`;
    const levelData = embeddingsData[levelKey];
    
    if (!levelData) {
        console.error(`No data found for level ${level}`);
        return;
    }
    
    const data = levelData.data;
    const rect = pcaPlot.getBoundingClientRect();
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;
    
    // Clear previous content
    pcaG.selectAll('*').remove();
    
    // Calculate centroid (center of mass) for better centering
    const xValues = data.map(d => d.x).sort((a, b) => a - b);
    const yValues = data.map(d => d.y).sort((a, b) => a - b);
    
    // Use 5th and 95th percentiles to exclude extreme outliers
    const xP5 = d3.quantile(xValues, 0.05);
    const xP95 = d3.quantile(xValues, 0.95);
    const yP5 = d3.quantile(yValues, 0.05);
    const yP95 = d3.quantile(yValues, 0.95);
    
    // Calculate centroid of the main cluster (excluding outliers)
    const mainData = data.filter(d => d.x >= xP5 && d.x <= xP95 && d.y >= yP5 && d.y <= yP95);
    const xCentroid = d3.mean(mainData, d => d.x);
    const yCentroid = d3.mean(mainData, d => d.y);
    
    // Use a reasonable range that shows most data but keeps outliers visible
    const xRange = xP95 - xP5;
    const yRange = yP95 - yP5;
    const maxRange = Math.max(xRange, yRange) * 1.4; // Add more padding to ensure outliers are visible
    
    // Create separate domains for X and Y, both centered on their respective centroids
    const xDomain = [xCentroid - maxRange/2, xCentroid + maxRange/2];
    const yDomain = [yCentroid - maxRange/2, yCentroid + maxRange/2];
    
    // Create scales with centered domains
    pcaXScale = d3.scaleLinear()
        .domain(xDomain)
        .range([margin.left, width + margin.left]);
    
    pcaYScale = d3.scaleLinear()
        .domain(yDomain)
        .range([height + margin.top, margin.top]);
    
    // Create rainbow color scale based on parent groups
    const parentGroups = [...new Set(data.map(d => d.parent))];
    pcaColorScale = d3.scaleSequential()
        .domain([0, parentGroups.length - 1])
        .interpolator(d3.interpolateRainbow);
    
    // Create color mapping for parents
    const parentColorMap = {};
    parentGroups.forEach((parent, i) => {
        parentColorMap[parent] = pcaColorScale(i);
    });
    
    // Axes removed for cleaner visualization
    
    // Axis labels removed for cleaner visualization
    
    // Determine point size based on level
    const pointRadius = level === 0 ? 2 : (level === 1 ? 5 : 8);
    
    // Use Canvas for all levels for consistent smooth performance
    return drawPCAPlotCanvas(level, data, parentGroups, parentColorMap, pointRadius);
}

// Draw PCA plot using Canvas for better performance across all levels
function drawPCAPlotCanvas(level, data, parentGroups, parentColorMap, pointRadius) {
    if (!pcaContext) return;
    
    // Store data for interactions with enhanced metadata
    currentPCAData = data.map(d => ({
        ...d,
        color: parentColorMap[d.parent],
        level: level,
        baseRadius: pointRadius,
        displayName: d.name || `Cluster ${d.id}` // Fallback for display
    }));
    
    // Clear canvas
    const rect = pcaCanvas.getBoundingClientRect();
    pcaContext.clearRect(0, 0, rect.width, rect.height);
    
    // Draw points on canvas
    drawCanvasPoints();
    
    // Update legend with rainbow colors
    updatePCALegendRainbow(parentGroups, parentColorMap);
}

// Draw points on canvas
function drawCanvasPoints() {
    drawCanvasPointsWithHighlight(null);
}

// Draw points on canvas with optional highlight
function drawCanvasPointsWithHighlight(highlightPoint) {
    if (!pcaContext || !currentPCAData.length) return;
    
    // Clear the entire canvas using actual canvas dimensions
    pcaContext.clearRect(0, 0, pcaCanvas.width, pcaCanvas.height);
    
    // Apply current transform
    pcaContext.save();
    pcaContext.translate(currentTransform.x, currentTransform.y);
    pcaContext.scale(currentTransform.k, currentTransform.k);
    
    // Draw all points with level-appropriate styling
    currentPCAData.forEach((d, index) => {
        const x = pcaXScale(d.x);
        const y = pcaYScale(d.y);
        const baseRadius = d.baseRadius / currentTransform.k;
        
        // Debug: Log radius for first few points
        if (index < 3) {
            console.log(`Point ${index}: level=${d.level}, d.baseRadius=${d.baseRadius}, transform.k=${currentTransform.k}, final radius=${baseRadius}`);
        }
        
        // Check if this is the highlighted point (hover)
        const isHoverHighlighted = highlightPoint && d === highlightPoint;
        
        // Check if this point matches the search query
        const isSearchMatch = pcaSearchMatches.size > 0 && pcaSearchMatches.has(d.id);
        const isSearchActive = pcaSearchQuery.length > 0;
        
        // Check if this point matches the highlighted parent group
        const isParentHighlighted = highlightedParentGroup && d.parent === highlightedParentGroup;
        const isParentHighlightActive = highlightedParentGroup !== null;
        
        // Determine visual properties based on highlighting state
        let radius = baseRadius;
        let alpha = d.level === 0 ? 0.6 : 0.8; // Base opacity
        
        if (isHoverHighlighted) {
            // Hover highlighting takes priority
            radius = baseRadius * 1.5;
            alpha = 1.0;
        } else if (isSearchActive) {
            if (isSearchMatch) {
                // Highlight search matches
                radius = baseRadius * 1.3;
                alpha = 1.0;
            } else {
                // Dim non-matching points during search
                alpha = 0.15;
            }
        } else if (isParentHighlightActive) {
            if (isParentHighlighted) {
                // Highlight parent group matches
                radius = baseRadius * 1.2;
                alpha = 1.0;
            } else {
                // Dim non-matching points during parent group highlighting
                alpha = 0.2;
            }
        }
        
        pcaContext.beginPath();
        pcaContext.arc(x, y, radius, 0, 2 * Math.PI);
        pcaContext.fillStyle = d.color;
        pcaContext.globalAlpha = alpha;
        pcaContext.fill();
        
        // Add stroke - more prominent for highlighted points
        if (isHoverHighlighted) {
            // Hover highlight - white stroke
            pcaContext.strokeStyle = 'rgba(255,255,255,0.9)';
            pcaContext.lineWidth = Math.max(1.5, baseRadius * 0.3) / currentTransform.k;
        } else if (isSearchActive && isSearchMatch) {
            // Search match highlight - bright cyan stroke
            pcaContext.strokeStyle = 'rgba(37, 212, 237, 0.9)';
            pcaContext.lineWidth = Math.max(1.2, baseRadius * 0.25) / currentTransform.k;
        } else if (isParentHighlightActive && isParentHighlighted) {
            // Parent group highlight - bright yellow stroke
            pcaContext.strokeStyle = 'rgba(255, 223, 0, 0.9)';
            pcaContext.lineWidth = Math.max(1.1, baseRadius * 0.2) / currentTransform.k;
        } else {
            // Default stroke
            const strokeAlpha = (isSearchActive && !isSearchMatch) || (isParentHighlightActive && !isParentHighlighted) ? 0.1 : (d.level === 0 ? 0.2 : 0.4);
            pcaContext.strokeStyle = `rgba(255,255,255,${strokeAlpha})`;
            pcaContext.lineWidth = Math.max(0.5, baseRadius * 0.15) / currentTransform.k;
        }
        pcaContext.stroke();
    });
    
    pcaContext.restore();
}

// Redraw canvas with new transform
function redrawCanvas(transform) {
    currentTransform = transform;
    drawCanvasPoints();
}

// Handle canvas mouse events
function handleCanvasMouseMove(event) {
    if (!currentPCAData.length) return;
    
    // Throttle mouse events for better performance
    if (mouseThrottleTimeout) return;
    mouseThrottleTimeout = setTimeout(() => {
        mouseThrottleTimeout = null;
    }, 16); // ~60fps
    
    const rect = pcaCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Transform mouse coordinates back to data space
    const x = (mouseX - currentTransform.x) / currentTransform.k;
    const y = (mouseY - currentTransform.y) / currentTransform.k;
    
    // Find nearest point with efficient spatial searching
    let closestPoint = null;
    let minDistance = Infinity;
    const searchRadius = 10 / currentTransform.k; // Adjust search radius based on zoom
    
    // Optimization: only check points that are potentially visible and close
    const visibleMargin = 50; // pixels
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    for (const d of currentPCAData) {
        const px = pcaXScale(d.x);
        const py = pcaYScale(d.y);
        
        // Transform point to screen coordinates
        const screenX = px * currentTransform.k + currentTransform.x;
        const screenY = py * currentTransform.k + currentTransform.y;
        
        // Skip points that are clearly off-screen
        if (screenX < -visibleMargin || screenX > canvasWidth + visibleMargin ||
            screenY < -visibleMargin || screenY > canvasHeight + visibleMargin) {
            continue;
        }
        
        const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        const pointRadius = d.baseRadius / currentTransform.k;
        
        if (distance <= pointRadius + searchRadius && distance < minDistance) {
            minDistance = distance;
            closestPoint = d;
        }
    }
    
    // Show/hide tooltip with better performance
    if (closestPoint && closestPoint !== selectedPCAPoint) {
        selectedPCAPoint = closestPoint;
        showPCATooltip(event, closestPoint);
        pcaCanvas.style.cursor = 'pointer';
        
        // Highlight the point by redrawing with highlight
        drawCanvasPointsWithHighlight(closestPoint);
    } else if (!closestPoint && selectedPCAPoint) {
        selectedPCAPoint = null;
        hidePCATooltip();
        pcaCanvas.style.cursor = 'default';
        
        // Redraw without highlight
        drawCanvasPoints();
    }
}

function handleCanvasClick(event) {
    if (!currentPCAData.length) return;
    
    const rect = pcaCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Transform mouse coordinates back to data space
    const x = (mouseX - currentTransform.x) / currentTransform.k;
    const y = (mouseY - currentTransform.y) / currentTransform.k;
    
    // Find clicked point - use the same logic as mouse move for consistency
    let clickedPoint = null;
    let minDistance = Infinity;
    const searchRadius = 10 / currentTransform.k;
    
    for (const d of currentPCAData) {
        const px = pcaXScale(d.x);
        const py = pcaYScale(d.y);
        const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        const pointRadius = d.baseRadius / currentTransform.k;
        
        if (distance <= pointRadius + searchRadius && distance < minDistance) {
            minDistance = distance;
            clickedPoint = d;
        }
    }
    
    if (clickedPoint) {
        const currentTime = Date.now();
        const isDoubleClick = (currentTime - lastClickTime < 300) && (lastClickedPoint === clickedPoint);
        
        if (isDoubleClick) {
            // Double-click: drill down into the cluster
            handlePCAPointDoubleClick(clickedPoint, clickedPoint.level || currentPCALevel);
        } else {
            // Single click: show cluster info
            handlePCAPointClick(clickedPoint, clickedPoint.level || currentPCALevel);
        }
        
        lastClickTime = currentTime;
        lastClickedPoint = clickedPoint;
    }
}

// Handle double-click on PCA points for drill-down
function handlePCAPointDoubleClick(data, level) {
    // For individual clusters (level 0), we can't drill down further
    if (level === 0) {
        console.log('Cannot drill down from individual clusters');
        return;
    }
    
    // Find the corresponding cluster data in the current view
    if (currentView && Array.isArray(currentView)) {
        const clusterToSelect = currentView.find(cluster => 
            cluster.id === data.id || cluster.name === data.name
        );
        
        if (clusterToSelect) {
            console.log('Drilling down into cluster:', clusterToSelect.name);
            drillDown(clusterToSelect);
        } else {
            console.log('Could not find cluster data for drill-down:', data);
        }
    }
}

// PCA Tooltip functions
function showPCATooltip(event, data) {
    // Create or get existing tooltip
    let tooltip = d3.select('body').select('.pca-tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('class', 'pca-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(18, 18, 18, 0.95)')
            .style('color', 'white')
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('border', '1px solid #FF0050')
            .style('font-size', '12px')
            .style('font-family', '"Helvetica Neue", Arial, sans-serif')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('opacity', 0);
    }
    
    tooltip.transition()
        .duration(100)
        .style('opacity', 0.95);
    
    const level = data.level || currentPCALevel;
    const canDrillDown = level > 0; // Can only drill down from meta-clusters
    const drillText = canDrillDown ? '<br/><em>Double-click to drill down</em>' : '';
    
    tooltip.html(`<strong>${data.displayName || data.name}</strong><br/>Parent: ${data.parent}<br/><em>Click to explore</em>${drillText}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
}

function hidePCATooltip() {
    d3.select('body').select('.pca-tooltip')
        .transition()
        .duration(100)
        .style('opacity', 0);
}

// Update UMAP info panel
function updatePCAInfo(level) {
    const levelKey = `level_${level}`;
    const levelData = embeddingsData[levelKey];
    
    if (!levelData) return;
    
    // UMAP doesn't have explained variance, so we keep the static text from HTML
    pcaClusters.textContent = levelData.data.length.toLocaleString();
    
    // Count unique parents
    const uniqueParents = new Set(levelData.data.map(d => d.parent));
    pcaParents.textContent = uniqueParents.size;
    
    // Update legend
    updatePCALegend(levelData);
}

// Update PCA for filtered view (drill-down)
function updatePCAForFilteredView(level, filteredIds) {
    if (!embeddingsData || !pcaSvg) return;
    
    const levelKey = `level_${level}`;
    const levelData = embeddingsData[levelKey];
    
    if (!levelData) {
        console.error(`No data found for level ${level}`);
        return;
    }
    
    // Filter data to only show the selected clusters
    const filteredData = levelData.data.filter(d => filteredIds.includes(d.id));
    
    if (filteredData.length === 0) {
        console.error(`No matching data found for filtered IDs`);
        return;
    }
    
    const rect = pcaPlot.getBoundingClientRect();
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;
    
    // Clear previous content
    pcaG.selectAll('*').remove();
    
    // Calculate centroid (center of mass) for filtered data
    const xValues = filteredData.map(d => d.x).sort((a, b) => a - b);
    const yValues = filteredData.map(d => d.y).sort((a, b) => a - b);
    
    // Use 5th and 95th percentiles to exclude extreme outliers
    const xP5 = d3.quantile(xValues, 0.05);
    const xP95 = d3.quantile(xValues, 0.95);
    const yP5 = d3.quantile(yValues, 0.05);
    const yP95 = d3.quantile(yValues, 0.95);
    
    // Calculate centroid of the main cluster (excluding outliers)
    const mainData = filteredData.filter(d => d.x >= xP5 && d.x <= xP95 && d.y >= yP5 && d.y <= yP95);
    const xCentroid = d3.mean(mainData, d => d.x);
    const yCentroid = d3.mean(mainData, d => d.y);
    
    // Use a reasonable range that shows most data but keeps outliers visible
    const xRange = xP95 - xP5;
    const yRange = yP95 - yP5;
    const maxRange = Math.max(xRange, yRange) * 1.4; // Add more padding to ensure outliers are visible
    
    // Create separate domains for X and Y, both centered on their respective centroids
    const xDomain = [xCentroid - maxRange/2, xCentroid + maxRange/2];
    const yDomain = [yCentroid - maxRange/2, yCentroid + maxRange/2];
    
    // Create scales with centered domains
    pcaXScale = d3.scaleLinear()
        .domain(xDomain)
        .range([margin.left, width + margin.left]);
    
    pcaYScale = d3.scaleLinear()
        .domain(yDomain)
        .range([height + margin.top, margin.top]);
    
    // Create rainbow color scale based on parent groups
    const parentGroups = [...new Set(filteredData.map(d => d.parent))];
    pcaColorScale = d3.scaleSequential()
        .domain([0, parentGroups.length - 1])
        .interpolator(d3.interpolateRainbow);
    
    // Create color mapping for parents
    const parentColorMap = {};
    parentGroups.forEach((parent, i) => {
        parentColorMap[parent] = pcaColorScale(i);
    });
    
    // Axes removed for cleaner visualization
    
    // Axis labels removed for cleaner visualization
    
    // Determine point size based on level
    const pointRadius = level === 0 ? 2 : (level === 1 ? 5 : 8);
    
    // Create tooltip
    const tooltip = d3.select('body').selectAll('.pca-tooltip').data([0]);
    const tooltipEnter = tooltip.enter().append('div')
        .attr('class', 'pca-tooltip')
        .style('opacity', 0);
    
    const tooltipUpdate = tooltipEnter.merge(tooltip);
    
    // Draw points
    pcaG.selectAll('.pca-point')
        .data(filteredData)
        .enter()
        .append('circle')
        .attr('class', 'pca-point')
        .attr('cx', d => pcaXScale(d.x))
        .attr('cy', d => pcaYScale(d.y))
        .attr('r', pointRadius)
        .attr('fill', d => parentColorMap[d.parent])
        .attr('opacity', 0.8)
        .on('mouseover', function(event, d) {
            // Highlight point
            d3.select(this)
                .attr('opacity', 1)
                .attr('r', pointRadius * 1.5);
            
            // Show tooltip
            tooltipUpdate
                .style('opacity', 0.95)
                .html(`<strong>${d.name}</strong><br/>Parent: ${d.parent}<br/><em>Click to explore</em>`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function(event, d) {
            // Reset point
            d3.select(this)
                .attr('opacity', 0.8)
                .attr('r', pointRadius);
            
            // Hide tooltip
            tooltipUpdate.style('opacity', 0);
        })
        .on('click', function(event, d) {
            handlePCAPointClick(d, level);
        });
    
    // Update legend with rainbow colors
    updatePCALegendRainbow(parentGroups, parentColorMap);
    
    // Update PCA level buttons to show filtered state
    currentPCALevel = level;
    pcaLevelBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
    });
    
    // Update info panel
    updatePCAInfoFiltered(level, filteredData.length, parentGroups.length);
}

// Update UMAP info panel for filtered view
function updatePCAInfoFiltered(level, clusterCount, parentCount) {
    // UMAP doesn't have explained variance, so we keep the static text from HTML
    pcaClusters.textContent = `${clusterCount.toLocaleString()} (filtered)`;
    pcaParents.textContent = parentCount;
}

// Update PCA legend with rainbow colors
function updatePCALegendRainbow(parentGroups, parentColorMap) {
    pcaLegend.innerHTML = '';
    
    // Show all parent groups - they will be scrollable if too many
    parentGroups.forEach(parent => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.style.cursor = 'pointer';
        item.title = `Click to view: ${parent}`;
        
        const colorDiv = document.createElement('div');
        colorDiv.className = 'legend-color';
        colorDiv.style.backgroundColor = parentColorMap[parent];
        
        const textDiv = document.createElement('div');
        textDiv.className = 'legend-text';
        textDiv.textContent = parent.length > 25 ? parent.substring(0, 25) + '...' : parent;
        
        item.appendChild(colorDiv);
        item.appendChild(textDiv);
        pcaLegend.appendChild(item);
        
        // Add hover effects with parent group highlighting
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = 'rgba(255, 0, 80, 0.1)';
            item.style.transform = 'scale(1.02)';
            
            // Highlight parent group in the plot
            highlightedParentGroup = parent;
            drawCanvasPoints();
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
            item.style.transform = 'scale(1)';
            
            // Clear parent group highlighting
            highlightedParentGroup = null;
            drawCanvasPoints();
        });
        
        // Add click functionality to navigate to Level 3 cluster
        item.addEventListener('click', () => navigateToLevel3Cluster(parent));
    });
}

// Navigate to Level 3 cluster when parent group is clicked
function navigateToLevel3Cluster(parentName) {
    if (!hierarchyData || !hierarchyData.meta_clusters || !hierarchyData.meta_clusters.round_3) {
        console.error('Level 3 cluster data not available');
        return;
    }
    
    // Find the Level 3 cluster by name
    const level3Clusters = hierarchyData.meta_clusters.round_3;
    const targetCluster = level3Clusters.find(cluster => cluster.name === parentName);
    
    if (!targetCluster) {
        console.error('Level 3 cluster not found:', parentName);
        return;
    }
    
    // Clear any existing navigation stack and search
    navigationStack = [];
    searchInput.value = '';
    
    // Navigate to Level 3 and set the current view to only show Level 3 clusters
    currentLevel = 3;
    currentView = level3Clusters;
    
    // Find the index of the target cluster
    selectedItemIndex = level3Clusters.findIndex(cluster => cluster.name === parentName);
    if (selectedItemIndex === -1) selectedItemIndex = 0;
    
    // Update UI elements
    levelBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === 3);
    });
    

    clusterListTitle.textContent = 'Level 3 Meta-Clusters';
    backBtn.style.display = 'none';
    
    // Render the view and display the selected cluster
    renderCurrentView();
    displaySelectedItem();
    
    console.log('Navigated to Level 3 cluster:', parentName);
}

// Highlight parent group in PCA plot
function highlightParentGroup(parentName) {
    if (!pcaG) return;
    
    pcaG.selectAll('.pca-point')
        .transition()
        .duration(300)
        .attr('opacity', d => d.parent === parentName ? 1 : 0.2)
        .attr('r', d => {
            const baseRadius = currentPCALevel === 0 ? 2 : (currentPCALevel === 1 ? 5 : 8);
            return d.parent === parentName ? baseRadius * 1.5 : baseRadius;
        });
    
    // Reset after 3 seconds
    setTimeout(() => {
        if (pcaG) {
            pcaG.selectAll('.pca-point')
                .transition()
                .duration(500)
                .attr('opacity', 0.8)
                .attr('r', currentPCALevel === 0 ? 2 : (currentPCALevel === 1 ? 5 : 8));
        }
    }, 3000);
}

// Handle PCA point click with D3.js
function handlePCAPointClick(pointData, level) {
    selectedPCAPoint = pointData;
    
    // Find and display the cluster
    if (level === 0) {
        // Individual cluster
        const cluster = hierarchyData.individual_clusters.find(c => c.id === pointData.id);
        if (cluster) {
            // If we're in a filtered view, find the index in current view
            if (currentView !== hierarchyData.individual_clusters) {
                const indexInCurrentView = currentView.findIndex(c => c.id === pointData.id);
                if (indexInCurrentView !== -1) {
                    selectedItemIndex = indexInCurrentView;
                } else {
                    // If not in current view, switch to full view
                    currentLevel = 0;
                    currentView = hierarchyData.individual_clusters;
                    selectedItemIndex = hierarchyData.individual_clusters.findIndex(c => c.id === pointData.id);
                    
                    // Clear navigation stack
                    navigationStack = [];
                    backBtn.style.display = 'none';
                    
                    // Update UI
                    levelBtns.forEach(btn => {
                        btn.classList.toggle('active', parseInt(btn.dataset.level) === 0);
                    });
                    

                    clusterListTitle.textContent = 'Individual Clusters';
                }
            } else {
                selectedItemIndex = hierarchyData.individual_clusters.findIndex(c => c.id === pointData.id);
            }
            
            renderCurrentView();
            displaySelectedItem();
        }
    } else {
        // Meta-cluster
        const targetRound = `round_${level}`;
        const metaClusters = hierarchyData.meta_clusters[targetRound];
        const metaCluster = metaClusters.find(mc => mc.id === pointData.id);
        
        if (metaCluster) {
            // If we're in a filtered view, find the index in current view
            if (currentView !== metaClusters) {
                const indexInCurrentView = currentView.findIndex(mc => mc.id === pointData.id);
                if (indexInCurrentView !== -1) {
                    selectedItemIndex = indexInCurrentView;
                } else {
                    // If not in current view, switch to full view
                    currentLevel = level;
                    currentView = metaClusters;
                    selectedItemIndex = metaClusters.findIndex(mc => mc.id === pointData.id);
                    
                    // Clear navigation stack
                    navigationStack = [];
                    backBtn.style.display = 'none';
                    
                    // Update UI
                    levelBtns.forEach(btn => {
                        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
                    });
                    

                    clusterListTitle.textContent = `Level ${level} Meta-Clusters`;
                }
            } else {
                selectedItemIndex = metaClusters.findIndex(mc => mc.id === pointData.id);
            }
            
            renderCurrentView();
            displaySelectedItem();
        }
    }
    
    // Highlight selected point in PCA plot
    highlightSelectedPoint(pointData);
}

// Highlight selected point in PCA plot
function highlightSelectedPoint(pointData) {
    if (!pcaG) return;
    
    pcaG.selectAll('.pca-point')
        .classed('selected', d => d.id === pointData.id);
}



// PCA Search Functions
function searchClustersInPCA(query) {
    pcaSearchQuery = query.toLowerCase().trim();
    pcaSearchMatches.clear();
    
    if (!pcaSearchQuery || !currentPCAData.length) {
        clearPCASearch();
        return;
    }
    
    // Search through current PCA data - KEYWORDS ONLY
    currentPCAData.forEach(d => {
        // Find the corresponding cluster data based on the current PCA level
        let actualKeywords = '';
        let searchData = null;
        
        // Get the appropriate data source based on current PCA level
        if (currentPCALevel === 0) {
            searchData = hierarchyData?.individual_clusters;
        } else if (currentPCALevel === 1) {
            searchData = hierarchyData?.meta_clusters?.round_1;
        } else if (currentPCALevel === 2) {
            searchData = hierarchyData?.meta_clusters?.round_2;
        }
        
        if (searchData && Array.isArray(searchData)) {
            const cluster = searchData.find(c => c.id === d.id || c.name === d.name);
            if (cluster && cluster.keywords) {
                actualKeywords = cluster.keywords.toLowerCase();
            }
        }
        
        if (actualKeywords && actualKeywords.includes(pcaSearchQuery)) {
            pcaSearchMatches.add(d.id);
        }
    });
    
    console.log(`Found ${pcaSearchMatches.size} matches for "${query}"`);
    
    // Redraw with highlighting
    drawCanvasPoints();
    
    // Update clear button state
    pcaSearchClear.disabled = false;
    pcaSearchClear.style.opacity = '1';
}

function clearPCASearch() {
    pcaSearchQuery = '';
    pcaSearchMatches.clear();
    pcaSearchInput.value = '';
    
    // Redraw without highlighting
    drawCanvasPoints();
    
    // Update clear button state
    pcaSearchClear.disabled = true;
    pcaSearchClear.style.opacity = '0.3';
}

function setupPCASearchListeners() {
    // Search input event
    pcaSearchInput.addEventListener('input', (e) => {
        searchClustersInPCA(e.target.value);
    });
    
    // Clear button event
    pcaSearchClear.addEventListener('click', () => {
        clearPCASearch();
    });
    
    // Enter key to focus search
    pcaSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchClustersInPCA(e.target.value);
        }
    });
    
    // Initialize clear button state
    pcaSearchClear.disabled = true;
    pcaSearchClear.style.opacity = '0.3';
}

// Display keywords in a styled format
function displayKeywords(keywords, container) {
    container.innerHTML = '';
    
    if (!keywords || typeof keywords !== 'string' || !keywords.trim()) {
        container.textContent = 'No keywords available';
        return;
    }
    
    // Split keywords by comma and clean up
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keywordList.length === 0) {
        container.textContent = 'No keywords available';
        return;
    }
    
    keywordList.forEach((keyword, index) => {
        const keywordSpan = document.createElement('span');
        keywordSpan.className = 'keyword';
        keywordSpan.textContent = keyword;
        container.appendChild(keywordSpan);
    });
}

// Display item IDs for individual clusters
function displayItemIds(itemIds) {
    const itemIdsSection = document.getElementById('itemIdsSection');
    const clusterItemIds = document.getElementById('clusterItemIds');
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        itemIdsSection.style.display = 'none';
        return;
    }
    
    // Show ALL item IDs as clickable buttons
    clusterItemIds.innerHTML = '';
    itemIds.forEach(item => {
        const idLink = document.createElement('a');
        idLink.className = 'item-id';
        
        // Handle both old format (string) and new format (object with item_id and truth_value)
        let itemId, truthValue;
        if (typeof item === 'object' && item.item_id !== undefined) {
            itemId = item.item_id;
            truthValue = item.truth_value;
        } else {
            // Fallback for old format
            itemId = item;
            truthValue = false;
        }
        
        idLink.textContent = itemId;
        
        // Conditional link based on truth value
        if (truthValue) {
            // Use photo-post link for truth_value = true
            idLink.href = `https://lighthouse.tiktok-usts.net/detail/photo-post?item_id=${itemId}&product=tiktok&config_key=tiktok_photo_post`;
        } else {
            // Use original video link for truth_value = false
            idLink.href = `https://lighthouse.tiktok-usts.net/detail/video?item_id=${itemId}&product=tiktok&config_key=tiktok`;
        }
        
        idLink.target = '_blank'; // Open in new tab
        idLink.rel = 'noopener noreferrer'; // Security best practice
        
        // Add visual indicator for photo posts
        if (truthValue) {
            idLink.style.background = '#4CAF50'; // Green for photo posts
            idLink.title = 'Photo Post';
        } else {
            idLink.title = 'Video Post';
        }
        
        clusterItemIds.appendChild(idLink);
    });
    
    itemIdsSection.style.display = 'block';
}

// Copy all item IDs to clipboard
function copyAllItemIds() {
    const clusterItemIds = document.getElementById('clusterItemIds');
    const itemLinks = clusterItemIds.querySelectorAll('.item-id');
    
    if (itemLinks.length === 0) {
        return;
    }
    
    // Extract text content from all item ID links
    const itemIdStrings = Array.from(itemLinks)
        .filter(link => !link.textContent.startsWith('+')) // Exclude "+X more" indicators
        .map(link => link.textContent);
    
    const text = itemIdStrings.join('\n');
    
    if (!text || text.trim() === '') {
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        // Show success feedback
        copyItemIdsBtn.textContent = '✓ Copied!';
        copyItemIdsBtn.classList.add('copied');
        
        // Reset button after 2 seconds
        setTimeout(() => {
            copyItemIdsBtn.textContent = 'Copy All';
            copyItemIdsBtn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            copyItemIdsBtn.textContent = '✓ Copied!';
            copyItemIdsBtn.classList.add('copied');
            setTimeout(() => {
                copyItemIdsBtn.textContent = 'Copy All';
                copyItemIdsBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
    });
}

// Hide item IDs section for meta-clusters
function hideItemIds() {
    const itemIdsSection = document.getElementById('itemIdsSection');
    itemIdsSection.style.display = 'none';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupPCASearchListeners();
    init();
});