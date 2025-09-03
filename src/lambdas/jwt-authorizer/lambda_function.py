import json
import time
import os
import urllib.request
from jose import jwk, jwt
from jose.utils import base64url_decode

# Environment variables
REGION = os.environ.get('AWS_REGION', 'eu-west-1')
USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
APP_CLIENT_ID = os.environ.get('COGNITO_APP_CLIENT_ID')
# API Gateway Resource ARN pattern
API_ARN_PREFIX = os.environ.get('API_ARN_PREFIX', '')

# Load Cognito public keys
def get_cognito_public_keys():
    keys_url = f'https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json'
    try:
        with urllib.request.urlopen(keys_url) as f:
            response = f.read()
        return json.loads(response.decode('utf-8'))['keys']
    except Exception as e:
        print(f"Error loading Cognito public keys: {str(e)}")
        # Return empty list if keys cannot be loaded
        return []

def lambda_handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    # Get the token from the Authorization header
    try:
        token = event['headers']['Authorization']
        # Remove 'Bearer ' prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
    except (KeyError, TypeError):
        print("No valid authorization header found")
        return generate_policy('user', 'Deny', event['methodArn'])
    
    # Verify and decode the token
    try:
        # Load keys - moved inside handler to handle cold starts better
        keys = get_cognito_public_keys()
        if not keys:
            print("Failed to load Cognito public keys")
            return generate_policy('user', 'Deny', event['methodArn'])
            
        # Get the kid (key ID) from the token header
        token_header = jwt.get_unverified_header(token)
        kid = token_header['kid']
        
        # Find the key that matches the kid
        key = next((k for k in keys if k['kid'] == kid), None)
        if not key:
            print(f"Public key not found for kid: {kid}")
            return generate_policy('user', 'Deny', event['methodArn'])
        
        # Convert the key to PEM format
        public_key = jwk.construct(key)
        
        # Verify the token
        claims = jwt.decode(
            token,
            public_key.to_pem().decode('utf-8'),
            algorithms=['RS256'],
            audience=APP_CLIENT_ID,
            options={
                'verify_at_hash': False  # Skip at_hash verification
            }
        )
        
        # Check token expiration
        if time.time() > claims['exp']:
            print("Token expired")
            return generate_policy('user', 'Deny', event['methodArn'])
        
        # Extract user information
        user_id = claims['sub']
        username = claims.get('username', claims.get('cognito:username', user_id))
        groups = claims.get('cognito:groups', [])
        
        # Log successful authentication
        print(f"Authenticated user: {username}")
        
        # Generate policy document
        policy = generate_policy(username, 'Allow', event['methodArn'], claims)
        return policy
        
    except Exception as e:
        print(f"Exception validating token: {str(e)}")
        return generate_policy('user', 'Deny', event['methodArn'])

def generate_policy(principal_id, effect, resource, claims=None):
    """Generate an IAM policy document"""
    policy = {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [
                {
                    'Action': 'execute-api:Invoke',
                    'Effect': effect,
                    'Resource': resource
                }
            ]
        }
    }
    
    # Add user information in context
    if claims:
        policy['context'] = {
            'userId': claims['sub'],
            'username': claims.get('username', claims.get('cognito:username', claims['sub'])),
            'email': claims.get('email', ''),
            'groups': ','.join(claims.get('cognito:groups', []))
        }
    
    return policy
