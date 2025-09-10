#/workspaces/cloud-project-management-tool/src/lambdas/jwt-authorizer

import json

def lambda_handler(event, context):
    return {
        'principalId': 'user',
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [{
                'Action': 'execute-api:Invoke',
                'Effect': 'Allow',
                'Resource': event['methodArn']
            }]
        }
    }
