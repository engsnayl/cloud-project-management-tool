import json
import boto3
import os
from datetime import datetime
from decimal import Decimal

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')
DYNAMODB_TABLE = os.environ['DYNAMODB_TABLE']
table = dynamodb.Table(DYNAMODB_TABLE)

def lambda_handler(event, context):
    """
    Handle API Gateway requests for the DeliveryCommand application
    Routes: /api/v1/requirements, /api/v1/projects, /api/v1/health
    """
    print(f"API request: {json.dumps(event, indent=2)}")
    
    try:
        http_method = event['httpMethod']
        path = event['path']
        body = json.loads(event['body']) if event.get('body') else {}
        
        # CORS headers
        headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
        
        # Handle OPTIONS requests (CORS preflight)
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'CORS preflight successful'})
            }
        
        # Route requests
        if path.startswith('/api/v1/requirements'):
            return handle_requirements(http_method, path, body, headers)
        elif path.startswith('/api/v1/projects'):
            return handle_projects(http_method, path, body, headers)
        elif path.startswith('/api/v1/health'):
            return handle_health(headers)
        else:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Route not found'})
            }
            
    except Exception as error:
        print(f"API Error: {str(error)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(error)
            })
        }

def handle_requirements(method, path, body, headers):
    """Handle requirements endpoints"""
    
    if method == 'GET':
        try:
            # Query requirements using GSI
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': 'REQUIREMENT'}
            )
            
            # Convert Decimal to int/float for JSON serialization
            requirements = []
            for item in response['Items']:
                req = convert_decimals(item)
                requirements.append(req)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'requirements': requirements,
                    'count': len(requirements)
                })
            }
            
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': f'Failed to fetch requirements: {str(e)}'})
            }
    
    elif method == 'POST':
        try:
            # Create new requirement
            requirement_id = f"REQ-{int(datetime.utcnow().timestamp())}"
            
            item = {
                'PK': f'REQUIREMENT#{requirement_id}',
                'SK': 'METADATA',
                'GSI1PK': f"REQUIREMENT#{body.get('priority', 'MEDIUM')}",
                'GSI1SK': datetime.utcnow().isoformat(),
                'requirementId': requirement_id,
                'title': body.get('title', 'Untitled Requirement'),
                'description': body.get('description', ''),
                'priority': body.get('priority', 'MEDIUM'),
                'status': body.get('status', 'DRAFT'),
                'assignedTo': body.get('assignedTo', ''),
                'projectId': body.get('projectId', ''),
                'estimatedHours': body.get('estimatedHours', 0),
                'createdAt': datetime.utcnow().isoformat(),
                'lastModified': datetime.utcnow().isoformat(),
                'createdBy': body.get('createdBy', 'system')
            }
            
            table.put_item(Item=item)
            
            return {
                'statusCode': 201,
                'headers': headers,
                'body': json.dumps({
                    'message': 'Requirement created successfully',
                    'requirement': convert_decimals(item)
                })
            }
            
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': f'Failed to create requirement: {str(e)}'})
            }
    
    elif method == 'PUT':
        # Update requirement - extract ID from path
        path_parts = path.split('/')
        if len(path_parts) >= 4:
            requirement_id = path_parts[4]  # /api/v1/requirements/{id}
            
            try:
                # Update the requirement
                update_expression = "SET "
                expression_values = {}
                
                for key, value in body.items():
                    if key not in ['PK', 'SK', 'requirementId', 'createdAt']:
                        update_expression += f"{key} = :{key}, "
                        expression_values[f":{key}"] = value
                
                update_expression += "lastModified = :lastModified"
                expression_values[':lastModified'] = datetime.utcnow().isoformat()
                
                table.update_item(
                    Key={
                        'PK': f'REQUIREMENT#{requirement_id}',
                        'SK': 'METADATA'
                    },
                    UpdateExpression=update_expression,
                    ExpressionAttributeValues=expression_values
                )
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'message': 'Requirement updated successfully'})
                }
                
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': f'Failed to update requirement: {str(e)}'})
                }
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Method not allowed'})
    }

def handle_projects(method, path, body, headers):
    """Handle projects endpoints"""
    
    if method == 'GET':
        try:
            # Query projects using GSI
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': 'PROJECT'}
            )
            
            projects = []
            for item in response['Items']:
                project = convert_decimals(item)
                projects.append(project)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'projects': projects,
                    'count': len(projects)
                })
            }
            
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': f'Failed to fetch projects: {str(e)}'})
            }
    
    elif method == 'POST':
        try:
            # Create new project
            project_id = f"PROJ-{int(datetime.utcnow().timestamp())}"
            
            item = {
                'PK': f'PROJECT#{project_id}',
                'SK': 'METADATA',
                'GSI1PK': 'PROJECT',
                'GSI1SK': datetime.utcnow().isoformat(),
                'projectId': project_id,
                'name': body.get('name', 'Untitled Project'),
                'description': body.get('description', ''),
                'status': body.get('status', 'ACTIVE'),
                'startDate': body.get('startDate', datetime.utcnow().isoformat()),
                'targetEndDate': body.get('targetEndDate', ''),
                'budget': body.get('budget', 0),
                'teamMembers': body.get('teamMembers', []),
                'stakeholders': body.get('stakeholders', []),
                'riskLevel': body.get('riskLevel', 'MEDIUM'),
                'createdAt': datetime.utcnow().isoformat(),
                'lastModified': datetime.utcnow().isoformat()
            }
            
            table.put_item(Item=item)
            
            return {
                'statusCode': 201,
                'headers': headers,
                'body': json.dumps({
                    'message': 'Project created successfully',
                    'project': convert_decimals(item)
                })
            }
            
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': f'Failed to create project: {str(e)}'})
            }
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Method not allowed'})
    }

def handle_health(headers):
    """Handle health check endpoint"""
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'environment': os.environ.get('ENVIRONMENT', 'unknown'),
            'service': 'DeliveryCommand API'
        })
    }

def convert_decimals(obj):
    """Convert DynamoDB Decimal objects to int/float for JSON serialization"""
    if isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_decimals(value) for key, value in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    else:
        return obj