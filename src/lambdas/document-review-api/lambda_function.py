# src/lambdas/document-review-api/lambda_function.py

import json
import boto3
import logging
from datetime import datetime
from decimal import Decimal
from boto3.dynamodb.conditions import Key
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
        elif method == 'POST' and '/approve' in path:
            return approve_suggestion(event)
        elif method == 'POST' and '/reject' in path:
            return reject_suggestion(event)
        elif method == 'GET' and '/document-suggestions/' in path:
            suggestion_id = path.split('/')[-1]
            return get_suggestion_details(suggestion_id)
        else:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
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
        # Query for pending suggestions using GSI
        response = table.query(
            IndexName='GSI1',
            KeyConditionExpression=Key('GSI1PK').eq('PENDING_REVIEW'),
            ScanIndexForward=False  # Most recent first
        )
        
        suggestions = []
        for item in response['Items']:
            # Convert DynamoDB format to frontend format
            suggestion = {
                'suggestionId': item['PK'].replace('SUGGESTION#', ''),
                'document_key': item.get('document_key', ''),
                'user_id': item.get('user_id', ''),
                'status': item.get('status', ''),
                'created_at': item.get('created_at', ''),
                'total_suggestions': int(item.get('total_suggestions', 0)),
                'suggestions': []
            }
            
            # Process the suggestions list
            if 'suggestions' in item:
                for i, suggestion_item in enumerate(item['suggestions']):
                    processed_suggestion = {
                        'index': i,
                        'text': suggestion_item.get('text', ''),
                        'confidence': suggestion_item.get('confidence', '0'),
                        'line_number': int(suggestion_item.get('line_number', 0)),
                        'context': suggestion_item.get('context', ''),
                        'suggested_deadline': suggestion_item.get('suggested_deadline'),
                        'suggested_priority': suggestion_item.get('suggested_priority', 'MEDIUM'),
                        'suggested_assignee': suggestion_item.get('suggested_assignee')
                    }
                    suggestion['suggestions'].append(processed_suggestion)
            
            suggestions.append(suggestion)
        
        logger.info(f"Found {len(suggestions)} pending suggestions")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': json.dumps(suggestions, default=decimal_default)
        }
        
    except Exception as e:
        logger.error(f"Error getting pending suggestions: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }

def approve_suggestion(event):
    """Approve a suggestion and create a real action"""
    try:
        body = json.loads(event['body'])
        suggestion_id = body['suggestionId']
        action_item_index = body['actionItemIndex']
        action_data = body['action']
        
        logger.info(f"Approving suggestion {suggestion_id}, item {action_item_index}")
        
        # Get the original suggestion
        suggestion_pk = f"SUGGESTION#{suggestion_id}"
        response = table.get_item(Key={'PK': suggestion_pk, 'SK': 'METADATA'})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Suggestion not found'})
            }
        
        suggestion = response['Item']
        
        # Create new action from approved suggestion
        action_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        # Create action item in DynamoDB
        action_item = {
            'PK': f'ACTION#{action_id}',
            'SK': 'METADATA',
            'GSI1PK': f'PROJECT#{action_data.get("projectId", "miscellaneous")}',
            'GSI1SK': f'ACTION#{now}',
            'actionId': action_id,
            'title': action_data['title'],
            'description': action_data['description'],
            'priority': action_data['priority'],
            'status': 'pending',
            'owner': action_data['owner'],
            'projectId': action_data.get('projectId', 'miscellaneous'),
            'deadline': action_data.get('deadline'),
            'createdAt': now,
            'updatedAt': now,
            'source': 'DOCUMENT_PROCESSING',
            'originalSuggestionId': suggestion_id,
            'entityType': 'action'
        }
        
        # Store the new action
        table.put_item(Item=action_item)
        
        # Update the suggestion to mark this item as approved
        suggestions_list = suggestion.get('suggestions', [])
        if action_item_index < len(suggestions_list):
            suggestions_list[action_item_index]['status'] = 'APPROVED'
            suggestions_list[action_item_index]['approvedAt'] = now
            suggestions_list[action_item_index]['createdActionId'] = action_id
        
        # Update the suggestion record
        table.update_item(
            Key={'PK': suggestion_pk, 'SK': 'METADATA'},
            UpdateExpression='SET suggestions = :suggestions, updatedAt = :updated',
            ExpressionAttributeValues={
                ':suggestions': suggestions_list,
                ':updated': now
            }
        )
        
        logger.info(f"Created action {action_id} from approved suggestion")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': json.dumps({
                'message': 'Suggestion approved and action created',
                'actionId': action_id,
                'suggestionId': suggestion_id
            })
        }
        
    except Exception as e:
        logger.error(f"Error approving suggestion: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }

def reject_suggestion(event):
    """Reject a suggestion"""
    try:
        # Extract suggestion ID from path
        path = event['path']
        suggestion_id = path.split('/')[-2]  # Gets ID from /suggestions/{id}/reject
        
        # Parse body for action item index if provided
        body = json.loads(event.get('body', '{}'))
        action_item_index = body.get('actionItemIndex')
        
        logger.info(f"Rejecting suggestion {suggestion_id}, item {action_item_index}")
        
        suggestion_pk = f"SUGGESTION#{suggestion_id}"
        now = datetime.now().isoformat()
        
        if action_item_index is not None:
            # Reject specific action item
            response = table.get_item(Key={'PK': suggestion_pk, 'SK': 'METADATA'})
            
            if 'Item' not in response:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Suggestion not found'})
                }
            
            suggestion = response['Item']
            suggestions_list = suggestion.get('suggestions', [])
            
            if action_item_index < len(suggestions_list):
                suggestions_list[action_item_index]['status'] = 'REJECTED'
                suggestions_list[action_item_index]['rejectedAt'] = now
            
            # Update the suggestion record
            table.update_item(
                Key={'PK': suggestion_pk, 'SK': 'METADATA'},
                UpdateExpression='SET suggestions = :suggestions, updatedAt = :updated',
                ExpressionAttributeValues={
                    ':suggestions': suggestions_list,
                    ':updated': now
                }
            )
        else:
            # Reject entire suggestion
            table.update_item(
                Key={'PK': suggestion_pk, 'SK': 'METADATA'},
                UpdateExpression='SET #status = :status, updatedAt = :updated, GSI1PK = :new_gsi1pk',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'REJECTED',
                    ':updated': now,
                    ':new_gsi1pk': 'REJECTED_SUGGESTIONS'
                }
            )
        
        logger.info(f"Rejected suggestion {suggestion_id}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': json.dumps({
                'message': 'Suggestion rejected',
                'suggestionId': suggestion_id
            })
        }
        
    except Exception as e:
        logger.error(f"Error rejecting suggestion: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }

def get_suggestion_details(suggestion_id):
    """Get details for a specific suggestion"""
    try:
        suggestion_pk = f"SUGGESTION#{suggestion_id}"
        response = table.get_item(Key={'PK': suggestion_pk, 'SK': 'METADATA'})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Suggestion not found'})
            }
        
        item = response['Item']
        
        # Convert to frontend format
        suggestion = {
            'suggestionId': suggestion_id,
            'document_key': item.get('document_key', ''),
            'user_id': item.get('user_id', ''),
            'status': item.get('status', ''),
            'created_at': item.get('created_at', ''),
            'total_suggestions': int(item.get('total_suggestions', 0)),
            'suggestions': []
        }
        
        # Process suggestions list
        if 'suggestions' in item:
            for i, suggestion_item in enumerate(item['suggestions']):
                processed_suggestion = {
                    'index': i,
                    'text': suggestion_item.get('text', ''),
                    'confidence': suggestion_item.get('confidence', '0'),
                    'line_number': int(suggestion_item.get('line_number', 0)),
                    'context': suggestion_item.get('context', ''),
                    'suggested_deadline': suggestion_item.get('suggested_deadline'),
                    'suggested_priority': suggestion_item.get('suggested_priority', 'MEDIUM'),
                    'suggested_assignee': suggestion_item.get('suggested_assignee'),
                    'status': suggestion_item.get('status', 'PENDING'),
                    'approvedAt': suggestion_item.get('approvedAt'),
                    'rejectedAt': suggestion_item.get('rejectedAt'),
                    'createdActionId': suggestion_item.get('createdActionId')
                }
                suggestion['suggestions'].append(processed_suggestion)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': json.dumps(suggestion, default=decimal_default)
        }
        
    except Exception as e:
        logger.error(f"Error getting suggestion details: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }