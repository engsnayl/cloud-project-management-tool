# FILE LOCATION: /workspaces/cloud-project-management-tool/src/lambdas/api-handler/lambda_function.py

import json
import os
import boto3
from datetime import datetime, timezone
import uuid
import logging
from decimal import Decimal
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# AWS clients
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
ecs_client = boto3.client('ecs')

# Environment variables - Fixed to match what Lambda actually has
ACTIONS_TABLE = os.environ.get('DYNAMODB_TABLE', 'deliverycommand-dev-main')
DOCUMENTS_BUCKET = os.environ.get('DOCUMENT_BUCKET', 'deliverycommand-dev-documents-h9uf8l1k')

# Get the main table reference
table = dynamodb.Table(ACTIONS_TABLE)

def detect_file_type(file_data):
    """Detect file type from binary signature"""
    if isinstance(file_data, str):
        file_data = file_data.encode("utf-8")
    
    if file_data.startswith(b"PK"):
        return "docx"
    elif file_data.startswith(b"%PDF"):
        return "pdf"
    else:
        return "pdf"


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

        # Route to appropriate handler
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
        
        elif path.startswith('/api/v1/document-suggestions/') and path.endswith('/approve'):
            suggestion_id = path.split('/')[-2]
            if http_method == 'POST':
                return handle_approve_suggestion(suggestion_id, body_data)
        
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
    """Get actions - simplified for debugging"""
    try:
        logger.info("Getting actions...")
        
        # Simple scan to get all actions
        response = table.scan()
        logger.info(f"DynamoDB scan response: {response}")
        
        # Filter for action items
        actions = []
        for item in response.get('Items', []):
            # Look for action items by checking PK or actionId
            if (item.get('PK', '').startswith('ACTION#') or 
                'actionId' in item or 
                item.get('type') == 'action'):
                
                action = {
                    'actionId': item.get('actionId', item.get('PK', '').replace('ACTION#', '')),
                    'title': item.get('title', 'Untitled Action'),
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
        
        logger.info(f"Found {len(actions)} actions")
        return success_response({'actions': actions, 'count': len(actions)})
        
    except Exception as e:
        logger.error(f"Error getting actions: {str(e)}")
        return error_response(500, f"Failed to get actions: {str(e)}")

def handle_get_action(action_id):
    """Get a single action by ID"""
    try:
        # Try multiple possible key formats
        possible_keys = [
            {'PK': f'ACTION#{action_id}', 'SK': 'METADATA'},
            {'actionId': action_id}
        ]
        
        for key in possible_keys:
            try:
                response = table.get_item(Key=key)
                if 'Item' in response:
                    return success_response({'action': convert_decimals(response['Item'])})
            except:
                continue
                
        return error_response(404, "Action not found")
        
    except Exception as e:
        logger.error(f"Error getting action {action_id}: {str(e)}")
        return error_response(500, "Failed to get action")

def handle_create_action(body_data):
    """Create a new action"""
    try:
        # Validate required fields
        if not body_data.get('title'):
            return error_response(400, 'Title is required')
        
        # Generate action ID
        action_id = f"ACT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create action item
        action_item = {
            'PK': f'ACTION#{action_id}',
            'SK': 'METADATA',
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
        return error_response(500, f"Failed to create action: {str(e)}")

def handle_update_action(action_id, body_data):
    """Update an existing action"""
    try:
        # Get existing action first
        response = table.get_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in response:
            return error_response(404, "Action not found")
        
        # Build update expression
        update_expression = "SET updatedAt = :timestamp"
        expression_values = {':timestamp': datetime.now(timezone.utc).isoformat()}
        expression_names = {}
        
        # Handle reserved keywords
        reserved_keywords = ['status', 'owner']
        updateable_fields = ['title', 'description', 'status', 'priority', 'deadline', 'owner', 'projectId']
        
        for field in updateable_fields:
            if field in body_data:
                if field.lower() in reserved_keywords:
                    update_expression += f", #{field} = :{field}"
                    expression_names[f'#{field}'] = field
                    expression_values[f':{field}'] = body_data[field]
                else:
                    update_expression += f", {field} = :{field}"
                    expression_values[f':{field}'] = body_data[field]
        
        # Build update parameters
        update_params = {
            'Key': {'PK': f'ACTION#{action_id}', 'SK': 'METADATA'},
            'UpdateExpression': update_expression,
            'ExpressionAttributeValues': expression_values,
            'ReturnValues': 'ALL_NEW'
        }
        
        if expression_names:
            update_params['ExpressionAttributeNames'] = expression_names
        
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
            UpdateExpression='SET #status = :status, updatedAt = :timestamp',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': status,
                ':timestamp': datetime.now(timezone.utc).isoformat()
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
    """Delete an action"""
    try:
        # Try to delete with the standard key format
        table.delete_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'}
        )
        
        logger.info(f"Successfully deleted action: {action_id}")
        return success_response({'message': 'Action deleted successfully'})
        
    except Exception as e:
        logger.error(f"Error deleting action {action_id}: {str(e)}")
        return error_response(500, f"Failed to delete action: {str(e)}")

def handle_get_projects():
    """Get all projects"""
    try:
        # Simple scan for projects
        response = table.scan()
        
        projects = []
        for item in response.get('Items', []):
            if item.get('PK', '').startswith('PROJECT#') or 'projectId' in item:
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
    """Get dashboard analytics - simplified"""
    try:
        # Get all items and categorize
        response = table.scan()
        actions = [item for item in response.get('Items', []) if item.get('PK', '').startswith('ACTION#')]
        projects = [item for item in response.get('Items', []) if item.get('PK', '').startswith('PROJECT#')]
        
        # Count by status
        status_counts = {}
        for action in actions:
            status = action.get('status', 'PENDING')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return success_response({
            'totalActions': len(actions),
            'totalProjects': len(projects),
            'actionsByStatus': status_counts,
            'recentActions': 0  # Simplified
        })
        
    except Exception as e:
        logger.error(f"Error getting dashboard analytics: {str(e)}")
        return error_response(500, "Failed to get analytics")

def handle_action_analytics():
    """Get action-specific analytics"""
    try:
        response = table.scan()
        actions = [item for item in response.get('Items', []) if item.get('PK', '').startswith('ACTION#')]
        
        return success_response({
            'totalActions': len(actions),
            'byStatus': {status: len([a for a in actions if a.get('status') == status]) 
                        for status in ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']},
            'byPriority': {priority: len([a for a in actions if a.get('priority') == priority]) 
                          for priority in ['LOW', 'MEDIUM', 'HIGH', 'URGENT']}
        })
        
    except Exception as e:
        logger.error(f"Error getting action analytics: {str(e)}")
        return error_response(500, "Failed to get action analytics")

def handle_document_upload(event):
    """Handle document upload and trigger processing"""
    try:
        import base64
        import uuid
        from datetime import datetime, timezone
        
        # Parse the multipart form data
        body = event.get('body', '')
        content_type = event.get('headers', {}).get('Content-Type', '')
        
        if not body:
            return error_response(400, 'No file data provided')
        
        # Handle base64 encoded body
        if event.get('isBase64Encoded', False):
            body = base64.b64decode(body)
        else:
            body = body.encode('utf-8')
        
        # Generate file info
        document_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Detect file type from binary content
        file_extension = "docx"
        
        # Create S3 key
        s3_key = f"documents/{timestamp}_{document_id}.{file_extension}"
        
        # Upload to S3
        s3_client.put_object(
            Bucket=DOCUMENTS_BUCKET,
            Key=s3_key,
            Body=body,
            ContentType=content_type
        )
        
        logger.info(f"Uploaded file to S3: {s3_key}")
        
        # Trigger ECS task for processing
        task_response = ecs_client.run_task(
            cluster='deliverycommand-dev-cluster',
            taskDefinition='deliverycommand-dev-document-processor',
            launchType='FARGATE',
            networkConfiguration={
                'awsvpcConfiguration': {
                    'subnets': [
                        'subnet-08264e8225b611b9a',
                        'subnet-042f5fe9c5b4d70c1'
                    ],
                    'securityGroups': ['sg-0a58a00cc6b3962fe'],
                    'assignPublicIp': 'ENABLED'
                }
            },
            overrides={
                'containerOverrides': [
                    {
                        'name': 'document-processor',
                        'environment': [
                            {'name': 'DOCUMENT_BUCKET', 'value': DOCUMENTS_BUCKET},
                            {'name': 'DOCUMENT_KEY', 'value': s3_key},
                            {'name': 'DOCUMENT_ID', 'value': document_id},
                            {'name': 'DYNAMODB_TABLE', 'value': ACTIONS_TABLE}
                        ]
                    }
                ]
            }
        )
        
        task_arn = task_response['tasks'][0]['taskArn']
        logger.info(f"Started ECS task: {task_arn}")
        
        # Store document metadata
        document_item = {
            'PK': f'DOCUMENT#{document_id}',
            'SK': 'METADATA',
            'documentId': document_id,
            'filename': f"{timestamp}_{document_id}.{file_extension}",
            's3Key': s3_key,
            's3Bucket': DOCUMENTS_BUCKET,
            'status': 'PROCESSING',
            'taskArn': task_arn,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'fileExtension': file_extension
        }
        
        table.put_item(Item=document_item)
        
        return success_response({
            'message': 'Document uploaded successfully and processing started',
            'documentId': document_id,
            'status': 'PROCESSING',
            'taskArn': task_arn,
            's3Key': s3_key
        })
        
    except Exception as e:
        logger.error(f"Document upload error: {str(e)}")
        return error_response(500, f'Upload failed: {str(e)}')

def handle_get_pending_suggestions():
    """Get pending document suggestions"""
    try:
        # Scan for suggestion items
        response = table.scan()
        
        suggestions = []
        for item in response.get('Items', []):
            if item.get('PK', '').startswith('SUGGESTION#') and item.get('status') == 'PENDING':
                suggestion = {
                    'suggestionId': item.get('suggestionId', item.get('PK', '').replace('SUGGESTION#', '')),
                    'title': item.get('title', ''),
                    'description': item.get('description', ''),
                    'priority': item.get('priority', 'MEDIUM'),
                    'confidence': float(item.get('confidence', 0.5)),
                    'context': item.get('context', ''),
                    'extractedFrom': item.get('extractedFrom', ''),
                    'createdAt': item.get('createdAt', ''),
                    'status': item.get('status', 'PENDING')
                }
                suggestions.append(suggestion)
        
        logger.info(f"Found {len(suggestions)} pending suggestions")
        return success_response({
            'suggestions': suggestions,
            'total_suggestions': len(suggestions)
        })
        
    except Exception as e:
        logger.error(f"Error getting pending suggestions: {str(e)}")
        return error_response(500, f'Failed to get suggestions: {str(e)}')

def handle_approve_suggestion(suggestion_id, body_data):
    """Approve a suggestion and convert it to an action"""
    try:
        # Get the suggestion
        response = table.get_item(
            Key={'PK': f'SUGGESTION#{suggestion_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in response:
            return error_response(404, "Suggestion not found")
        
        suggestion = response['Item']
        
        # Generate action ID
        action_id = f"ACT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create action from suggestion with any edits from body_data
        action_item = {
            'PK': f'ACTION#{action_id}',
            'SK': 'METADATA',
            'actionId': action_id,
            'title': body_data.get('title', suggestion.get('title', '')),
            'description': body_data.get('description', suggestion.get('description', '')),
            'owner': body_data.get('owner', ''),
            'status': body_data.get('status', 'PENDING'),
            'priority': body_data.get('priority', suggestion.get('priority', 'MEDIUM')),
            'projectId': body_data.get('project', 'miscellaneous'),
            'deadline': body_data.get('deadline', ''),
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'source': 'DOCUMENT_EXTRACTION',
            'originalSuggestionId': suggestion_id
        }
        
        # Create the action
        table.put_item(Item=action_item)
        
        # Mark suggestion as approved
        table.update_item(
            Key={'PK': f'SUGGESTION#{suggestion_id}', 'SK': 'METADATA'},
            UpdateExpression='SET #status = :status, approvedAt = :timestamp, actionId = :actionId',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'APPROVED',
                ':timestamp': timestamp,
                ':actionId': action_id
            }
        )
        
        logger.info(f"Approved suggestion {suggestion_id} and created action {action_id}")
        return success_response({
            'action': convert_decimals(action_item),
            'message': 'Suggestion approved and action created successfully'
        })
        
    except Exception as e:
        logger.error(f"Error approving suggestion {suggestion_id}: {str(e)}")
        return error_response(500, f'Failed to approve suggestion: {str(e)}')