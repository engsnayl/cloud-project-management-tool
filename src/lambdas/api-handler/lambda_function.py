# src/lambdas/api-handler/lambda_function.py
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
    print('API request:', json.dumps(event, default=str))
    
    try:
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        body = event.get('body', '{}')
        
        # Parse request body if present
        if body:
            try:
                request_body = json.loads(body)
            except json.JSONDecodeError:
                request_body = {}
        else:
            request_body = {}
        
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
            return handle_requirements(http_method, path, request_body, headers)
        elif path.startswith('/api/v1/projects'):
            return handle_projects(http_method, path, request_body, headers)
        elif path.startswith('/api/v1/health'):
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({ 
                    'status': 'healthy',
                    'timestamp': datetime.now().isoformat(),
                    'environment': os.environ.get('ENVIRONMENT', 'dev'),
                    'service': 'DeliveryCommand API'
                })
            }
        
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Route not found'})
        }
        
    except Exception as error:
        print('API Error:', str(error))
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
            # Use scan to get all requirements regardless of priority
            response = table.scan(
                FilterExpression='begins_with(PK, :pk)',
                ExpressionAttributeValues={
                    ':pk': 'REQUIREMENT#'
                }
            )
            
            requirements = response.get('Items', [])
            
            # Convert Decimal types to regular numbers for JSON serialization
            def decimal_default(obj):
                if isinstance(obj, Decimal):
                    return float(obj)
                raise TypeError
            
            # Clean up the requirements data
            cleaned_requirements = []
            for req in requirements:
                # Convert DynamoDB format to clean JSON
                cleaned_req = {}
                for key, value in req.items():
                    if isinstance(value, Decimal):
                        cleaned_req[key] = float(value)
                    else:
                        cleaned_req[key] = value
                cleaned_requirements.append(cleaned_req)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'requirements': cleaned_requirements,
                    'count': len(cleaned_requirements)
                }, default=decimal_default)
            }
            
        except Exception as e:
            print('Error fetching requirements:', str(e))
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Failed to fetch requirements',
                    'message': str(e)
                })
            }
    
    elif method == 'POST':
        try:
            # Generate requirement ID
            requirement_id = f"REQ-{int(datetime.now().timestamp())}"
            timestamp = datetime.now().isoformat()
            
            # Create requirement item
            item = {
                'PK': f'REQUIREMENT#{requirement_id}',
                'SK': 'METADATA',
                'GSI1PK': f'REQUIREMENT#{body.get("priority", "MEDIUM")}',
                'GSI1SK': timestamp,
                'requirementId': requirement_id,
                'title': body.get('title', ''),
                'description': body.get('description', ''),
                'priority': body.get('priority', 'MEDIUM'),
                'status': 'DRAFT',
                'projectId': body.get('projectId', ''),
                'assignedTo': body.get('assignedTo', ''),
                'estimatedHours': int(body.get('estimatedHours', 0)),
                'acceptanceCriteria': body.get('acceptanceCriteria', ''),
                'businessValue': body.get('businessValue', ''),
                'technicalNotes': body.get('technicalNotes', ''),
                'createdAt': timestamp,
                'lastModified': timestamp,
                'createdBy': 'system'
            }
            
            # Save to DynamoDB
            table.put_item(Item=item)
            
            return {
                'statusCode': 201,
                'headers': headers,
                'body': json.dumps({
                    'message': 'Requirement created successfully',
                    'requirement': item
                }, default=str)
            }
            
        except Exception as e:
            print('Error creating requirement:', str(e))
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Failed to create requirement',
                    'message': str(e)
                })
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
            # Use scan to get all projects
            response = table.scan(
                FilterExpression='begins_with(PK, :pk)',
                ExpressionAttributeValues={
                    ':pk': 'PROJECT#'
                }
            )
            
            projects = response.get('Items', [])
            
            # Convert Decimal types for JSON serialization
            def decimal_default(obj):
                if isinstance(obj, Decimal):
                    return float(obj)
                raise TypeError
            
            # Clean up the projects data
            cleaned_projects = []
            for project in projects:
                cleaned_project = {}
                for key, value in project.items():
                    if isinstance(value, Decimal):
                        cleaned_project[key] = float(value)
                    else:
                        cleaned_project[key] = value
                cleaned_projects.append(cleaned_project)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'projects': cleaned_projects,
                    'count': len(cleaned_projects)
                }, default=decimal_default)
            }
            
        except Exception as e:
            print('Error fetching projects:', str(e))
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Failed to fetch projects',
                    'message': str(e)
                })
            }
    
    elif method == 'POST':
        try:
            # Generate project ID
            project_id = f"PROJ-{int(datetime.now().timestamp())}"
            timestamp = datetime.now().isoformat()
            
            # Create project item
            item = {
                'PK': f'PROJECT#{project_id}',
                'SK': 'METADATA',
                'GSI1PK': 'PROJECT',
                'GSI1SK': timestamp,
                'projectId': project_id,
                'name': body.get('name', ''),
                'description': body.get('description', ''),
                'status': body.get('status', 'ACTIVE'),
                'startDate': body.get('startDate', ''),
                'targetEndDate': body.get('targetEndDate', ''),
                'budget': float(body.get('budget', 0)),
                'teamMembers': body.get('teamMembers', []),
                'stakeholders': body.get('stakeholders', []),
                'riskLevel': body.get('riskLevel', 'MEDIUM'),
                'createdAt': timestamp,
                'lastModified': timestamp,
                'createdBy': 'system'
            }
            
            # Save to DynamoDB
            table.put_item(Item=item)
            
            return {
                'statusCode': 201,
                'headers': headers,
                'body': json.dumps({
                    'message': 'Project created successfully',
                    'project': item
                }, default=str)
            }
            
        except Exception as e:
            print('Error creating project:', str(e))
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Failed to create project',
                    'message': str(e)
                })
            }
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Method not allowed'})
    }