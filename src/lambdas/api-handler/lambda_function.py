# src/lambdas/api-handler/lambda_function.py
#
# This is the main API handler for the DeliveryCommand application.
# It receives HTTP requests from API Gateway and performs CRUD operations
# on DynamoDB. Think of it as the "brain" of the backend.
#
# Key improvements over the original version:
#   1. Uses DynamoDB Query (fast, indexed) instead of Scan (slow, reads entire table)
#   2. Populates GSI1PK/GSI1SK so the Global Secondary Index actually works
#   3. Uses environment-based CORS origins instead of wildcard "*"
#   4. Adds pagination support for listing endpoints
#   5. Removes hardcoded AWS resource IDs (ECS clusters, subnets, etc.)
#   6. Adds input validation

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

# Environment variables set by Terraform (see modules/lambda/main.tf)
ACTIONS_TABLE = os.environ.get('DYNAMODB_TABLE', 'deliverycommand-dev-main')
DOCUMENTS_BUCKET = os.environ.get('DOCUMENT_BUCKET', os.environ.get('S3_BUCKET', ''))
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*')

# DynamoDB table reference
table = dynamodb.Table(ACTIONS_TABLE)

# Default page size for list operations
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


# ─────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────

def get_cors_origin(event):
    """
    Return the correct CORS origin header based on the request.

    Instead of returning '*' (which means "allow any website to call our API"),
    we check if the request came from one of our allowed domains and only
    allow that specific domain. This is more secure.
    """
    if ALLOWED_ORIGINS == '*':
        return '*'

    request_origin = ''
    headers = event.get('headers', {}) or {}
    # HTTP headers can be any case, so check common variations
    request_origin = headers.get('Origin', headers.get('origin', ''))

    allowed = [o.strip() for o in ALLOWED_ORIGINS.split(',')]

    if request_origin in allowed:
        return request_origin

    # If no match, return the first allowed origin (safe default)
    return allowed[0] if allowed else '*'


def convert_decimals(obj):
    """
    Convert DynamoDB Decimal objects to regular Python numbers.

    DynamoDB returns numbers as Decimal objects (for precision), but
    JSON doesn't understand Decimals. This converts them to int or float
    so json.dumps() works properly.
    """
    if isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_decimals(value) for key, value in obj.items()}
    elif isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    return obj


def success_response(event, data, status_code=200):
    """Create a success response with proper CORS headers."""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': get_cors_origin(event),
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(convert_decimals(data), default=str)
    }


def error_response(event, status_code, message):
    """Create an error response with proper CORS headers."""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': get_cors_origin(event),
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': message})
    }


def validate_required_fields(body_data, required_fields):
    """
    Check that all required fields are present and non-empty.
    Returns None if valid, or an error message string if not.
    """
    missing = [f for f in required_fields if not body_data.get(f)]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None


def get_page_size(query_parameters):
    """Extract and validate page size from query parameters."""
    try:
        size = int(query_parameters.get('pageSize', DEFAULT_PAGE_SIZE))
        return min(size, MAX_PAGE_SIZE)
    except (ValueError, TypeError):
        return DEFAULT_PAGE_SIZE


# ─────────────────────────────────────────────
# Main Handler (Router)
# ─────────────────────────────────────────────

def lambda_handler(event, context):
    """
    Main Lambda entry point. API Gateway sends the HTTP request here.
    This function reads the path and method, then routes to the right handler.
    """
    try:
        logger.info(f"Received event: {json.dumps(event)}")

        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        query_parameters = event.get('queryStringParameters') or {}
        body = event.get('body', '{}')

        try:
            body_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            body_data = {}

        # Handle CORS preflight (browser sends OPTIONS before real request)
        if http_method == 'OPTIONS':
            return success_response(event, {'message': 'CORS preflight'})

        # Route to the correct handler based on path and method
        if path == '/health':
            return handle_health(event)

        elif path == '/api/v1/actions':
            if http_method == 'GET':
                return handle_get_actions(event, query_parameters)
            elif http_method == 'POST':
                return handle_create_action(event, body_data)

        elif path.startswith('/api/v1/actions/') and path.endswith('/status'):
            action_id = path.split('/')[-2]
            if http_method == 'PUT':
                return handle_update_action_status(event, action_id, body_data)

        elif path.startswith('/api/v1/actions/'):
            action_id = path.split('/')[-1]
            if http_method == 'GET':
                return handle_get_action(event, action_id)
            elif http_method == 'PUT':
                return handle_update_action(event, action_id, body_data)
            elif http_method == 'DELETE':
                return handle_delete_action(event, action_id)

        elif path == '/api/v1/projects':
            if http_method == 'GET':
                return handle_get_projects(event, query_parameters)
            elif http_method == 'POST':
                return handle_create_project(event, body_data)

        elif path.startswith('/api/v1/projects/'):
            project_id = path.split('/')[-1]
            if http_method == 'GET':
                return handle_get_project(event, project_id)
            elif http_method == 'PUT':
                return handle_update_project(event, project_id, body_data)
            elif http_method == 'DELETE':
                return handle_delete_project(event, project_id)

        elif path == '/api/v1/analytics/dashboard':
            return handle_dashboard_analytics(event)

        elif path == '/api/v1/analytics/actions':
            return handle_action_analytics(event)

        elif path == '/api/v1/documents/upload':
            if http_method == 'POST':
                return handle_document_upload(event)

        elif path == '/api/v1/document-suggestions/pending':
            return handle_get_pending_suggestions(event, query_parameters)

        elif path.startswith('/api/v1/document-suggestions/') and path.endswith('/approve'):
            suggestion_id = path.split('/')[-2]
            if http_method == 'POST':
                return handle_approve_suggestion(event, suggestion_id, body_data)

        logger.warning(f"Unhandled path: {http_method} {path}")
        return error_response(event, 404, f'Endpoint not found: {path}')

    except Exception as e:
        logger.error(f"Handler error: {str(e)}", exc_info=True)
        return error_response(event, 500, 'Internal server error')


# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────

def handle_health(event):
    """Health check endpoint - no auth required."""
    return success_response(event, {
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'service': 'deliverycommand-api',
        'environment': ENVIRONMENT
    })


# ─────────────────────────────────────────────
# Actions CRUD
# ─────────────────────────────────────────────

def handle_get_actions(event, query_parameters):
    """
    Get all actions using DynamoDB Query on GSI1 (not Scan).

    Why Query instead of Scan?
    - Scan reads EVERY item in the table, then filters. Slow and expensive.
    - Query uses an index to jump directly to matching items. Fast and cheap.

    We use the GSI1 index where GSI1PK = "ACTIONS" to find all action items.
    """
    try:
        page_size = get_page_size(query_parameters)
        status_filter = query_parameters.get('status', '').upper()

        # Build the query against GSI1
        query_params = {
            'IndexName': 'GSI1',
            'KeyConditionExpression': 'GSI1PK = :pk',
            'ExpressionAttributeValues': {':pk': 'ACTIONS'},
            'ScanIndexForward': False,  # Newest first
            'Limit': page_size
        }

        # If caller wants a specific page, use the pagination token
        next_token = query_parameters.get('nextToken')
        if next_token:
            try:
                query_params['ExclusiveStartKey'] = json.loads(
                    __import__('base64').b64decode(next_token).decode()
                )
            except Exception:
                pass

        response = table.query(**query_params)

        actions = []
        for item in response.get('Items', []):
            action = _format_action(item)
            # Apply status filter client-side if requested
            if status_filter and action['status'] != status_filter:
                continue
            actions.append(action)

        result = {'actions': actions, 'count': len(actions)}

        # Include pagination token if there are more results
        if response.get('LastEvaluatedKey'):
            import base64
            result['nextToken'] = base64.b64encode(
                json.dumps(response['LastEvaluatedKey']).encode()
            ).decode()

        return success_response(event, result)

    except Exception as e:
        logger.error(f"Error getting actions: {str(e)}", exc_info=True)
        # Fall back to scan for backward compatibility with old data
        return _get_actions_fallback(event, query_parameters)


def _get_actions_fallback(event, query_parameters):
    """Fallback: scan table for actions that don't have GSI1 keys yet."""
    try:
        response = table.scan()
        actions = []
        for item in response.get('Items', []):
            if (item.get('PK', '').startswith('ACTION#') or
                    item.get('type') == 'action'):
                actions.append(_format_action(item))

        return success_response(event, {'actions': actions, 'count': len(actions)})
    except Exception as e:
        logger.error(f"Fallback scan error: {str(e)}")
        return error_response(event, 500, 'Failed to get actions')


def _format_action(item):
    """Format a DynamoDB item into the action response shape."""
    return {
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


def handle_get_action(event, action_id):
    """Get a single action by its ID."""
    try:
        response = table.get_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'}
        )

        if 'Item' not in response:
            return error_response(event, 404, 'Action not found')

        return success_response(event, {'action': _format_action(response['Item'])})

    except Exception as e:
        logger.error(f"Error getting action {action_id}: {str(e)}")
        return error_response(event, 500, 'Failed to get action')


def handle_create_action(event, body_data):
    """
    Create a new action item in DynamoDB.

    Key design decision: we set GSI1PK = "ACTIONS" and GSI1SK = the timestamp.
    This lets us efficiently query all actions sorted by creation date using the
    Global Secondary Index, instead of scanning the whole table.
    """
    try:
        validation_error = validate_required_fields(body_data, ['title'])
        if validation_error:
            return error_response(event, 400, validation_error)

        action_id = f"ACT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
        timestamp = datetime.now(timezone.utc).isoformat()

        action_item = {
            'PK': f'ACTION#{action_id}',
            'SK': 'METADATA',
            # GSI1 keys: enables "get all actions sorted by date" queries
            'GSI1PK': 'ACTIONS',
            'GSI1SK': f'{timestamp}#{action_id}',
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
        return success_response(event, {'action': _format_action(action_item)}, 201)

    except Exception as e:
        logger.error(f"Error creating action: {str(e)}")
        return error_response(event, 500, f'Failed to create action: {str(e)}')


def handle_update_action(event, action_id, body_data):
    """Update an existing action."""
    try:
        # Verify the action exists
        response = table.get_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'}
        )

        if 'Item' not in response:
            return error_response(event, 404, 'Action not found')

        timestamp = datetime.now(timezone.utc).isoformat()

        # Build update expression dynamically based on which fields were sent
        update_expression = 'SET updatedAt = :timestamp'
        expression_values = {':timestamp': timestamp}
        expression_names = {}

        # DynamoDB reserves certain words (like "status" and "owner").
        # We must use expression attribute names (#status) to work around this.
        reserved_keywords = {'status', 'owner'}
        updateable_fields = ['title', 'description', 'status', 'priority', 'deadline', 'owner', 'projectId']

        for field in updateable_fields:
            if field in body_data:
                if field in reserved_keywords:
                    update_expression += f', #{field} = :{field}'
                    expression_names[f'#{field}'] = field
                else:
                    update_expression += f', {field} = :{field}'
                expression_values[f':{field}'] = body_data[field]

        update_params = {
            'Key': {'PK': f'ACTION#{action_id}', 'SK': 'METADATA'},
            'UpdateExpression': update_expression,
            'ExpressionAttributeValues': expression_values,
            'ReturnValues': 'ALL_NEW'
        }

        if expression_names:
            update_params['ExpressionAttributeNames'] = expression_names

        update_response = table.update_item(**update_params)

        logger.info(f"Updated action: {action_id}")
        return success_response(event, {
            'action': _format_action(update_response['Attributes']),
            'message': 'Action updated successfully'
        })

    except Exception as e:
        logger.error(f"Error updating action {action_id}: {str(e)}")
        return error_response(event, 500, f'Failed to update action: {str(e)}')


def handle_update_action_status(event, action_id, body_data):
    """Update only the status of an action (convenience endpoint)."""
    try:
        validation_error = validate_required_fields(body_data, ['status'])
        if validation_error:
            return error_response(event, 400, validation_error)

        valid_statuses = {'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'}
        status = body_data['status'].upper()
        if status not in valid_statuses:
            return error_response(event, 400, f'Invalid status. Must be one of: {", ".join(valid_statuses)}')

        response = table.update_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'},
            UpdateExpression='SET #status = :status, updatedAt = :timestamp',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': status,
                ':timestamp': datetime.now(timezone.utc).isoformat()
            },
            ConditionExpression='attribute_exists(PK)',
            ReturnValues='ALL_NEW'
        )

        logger.info(f"Updated action status: {action_id} -> {status}")
        return success_response(event, {
            'action': _format_action(response['Attributes']),
            'message': 'Status updated successfully'
        })

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return error_response(event, 404, 'Action not found')
    except Exception as e:
        logger.error(f"Error updating action status {action_id}: {str(e)}")
        return error_response(event, 500, 'Failed to update action status')


def handle_delete_action(event, action_id):
    """Delete an action."""
    try:
        table.delete_item(
            Key={'PK': f'ACTION#{action_id}', 'SK': 'METADATA'}
        )

        logger.info(f"Deleted action: {action_id}")
        return success_response(event, {'message': 'Action deleted successfully'})

    except Exception as e:
        logger.error(f"Error deleting action {action_id}: {str(e)}")
        return error_response(event, 500, f'Failed to delete action: {str(e)}')


# ─────────────────────────────────────────────
# Projects CRUD
# ─────────────────────────────────────────────

def handle_get_projects(event, query_parameters):
    """Get all projects using DynamoDB Query on GSI1."""
    try:
        page_size = get_page_size(query_parameters)

        query_params = {
            'IndexName': 'GSI1',
            'KeyConditionExpression': 'GSI1PK = :pk',
            'ExpressionAttributeValues': {':pk': 'PROJECTS'},
            'ScanIndexForward': False,
            'Limit': page_size
        }

        response = table.query(**query_params)

        projects = []
        for item in response.get('Items', []):
            projects.append(_format_project(item))

        result = {'projects': projects, 'count': len(projects)}

        if response.get('LastEvaluatedKey'):
            import base64
            result['nextToken'] = base64.b64encode(
                json.dumps(response['LastEvaluatedKey']).encode()
            ).decode()

        return success_response(event, result)

    except Exception as e:
        logger.error(f"Error getting projects: {str(e)}", exc_info=True)
        # Fall back to scan for backward compatibility
        return _get_projects_fallback(event)


def _get_projects_fallback(event):
    """Fallback: scan table for projects that don't have GSI1 keys yet."""
    try:
        response = table.scan()
        projects = []
        for item in response.get('Items', []):
            if item.get('PK', '').startswith('PROJECT#'):
                projects.append(_format_project(item))

        return success_response(event, {'projects': projects, 'count': len(projects)})
    except Exception as e:
        logger.error(f"Fallback scan error: {str(e)}")
        return error_response(event, 500, 'Failed to get projects')


def _format_project(item):
    """Format a DynamoDB item into the project response shape."""
    return {
        'projectId': item.get('projectId', item.get('PK', '').replace('PROJECT#', '')),
        'name': item.get('name', ''),
        'description': item.get('description', ''),
        'status': item.get('status', 'ACTIVE'),
        'createdAt': item.get('createdAt', ''),
        'updatedAt': item.get('updatedAt', '')
    }


def handle_get_project(event, project_id):
    """Get a single project by ID."""
    try:
        response = table.get_item(
            Key={'PK': f'PROJECT#{project_id}', 'SK': 'METADATA'}
        )

        if 'Item' not in response:
            return error_response(event, 404, 'Project not found')

        return success_response(event, {'project': _format_project(response['Item'])})

    except Exception as e:
        logger.error(f"Error getting project {project_id}: {str(e)}")
        return error_response(event, 500, 'Failed to get project')


def handle_create_project(event, body_data):
    """Create a new project."""
    try:
        validation_error = validate_required_fields(body_data, ['name'])
        if validation_error:
            return error_response(event, 400, validation_error)

        project_id = f"PRJ-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
        timestamp = datetime.now(timezone.utc).isoformat()

        project_item = {
            'PK': f'PROJECT#{project_id}',
            'SK': 'METADATA',
            # GSI1 keys for efficient listing
            'GSI1PK': 'PROJECTS',
            'GSI1SK': f'{timestamp}#{project_id}',
            'projectId': project_id,
            'name': body_data['name'],
            'description': body_data.get('description', ''),
            'status': body_data.get('status', 'ACTIVE'),
            'createdAt': timestamp,
            'updatedAt': timestamp
        }

        table.put_item(Item=project_item)

        logger.info(f"Created project: {project_id}")
        return success_response(event, {'project': _format_project(project_item)}, 201)

    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        return error_response(event, 500, 'Failed to create project')


def handle_update_project(event, project_id, body_data):
    """Update an existing project."""
    try:
        response = table.get_item(
            Key={'PK': f'PROJECT#{project_id}', 'SK': 'METADATA'}
        )

        if 'Item' not in response:
            return error_response(event, 404, 'Project not found')

        timestamp = datetime.now(timezone.utc).isoformat()
        update_expression = 'SET updatedAt = :timestamp'
        expression_values = {':timestamp': timestamp}
        expression_names = {}

        reserved_keywords = {'status'}
        updateable_fields = ['name', 'description', 'status']

        for field in updateable_fields:
            if field in body_data:
                if field in reserved_keywords:
                    update_expression += f', #{field} = :{field}'
                    expression_names[f'#{field}'] = field
                else:
                    update_expression += f', {field} = :{field}'
                expression_values[f':{field}'] = body_data[field]

        update_params = {
            'Key': {'PK': f'PROJECT#{project_id}', 'SK': 'METADATA'},
            'UpdateExpression': update_expression,
            'ExpressionAttributeValues': expression_values,
            'ReturnValues': 'ALL_NEW'
        }

        if expression_names:
            update_params['ExpressionAttributeNames'] = expression_names

        update_response = table.update_item(**update_params)

        logger.info(f"Updated project: {project_id}")
        return success_response(event, {
            'project': _format_project(update_response['Attributes']),
            'message': 'Project updated successfully'
        })

    except Exception as e:
        logger.error(f"Error updating project {project_id}: {str(e)}")
        return error_response(event, 500, f'Failed to update project: {str(e)}')


def handle_delete_project(event, project_id):
    """Delete a project."""
    try:
        table.delete_item(
            Key={'PK': f'PROJECT#{project_id}', 'SK': 'METADATA'}
        )

        logger.info(f"Deleted project: {project_id}")
        return success_response(event, {'message': 'Project deleted successfully'})

    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {str(e)}")
        return error_response(event, 500, f'Failed to delete project: {str(e)}')


# ─────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────

def handle_dashboard_analytics(event):
    """
    Get dashboard summary analytics.

    Note: Analytics still uses scan because it needs to count ALL items
    across different categories. For a production system with lots of data,
    you'd pre-compute these counts and store them separately.
    """
    try:
        response = table.scan()
        items = response.get('Items', [])

        actions = [i for i in items if i.get('PK', '').startswith('ACTION#')]
        projects = [i for i in items if i.get('PK', '').startswith('PROJECT#')]

        status_counts = {}
        for action in actions:
            status = action.get('status', 'PENDING')
            status_counts[status] = status_counts.get(status, 0) + 1

        overdue_count = 0
        now = datetime.now(timezone.utc).isoformat()
        for action in actions:
            deadline = action.get('deadline', '')
            if deadline and deadline < now and action.get('status') not in ('COMPLETED', 'CANCELLED'):
                overdue_count += 1

        return success_response(event, {
            'totalActions': len(actions),
            'totalProjects': len(projects),
            'actionsByStatus': status_counts,
            'overdueActions': overdue_count
        })

    except Exception as e:
        logger.error(f"Error getting dashboard analytics: {str(e)}")
        return error_response(event, 500, 'Failed to get analytics')


def handle_action_analytics(event):
    """Get detailed action analytics (counts by status and priority)."""
    try:
        response = table.scan()
        actions = [i for i in response.get('Items', []) if i.get('PK', '').startswith('ACTION#')]

        statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
        priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

        return success_response(event, {
            'totalActions': len(actions),
            'byStatus': {s: len([a for a in actions if a.get('status') == s]) for s in statuses},
            'byPriority': {p: len([a for a in actions if a.get('priority') == p]) for p in priorities}
        })

    except Exception as e:
        logger.error(f"Error getting action analytics: {str(e)}")
        return error_response(event, 500, 'Failed to get action analytics')


# ─────────────────────────────────────────────
# Document Upload & Suggestions
# ─────────────────────────────────────────────

def handle_document_upload(event):
    """
    Handle document upload to S3.

    The document is uploaded to the S3 documents bucket. In a full implementation,
    this would trigger an EventBridge event to start document processing
    (e.g., extracting action items from meeting minutes).
    """
    try:
        import base64

        body = event.get('body', '')
        content_type = (event.get('headers') or {}).get('Content-Type', 'application/octet-stream')

        if not body:
            return error_response(event, 400, 'No file data provided')

        if not DOCUMENTS_BUCKET:
            return error_response(event, 500, 'Document storage not configured')

        # Handle base64 encoded body (API Gateway binary support)
        if event.get('isBase64Encoded', False):
            body = base64.b64decode(body)
        else:
            body = body.encode('utf-8')

        document_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Detect file type from content
        if body[:2] == b'PK':
            file_extension = 'docx'
        elif body[:4] == b'%PDF':
            file_extension = 'pdf'
        else:
            file_extension = 'bin'

        s3_key = f"documents/{timestamp}_{document_id}.{file_extension}"

        # Upload to S3
        s3_client.put_object(
            Bucket=DOCUMENTS_BUCKET,
            Key=s3_key,
            Body=body,
            ContentType=content_type
        )

        logger.info(f"Uploaded document to S3: {s3_key}")

        # Store document metadata in DynamoDB
        doc_timestamp = datetime.now(timezone.utc).isoformat()
        document_item = {
            'PK': f'DOCUMENT#{document_id}',
            'SK': 'METADATA',
            'GSI1PK': 'DOCUMENTS',
            'GSI1SK': f'{doc_timestamp}#{document_id}',
            'documentId': document_id,
            'filename': f"{timestamp}_{document_id}.{file_extension}",
            's3Key': s3_key,
            's3Bucket': DOCUMENTS_BUCKET,
            'status': 'UPLOADED',
            'createdAt': doc_timestamp,
            'fileExtension': file_extension
        }

        table.put_item(Item=document_item)

        return success_response(event, {
            'message': 'Document uploaded successfully',
            'documentId': document_id,
            'status': 'UPLOADED',
            's3Key': s3_key
        })

    except Exception as e:
        logger.error(f"Document upload error: {str(e)}", exc_info=True)
        return error_response(event, 500, f'Upload failed: {str(e)}')


def handle_get_pending_suggestions(event, query_parameters):
    """Get pending document suggestions using GSI1 query."""
    try:
        page_size = get_page_size(query_parameters)

        # Try GSI1 query first
        query_params = {
            'IndexName': 'GSI1',
            'KeyConditionExpression': 'GSI1PK = :pk',
            'ExpressionAttributeValues': {':pk': 'SUGGESTIONS#PENDING'},
            'ScanIndexForward': False,
            'Limit': page_size
        }

        response = table.query(**query_params)
        suggestions = []
        for item in response.get('Items', []):
            suggestions.append(_format_suggestion(item))

        # Fall back to scan if no GSI results (backward compatibility)
        if not suggestions:
            scan_response = table.scan()
            for item in scan_response.get('Items', []):
                if item.get('PK', '').startswith('SUGGESTION#') and item.get('status') == 'PENDING':
                    suggestions.append(_format_suggestion(item))

        return success_response(event, {
            'suggestions': suggestions,
            'total_suggestions': len(suggestions)
        })

    except Exception as e:
        logger.error(f"Error getting pending suggestions: {str(e)}")
        return error_response(event, 500, f'Failed to get suggestions: {str(e)}')


def _format_suggestion(item):
    """Format a DynamoDB item into the suggestion response shape."""
    return {
        'suggestionId': item.get('suggestionId', item.get('PK', '').replace('SUGGESTION#', '')),
        'title': item.get('title', ''),
        'description': item.get('description', ''),
        'priority': item.get('priority', 'MEDIUM'),
        'confidence': float(item.get('confidence', Decimal('0.5'))),
        'context': item.get('context', ''),
        'extractedFrom': item.get('extractedFrom', ''),
        'createdAt': item.get('createdAt', ''),
        'status': item.get('status', 'PENDING')
    }


def handle_approve_suggestion(event, suggestion_id, body_data):
    """Approve a suggestion and convert it into an action."""
    try:
        response = table.get_item(
            Key={'PK': f'SUGGESTION#{suggestion_id}', 'SK': 'METADATA'}
        )

        if 'Item' not in response:
            return error_response(event, 404, 'Suggestion not found')

        suggestion = response['Item']

        action_id = f"ACT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
        timestamp = datetime.now(timezone.utc).isoformat()

        # Create action from suggestion (user can override fields via body_data)
        action_item = {
            'PK': f'ACTION#{action_id}',
            'SK': 'METADATA',
            'GSI1PK': 'ACTIONS',
            'GSI1SK': f'{timestamp}#{action_id}',
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

        table.put_item(Item=action_item)

        # Mark suggestion as approved
        table.update_item(
            Key={'PK': f'SUGGESTION#{suggestion_id}', 'SK': 'METADATA'},
            UpdateExpression='SET #status = :status, approvedAt = :timestamp, actionId = :actionId, GSI1PK = :gsi1pk',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'APPROVED',
                ':timestamp': timestamp,
                ':actionId': action_id,
                ':gsi1pk': 'SUGGESTIONS#APPROVED'
            }
        )

        logger.info(f"Approved suggestion {suggestion_id} -> action {action_id}")
        return success_response(event, {
            'action': _format_action(action_item),
            'message': 'Suggestion approved and action created successfully'
        })

    except Exception as e:
        logger.error(f"Error approving suggestion {suggestion_id}: {str(e)}")
        return error_response(event, 500, f'Failed to approve suggestion: {str(e)}')
