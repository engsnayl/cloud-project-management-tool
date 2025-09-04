# src/lambdas/metrics-publisher/lambda_function.py

import json
import boto3
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
import os

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
dynamodb = boto3.resource('dynamodb')
cloudwatch = boto3.client('cloudwatch')

# Environment variables
TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME']
ENVIRONMENT = os.environ['ENVIRONMENT']
PROJECT_NAME = os.environ['PROJECT_NAME']

def lambda_handler(event, context):
    """
    Lambda function to publish custom business metrics to CloudWatch
    Triggered by EventBridge on a schedule (every 5 minutes)
    """
    
    try:
        logger.info("Starting custom metrics collection")
        
        # Collect business metrics
        metrics = collect_business_metrics()
        
        # Publish to CloudWatch
        publish_metrics(metrics)
        
        logger.info(f"Successfully published {len(metrics)} custom metrics")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Custom metrics published successfully',
                'metrics_count': len(metrics),
                'timestamp': datetime.now().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error publishing custom metrics: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
        }

def collect_business_metrics() -> Dict[str, Any]:
    """
    Collect business metrics from DynamoDB
    """
    table = dynamodb.Table(TABLE_NAME)
    metrics = {}
    
    try:
        # Get current timestamp for time-based queries
        now = datetime.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Query all actions
        response = table.scan()
        items = response['Items']
        
        # Continue scanning if there are more items
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response['Items'])
        
        # Calculate metrics
        metrics.update(calculate_action_metrics(items, today))
        metrics.update(calculate_user_metrics(items, today))
        metrics.update(calculate_performance_metrics(items))
        
        logger.info(f"Collected metrics for {len(items)} total records")
        
    except Exception as e:
        logger.error(f"Error collecting business metrics: {str(e)}")
        # Return empty metrics on error to avoid pipeline failures
        metrics = {}
    
    return metrics

def calculate_action_metrics(items: list, today: datetime) -> Dict[str, int]:
    """
    Calculate action-related metrics
    """
    metrics = {}
    
    actions = [item for item in items if item.get('PK', '').startswith('ACTION#')]
    
    # Total actions
    metrics['ActionsTotal'] = len(actions)
    
    # Actions by status
    status_counts = {}
    for action in actions:
        status = action.get('status', 'unknown')
        status_counts[status] = status_counts.get(status, 0) + 1
    
    metrics['ActionsPending'] = status_counts.get('pending', 0)
    metrics['ActionsInProgress'] = status_counts.get('in_progress', 0)
    metrics['ActionsCompleted'] = status_counts.get('completed', 0)
    metrics['ActionsOverdue'] = status_counts.get('overdue', 0)
    
    # Actions created today
    today_str = today.strftime('%Y-%m-%d')
    actions_today = [
        action for action in actions 
        if action.get('createdAt', '').startswith(today_str)
    ]
    metrics['ActionsCreatedToday'] = len(actions_today)
    
    # Overdue actions (deadline passed)
    now_str = datetime.now().isoformat()
    overdue_actions = [
        action for action in actions 
        if action.get('deadline', '') and action.get('deadline', '') < now_str 
        and action.get('status', '') != 'completed'
    ]
    metrics['ActionsOverdueCount'] = len(overdue_actions)
    
    return metrics

def calculate_user_metrics(items: list, today: datetime) -> Dict[str, int]:
    """
    Calculate user-related metrics
    """
    metrics = {}
    
    users = [item for item in items if item.get('PK', '').startswith('USER#')]
    
    # Total users
    metrics['UsersTotal'] = len(users)
    
    # Active users (logged in within last 24 hours)
    yesterday = today - timedelta(days=1)
    yesterday_str = yesterday.isoformat()
    
    active_users = [
        user for user in users 
        if user.get('lastLogin', '') > yesterday_str
    ]
    metrics['UsersActive24h'] = len(active_users)
    
    return metrics

def calculate_performance_metrics(items: list) -> Dict[str, int]:
    """
    Calculate performance and system health metrics
    """
    metrics = {}
    
    # Documents processed
    documents = [item for item in items if item.get('PK', '').startswith('DOCUMENT#')]
    metrics['DocumentsTotal'] = len(documents)
    
    # Document processing status
    processed_docs = [
        doc for doc in documents 
        if doc.get('processingStatus', '') == 'completed'
    ]
    failed_docs = [
        doc for doc in documents 
        if doc.get('processingStatus', '') == 'failed'
    ]
    
    metrics['DocumentsProcessed'] = len(processed_docs)
    metrics['DocumentsProcessingFailed'] = len(failed_docs)
    
    return metrics

def publish_metrics(metrics: Dict[str, Any]):
    """
    Publish metrics to CloudWatch
    """
    if not metrics:
        logger.info("No metrics to publish")
        return
    
    # Prepare metric data
    metric_data = []
    
    for metric_name, value in metrics.items():
        metric_data.append({
            'MetricName': metric_name,
            'Value': value,
            'Unit': 'Count',
            'Dimensions': [
                {
                    'Name': 'Environment',
                    'Value': ENVIRONMENT
                },
                {
                    'Name': 'Project',
                    'Value': PROJECT_NAME
                }
            ],
            'Timestamp': datetime.now()
        })
    
    # CloudWatch has a limit of 20 metrics per put_metric_data call
    batch_size = 20
    namespace = 'DeliveryCommand/Business'
    
    for i in range(0, len(metric_data), batch_size):
        batch = metric_data[i:i + batch_size]
        
        try:
            cloudwatch.put_metric_data(
                Namespace=namespace,
                MetricData=batch
            )
            logger.info(f"Published batch of {len(batch)} metrics to namespace {namespace}")
            
        except Exception as e:
            logger.error(f"Error publishing metric batch: {str(e)}")
            # Continue with other batches even if one fails