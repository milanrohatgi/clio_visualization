#!/usr/bin/env python3

import json
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
import umap
from tqdm import tqdm
import warnings
warnings.filterwarnings('ignore')

def load_hierarchical_data():
    """Load the hierarchical cluster data"""
    try:
        with open('hierarchical_clusters.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: hierarchical_clusters.json not found. Please run hierarchy_parser.py first.")
        return None

def extract_text_content(cluster):
    """Extract and combine text content from cluster for embedding"""
    text_parts = []
    
    # Add cluster name
    if cluster.get('name'):
        text_parts.append(cluster['name'])
    
    # Add keywords
    if cluster.get('keywords'):
        if isinstance(cluster['keywords'], list):
            text_parts.extend(cluster['keywords'])
        else:
            text_parts.append(str(cluster['keywords']))
    
    # Add engagement patterns (different field names for individual vs meta clusters)
    if cluster.get('engagement'):  # individual clusters
        text_parts.append(cluster['engagement'])
    elif cluster.get('tactics'):  # meta clusters (updated field name)
        text_parts.append(cluster['tactics'])
    
    # Add redirection patterns (different field names for individual vs meta clusters)
    if cluster.get('redirection'):  # both individual and meta clusters now use 'redirection'
        text_parts.append(cluster['redirection'])
    
    # Add common topics or themes
    if cluster.get('topic'):  # can be common_topic or overarching_theme
        text_parts.append(cluster['topic'])
    
    # Add synthesis/description
    if cluster.get('description'):
        text_parts.append(cluster['description'])
    
    # Combine all text parts
    combined_text = ' '.join([str(part) for part in text_parts if part and str(part).strip()])
    
    # Fallback if no text found
    if not combined_text.strip():
        combined_text = f"Cluster {cluster.get('id', 'unknown')}"
    
    return combined_text

def generate_embeddings_for_level(clusters, level_name, model, hierarchy_data=None):
    """Generate embeddings for a specific level"""
    print(f"\nGenerating embeddings for {level_name}...")
    
    # Extract text content for each cluster
    texts = []
    cluster_data = []
    
    for cluster in tqdm(clusters, desc=f"Processing {level_name}"):
        text_content = extract_text_content(cluster)
        texts.append(text_content)
        cluster_data.append(cluster)
    
    print(f"Extracted text from {len(texts)} clusters")
    
    # Generate sentence embeddings using SentenceTransformer
    print("Generating sentence embeddings...")
    embeddings = model.encode(texts, 
                             batch_size=32, 
                             show_progress_bar=True,
                             convert_to_numpy=True)
    
    print(f"Generated {embeddings.shape[0]} embeddings of dimension {embeddings.shape[1]}")
    
    # Apply UMAP for dimensionality reduction to 2D
    print("Applying UMAP dimensionality reduction...")
    umap_reducer = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.1,
        metric='cosine',  # Good for text embeddings
        random_state=42
    )
    
    embeddings_2d = umap_reducer.fit_transform(embeddings)
    print(f"UMAP reduced embeddings to {embeddings_2d.shape}")
    
    # Determine parent assignments for coloring - ALL LEVELS USE LEVEL 3 PARENTS
    parent_assignments = []
    if level_name == "level_0":  # Individual clusters - color by Level 3 parents
        for cluster in cluster_data:
            parent_names = cluster.get('parent_names', {})
            parent_assignments.append(parent_names.get('round_3', 'Unknown'))
    elif level_name == "level_1":  # Level 1 meta-clusters - color by Level 3 parents
        # For level_1 clusters, need to trace through level_2 to find level_3 parent
        if hierarchy_data and 'meta_clusters' in hierarchy_data and 'round_2' in hierarchy_data['meta_clusters'] and 'round_3' in hierarchy_data['meta_clusters']:
            round_1_clusters = hierarchy_data['meta_clusters']['round_1']
            round_2_clusters = hierarchy_data['meta_clusters']['round_2']
            round_3_clusters = hierarchy_data['meta_clusters']['round_3']

            # For each level_1 cluster, find its level_2 parent, then find level_3 parent
            for i, cluster in enumerate(cluster_data):
                cluster_index = None
                for idx, r1_cluster in enumerate(round_1_clusters):
                    if r1_cluster.get('id') == cluster.get('id'):
                        cluster_index = idx
                        break

                parent_found = False
                if cluster_index is not None:
                    # Find level_2 parent
                    level_2_parent_index = None
                    for r2_idx, r2_cluster in enumerate(round_2_clusters):
                        children_list = r2_cluster.get('children', [])
                        if cluster_index in children_list:
                            level_2_parent_index = r2_idx
                            break

                    # Find level_3 parent
                    if level_2_parent_index is not None:
                        for r3_cluster in round_3_clusters:
                            children_list = r3_cluster.get('children', [])
                            if level_2_parent_index in children_list:
                                parent_assignments.append(r3_cluster.get('name', 'Unknown'))
                                parent_found = True
                                break

                if not parent_found:
                    parent_assignments.append('Unknown')
        else:
            parent_assignments = ['Unknown'] * len(cluster_data)
    elif level_name == "level_2":  # Level 2 meta-clusters - color by Level 3 parents
        # For round_2 meta-clusters, children lists contain indices, not IDs
        if hierarchy_data and 'meta_clusters' in hierarchy_data and 'round_3' in hierarchy_data['meta_clusters']:
            round_3_clusters = hierarchy_data['meta_clusters']['round_3']
            round_2_clusters = hierarchy_data['meta_clusters']['round_2']
            
            for i, cluster in enumerate(cluster_data):
                cluster_index = None
                for idx, r2_cluster in enumerate(round_2_clusters):
                    if r2_cluster.get('id') == cluster.get('id'):
                        cluster_index = idx
                        break
                
                parent_found = False
                if cluster_index is not None:
                    # Find level_3 parent by checking which round_3 cluster contains this index
                    for r3_cluster in round_3_clusters:
                        children_list = r3_cluster.get('children', [])
                        if cluster_index in children_list:
                            parent_assignments.append(r3_cluster.get('name', 'Unknown'))
                            parent_found = True
                            break
                
                if not parent_found:
                    parent_assignments.append('Unknown')
        else:
            parent_assignments = ['Unknown'] * len(cluster_data)
    else:
        parent_assignments = ['Unknown'] * len(cluster_data)
    
    # Create result data
    result_data = []
    for i, cluster in enumerate(cluster_data):
        result_data.append({
            'id': cluster.get('id', f'{level_name}_{i}'),
            'name': cluster.get('name', f'Cluster {i}'),
            'x': float(embeddings_2d[i, 0]),
            'y': float(embeddings_2d[i, 1]),
            'parent': parent_assignments[i],
            'text_content': texts[i]
        })
    
    print(f"Generated {len(result_data)} data points for {level_name}")
    return result_data

def main():
    print("=== UMAP Cluster Embeddings Generator ===")
    print("Using SentenceTransformer: paraphrase-multilingual-mpnet-base-v2")
    
    # Load hierarchical data
    print("Loading hierarchical cluster data...")
    hierarchy_data = load_hierarchical_data()
    if not hierarchy_data:
        return
    
    print(f"Loaded hierarchy with {len(hierarchy_data.get('individual_clusters', []))} individual clusters")
    print(f"Meta-clusters: Round 1: {len(hierarchy_data.get('meta_clusters', {}).get('round_1', []))}, "
          f"Round 2: {len(hierarchy_data.get('meta_clusters', {}).get('round_2', []))}, "
          f"Round 3: {len(hierarchy_data.get('meta_clusters', {}).get('round_3', []))}")
    
    # Initialize SentenceTransformer model
    print("\nInitializing SentenceTransformer model...")
    model = SentenceTransformer('paraphrase-multilingual-mpnet-base-v2')
    print("Model loaded successfully")
    
    # Generate embeddings for each level
    all_embeddings = {}
    
    # Level 0: Individual clusters
    if 'individual_clusters' in hierarchy_data:
        individual_clusters = hierarchy_data['individual_clusters']
        level_0_data = generate_embeddings_for_level(individual_clusters, "level_0", model, hierarchy_data)
        all_embeddings['level_0'] = {'data': level_0_data}
    
    # Level 1: Round 1 meta-clusters
    if 'meta_clusters' in hierarchy_data and 'round_1' in hierarchy_data['meta_clusters']:
        round_1_clusters = hierarchy_data['meta_clusters']['round_1']
        level_1_data = generate_embeddings_for_level(round_1_clusters, "level_1", model, hierarchy_data)
        all_embeddings['level_1'] = {'data': level_1_data}
    
    # Level 2: Round 2 meta-clusters
    if 'meta_clusters' in hierarchy_data and 'round_2' in hierarchy_data['meta_clusters']:
        round_2_clusters = hierarchy_data['meta_clusters']['round_2']
        level_2_data = generate_embeddings_for_level(round_2_clusters, "level_2", model, hierarchy_data)
        all_embeddings['level_2'] = {'data': level_2_data}
    
    # Save embeddings
    output_file = 'cluster_embeddings.json'
    print(f"\nSaving embeddings to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(all_embeddings, f, indent=2)
    
    print(f"✅ UMAP embeddings saved successfully!")
    print(f"📊 Summary:")
    for level, data in all_embeddings.items():
        print(f"  {level}: {len(data['data'])} clusters")
    
    print(f"\n🎯 Ready to visualize!")
    print(f"  Open the web interface to explore your cluster data.")

if __name__ == "__main__":
    main()
