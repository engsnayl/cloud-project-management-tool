# FILE LOCATION: /workspaces/cloud-project-management-tool/src/lambdas/api-handler/lambda_function.py

import json
import os
import boto3
from datetime import datetime, timezone
import uuid
import logging
from decimal import Decimal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AWS clients
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

# Environment variables - Use actual environment variables with fallbacks
ACTIONS_TABLE = os.environ.get('DYNAMODB_TABLE', 'deliverycommand-dev-main')
DOCUMENTS_BUCKET = os.environ.get('S3_BUCKET', 'deliverycommand-dev-documents-h9uf8l1k')

# Get the main table reference
table = dynamodb.Table(ACTIONS_TABLE)

def convert_decimals(obj):
    """Convert DynamoDB Decimal objects to regular numbers"""
    if isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_decimals(value) for key, value in obj.items()}
    elif hasattr(obj, '__class__') and obj.__class__.__name__ == 'Decimal':
        return float(obj)
    else:
        return obj

def success_response(data, status_code=200):
    """Create a success response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(convert_decimals(data), default=str)
    }

def error_response(status_code, message):
    """Create an error response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': message})
    }

def lambda_handler(event, context):
    """Main Lambda handler"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Parse request
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        path_parameters = event.get('pathParameters') or {}
        query_parameters = event.get('queryStringParameters') or {}
        body = event.get('body', '{}')
        
        # Parse JSON body
        try:
            body_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            body_data = {}

        # Handle OPTIONS requests for CORS
        if http_method == 'OPTIONS':
            return success_response({'message': 'CORS preflight'})

        # Route to appropriate handler based on your actual API structure
        if path == '/health':
            return handle_health()
        
        elif path == '/api/v1/actions':
            if http_method == 'GET':
                return handle_get_actions(query_parameters)
            elif http_method == 'POST':
                return handle_create_action(body_data)
        
        elif path.startswith('/api/v1/actions/') and path.endswith('/status'):
            action_id = path.split('/')[-2]
            if http_method == 'PUT':
                return handle_update_action_status(action_id, body_data)
        
        elif path.startswith('/api/v1/actions/'):
            action_id = path.split('/')[-1]
            if http_method == 'GET':
                return handle_get_action(action_id)
            elif http_method == 'PUT':
                return handle_update_action(action_id, body_data)
            elif http_method == 'DELETE':
                return handle_delete_action(action_id)
        
        elif path == '/api/v1/projects':
            if http_method == 'GET':
                return handle_get_projects()
            elif http_method == 'POST':
                return handle_create_project(body_data)

        elif path == '/api/v1/analytics/dashboard':
            return handle_dashboard_analytics()
            
        elif path == '/api/v1/analytics/actions':
            return handle_action_analytics()
        
        # Document processing endpoints
        elif path == '/api/v1/documents/upload':
            if http_method == 'POST':
                return handle_document_upload(event)
        
        elif path == '/api/v1/document-suggestions/pending':
            return handle_get_pending_suggestions()
        
        else:
            logger.warning(f"Unhandled path: {path}")
            return error_response(404, f'Endpoint not found: {path}')

    except Exception as e:
        logger.error(f"Handler error: {str(e)}")
        return error_response(500, f'Internal server error: {str(e)}')

def handle_health():
    """Health check endpoint"""
    return success_response({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'service': 'deliverycommand-api'
    })

def handle_get_actions(query_parameters=None):
    """Get actions using the correct DynamoDB structure"""
    try:
        # Use scan with filter on PK to get all actions
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'ACTION#'}
        )
        
        actions = []
        for item in response.get('Items', []):
            # Convert DynamoDB item to action format
            action = {
                'actionId': item.get('actionId', item.get('PK', '').replace('ACTION#', '')),
                'title': item.get('title', ''),
                'description': item.get('description', ''),
                'status': item.get('status', 'PENDING'),
                'priority': item.get('priority', 'MEDIUM'),
                'projectId': item.get('projectId', 'miscellaneous'),
                'owner': item.get('owner', ''),
                'deadline': item.get('deadline', ''),
                'createdAt': item.get('createdAt', ''),
                'updatedAt': item.get('updatedAt', ''),
                'source': item.get('source', 'MANUAL')
            }
            actions.append(action)
        
        return success_response({'actions': actions, 'count': len(actions)})
        
    except Exception as e:
        logger.error(f"Error getting actions: {str(e)}")
        return error_response(500, "Failed to get actions")

def handle_get_action(action_id):
    """Get a single action by ID"""
    try:
        response = table.get_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in response:
            return error_response(404, "Action not found")
        
        return success_response({'action': convert_decimals(response['Item'])})
        
    except Exception as e:
        logger.error(f"Error getting action {action_id}: {str(e)}")
        return error_response(500, "Failed to get action")

def handle_create_action(body_data):
    """Create a new action with correct DynamoDB structure"""
    try:
        # Validate required fields
        if not body_data.get('title'):
            return error_response(400, 'Title is required')
        
        # Generate action ID
        action_id = f"ACT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create action item with correct structure
        action_item = {
            'PK': f'ACTION#{action_id}',
            'SK': 'METADATA',
            'GSI1PK': f"ACTION#{body_data.get('status', 'PENDING')}",
            'GSI1SK': f"PROJECT#{body_data.get('project', 'miscellaneous')}",
            'actionId': action_id,
            'title': body_data['title'],
            'description': body_data.get('description', ''),
            'owner': body_data.get('owner', ''),
            'status': body_data.get('status', 'PENDING'),
            'priority': body_data.get('priority', 'MEDIUM'),
            'projectId': body_data.get('project', 'miscellaneous'),
            'deadline': body_data.get('deadline', ''),
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'source': 'MANUAL'
        }
        
        table.put_item(Item=action_item)
        
        logger.info(f"Created action: {action_id}")
        return success_response({'action': convert_decimals(action_item)}, 201)
        
    except Exception as e:
        logger.error(f"Error creating action: {str(e)}")
        return error_response(500, "Failed to create action")

def handle_update_action(action_id, body_data):
    """Update an existing action with proper reserved keyword handling"""
    try:
        # Get existing action first
        response = table.get_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in response:
            return error_response(404, "Action not found")
        
        # Build update expression with proper attribute names for reserved keywords
        update_expression = "SET updatedAt = :timestamp"
        expression_values = {':timestamp': datetime.now(timezone.utc).isoformat()}
        expression_names = {}
        
        # Define reserved keywords that need special handling
        reserved_keywords = ['status', 'owner', 'data', 'timestamp', 'comment']
        updateable_fields = ['title', 'description', 'status', 'priority', 'deadline', 'owner', 'projectId']
        
        for field in updateable_fields:
            if field in body_data:
                if field.lower() in reserved_keywords:
                    # Use ExpressionAttributeNames for reserved keywords
                    update_expression += f", #{field} = :{field}"
                    expression_names[f'#{field}'] = field
                    expression_values[f':{field}'] = body_data[field]
                else:
                    # Regular field update
                    update_expression += f", {field} = :{field}"
                    expression_values[f':{field}'] = body_data[field]
        
        # Update GSI1PK if status changed (for filtering)
        if 'status' in body_data:
            update_expression += ", GSI1PK = :gsi1pk"
            expression_values[':gsi1pk'] = f"ACTION#{body_data['status']}"
        
        # Build the update parameters
        update_params = {
            'Key': {'PK': f'ACTION#{action_id}', 'SK': 'METADATA'},
            'UpdateExpression': update_expression,
            'ExpressionAttributeValues': expression_values,
            'ReturnValues': 'ALL_NEW'
        }
        
        # Add ExpressionAttributeNames only if we have reserved keywords
        if expression_names:
            update_params['ExpressionAttributeNames'] = expression_names
        
        # Perform the update
        update_response = table.update_item(**update_params)
        
        logger.info(f"Successfully updated action: {action_id}")
        return success_response({
            'action': convert_decimals(update_response['Attributes']),
            'message': 'Action updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error updating action {action_id}: {str(e)}")
        return error_response(500, f"Failed to update action: {str(e)}")

def handle_update_action_status(action_id, body_data):
    """Update only the status of an action"""
    try:
        status = body_data.get('status')
        if not status:
            return error_response(400, 'Status is required')
        
        response = table.update_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'},
            UpdateExpression='SET #status = :status, updatedAt = :timestamp, GSI1PK = :gsi1pk',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': status,
                ':timestamp': datetime.now(timezone.utc).isoformat(),
                ':gsi1pk': f'ACTION#{status}'
            },
            ReturnValues='ALL_NEW'
        )
        
        logger.info(f"Updated action status: {action_id} -> {status}")
        return success_response({
            'action': convert_decimals(response['Attributes']),
            'message': 'Status updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error updating action status {action_id}: {str(e)}")
        return error_response(500, "Failed to update action status")

def handle_delete_action(action_id):
    """Delete an action - handles multiple ID formats for backward compatibility"""
    try:
        # Try multiple key formats for backwards compatibility
        possible_keys = [
            # Current format
            {'PK': f'ACTION#{action_id}', 'SK': 'METADATA'},
            # Alternative format for UUIDs
            {'PK': f'ACTION#{action_id}', 'SK': f'ACTION#{action_id}'},
            # Legacy format
            {'PK': action_id, 'SK': 'METADATA'}
        ]
        
        action_found = None
        key_to_delete = None
        
        # Try each possible key format
        for key in possible_keys:
            try:
                response = table.get_item(Key=key)
                if 'Item' in response:
                    action_found = response['Item']
                    key_to_delete = key
                    logger.info(f"Found action {action_id} with key format: {key}")
                    break
            except Exception as e:
                logger.debug(f"Failed to find action with key {key}: {str(e)}")
                continue
        
        # If not found with direct keys, try scanning
        if not action_found:
            logger.info(f"Scanning for action {action_id}")
            scan_response = table.scan(
                FilterExpression='contains(PK, :action_id) OR contains(SK, :action_id) OR contains(actionId, :action_id)',
                ExpressionAttributeValues={':action_id': action_id}
            )
            
            if scan_response.get('Items'):
                for item in scan_response['Items']:
                    # Check if this is our action
                    if (item.get('actionId') == action_id or 
                        action_id in item.get('PK', '') or 
                        action_id in item.get('SK', '')):
                        action_found = item
                        key_to_delete = {'PK': item['PK'], 'SK': item['SK']}
                        logger.info(f"Found action {action_id} via scan: PK={item['PK']}, SK={item['SK']}")
                        break
        
        if not action_found:
            logger.error(f"Action not found: {action_id}")
            return error_response(404, f"Action not found: {action_id}")
        
        # Delete the action
        table.delete_item(Key=key_to_delete)
        
        logger.info(f"Successfully deleted action: {action_id} with key: {key_to_delete}")
        return success_response({'message': 'Action deleted successfully'})
        
    except Exception as e:
        logger.error(f"Error deleting action {action_id}: {str(e)}")
        return error_response(500, f"Failed to delete action: {str(e)}")

def handle_get_projects():
    """Get all projects"""
    try:
        # Scan for project items
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'PROJECT#'}
        )
        
        projects = []
        for item in response.get('Items', []):
            project = {
                'projectId': item.get('projectId', item.get('PK', '').replace('PROJECT#', '')),
                'name': item.get('name', ''),
                'description': item.get('description', ''),
                'status': item.get('status', 'ACTIVE'),
                'createdAt': item.get('createdAt', ''),
                'updatedAt': item.get('updatedAt', '')
            }
            projects.append(project)
        
        return success_response({'projects': projects, 'count': len(projects)})
        
    except Exception as e:
        logger.error(f"Error getting projects: {str(e)}")
        return error_response(500, "Failed to get projects")

def handle_create_project(body_data):
    """Create a new project"""
    try:
        if not body_data.get('name'):
            return error_response(400, 'Project name is required')
        
        project_id = f"PRJ-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        project_item = {
            'PK': f'PROJECT#{project_id}',
            'SK': 'METADATA',
            'projectId': project_id,
            'name': body_data['name'],
            'description': body_data.get('description', ''),
            'status': body_data.get('status', 'ACTIVE'),
            'createdAt': timestamp,
            'updatedAt': timestamp
        }
        
        table.put_item(Item=project_item)
        
        logger.info(f"Created project: {project_id}")
        return success_response({'project': convert_decimals(project_item)}, 201)
        
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        return error_response(500, "Failed to create project")

def handle_dashboard_analytics():
    """Get dashboard analytics"""
    try:
        # Get action counts by status
        actions_response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'ACTION#'}
        )
        
        actions = actions_response.get('Items', [])
        
        # Count by status
        status_counts = {}
        priority_counts = {}
        
        for action in actions:
            status = action.get('status', 'PENDING')
            priority = action.get('priority', 'MEDIUM')
            
            status_counts[status] = status_counts.get(status, 0) + 1
            priority_counts[priority] = priority_counts.get(priority, 0) + 1
        
        # Get project count
        projects_response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'PROJECT#'}
        )
        
        return success_response({
            'totalActions': len(actions),
            'totalProjects': len(projects_response.get('Items', [])),
            'actionsByStatus': status_counts,
            'actionsByPriority': priority_counts,
            'recentActions': len([a for a in actions if a.get('createdAt', '').startswith(datetime.now().strftime('%Y-%m-%d'))])
        })
        
    except Exception as e:
        logger.error(f"Error getting dashboard analytics: {str(e)}")
        return error_response(500, "Failed to get analytics")

def handle_action_analytics():
    """Get action-specific analytics"""
    try:
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'ACTION#'}
        )
        
        actions = response.get('Items', [])
        
        return success_response({
            'totalActions': len(actions),
            'byStatus': {status: len([a for a in actions if a.get('status') == status]) for status in ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']},
            'byPriority': {priority: len([a for a in actions if a.get('priority') == priority]) for priority in ['LOW', 'MEDIUM', 'HIGH', 'URGENT']},
            'byOwner': {}
        })
        
    except Exception as e:
        logger.error(f"Error getting action analytics: {str(e)}")
        return error_response(500, "Failed to get action analytics")

# Document processing placeholder functions
def handle_document_upload(event):
    """Handle document upload - placeholder"""
    return success_response({'message': 'Document upload not yet implemented'})

def handle_get_pending_suggestions():
    """Get pending document suggestions - placeholder"""
    return success_response({'suggestions': [], 'count': 0})