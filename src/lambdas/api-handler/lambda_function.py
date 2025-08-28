# src/lambdas/api-handler/lambda_function.py
import json
import boto3
import os
from datetime import datetime
from decimal import Decimal
import uuid

# Initialize AWS services
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMODB_TABLE', 'deliverycommand-dev-main')
table = dynamodb.Table(table_name)

def convert_floats_to_decimal(obj):
    """Convert float values to Decimal for DynamoDB compatibility"""
    if isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(v) for v in obj]
    elif isinstance(obj, float):
        return Decimal(str(obj))
    return obj

def create_response(status_code, body, extra_headers=None):
    """Create a properly formatted API Gateway response"""
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
    if extra_headers:
        headers.update(extra_headers)
    
    # Convert Decimals back to float for JSON serialization
    def decimal_default(obj):
        if isinstance(obj, Decimal):
            return float(obj)
        raise TypeError
    
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body, default=decimal_default)
    }

def handle_health():
    """Handle health check endpoint"""
    return create_response(200, {'status': 'healthy', 'timestamp': str(datetime.utcnow())})

def handle_get_projects():
    """Get all projects"""
    try:
        # Scan for all project items
        response = table.scan(
            FilterExpression='begins_with(PK, :pk)',
            ExpressionAttributeValues={':pk': 'PROJECT#'}
        )
        
        projects = response.get('Items', [])
        print(f"Found {len(projects)} projects")
        
        return create_response(200, {
            'projects': projects,
            'count': len(projects)
        })
        
    except Exception as e:
        print(f"Error getting projects: {str(e)}")
        return create_response(500, {'error': 'Failed to get projects', 'message': str(e)})

def handle_create_project(body):
    """Create a new project"""
    try:
        project_id = str(uuid.uuid4())[:8]
        timestamp = datetime.utcnow().isoformat() + 'Z'
        
        project_item = {
            'PK': f'PROJECT#{project_id}',
            'SK': 'METADATA',
            'GSI1PK': 'PROJECT',
            'GSI1SK': timestamp,
            'projectId': project_id,
            'name': body.get('name', ''),
            'description': body.get('description', ''),
            'status': body.get('status', 'active'),
            'createdAt': timestamp,
            'updatedAt': timestamp
        }
        
        # Convert any floats to Decimal
        project_item = convert_floats_to_decimal(project_item)
        
        table.put_item(Item=project_item)
        print(f"Created project: {project_id}")
        
        return create_response(201, {
            'message': 'Project created successfully',
            'project': project_item
        })
        
    except Exception as e:
        print(f"Error creating project: {str(e)}")
        return create_response(500, {'error': 'Failed to create project', 'message': str(e)})

def handle_get_actions():
    """Get all actions"""
    try:
        # Scan for all action items
        response = table.scan(
            FilterExpression='begins_with(PK, :pk)',
            ExpressionAttributeValues={':pk': 'ACTION#'}
        )
        
        actions = response.get('Items', [])
        print(f"Found {len(actions)} actions")
        
        return create_response(200, {
            'actions': actions,
            'count': len(actions)
        })
        
    except Exception as e:
        print(f"Error getting actions: {str(e)}")
        return create_response(500, {'error': 'Failed to get actions', 'message': str(e)})

def handle_create_action(body):
    """Create a new action"""
    try:
        action_id = str(uuid.uuid4())[:8]
        timestamp = datetime.utcnow().isoformat() + 'Z'
        
        action_item = {
            'PK': f'ACTION#{action_id}',
            'SK': 'METADATA',
            'GSI1PK': 'ACTION',
            'GSI1SK': timestamp,
            'actionId': action_id,
            'title': body.get('title', ''),
            'description': body.get('description', ''),
            'owner': body.get('owner', ''),
            'projectId': body.get('projectId', ''),
            'status': body.get('status', 'pending'),
            'deadline': body.get('deadline', ''),
            'priority': body.get('priority', 'medium'),
            'source': body.get('source', 'manual'),
            'createdAt': timestamp,
            'updatedAt': timestamp
        }
        
        # Convert any floats to Decimal
        action_item = convert_floats_to_decimal(action_item)
        
        table.put_item(Item=action_item)
        print(f"Created action: {action_id}")
        
        return create_response(201, {
            'message': 'Action created successfully',
            'action': action_item
        })
        
    except Exception as e:
        print(f"Error creating action: {str(e)}")
        return create_response(500, {'error': 'Failed to create action', 'message': str(e)})

def lambda_handler(event, context):
    """Main Lambda handler"""
    print(f"Received event: {json.dumps(event)}")
    
    try:
        # Extract HTTP method and path
        method = event.get('httpMethod', '').upper()
        path = event.get('path', '')
        body = {}
        
        # Parse body if present
        if event.get('body'):
            try:
                body = json.loads(event['body'])
            except json.JSONDecodeError:
                return create_response(400, {'error': 'Invalid JSON in request body'})
        
        print(f"Method: {method}, Path: {path}")
        
        # Route to appropriate handler
        if path == '/dev/api/v1/health' or path == '/api/v1/health':
            return handle_health()
            
        elif path == '/dev/api/v1/projects' or path == '/api/v1/projects':
            if method == 'GET':
                return handle_get_projects()
            elif method == 'POST':
                return handle_create_project(body)
            elif method == 'OPTIONS':
                return create_response(200, {})
            else:
                return create_response(405, {'error': 'Method not allowed'})
                
        elif path == '/dev/api/v1/actions' or path == '/api/v1/actions':
            if method == 'GET':
                return handle_get_actions()
            elif method == 'POST':
                return handle_create_action(body)
            elif method == 'OPTIONS':
                return create_response(200, {})
            else:
                return create_response(405, {'error': 'Method not allowed'})
                
        else:
            print(f"Route not found for path: {path}")
            return create_response(404, {'error': 'Route not found'})
            
    except Exception as e:
        print(f"Lambda handler error: {str(e)}")
        return create_response(500, {'error': 'Internal server error', 'message': str(e)})