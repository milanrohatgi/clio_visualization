#!/usr/bin/env python3
import pandas as pd
import json
import re
import ast
from typing import Dict, List, Any
import html
from collections import defaultdict

def extract_xml_field(xml_content: str, field_name: str) -> str:
    """Extract a specific field from XML content using regex"""
    # First try the standard pattern
    pattern = f'<{field_name}>(.*?)</{field_name}>'
    match = re.search(pattern, xml_content, re.DOTALL)
    if match:
        content = match.group(1).strip()
        content = html.unescape(content)
        return content
    
    # If that fails, try to handle malformed opening tags (missing >)
    # Look for <field_name followed by content, then </field_name>
    malformed_pattern = f'<{field_name}([^>]*?)(.*?)</{field_name}>'
    malformed_match = re.search(malformed_pattern, xml_content, re.DOTALL)
    if malformed_match:
        # Get the content, but skip the malformed part of the opening tag
        content = malformed_match.group(2).strip()
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

def build_hierarchy_tree():
    """Build the complete hierarchy tree structure"""
    print("Loading CSV data...")
    df = pd.read_csv('data.csv', encoding='utf-8', encoding_errors='ignore')
    
    print("Parsing cluster data...")
    
    # Parse all clusters
    clusters = []
    for idx, row in df.iterrows():
        # Use index as cluster ID
        cluster_id = idx
        
        # Parse item_ids
        item_ids = parse_item_ids(row['item_ids'])
        
        # Parse each level
        cluster_analysis = parse_xml_robust(row['cluster_name'], is_meta_cluster=False)
        round_1_meta = parse_xml_robust(row['round_1_cluster_name'], is_meta_cluster=True)
        round_2_meta = parse_xml_robust(row['round_2_cluster_name'], is_meta_cluster=True)
        round_3_meta = parse_xml_robust(row['round_3_cluster_name'], is_meta_cluster=True)
        
        cluster_data = {
            'id': cluster_id,
            'name': cluster_analysis.get('cluster_name', f'Cluster {cluster_id}'),
            'description': cluster_analysis.get('synthesis', ''),
            'topic': cluster_analysis.get('common_topic', ''),
            'keywords': cluster_analysis.get('keywords', ''),
            'engagement': cluster_analysis.get('common_engagement', ''),
            'redirection': cluster_analysis.get('common_redirection', ''),
            'item_ids': item_ids,  # New field for v4
            'level': 0,  # Individual cluster level
            'parent_names': {
                'round_1': round_1_meta.get('meta_cluster_name', ''),
                'round_2': round_2_meta.get('meta_cluster_name', ''),
                'round_3': round_3_meta.get('meta_cluster_name', '')
            },
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
        
        if (idx + 1) % 1000 == 0:
            print(f"Processed {idx + 1} clusters...")
    
    print("Building hierarchy groups...")
    
    # Build hierarchy groups
    round_1_groups = defaultdict(lambda: {'clusters': [], 'meta_data': None})
    round_2_groups = defaultdict(lambda: {'clusters': [], 'meta_data': None})
    round_3_groups = defaultdict(lambda: {'clusters': [], 'meta_data': None})
    
    # Group clusters by their meta-cluster names
    for cluster in clusters:
        r1_name = cluster['parent_names']['round_1']
        r2_name = cluster['parent_names']['round_2'] 
        r3_name = cluster['parent_names']['round_3']
        
        if r1_name:
            round_1_groups[r1_name]['clusters'].append(cluster['id'])
            if not round_1_groups[r1_name]['meta_data']:
                round_1_groups[r1_name]['meta_data'] = cluster['meta_analyses']['round_1']
        
        if r2_name:
            round_2_groups[r2_name]['clusters'].append(cluster['id'])
            if not round_2_groups[r2_name]['meta_data']:
                round_2_groups[r2_name]['meta_data'] = cluster['meta_analyses']['round_2']
        
        if r3_name:
            round_3_groups[r3_name]['clusters'].append(cluster['id'])
            if not round_3_groups[r3_name]['meta_data']:
                round_3_groups[r3_name]['meta_data'] = cluster['meta_analyses']['round_3']
    
    # Create meta-cluster objects for each level
    meta_clusters = {
        'round_1': [],
        'round_2': [],
        'round_3': []
    }
    
    # Round 1 meta-clusters
    for name, data in round_1_groups.items():
        if not name or name == 'Unknown':
            continue
        meta_cluster = {
            'id': f"r1_{len(meta_clusters['round_1'])}",
            'name': name,
            'level': 1,
            'description': data['meta_data']['synthesis'] if data['meta_data'] else '',
            'topic': data['meta_data']['theme'] if data['meta_data'] else '',
            'keywords': data['meta_data']['keywords'] if data['meta_data'] else '',
            'tactics': data['meta_data']['tactics'] if data['meta_data'] else '',  # Updated field
            'redirection': data['meta_data']['redirection'] if data['meta_data'] else '',  # Updated field
            'children': sorted(data['clusters']),
            'child_count': len(data['clusters'])
        }
        meta_clusters['round_1'].append(meta_cluster)
    
    # Round 2 meta-clusters  
    for name, data in round_2_groups.items():
        if not name or name == 'Unknown':
            continue
        meta_cluster = {
            'id': f"r2_{len(meta_clusters['round_2'])}",
            'name': name,
            'level': 2,
            'description': data['meta_data']['synthesis'] if data['meta_data'] else '',
            'topic': data['meta_data']['theme'] if data['meta_data'] else '',
            'keywords': data['meta_data']['keywords'] if data['meta_data'] else '',
            'tactics': data['meta_data']['tactics'] if data['meta_data'] else '',  # Updated field
            'redirection': data['meta_data']['redirection'] if data['meta_data'] else '',  # Updated field
            'children': sorted(data['clusters']),
            'child_count': len(data['clusters'])
        }
        meta_clusters['round_2'].append(meta_cluster)
    
    # Round 3 meta-clusters
    for name, data in round_3_groups.items():
        if not name or name == 'Unknown':
            continue
        meta_cluster = {
            'id': f"r3_{len(meta_clusters['round_3'])}",
            'name': name,
            'level': 3,
            'description': data['meta_data']['synthesis'] if data['meta_data'] else '',
            'topic': data['meta_data']['theme'] if data['meta_data'] else '',
            'keywords': data['meta_data']['keywords'] if data['meta_data'] else '',
            'tactics': data['meta_data']['tactics'] if data['meta_data'] else '',  # Updated field
            'redirection': data['meta_data']['redirection'] if data['meta_data'] else '',  # Updated field
            'children': sorted(data['clusters']),
            'child_count': len(data['clusters'])
        }
        meta_clusters['round_3'].append(meta_cluster)
    
    # Sort meta-clusters by child count (largest first)
    for round_key in meta_clusters:
        meta_clusters[round_key].sort(key=lambda x: x['child_count'], reverse=True)
    
    return {
        'individual_clusters': clusters,
        'meta_clusters': meta_clusters,
        'hierarchy_stats': {
            'total_clusters': len(clusters),
            'round_1_groups': len(meta_clusters['round_1']),
            'round_2_groups': len(meta_clusters['round_2']),
            'round_3_groups': len(meta_clusters['round_3'])
        }
    }

def main():
    print("Building hierarchical cluster data...")
    hierarchy_data = build_hierarchy_tree()
    
    print(f"Saving hierarchical data...")
    with open('hierarchical_clusters.json', 'w') as f:
        json.dump(hierarchy_data, f, indent=2)
    
    stats = hierarchy_data['hierarchy_stats']
    print(f"\n✅ Hierarchical data created successfully!")
    print(f"📊 Statistics:")
    print(f"   - Individual clusters: {stats['total_clusters']}")
    print(f"   - Round 1 meta-clusters: {stats['round_1_groups']}")
    print(f"   - Round 2 meta-clusters: {stats['round_2_groups']}")
    print(f"   - Round 3 meta-clusters: {stats['round_3_groups']}")
    
    # Show some examples
    print(f"\n🔍 Top 3 Round 3 meta-clusters:")
    for i, mc in enumerate(hierarchy_data['meta_clusters']['round_3'][:3]):
        print(f"   {i+1}. {mc['name'][:60]}... ({mc['child_count']} clusters)")
    
    # Show sample cluster with item_ids
    if hierarchy_data['individual_clusters']:
        sample = hierarchy_data['individual_clusters'][0]
        print(f"\n📋 Sample cluster with item_ids:")
        print(f"   Name: {sample['name']}")
        print(f"   Item IDs count: {len(sample['item_ids'])}")
        print(f"   Sample items: {sample['item_ids'][:10]}")

if __name__ == "__main__":
    main()
