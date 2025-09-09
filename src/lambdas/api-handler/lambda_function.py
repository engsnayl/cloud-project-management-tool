#/cloud-project-management-tool/src/lambdas/api-handler/lambda_function.py

import json
import boto3
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMODB_TABLE', 'deliverycommand-dev-main')
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    """Main handler for API Gateway requests"""
    try:
        # Parse the request
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        headers = event.get('headers', {})
        query_params = event.get('queryStringParameters') or {}
        body = event.get('body')
        
        # Parse JSON body if present
        json_body = None
        if body:
            try:
                json_body = json.loads(body)
            except json.JSONDecodeError:
                return error_response(400, "Invalid JSON in request body")
        
        logger.info(f"Processing {http_method} {path}")
        
        # Route the request
        if path == '/api/v1/health':
            return handle_health()
        elif path == '/api/v1/actions':
            return handle_actions(http_method, query_params, json_body)
        elif path.startswith('/api/v1/actions/') and path.endswith('/status'):
            action_id = path.split('/')[4]  # Extract action ID from path
            return handle_action_status_update(action_id, json_body)
        elif path == '/api/v1/projects':
            return handle_projects(http_method, query_params, json_body)
        elif path.startswith('/api/v1/projects/'):
            project_id = path.split('/')[4]  # Extract project ID from path
            return handle_project_detail(project_id, http_method, json_body)
        else:
            return error_response(404, f"Endpoint not found: {path}")
            
    except Exception as e:
        logger.error(f"Unhandled error: {str(e)}")
        return error_response(500, "Internal server error")

def handle_health():
    """Health check endpoint"""
    return success_response({
        'status': 'healthy',
        'service': 'DeliveryCommand API',
        'version': '1.0.0',
        'timestamp': datetime.now(timezone.utc).isoformat()
    })

def handle_actions(http_method, query_params, json_body):
    """Handle actions endpoints"""
    if http_method == 'GET':
        return get_actions(query_params)
    elif http_method == 'POST':
        return create_action(json_body)
    else:
        return error_response(405, f"Method {http_method} not allowed")

def handle_action_status_update(action_id, json_body):
    """Handle action status updates"""
    if not json_body or 'status' not in json_body:
        return error_response(400, "Status is required")
    
    return update_action_status(action_id, json_body['status'])

def handle_projects(http_method, query_params, json_body):
    """Handle projects endpoints"""
    if http_method == 'GET':
        return get_projects(query_params)
    elif http_method == 'POST':
        return create_project(json_body)
    else:
        return error_response(405, f"Method {http_method} not allowed")

def handle_project_detail(project_id, http_method, json_body):
    """Handle individual project operations"""
    if http_method == 'GET':
        return get_project(project_id)
    elif http_method == 'PUT':
        return update_project(project_id, json_body)
    else:
        return error_response(405, f"Method {http_method} not allowed")

def get_actions(query_params):
    """Get actions with optional filtering"""
    try:
        # Handle query parameters for filtering
        project_id = query_params.get('projectId')
        owner = query_params.get('owner')
        status = query_params.get('status')
        
        if project_id:
            # Query actions by project using GSI1
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={
                    ':pk': f"PROJECT#{project_id}"
                }
            )
            items = response.get('Items', [])
        elif owner:
            # Query actions by owner using GSI1
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={
                    ':pk': f"OWNER#{owner}"
                }
            )
            items = response.get('Items', [])
        else:
            # Scan for all actions (not ideal for large datasets, but OK for demo)
            response = table.scan(
                FilterExpression='begins_with(PK, :pk)',
                ExpressionAttributeValues={
                    ':pk': 'ACTION#'
                }
            )
            items = response.get('Items', [])
        
        # Filter by status if provided
        if status:
            items = [item for item in items if item.get('status', '').lower() == status.lower()]
        
        # Convert DynamoDB items to clean JSON
        actions = []
        for item in items:
            if item.get('entityType') == 'action':
                action = dynamodb_to_dict(item)
                actions.append(action)
        
        # Sort by creation date (most recent first)
        actions.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        return success_response({
            'actions': actions,
            'count': len(actions)
        })
        
    except Exception as e:
        logger.error(f"Error getting actions: {str(e)}")
        return error_response(500, "Failed to retrieve actions")

def create_action(json_body):
    """Create a new action"""
    try:
        if not json_body:
            return error_response(400, "Request body is required")
        
        # Validate required fields
        required_fields = ['title', 'owner', 'projectId']
        for field in required_fields:
            if not json_body.get(field):
                return error_response(400, f"Field '{field}' is required")
        
        # Generate unique action ID
        action_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create the action item
        action_item = {
            'PK': f"ACTION#{action_id}",
            'SK': f"ACTION#{action_id}",
            'GSI1PK': f"PROJECT#{json_body['projectId']}",
            'GSI1SK': f"ACTION#{timestamp}",
            'entityType': 'action',
            'actionId': action_id,
            'title': json_body['title'],
            'description': json_body.get('description', ''),
            'owner': json_body['owner'],
            'projectId': json_body['projectId'],
            'status': 'pending',
            'priority': json_body.get('priority', 'MEDIUM'),
            'source': json_body.get('source', 'MANUAL'),
            'deadline': json_body.get('deadline'),
            'createdAt': timestamp,
            'updatedAt': timestamp
        }
        
        # Also create an index by owner for efficient queries
        owner_index_item = {
            'PK': f"OWNER#{json_body['owner']}",
            'SK': f"ACTION#{action_id}",
            'GSI1PK': f"OWNER#{json_body['owner']}",
            'GSI1SK': f"ACTION#{timestamp}",
            'entityType': 'owner_action_index',
            'actionId': action_id,
            'projectId': json_body['projectId'],
            'status': 'pending',
            'createdAt': timestamp
        }
        
        # Write both items in a transaction
        table.put_item(Item=action_item)
        table.put_item(Item=owner_index_item)
        
        logger.info(f"Created action {action_id} for project {json_body['projectId']}")
        
        return success_response({
            'message': 'Action created successfully',
            'action': dynamodb_to_dict(action_item)
        }, 201)
        
    except Exception as e:
        logger.error(f"Error creating action: {str(e)}")
        return error_response(500, "Failed to create action")

def update_action_status(action_id, new_status):
    """Update action status"""
    try:
        # Valid statuses
        valid_statuses = ['pending', 'in_progress', 'completed', 'overdue']
        if new_status.lower() not in valid_statuses:
            return error_response(400, f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Update the main action item
        response = table.update_item(
            Key={
                'PK': f"ACTION#{action_id}",
                'SK': f"ACTION#{action_id}"
            },
            UpdateExpression='SET #status = :status, updatedAt = :timestamp',
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':status': new_status.lower(),
                ':timestamp': timestamp
            },
            ReturnValues='ALL_NEW'
        )
        
        updated_action = response.get('Attributes')
        if not updated_action:
            return error_response(404, "Action not found")
        
        # Also update the owner index
        owner = updated_action.get('owner')
        if owner:
            table.update_item(
                Key={
                    'PK': f"OWNER#{owner}",
                    'SK': f"ACTION#{action_id}"
                },
                UpdateExpression='SET #status = :status',
                ExpressionAttributeNames={
                    '#status': 'status'
                },
                ExpressionAttributeValues={
                    ':status': new_status.lower()
                }
            )
        
        logger.info(f"Updated action {action_id} status to {new_status}")
        
        return success_response({
            'message': 'Action status updated successfully',
            'action': dynamodb_to_dict(updated_action)
        })
        
    except Exception as e:
        logger.error(f"Error updating action status: {str(e)}")
        return error_response(500, "Failed to update action status")

def get_projects(query_params):
    """Get all projects"""
    try:
        response = table.scan(
            FilterExpression='begins_with(PK, :pk)',
            ExpressionAttributeValues={
                ':pk': 'PROJECT#'
            }
        )
        
        projects = []
        for item in response.get('Items', []):
            if item.get('entityType') == 'project':
                project = dynamodb_to_dict(item)
                projects.append(project)
        
        # Sort by creation date (most recent first)
        projects.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        return success_response({
            'projects': projects,
            'count': len(projects)
        })
        
    except Exception as e:
        logger.error(f"Error getting projects: {str(e)}")
        return error_response(500, "Failed to retrieve projects")

def create_project(json_body):
    """Create a new project"""
    try:
        if not json_body:
            return error_response(400, "Request body is required")
        
        # Validate required fields
        required_fields = ['name', 'owner']
        for field in required_fields:
            if not json_body.get(field):
                return error_response(400, f"Field '{field}' is required")
        
        # Generate unique project ID
        project_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create the project item
        project_item = {
            'PK': f"PROJECT#{project_id}",
            'SK': f"PROJECT#{project_id}",
            'GSI1PK': f"OWNER#{json_body['owner']}",
            'GSI1SK': f"PROJECT#{timestamp}",
            'entityType': 'project',
            'projectId': project_id,
            'name': json_body['name'],
            'description': json_body.get('description', ''),
            'owner': json_body['owner'],
            'status': json_body.get('status', 'active'),
            'startDate': json_body.get('startDate'),
            'endDate': json_body.get('endDate'),
            'createdAt': timestamp,
            'updatedAt': timestamp
        }
        
        table.put_item(Item=project_item)
        
        logger.info(f"Created project {project_id}: {json_body['name']}")
        
        return success_response({
            'message': 'Project created successfully',
            'project': dynamodb_to_dict(project_item)
        }, 201)
        
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        return error_response(500, "Failed to create project")

def get_project(project_id):
    """Get a specific project"""
    try:
        response = table.get_item(
            Key={
                'PK': f"PROJECT#{project_id}",
                'SK': f"PROJECT#{project_id}"
            }
        )
        
        project = response.get('Item')
        if not project:
            return error_response(404, "Project not found")
        
        return success_response({
            'project': dynamodb_to_dict(project)
        })
        
    except Exception as e:
        logger.error(f"Error getting project: {str(e)}")
        return error_response(500, "Failed to retrieve project")

def update_project(project_id, json_body):
    """Update a project"""
    try:
        if not json_body:
            return error_response(400, "Request body is required")
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Build update expression dynamically
        update_expression = "SET updatedAt = :timestamp"
        expression_values = {':timestamp': timestamp}
        expression_names = {}
        
        updatable_fields = ['name', 'description', 'status', 'startDate', 'endDate']
        for field in updatable_fields:
            if field in json_body:
                if field == 'status':  # Handle reserved keyword
                    update_expression += f", #status = :{field}"
                    expression_names['#status'] = 'status'
                else:
                    update_expression += f", {field} = :{field}"
                expression_values[f":{field}"] = json_body[field]
        
        response = table.update_item(
            Key={
                'PK': f"PROJECT#{project_id}",
                'SK': f"PROJECT#{project_id}"
            },
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ExpressionAttributeNames=expression_names if expression_names else None,
            ReturnValues='ALL_NEW'
        )
        
        updated_project = response.get('Attributes')
        if not updated_project:
            return error_response(404, "Project not found")
        
        logger.info(f"Updated project {project_id}")
        
        return success_response({
            'message': 'Project updated successfully',
            'project': dynamodb_to_dict(updated_project)
        })
        
    except Exception as e:
        logger.error(f"Error updating project: {str(e)}")
        return error_response(500, "Failed to update project")

def dynamodb_to_dict(item):
    """Convert DynamoDB item to clean dictionary (handle Decimal types)"""
    def convert_item(obj):
        if isinstance(obj, dict):
            return {k: convert_item(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_item(v) for v in obj]
        elif isinstance(obj, Decimal):
            return float(obj) if obj % 1 else int(obj)
        else:
            return obj
    
    return convert_item(item)

def success_response(data, status_code=200):
    """Return successful response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(data)
    }

def error_response(status_code, message):
    """Return error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps({
            'error': True,
            'message': message,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    }