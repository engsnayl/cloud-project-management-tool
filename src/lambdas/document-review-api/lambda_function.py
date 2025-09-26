import json
import boto3
import logging
from datetime import datetime
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
table_name = 'deliverycommand-dev-main'
table = dynamodb.Table(table_name)

def decimal_default(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def lambda_handler(event, context):
    """Main Lambda handler for document suggestions API"""
    try:
        method = event['httpMethod']
        path = event['path']
        
        logger.info(f"Processing {method} request to {path}")
        
        # Route requests
        if method == 'GET' and '/document-suggestions/pending' in path:
            return get_pending_suggestions()
        else:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Endpoint not found'})
            }
            
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Internal server error'})
        }

def get_pending_suggestions():
    """Get all pending document suggestions"""
    try:
        # Scan for suggestions with PENDING status
        response = table.scan(
            FilterExpression=Attr('PK').begins_with('SUGGESTION#') & Attr('status').eq('PENDING')
        )
        
        logger.info(f"Found {len(response['Items'])} pending suggestions")
        
        # Convert to format expected by frontend
        suggestions = []
        for item in response['Items']:
            suggestion = {
                'suggestionId': item['suggestionId'],
                'title': item['title'],
                'description': item.get('description', ''),
                'priority': item.get('priority', 'MEDIUM'),
                'confidence': float(item.get('confidence', 0.8)),
                'context': item.get('context', ''),
                'extractedFrom': item.get('extractedFrom', ''),
                'createdAt': item.get('createdAt', ''),
                'status': item['status']
            }
            suggestions.append(suggestion)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'suggestions': suggestions,
                'total_suggestions': len(suggestions)
            }, default=decimal_default)
        }
        
    except Exception as e:
        logger.error(f"Error getting pending suggestions: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
