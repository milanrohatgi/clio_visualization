#!/usr/bin/env python3
import pandas as pd
import json
import re
import ast
from typing import Dict, Any, List
import html

def extract_xml_field(xml_content: str, field_name: str) -> str:
    """Extract a specific field from XML content using regex"""
    pattern = f'<{field_name}>(.*?)</{field_name}>'
    match = re.search(pattern, xml_content, re.DOTALL)
    if match:
        content = match.group(1).strip()
        # Decode HTML entities if present
        content = html.unescape(content)
        return content
    return ""

def parse_item_ids(item_ids_str) -> List[Dict[str, Any]]:
    """Parse the item_ids column which now contains tuples with (item_id, truth_value)"""
    # Handle NaN/None values
    if pd.isna(item_ids_str) or item_ids_str is None:
        return []
    
    # Convert to string if not already
    item_ids_str = str(item_ids_str)
    
    try:
        # Try to parse as a Python literal (list of tuples)
        parsed_data = ast.literal_eval(item_ids_str)
        
        # Convert tuples to dictionaries with item_id and truth_value
        result = []
        for item in parsed_data:
            if isinstance(item, tuple) and len(item) >= 2:
                result.append({
                    'item_id': str(item[0]),
                    'truth_value': bool(item[1])
                })
            elif isinstance(item, (str, int)):
                # Fallback for old format - assume False for truth_value
                result.append({
                    'item_id': str(item),
                    'truth_value': False
                })
        return result
    except:
        try:
            # If that fails, try to clean it up and parse
            cleaned = item_ids_str.strip()
            if cleaned.startswith('[') and cleaned.endswith(']'):
                # Remove brackets and split by comma
                items = cleaned[1:-1].split(',')
                result = []
                for item in items:
                    item = item.strip().strip("'\"")
                    if item:
                        # Old format fallback
                        result.append({
                            'item_id': str(item),
                            'truth_value': False
                        })
                return result
        except:
            pass
    
    # Fallback: return empty list
    print(f"Could not parse item_ids: {item_ids_str[:100]}...")
    return []

def parse_xml_robust(xml_string, is_meta_cluster: bool = False) -> Dict[str, Any]:
    """Parse XML content robustly using regex instead of XML parser"""
    try:
        # Handle NaN/None values
        if pd.isna(xml_string) or xml_string is None:
            return {}
        
        # Convert to string if not already
        xml_string = str(xml_string)
        
        # Clean up the XML string
        xml_string = xml_string.strip('```xml').strip('```').strip()
        
        # Fields to extract - different for individual vs meta clusters
        if is_meta_cluster:
            # Meta-cluster fields use engagement_tactics and redirection_methods
            fields = [
                'overarching_theme', 'meta_keywords', 'engagement_tactics', 
                'redirection_methods', 'synthesis_of_clusters', 'meta_cluster_name'
            ]
        else:
            # Individual cluster fields use common_engagement and common_redirection
            fields = [
                'common_topic', 'keywords', 'common_engagement', 'common_redirection', 
                'synthesis', 'cluster_name'
            ]
        
        result = {}
        for field in fields:
            result[field] = extract_xml_field(xml_string, field)
        
        return result
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return {}

def process_cluster_data(df: pd.DataFrame) -> Dict[str, Any]:
    """Process the cluster data with robust parsing"""
    clusters = []
    
    for idx, row in df.iterrows():
        # Use index as cluster ID
        cluster_id = idx
        
        # Parse item_ids
        item_ids = parse_item_ids(row['item_ids'])
        
        # Parse cluster_name (individual cluster analysis)
        cluster_analysis = parse_xml_robust(row['cluster_name'], is_meta_cluster=False)
        
        # Parse round_1_cluster_name (meta analysis 1)
        round_1_meta = parse_xml_robust(row['round_1_cluster_name'], is_meta_cluster=True)
        
        # Parse round_2_cluster_name (meta analysis 2)  
        round_2_meta = parse_xml_robust(row['round_2_cluster_name'], is_meta_cluster=True)
        
        # Parse round_3_cluster_name (meta analysis 3)
        round_3_meta = parse_xml_robust(row['round_3_cluster_name'], is_meta_cluster=True)
        
        cluster_data = {
            'id': cluster_id,
            'name': cluster_analysis.get('cluster_name', f'Cluster {cluster_id}'),
            'description': cluster_analysis.get('synthesis', ''),
            'topic': cluster_analysis.get('common_topic', ''),
            'keywords': cluster_analysis.get('keywords', ''),
            'engagement': cluster_analysis.get('common_engagement', ''),
            'redirection': cluster_analysis.get('common_redirection', ''),
            'item_ids': item_ids,  # Field for item IDs
            'meta_analyses': {
                'round_1': {
                    'theme': round_1_meta.get('overarching_theme', ''),
                    'keywords': round_1_meta.get('meta_keywords', ''),
                    'tactics': round_1_meta.get('engagement_tactics', ''),  # Updated field name
                    'redirection': round_1_meta.get('redirection_methods', ''),  # Updated field name
                    'synthesis': round_1_meta.get('synthesis_of_clusters', ''),
                    'name': round_1_meta.get('meta_cluster_name', '')
                },
                'round_2': {
                    'theme': round_2_meta.get('overarching_theme', ''),
                    'keywords': round_2_meta.get('meta_keywords', ''),
                    'tactics': round_2_meta.get('engagement_tactics', ''),  # Updated field name
                    'redirection': round_2_meta.get('redirection_methods', ''),  # Updated field name
                    'synthesis': round_2_meta.get('synthesis_of_clusters', ''),
                    'name': round_2_meta.get('meta_cluster_name', '')
                },
                'round_3': {
                    'theme': round_3_meta.get('overarching_theme', ''),
                    'keywords': round_3_meta.get('meta_keywords', ''),
                    'tactics': round_3_meta.get('engagement_tactics', ''),  # Updated field name
                    'redirection': round_3_meta.get('redirection_methods', ''),  # Updated field name
                    'synthesis': round_3_meta.get('synthesis_of_clusters', ''),
                    'name': round_3_meta.get('meta_cluster_name', '')
                }
            }
        }
        
        clusters.append(cluster_data)
        
        # Progress indicator
        if (idx + 1) % 1000 == 0:
            print(f"Processed {idx + 1} clusters...")
    
    return {
        'clusters': clusters,
        'total_count': len(clusters)
    }

def main():
    print("Loading CSV data...")
    df = pd.read_csv('data.csv', encoding='utf-8', encoding_errors='ignore')
    
    print(f"Processing {len(df)} clusters with robust parser...")
    processed_data = process_cluster_data(df)
    
    print(f"Saving processed data...")
    with open('processed_clusters.json', 'w') as f:
        json.dump(processed_data, f, indent=2)
    
    print(f"Successfully processed {processed_data['total_count']} clusters!")
    
    # Show a sample
    if processed_data['clusters']:
        sample = processed_data['clusters'][0]
        print(f"\nSample cluster:")
        print(f"ID: {sample['id']}")
        print(f"Name: {sample['name']}")
        print(f"Topic: {sample['topic'][:200]}...")
        print(f"Description: {sample['description'][:200]}...")
        print(f"Keywords: {sample['keywords']}")
        print(f"Item IDs count: {len(sample['item_ids'])}")
        print(f"Sample Item IDs: {sample['item_ids'][:5]}")

if __name__ == "__main__":
    main()
