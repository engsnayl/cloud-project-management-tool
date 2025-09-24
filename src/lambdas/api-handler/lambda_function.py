# /cloud-project-management-tool/src/lambdas/api-handler/lambda_function.py

import json
import boto3
import uuid
import os
from datetime import datetime, timezone
from decimal import Decimal
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMODB_TABLE', 'deliverycommand-dev-main')
table = dynamodb.Table(table_name)

def decimal_to_float(obj):
    """Convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(v) for v in obj]
    return obj

def cors_response(status_code, body):
    """Return response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        'body': json.dumps(decimal_to_float(body))
    }

def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    
    try:
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        path_parameters = event.get('pathParameters') or {}
        body = event.get('body')
        
        if body:
            try:
                body = json.loads(body)
            except:
                body = {}

        # Handle OPTIONS requests for CORS
        if http_method == 'OPTIONS':
            return cors_response(200, {})

        # Health check endpoint
        if path == '/api/v1/health' and http_method == 'GET':
            return cors_response(200, {
                'status': 'healthy',
                'message': 'DeliveryCommand API is running',
                'timestamp': datetime.utcnow().isoformat(),
                'version': '1.0.0',
                'environment': os.environ.get('ENVIRONMENT', 'dev'),
                'table': table_name
            })

        # Route handling
        if path == '/api/v1/actions':
            if http_method == 'GET':
                return get_actions()
            elif http_method == 'POST':
                return create_action(body)
                
        elif path.startswith('/api/v1/actions/') and path_parameters.get('actionId'):
            action_id = path_parameters['actionId']
            if http_method == 'GET':
                return get_action(action_id)
            elif http_method == 'PUT':
                return update_action(action_id, body)
            elif http_method == 'DELETE':
                return delete_action(action_id)
                
        elif path == '/api/v1/projects':
            if http_method == 'GET':
                return get_projects()
            elif http_method == 'POST':
                return create_project(body)
                
        elif path.startswith('/api/v1/projects/') and path_parameters.get('projectId'):
            project_id = path_parameters['projectId']
            if http_method == 'GET':
                return get_project(project_id)
            elif http_method == 'PUT':
                return update_project(project_id, body)
            elif http_method == 'DELETE':
                return delete_project(project_id)

        elif path == '/api/v1/requirements':
            if http_method == 'GET':
                return get_requirements()
            elif http_method == 'POST':
                return create_requirement(body)
                
        elif path == '/api/v1/analytics/dashboard':
            if http_method == 'GET':
                return get_dashboard_analytics()
                
        elif path == '/api/v1/analytics/actions':
            if http_method == 'GET':
                return get_action_analytics()

        return cors_response(404, {'error': f'Resource not found: {path}'})
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return cors_response(500, {'error': str(e)})

def get_actions():
    """Get all actions"""
    try:
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
        
        return cors_response(200, {'actions': actions, 'count': len(actions)})
        
    except Exception as e:
        logger.error(f"Error getting actions: {str(e)}")
        return cors_response(500, {'error': str(e)})

def create_action(body):
    """Create a new action"""
    try:
        # Ensure miscellaneous project exists
        ensure_miscellaneous_project()
        
        action_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Default values
        project_id = body.get('projectId', 'miscellaneous')
        title = body.get('title', 'Untitled Action')
        description = body.get('description', '')
        status = body.get('status', 'PENDING')
        priority = body.get('priority', 'MEDIUM')
        owner = body.get('owner', '')
        deadline = body.get('deadline', '')
        
        item = {
            'PK': f'ACTION#{action_id}',
            'SK': f'ACTION#{action_id}',
            'GSI1PK': f'PROJECT#{project_id}',
            'GSI1SK': f'ACTION#{now}',
            'actionId': action_id,
            'title': title,
            'description': description,
            'status': status,
            'priority': priority,
            'projectId': project_id,
            'owner': owner,
            'deadline': deadline,
            'createdAt': now,
            'updatedAt': now,
            'source': 'MANUAL',
            'entityType': 'action'
        }
        
        table.put_item(Item=item)
        
        # Convert for response
        action = {
            'actionId': action_id,
            'title': title,
            'description': description,
            'status': status,
            'priority': priority,
            'projectId': project_id,
            'owner': owner,
            'deadline': deadline,
            'createdAt': now,
            'updatedAt': now,
            'source': 'MANUAL'
        }
        
        return cors_response(201, action)
        
    except Exception as e:
        logger.error(f"Error creating action: {str(e)}")
        return cors_response(500, {'error': str(e)})

def update_action(action_id, body):
    """Update an existing action"""
    try:
        # First, get the existing action
        response = table.get_item(Key={'PK': f'ACTION#{action_id}', 'SK': f'ACTION#{action_id}'})
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Action not found'})
        
        existing_action = response['Item']
        now = datetime.now(timezone.utc).isoformat()
        
        # Update fields
        update_expression = []
        expression_values = {}
        expression_names = {}
        
        if 'title' in body:
            update_expression.append('#title = :title')
            expression_names['#title'] = 'title'
            expression_values[':title'] = body['title']
            
        if 'description' in body:
            update_expression.append('description = :description')
            expression_values[':description'] = body['description']
            
        if 'status' in body:
            update_expression.append('#status = :status')
            expression_names['#status'] = 'status'
            expression_values[':status'] = body['status']
            
        if 'priority' in body:
            update_expression.append('priority = :priority')
            expression_values[':priority'] = body['priority']
            
        if 'owner' in body:
            update_expression.append('#owner = :owner')
            expression_names['#owner'] = 'owner'
            expression_values[':owner'] = body['owner']
            
        if 'deadline' in body:
            update_expression.append('deadline = :deadline')
            expression_values[':deadline'] = body['deadline']
        
        # Always update the updatedAt timestamp
        update_expression.append('updatedAt = :updatedAt')
        expression_values[':updatedAt'] = now
        
        if not update_expression:
            return cors_response(400, {'error': 'No fields to update'})
        
        # Perform the update
        update_params = {
            'Key': {'PK': f'ACTION#{action_id}', 'SK': f'ACTION#{action_id}'},
            'UpdateExpression': 'SET ' + ', '.join(update_expression),
            'ExpressionAttributeValues': expression_values,
            'ReturnValues': 'ALL_NEW'
        }
        
        if expression_names:
            update_params['ExpressionAttributeNames'] = expression_names
        
        response = table.update_item(**update_params)
        
        # Convert response to action format
        updated_item = response['Attributes']
        action = {
            'actionId': updated_item.get('actionId', action_id),
            'title': updated_item.get('title', ''),
            'description': updated_item.get('description', ''),
            'status': updated_item.get('status', 'PENDING'),
            'priority': updated_item.get('priority', 'MEDIUM'),
            'projectId': updated_item.get('projectId', 'miscellaneous'),
            'owner': updated_item.get('owner', ''),
            'deadline': updated_item.get('deadline', ''),
            'createdAt': updated_item.get('createdAt', ''),
            'updatedAt': updated_item.get('updatedAt', ''),
            'source': updated_item.get('source', 'MANUAL')
        }
        
        return cors_response(200, action)
        
    except Exception as e:
        logger.error(f"Error updating action {action_id}: {str(e)}")
        return cors_response(500, {'error': str(e)})

def delete_action(action_id):
    """Delete an action and all related records"""
    try:
        # Find ALL records for this action ID by scanning
        logger.info(f"Scanning for all records with actionId: {action_id}")
        response = table.scan(
            FilterExpression='actionId = :action_id',
            ExpressionAttributeValues={':action_id': action_id}
        )
        
        items_to_delete = response.get('Items', [])
        
        if not items_to_delete:
            logger.error(f"Action {action_id} not found anywhere")
            return cors_response(404, {'error': 'Action not found'})
        
        logger.info(f"Found {len(items_to_delete)} records to delete for action {action_id}")
        
        # Delete all related records
        deletion_count = 0
        for item in items_to_delete:
            try:
                key_to_delete = {'PK': item['PK'], 'SK': item['SK']}
                table.delete_item(Key=key_to_delete)
                logger.info(f"Deleted record with key: {key_to_delete}")
                deletion_count += 1
            except Exception as delete_error:
                logger.error(f"Failed to delete record {key_to_delete}: {str(delete_error)}")
                # Continue deleting other records even if one fails
                continue
        
        if deletion_count == 0:
            return cors_response(500, {'error': 'Failed to delete any records'})
        
        logger.info(f"Successfully deleted {deletion_count} records for action {action_id}")
        return cors_response(200, {
            'message': 'Action deleted successfully', 
            'deletedRecords': deletion_count
        })
        
    except Exception as e:
        logger.error(f"Error deleting action {action_id}: {str(e)}")
        return cors_response(500, {'error': str(e)})

def get_projects():
    """Get all projects"""
    try:
        # Ensure miscellaneous project exists
        ensure_miscellaneous_project()
        
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'PROJECT#'}
        )
        
        projects = []
        for item in response.get('Items', []):
            project = {
                'projectId': item.get('projectId', item.get('SK', '').replace('PROJECT#', '')),
                'name': item.get('name', ''),
                'description': item.get('description', ''),
                'status': item.get('status', 'ACTIVE'),
                'createdAt': item.get('createdAt', ''),
                'updatedAt': item.get('updatedAt', '')
            }
            projects.append(project)
        
        return cors_response(200, {'projects': projects, 'count': len(projects)})
        
    except Exception as e:
        logger.error(f"Error getting projects: {str(e)}")
        return cors_response(500, {'error': str(e)})

def create_project(body):
    """Create a new project"""
    try:
        project_id = body.get('projectId') or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        item = {
            'PK': f'PROJECT#{project_id}',
            'SK': f'PROJECT#{project_id}',
            'projectId': project_id,
            'name': body.get('name', 'Untitled Project'),
            'description': body.get('description', ''),
            'status': body.get('status', 'ACTIVE'),
            'createdAt': now,
            'updatedAt': now,
            'entityType': 'project'
        }
        
        table.put_item(Item=item)
        
        project = {
            'projectId': project_id,
            'name': item['name'],
            'description': item['description'],
            'status': item['status'],
            'createdAt': now,
            'updatedAt': now
        }
        
        return cors_response(201, project)
        
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        return cors_response(500, {'error': str(e)})

def get_requirements():
    """Get all requirements"""
    try:
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'REQUIREMENT#'}
        )
        
        requirements = []
        for item in response.get('Items', []):
            requirement = {
                'requirementId': item.get('requirementId', item.get('SK', '').replace('REQUIREMENT#', '')),
                'title': item.get('title', ''),
                'description': item.get('description', ''),
                'status': item.get('status', 'DRAFT'),
                'priority': item.get('priority', 'MEDIUM'),
                'projectId': item.get('projectId', 'miscellaneous'),
                'assignedTo': item.get('assignedTo', ''),
                'lastModified': item.get('lastModified', ''),
                'createdAt': item.get('createdAt', ''),
                'createdBy': item.get('createdBy', 'system'),
                'estimatedHours': item.get('estimatedHours', 0.0)
            }
            requirements.append(requirement)
        
        return cors_response(200, {'requirements': requirements, 'count': len(requirements)})
        
    except Exception as e:
        logger.error(f"Error getting requirements: {str(e)}")
        return cors_response(500, {'error': str(e)})

def create_requirement(body):
    """Create a new requirement"""
    try:
        requirement_id = f"REQ-{int(datetime.now(timezone.utc).timestamp())}"
        now = datetime.now(timezone.utc).isoformat()
        
        item = {
            'PK': f'REQUIREMENT#{requirement_id}',
            'SK': f'REQUIREMENT#{requirement_id}',
            'GSI1PK': f'REQUIREMENT#{body.get("priority", "MEDIUM")}',
            'GSI1SK': now,
            'requirementId': requirement_id,
            'title': body.get('title', 'Untitled Requirement'),
            'description': body.get('description', ''),
            'status': body.get('status', 'DRAFT'),
            'priority': body.get('priority', 'MEDIUM'),
            'projectId': body.get('projectId', 'miscellaneous'),
            'assignedTo': body.get('assignedTo', ''),
            'createdAt': now,
            'lastModified': now,
            'createdBy': body.get('createdBy', 'system'),
            'estimatedHours': body.get('estimatedHours', 0.0),
            'entityType': 'requirement'
        }
        
        table.put_item(Item=item)
        
        requirement = {
            'requirementId': requirement_id,
            'title': item['title'],
            'description': item['description'],
            'status': item['status'],
            'priority': item['priority'],
            'projectId': item['projectId'],
            'assignedTo': item['assignedTo'],
            'createdAt': now,
            'lastModified': now,
            'createdBy': item['createdBy'],
            'estimatedHours': item['estimatedHours']
        }
        
        return cors_response(201, requirement)
        
    except Exception as e:
        logger.error(f"Error creating requirement: {str(e)}")
        return cors_response(500, {'error': str(e)})

def ensure_miscellaneous_project():
    """Ensure the miscellaneous project exists"""
    try:
        response = table.get_item(Key={'PK': 'PROJECT#miscellaneous', 'SK': 'PROJECT#miscellaneous'})
        
        if 'Item' not in response:
            now = datetime.now(timezone.utc).isoformat()
            item = {
                'PK': 'PROJECT#miscellaneous',
                'SK': 'PROJECT#miscellaneous',
                'projectId': 'miscellaneous',
                'name': 'Miscellaneous',
                'description': 'Default project for unassigned actions',
                'status': 'ACTIVE',
                'createdAt': now,
                'updatedAt': now,
                'entityType': 'project'
            }
            table.put_item(Item=item)
            logger.info("Created miscellaneous project")
            
    except Exception as e:
        logger.error(f"Error ensuring miscellaneous project: {str(e)}")

def get_dashboard_analytics():
    """Get dashboard analytics"""
    try:
        # Get all actions
        actions_response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'ACTION#'}
        )
        
        actions = actions_response.get('Items', [])
        
        # Get all projects
        projects_response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'PROJECT#'}
        )
        
        projects = projects_response.get('Items', [])
        
        # Calculate metrics
        total_actions = len(actions)
        pending_actions = len([a for a in actions if a.get('status') == 'PENDING'])
        completed_actions = len([a for a in actions if a.get('status') == 'COMPLETED'])
        in_progress_actions = len([a for a in actions if a.get('status') == 'IN_PROGRESS'])
        
        # Calculate overdue actions (simplified - actions with deadline in the past)
        now = datetime.now(timezone.utc).isoformat()
        overdue_actions = len([
            a for a in actions 
            if a.get('deadline') and a.get('deadline') < now and a.get('status') != 'COMPLETED'
        ])
        
        analytics = {
            'totalActions': total_actions,
            'pendingActions': pending_actions,
            'completedActions': completed_actions,
            'inProgressActions': in_progress_actions,
            'overdueActions': overdue_actions,
            'totalProjects': len(projects),
            'actionsByPriority': {
                'HIGH': len([a for a in actions if a.get('priority') == 'HIGH']),
                'MEDIUM': len([a for a in actions if a.get('priority') == 'MEDIUM']),
                'LOW': len([a for a in actions if a.get('priority') == 'LOW'])
            },
            'actionsByStatus': {
                'PENDING': pending_actions,
                'IN_PROGRESS': in_progress_actions,
                'COMPLETED': completed_actions
            }
        }
        
        return cors_response(200, analytics)
        
    except Exception as e:
        logger.error(f"Error getting dashboard analytics: {str(e)}")
        return cors_response(500, {'error': str(e)})

def get_action_analytics():
    """Get action analytics"""
    try:
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={':pk_prefix': 'ACTION#'}
        )
        
        actions = response.get('Items', [])
        
        # Calculate completion rate over time, priority distribution, etc.
        analytics = {
            'totalActions': len(actions),
            'completionRate': len([a for a in actions if a.get('status') == 'COMPLETED']) / len(actions) * 100 if actions else 0,
            'averageTimeToComplete': 0,  # Would need more complex calculation
            'actionsByProject': {},
            'trendsOverTime': []
        }
        
        # Group actions by project
        for action in actions:
            project_id = action.get('projectId', 'miscellaneous')
            if project_id not in analytics['actionsByProject']:
                analytics['actionsByProject'][project_id] = 0
            analytics['actionsByProject'][project_id] += 1
        
        return cors_response(200, analytics)
        
    except Exception as e:
        logger.error(f"Error getting action analytics: {str(e)}")
        return cors_response(500, {'error': str(e)})

def get_action(action_id):
    """Get a specific action"""
    try:
        response = table.get_item(Key={'PK': f'ACTION#{action_id}', 'SK': f'ACTION#{action_id}'})
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Action not found'})
        
        item = response['Item']
        action = {
            'actionId': item.get('actionId', action_id),
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
        
        return cors_response(200, action)
        
    except Exception as e:
        logger.error(f"Error getting action {action_id}: {str(e)}")
        return cors_response(500, {'error': str(e)})

def get_project(project_id):
    """Get a specific project"""
    try:
        response = table.get_item(Key={'PK': f'PROJECT#{project_id}', 'SK': f'PROJECT#{project_id}'})
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Project not found'})
        
        item = response['Item']
        project = {
            'projectId': item.get('projectId', project_id),
            'name': item.get('name', ''),
            'description': item.get('description', ''),
            'status': item.get('status', 'ACTIVE'),
            'createdAt': item.get('createdAt', ''),
            'updatedAt': item.get('updatedAt', '')
        }
        
        return cors_response(200, project)
        
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {str(e)}")
        return cors_response(500, {'error': str(e)})

def update_project(project_id, body):
    """Update an existing project"""
    try:
        response = table.get_item(Key={'PK': f'PROJECT#{project_id}', 'SK': f'PROJECT#{project_id}'})
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Project not found'})
        
        now = datetime.now(timezone.utc).isoformat()
        
        update_expression = []
        expression_values = {}
        expression_names = {}
        
        if 'name' in body:
            update_expression.append('#name = :name')
            expression_names['#name'] = 'name'
            expression_values[':name'] = body['name']
            
        if 'description' in body:
            update_expression.append('description = :description')
            expression_values[':description'] = body['description']
            
        if 'status' in body:
            update_expression.append('#status = :status')
            expression_names['#status'] = 'status'
            expression_values[':status'] = body['status']
        
        update_expression.append('updatedAt = :updatedAt')
        expression_values[':updatedAt'] = now
        
        if len(update_expression) == 1:  # Only updatedAt
            return cors_response(400, {'error': 'No fields to update'})
        
        update_params = {
            'Key': {'PK': f'PROJECT#{project_id}', 'SK': f'PROJECT#{project_id}'},
            'UpdateExpression': 'SET ' + ', '.join(update_expression),
            'ExpressionAttributeValues': expression_values,
            'ReturnValues': 'ALL_NEW'
        }
        
        if expression_names:
            update_params['ExpressionAttributeNames'] = expression_names
        
        response = table.update_item(**update_params)
        
        updated_item = response['Attributes']
        project = {
            'projectId': updated_item.get('projectId', project_id),
            'name': updated_item.get('name', ''),
            'description': updated_item.get('description', ''),
            'status': updated_item.get('status', 'ACTIVE'),
            'createdAt': updated_item.get('createdAt', ''),
            'updatedAt': updated_item.get('updatedAt', '')
        }
        
        return cors_response(200, project)
        
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {str(e)}")
        return cors_response(500, {'error': str(e)})

def delete_project(project_id):
    """Delete a project"""
    try:
        # Don't allow deletion of miscellaneous project
        if project_id == 'miscellaneous':
            return cors_response(400, {'error': 'Cannot delete miscellaneous project'})
        
        response = table.get_item(Key={'PK': f'PROJECT#{project_id}', 'SK': f'PROJECT#{project_id}'})
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Project not found'})
        
        # TODO: Handle actions associated with this project
        # For now, we'll just delete the project
        table.delete_item(Key={'PK': f'PROJECT#{project_id}', 'SK': f'PROJECT#{project_id}'})
        
        return cors_response(200, {'message': 'Project deleted successfully'})
        
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {str(e)}")
        return cors_response(500, {'error': str(e)})