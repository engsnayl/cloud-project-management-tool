# src/lambdas/api-handler/lambda_function.py
import json
import boto3
import os
from datetime import datetime, timedelta
from decimal import Decimal
import uuid
import re

# Initialize AWS services
dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
textract = boto3.client('textract')
s3 = boto3.client('s3')

# Environment variables
DYNAMODB_TABLE = os.environ['DYNAMODB_TABLE']
BUCKET_NAME = os.environ.get('BUCKET_NAME', '')

table = dynamodb.Table(DYNAMODB_TABLE)

def lambda_handler(event, context):
    """Main Lambda handler for Action Tracking API"""
    
    try:
        # Extract HTTP method and path
        method = event['httpMethod']
        path = event['path']
        
        # Route to appropriate handler
        if path.startswith('/api/v1/actions'):
            if method == 'GET':
                return handle_get_actions(event, context)
            elif method == 'POST':
                return handle_create_action(event, context)
            elif method == 'PUT':
                return handle_update_action(event, context)
        elif path.startswith('/api/v1/projects'):
            if method == 'GET':
                return handle_get_projects(event, context)
            elif method == 'POST':
                return handle_create_project(event, context)
        elif path.startswith('/api/v1/parse-email'):
            return handle_parse_email(event, context)
        elif path.startswith('/api/v1/parse-document'):
            return handle_parse_document(event, context)
        else:
            return create_response(404, {'error': 'Endpoint not found'})
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return create_response(500, {'error': 'Internal server error'})

def handle_get_actions(event, context):
    """Get actions with filtering options"""
    
    query_params = event.get('queryStringParameters') or {}
    path_params = event.get('pathParameters') or {}
    
    try:
        # Check for specific project actions
        if 'projectId' in query_params:
            project_id = query_params['projectId']
            response = table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'PROJECT#{project_id}',
                    ':sk': 'ACTION#'
                }
            )
            actions = response.get('Items', [])
            
        # Check for owner-specific actions
        elif 'owner' in query_params:
            owner = query_params['owner']
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={
                    ':pk': f'ACTION#OWNER#{owner}'
                }
            )
            actions = response.get('Items', [])
            
        # Check for status-based actions
        elif 'status' in query_params:
            status = query_params['status']
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={
                    ':pk': f'ACTION#{status.upper()}'
                }
            )
            actions = response.get('Items', [])
            
        else:
            # Get all actions across all projects
            response = table.scan(
                FilterExpression='begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':sk': 'ACTION#'
                }
            )
            actions = response.get('Items', [])
        
        # Clean up Decimal types for JSON serialization
        actions = json.loads(json.dumps(actions, default=decimal_default))
        
        return create_response(200, {
            'actions': actions,
            'count': len(actions)
        })
        
    except Exception as e:
        print(f"Error getting actions: {str(e)}")
        return create_response(500, {'error': 'Failed to retrieve actions'})

def handle_create_action(event, context):
    """Create a new action"""
    
    try:
        body = json.loads(event['body'])
        
        # Generate action ID
        action_id = f"ACT-{int(datetime.now().timestamp())}"
        timestamp = datetime.utcnow().isoformat()
        
        # Validate required fields
        required_fields = ['title', 'owner', 'projectId']
        for field in required_fields:
            if field not in body:
                return create_response(400, {'error': f'Missing required field: {field}'})
        
        # Calculate deadline (default to 7 days if not provided)
        deadline = body.get('deadline')
        if not deadline:
            deadline = (datetime.utcnow() + timedelta(days=7)).isoformat()[:10]
        
        # Determine GSI1PK based on status and owner
        status = body.get('status', 'PENDING').upper()
        owner = body['owner']
        
        action_item = {
            'PK': f"PROJECT#{body['projectId']}",
            'SK': f"ACTION#{action_id}",
            'GSI1PK': f"ACTION#{status}",
            'GSI1SK': deadline,
            'actionId': action_id,
            'title': body['title'],
            'description': body.get('description', ''),
            'owner': owner,
            'deadline': deadline,
            'status': status,
            'priority': body.get('priority', 'MEDIUM').upper(),
            'source': body.get('source', 'MANUAL').upper(),
            'meetingRef': body.get('meetingRef', ''),
            'projectId': body['projectId'],
            'createdAt': timestamp,
            'updatedAt': timestamp
        }
        
        # Add additional GSI for owner-based queries
        table.put_item(Item=action_item)
        
        # Also create an entry for owner-based queries
        owner_item = dict(action_item)
        owner_item['GSI1PK'] = f"ACTION#OWNER#{owner}"
        table.put_item(Item=owner_item)
        
        return create_response(201, {
            'message': 'Action created successfully',
            'action': json.loads(json.dumps(action_item, default=decimal_default))
        })
        
    except json.JSONDecodeError:
        return create_response(400, {'error': 'Invalid JSON in request body'})
    except Exception as e:
        print(f"Error creating action: {str(e)}")
        return create_response(500, {'error': 'Failed to create action'})

def handle_update_action(event, context):
    """Update action status"""
    
    try:
        # Extract action ID from path
        path_params = event.get('pathParameters') or {}
        action_id = path_params.get('id')
        
        if not action_id:
            return create_response(400, {'error': 'Action ID required'})
        
        body = json.loads(event['body'])
        new_status = body.get('status', '').upper()
        
        if not new_status:
            return create_response(400, {'error': 'Status required'})
        
        # First, find the action to get its current data
        response = table.scan(
            FilterExpression='SK = :sk',
            ExpressionAttributeValues={
                ':sk': f'ACTION#{action_id}'
            }
        )
        
        items = response.get('Items', [])
        if not items:
            return create_response(404, {'error': 'Action not found'})
        
        action = items[0]
        timestamp = datetime.utcnow().isoformat()
        
        # Update the action
        table.update_item(
            Key={
                'PK': action['PK'],
                'SK': action['SK']
            },
            UpdateExpression='SET #status = :status, #updated = :updated, GSI1PK = :gsi1pk',
            ExpressionAttributeNames={
                '#status': 'status',
                '#updated': 'updatedAt'
            },
            ExpressionAttributeValues={
                ':status': new_status,
                ':updated': timestamp,
                ':gsi1pk': f'ACTION#{new_status}'
            }
        )
        
        return create_response(200, {
            'message': 'Action updated successfully',
            'actionId': action_id,
            'newStatus': new_status
        })
        
    except json.JSONDecodeError:
        return create_response(400, {'error': 'Invalid JSON in request body'})
    except Exception as e:
        print(f"Error updating action: {str(e)}")
        return create_response(500, {'error': 'Failed to update action'})

def handle_get_projects(event, context):
    """Get all projects"""
    
    try:
        response = table.scan(
            FilterExpression='SK = :sk',
            ExpressionAttributeValues={
                ':sk': 'METADATA'
            }
        )
        
        # Filter for project items only
        projects = [item for item in response.get('Items', []) 
                   if item.get('PK', '').startswith('PROJECT#')]
        
        projects = json.loads(json.dumps(projects, default=decimal_default))
        
        return create_response(200, {
            'projects': projects,
            'count': len(projects)
        })
        
    except Exception as e:
        print(f"Error getting projects: {str(e)}")
        return create_response(500, {'error': 'Failed to retrieve projects'})

def handle_create_project(event, context):
    """Create a new project"""
    
    try:
        body = json.loads(event['body'])
        
        # Generate project ID
        project_id = f"PROJ-{datetime.now().year}-{int(datetime.now().timestamp())}"
        timestamp = datetime.utcnow().isoformat()
        
        # Validate required fields
        if 'name' not in body:
            return create_response(400, {'error': 'Project name required'})
        
        project_item = {
            'PK': f"PROJECT#{project_id}",
            'SK': 'METADATA',
            'GSI1PK': 'PROJECT',
            'GSI1SK': timestamp[:10],  # Date only
            'projectId': project_id,
            'name': body['name'],
            'description': body.get('description', ''),
            'status': body.get('status', 'ACTIVE').upper(),
            'owner': body.get('owner', ''),
            'deadline': body.get('deadline', ''),
            'createdAt': timestamp,
            'updatedAt': timestamp
        }
        
        table.put_item(Item=project_item)
        
        return create_response(201, {
            'message': 'Project created successfully',
            'project': json.loads(json.dumps(project_item, default=decimal_default))
        })
        
    except json.JSONDecodeError:
        return create_response(400, {'error': 'Invalid JSON in request body'})
    except Exception as e:
        print(f"Error creating project: {str(e)}")
        return create_response(500, {'error': 'Failed to create project'})

def handle_parse_email(event, context):
    """Parse email content for actions (placeholder for Phase 7.2)"""
    
    return create_response(200, {
        'message': 'Email parsing feature coming in Phase 7.2',
        'actions': []
    })

def handle_parse_document(event, context):
    """Parse document content for actions using Textract (placeholder for Phase 7.2)"""
    
    return create_response(200, {
        'message': 'Document parsing feature coming in Phase 7.2',
        'actions': []
    })

def create_response(status_code, body):
    """Create HTTP response with proper headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps(body)
    }

def decimal_default(obj):
    """Handle Decimal serialization for DynamoDB"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError