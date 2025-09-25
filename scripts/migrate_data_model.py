#!/usr/bin/env python3
"""
Data Model Migration Script
Location: /workspaces/cloud-project-management-tool/scripts/migrate_data_model.py

This script migrates your existing mixed action data to the clean two-model system:
- Actions (Confirmed, trackable tasks) - ACT- format only
- Suggestions (Unconfirmed extractions) - SUGGESTION# format

Run with: python3 migrate_data_model.py --dry-run (to see what would change)
Run with: python3 migrate_data_model.py --execute (to actually make changes)
"""

import boto3
import json
import argparse
from datetime import datetime, timezone
import uuid
import sys

def setup_aws():
    """Setup AWS clients"""
    try:
        dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')
        table = dynamodb.Table('deliverycommand-dev-main')
        return table
    except Exception as e:
        print(f"Error setting up AWS: {e}")
        sys.exit(1)

def analyze_existing_data(table):
    """Analyze current data structure"""
    print("Analyzing existing data...")
    
    # Get all ACTION# items
    response = table.scan(
        FilterExpression='begins_with(PK, :pk)',
        ExpressionAttributeValues={':pk': 'ACTION#'}
    )
    
    actions = response.get('Items', [])
    print(f"Found {len(actions)} existing actions")
    
    analysis = {
        'total_actions': len(actions),
        'manual_actions': [],      # ACT- format, keep as actions
        'document_actions': [],    # UUID format, convert to suggestions
        'mixed_format_actions': [] # Need cleanup
    }
    
    for action in actions:
        action_id = action.get('actionId', '')
        source = action.get('source', 'MANUAL')
        
        print(f"  Action: {action_id} | Source: {source} | Title: {action.get('title', 'N/A')[:50]}")
        
        if source == 'DOCUMENT_PROCESSING' or not action_id.startswith('ACT-'):
            analysis['document_actions'].append(action)
        elif action_id.startswith('ACT-'):
            analysis['manual_actions'].append(action)
        else:
            analysis['mixed_format_actions'].append(action)
    
    return analysis

def generate_suggestion_id():
    """Generate a suggestion ID"""
    return f"SUG-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"

def create_migration_plan(analysis):
    """Create detailed migration plan"""
    plan = {
        'actions_to_keep': [],      # Keep as-is (confirmed actions)
        'actions_to_delete': [],    # Delete (will become suggestions)
        'suggestions_to_create': [], # Create new suggestions
        'actions_to_update': []     # Fix format issues
    }
    
    print("\nCreating migration plan...")
    
    # Keep manual ACT- format actions as confirmed actions
    for action in analysis['manual_actions']:
        plan['actions_to_keep'].append({
            'action_id': action.get('actionId'),
            'title': action.get('title'),
            'action': 'KEEP - Already confirmed action'
        })
    
    # Convert document-processed actions to suggestions
    for action in analysis['document_actions']:
        suggestion_id = action.get('originalSuggestionId', generate_suggestion_id())
        
        # Create suggestion from action
        suggestion = {
            'PK': f'SUGGESTION#{suggestion_id}',
            'SK': 'METADATA',
            'suggestionId': suggestion_id,
            'title': action.get('title', ''),
            'description': action.get('description', ''),
            'priority': action.get('priority', 'MEDIUM'),
            'extractedFrom': 'document',
            'status': 'PENDING',  # Unconfirmed
            'createdAt': action.get('createdAt', datetime.now(timezone.utc).isoformat()),
            'updatedAt': datetime.now(timezone.utc).isoformat(),
            'originalActionData': json.dumps(action, default=str)  # Keep original for reference
        }
        
        plan['suggestions_to_create'].append(suggestion)
        plan['actions_to_delete'].append({
            'PK': action['PK'],
            'SK': action['SK'],
            'reason': f'Converting to suggestion {suggestion_id}'
        })
    
    return plan

def print_migration_summary(plan):
    """Print what the migration will do"""
    print("\n" + "="*60)
    print("MIGRATION SUMMARY")
    print("="*60)
    
    print(f"Actions to keep (confirmed):     {len(plan['actions_to_keep'])}")
    print(f"Actions to delete:               {len(plan['actions_to_delete'])}")
    print(f"Suggestions to create:           {len(plan['suggestions_to_create'])}")
    print(f"Actions to update:               {len(plan['actions_to_update'])}")
    
    print("\nACTIONS TO KEEP AS CONFIRMED:")
    for item in plan['actions_to_keep']:
        print(f"  ✓ {item['action_id']}: {item['title']}")
    
    print("\nACTIONS TO CONVERT TO SUGGESTIONS:")
    for i, suggestion in enumerate(plan['suggestions_to_create']):
        delete_item = plan['actions_to_delete'][i]
        print(f"  → {suggestion['suggestionId']}: {suggestion['title']}")
        print(f"    (was: {delete_item['PK']})")
    
    print("\n" + "="*60)

def execute_migration(table, plan, dry_run=True):
    """Execute the migration plan"""
    if dry_run:
        print("\nDRY RUN - No changes will be made")
        return
    
    print("\nExecuting migration...")
    
    try:
        # Create suggestions first
        print(f"Creating {len(plan['suggestions_to_create'])} suggestions...")
        for suggestion in plan['suggestions_to_create']:
            table.put_item(Item=suggestion)
            print(f"  ✓ Created suggestion: {suggestion['suggestionId']}")
        
        # Delete old actions
        print(f"Deleting {len(plan['actions_to_delete'])} old actions...")
        for action_to_delete in plan['actions_to_delete']:
            table.delete_item(Key={
                'PK': action_to_delete['PK'],
                'SK': action_to_delete['SK']
            })
            print(f"  ✓ Deleted: {action_to_delete['PK']}")
        
        print("\nMigration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        print("Migration stopped. Some changes may have been made.")
        raise

def main():
    parser = argparse.ArgumentParser(description='Migrate action data to clean two-model system')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Show what would be changed without making changes')
    parser.add_argument('--execute', action='store_true',
                       help='Actually execute the migration')
    
    args = parser.parse_args()
    
    if not args.dry_run and not args.execute:
        print("Please specify either --dry-run or --execute")
        print("Use --dry-run first to see what would be changed")
        sys.exit(1)
    
    # Setup
    table = setup_aws()
    
    # Analyze current data
    analysis = analyze_existing_data(table)
    
    # Create migration plan
    plan = create_migration_plan(analysis)
    
    # Show summary
    print_migration_summary(plan)
    
    # Execute or dry run
    if args.execute:
        confirm = input("\nAre you sure you want to execute this migration? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Migration cancelled")
            sys.exit(0)
    
    execute_migration(table, plan, dry_run=args.dry_run)
    
    if args.dry_run:
        print("\nTo actually execute the migration, run:")
        print("python3 migrate_data_model.py --execute")

if __name__ == '__main__':
    main()