import json

def lambda_handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'message': 'API Handler - Phase 10 Enterprise CI/CD',
            'environment': 'dev'
        })
    }
