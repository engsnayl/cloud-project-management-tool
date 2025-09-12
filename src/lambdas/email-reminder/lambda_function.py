import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')

# Environment variables
TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME']
SES_CONFIG_SET = os.environ['SES_CONFIGURATION_SET']
SENDER_EMAIL = os.environ['SENDER_EMAIL']
DASHBOARD_URL = os.environ['DASHBOARD_URL']
DAILY_TEMPLATE = os.environ['DAILY_REMINDER_TEMPLATE']
OVERDUE_TEMPLATE = os.environ['OVERDUE_ALERT_TEMPLATE']

table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    """Main Lambda handler for email reminders"""
    logger.info(f"Email reminder triggered with event: {json.dumps(event)}")
    
    try:
        action = event.get('action', 'send_daily_reminders')
        reminder_type = event.get('reminder_type', 'daily')
        
        if action == 'send_daily_reminders':
            return send_daily_reminders()
        elif action == 'send_overdue_alerts':
            return send_overdue_alerts()
        else:
            logger.error(f"Unknown action: {action}")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Unknown action: {action}'})
            }
            
    except Exception as e:
        logger.error(f"Error in email reminder: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def send_daily_reminders():
    """Send daily action reminders to all action owners"""
    logger.info("Starting daily reminder process")
    
    try:
        # Get all pending and in-progress actions
        actions = get_active_actions()
        
        if not actions:
            logger.info("No active actions found")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'No active actions to remind about'})
            }
        
        logger.info(f"Found {len(actions)} active actions")
        
        # Group actions by owner
        actions_by_owner = group_actions_by_owner(actions)
        logger.info(f"Actions grouped for {len(actions_by_owner)} owners")
        
        # Get project names for better email content
        projects = get_all_projects()
        project_names = {p.get('projectId', 'miscellaneous'): p.get('name', 'Unknown Project') for p in projects}
        
        sent_count = 0
        failed_count = 0
        
        # Send reminder to each owner
        for owner_email, owner_actions in actions_by_owner.items():
            try:
                logger.info(f"Preparing email for {owner_email} with {len(owner_actions)} actions")
                
                # Prepare email data
                email_data = prepare_daily_reminder_data(
                    owner_email, 
                    owner_actions, 
                    project_names
                )
                
                # Send templated email
                response = ses.send_templated_email(
                    Source=SENDER_EMAIL,
                    Destination={'ToAddresses': [owner_email]},
                    Template=DAILY_TEMPLATE,
                    TemplateData=json.dumps(email_data),
                    ConfigurationSetName=SES_CONFIG_SET
                )
                
                logger.info(f"Daily reminder sent to {owner_email}: {response['ResponseMetadata']['RequestId']}")
                sent_count += 1
                
            except Exception as e:
                logger.error(f"Failed to send daily reminder to {owner_email}: {str(e)}")
                failed_count += 1
                continue
        
        logger.info(f"Daily reminders completed: {sent_count} sent, {failed_count} failed")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Daily reminders sent',
                'sent_count': sent_count,
                'failed_count': failed_count,
                'total_owners': len(actions_by_owner)
            })
        }
        
    except Exception as e:
        logger.error(f"Error sending daily reminders: {str(e)}")
        raise

def send_overdue_alerts():
    """Send overdue action alerts to owners with overdue items"""
    logger.info("Starting overdue alert process")
    
    try:
        # Get overdue actions
        overdue_actions = get_overdue_actions()
        
        if not overdue_actions:
            logger.info("No overdue actions found")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'No overdue actions to alert about'})
            }
        
        logger.info(f"Found {len(overdue_actions)} overdue actions")
        
        # Group overdue actions by owner
        overdue_by_owner = group_actions_by_owner(overdue_actions)
        
        # Get project names
        projects = get_all_projects()
        project_names = {p.get('projectId', 'miscellaneous'): p.get('name', 'Unknown Project') for p in projects}
        
        sent_count = 0
        failed_count = 0
        
        # Send overdue alert to each owner
        for owner_email, owner_overdue_actions in overdue_by_owner.items():
            try:
                # Prepare email data
                email_data = prepare_overdue_alert_data(
                    owner_email, 
                    owner_overdue_actions, 
                    project_names
                )
                
                # Send templated email
                response = ses.send_templated_email(
                    Source=SENDER_EMAIL,
                    Destination={'ToAddresses': [owner_email]},
                    Template=OVERDUE_TEMPLATE,
                    TemplateData=json.dumps(email_data),
                    ConfigurationSetName=SES_CONFIG_SET
                )
                
                logger.info(f"Overdue alert sent to {owner_email}: {response['ResponseMetadata']['RequestId']}")
                sent_count += 1
                
            except Exception as e:
                logger.error(f"Failed to send overdue alert to {owner_email}: {str(e)}")
                failed_count += 1
                continue
        
        logger.info(f"Overdue alerts completed: {sent_count} sent, {failed_count} failed")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Overdue alerts sent',
                'sent_count': sent_count,
                'failed_count': failed_count,
                'total_owners': len(overdue_by_owner)
            })
        }
        
    except Exception as e:
        logger.error(f"Error sending overdue alerts: {str(e)}")
        raise

def get_active_actions():
    """Get all actions that are pending or in progress"""
    try:
        # Updated to match your actual data structure: PK starts with ACTION# and SK = METADATA
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix) AND SK = :sk AND (#status = :pending OR #status = :in_progress)',
            ExpressionAttributeValues={
                ':pk_prefix': 'ACTION#',
                ':sk': 'METADATA',
                ':pending': 'PENDING',
                ':in_progress': 'IN_PROGRESS'
            },
            ExpressionAttributeNames={
                '#status': 'status'
            }
        )
        
        logger.info(f"DynamoDB scan returned {len(response.get('Items', []))} items")
        return response.get('Items', [])
        
    except Exception as e:
        logger.error(f"Error getting active actions: {str(e)}")
        raise

def get_overdue_actions():
    """Get all actions that are overdue (deadline passed and not completed)"""
    try:
        # Get all non-completed actions
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix) AND SK = :sk AND #status <> :completed',
            ExpressionAttributeValues={
                ':pk_prefix': 'ACTION#',
                ':sk': 'METADATA',
                ':completed': 'COMPLETED'
            },
            ExpressionAttributeNames={
                '#status': 'status'
            }
        )
        
        all_actions = response.get('Items', [])
        
        # Filter for overdue actions (deadline is in the past)
        today = datetime.now(timezone.utc).date()
        overdue_actions = []
        
        for action in all_actions:
            deadline_str = action.get('deadline')
            if deadline_str:
                try:
                    # Parse deadline (assume YYYY-MM-DD format)
                    if 'T' in deadline_str:
                        deadline_date = datetime.fromisoformat(deadline_str.replace('Z', '+00:00')).date()
                    else:
                        deadline_date = datetime.strptime(deadline_str, '%Y-%m-%d').date()
                    
                    if deadline_date < today:
                        # Calculate days overdue
                        days_overdue = (today - deadline_date).days
                        action['days_overdue'] = days_overdue
                        overdue_actions.append(action)
                except ValueError:
                    logger.warning(f"Invalid deadline format for action {action.get('actionId')}: {deadline_str}")
                    continue
        
        return overdue_actions
        
    except Exception as e:
        logger.error(f"Error getting overdue actions: {str(e)}")
        raise

def get_all_projects():
    """Get all projects for name lookup"""
    try:
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix) AND SK = :sk',
            ExpressionAttributeValues={
                ':pk_prefix': 'PROJECT#',
                ':sk': 'METADATA'
            }
        )
        
        return response.get('Items', [])
        
    except Exception as e:
        logger.error(f"Error getting projects: {str(e)}")
        return []

def group_actions_by_owner(actions):
    """Group actions by owner email address"""
    actions_by_owner = defaultdict(list)
    
    for action in actions:
        owner = action.get('owner')
        if owner:
            actions_by_owner[owner].append(action)
    
    return dict(actions_by_owner)

def prepare_daily_reminder_data(owner_email, actions, project_names):
    """Prepare template data for daily reminder email"""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    owner_name = owner_email.split('@')[0].replace('.', ' ').title()
    
    # Prepare action data for template
    action_data = []
    for action in actions:
        project_id = action.get('projectId', 'miscellaneous')
        action_data.append({
            'title': action.get('title', 'Untitled Action'),
            'description': action.get('description', 'No description'),
            'project_name': project_names.get(project_id, project_id),
            'priority': action.get('priority', 'MEDIUM'),
            'priority_lower': action.get('priority', 'MEDIUM').lower(),
            'deadline': format_date(action.get('deadline', '')),
            'status': action.get('status', 'PENDING')
        })
    
    return {
        'owner_name': owner_name,
        'date': today,
        'actions': action_data,
        'total_actions': len(actions),
        'dashboard_url': DASHBOARD_URL
    }

def prepare_overdue_alert_data(owner_email, overdue_actions, project_names):
    """Prepare template data for overdue alert email"""
    owner_name = owner_email.split('@')[0].replace('.', ' ').title()
    
    # Prepare overdue action data for template
    overdue_data = []
    for action in overdue_actions:
        project_id = action.get('projectId', 'miscellaneous')
        overdue_data.append({
            'title': action.get('title', 'Untitled Action'),
            'description': action.get('description', 'No description'),
            'project_name': project_names.get(project_id, project_id),
            'priority': action.get('priority', 'MEDIUM'),
            'deadline': format_date(action.get('deadline', '')),
            'days_overdue': action.get('days_overdue', 0)
        })
    
    return {
        'owner_name': owner_name,
        'overdue_count': len(overdue_actions),
        'overdue_actions': overdue_data,
        'dashboard_url': DASHBOARD_URL
    }

def format_date(date_str):
    """Format date string for display"""
    if not date_str:
        return 'No deadline'
    
    try:
        # Parse different date formats
        if 'T' in date_str:
            date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        else:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        
        return date_obj.strftime('%B %d, %Y')
    except:
        return date_str  # Return original if parsing fails