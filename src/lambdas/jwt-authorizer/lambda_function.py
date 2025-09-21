#/workspaces/cloud-project-management-tool/src/lambdas/jwt-authorizer

import json
import os
import re
import jwt
import requests
from jwt.algorithms import RSAAlgorithm
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cognito configuration
COGNITO_USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID', 'eu-west-1_PqLIEsG1k')
COGNITO_APP_CLIENT_ID = os.environ.get('COGNITO_APP_CLIENT_ID', '647q6ph5fv5b1578q08g7i25k2')
COGNITO_REGION = 'eu-west-1'

# Cache for JWKS
_jwks_cache = None

def get_jwks():
    """Get JSON Web Key Set from Cognito"""
    global _jwks_cache
    
    if _jwks_cache is None:
        jwks_url = f'https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json'
        response = requests.get(jwks_url)
        _jwks_cache = response.json()
    
    return _jwks_cache

def get_signing_key(token):
    """Get the signing key for the JWT token"""
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header['kid']
        
        jwks = get_jwks()
        
        for key in jwks['keys']:
            if key['kid'] == kid:
                return RSAAlgorithm.from_jwk(json.dumps(key))
        
        raise Exception(f'Unable to find a signing key that matches: {kid}')
    
    except Exception as e:
        logger.error(f'Error getting signing key: {str(e)}')
        raise

def validate_jwt_token(token):
    """Validate JWT token against Cognito"""
    try:
        # Remove Bearer prefix if present
        if token.startswith('Bearer '):
            token = token[7:]
        
        # Get signing key
        signing_key = get_signing_key(token)
        
        # Verify and decode token
        decoded_token = jwt.decode(
            token,
            signing_key,
            algorithms=['RS256'],
            audience=COGNITO_APP_CLIENT_ID,
            issuer=f'https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}'
        )
        
        # Additional validations
        if decoded_token.get('token_use') != 'access':
            raise Exception('Token is not an access token')
        
        return decoded_token
    
    except jwt.ExpiredSignatureError:
        logger.error('Token has expired')
        raise Exception('Token has expired')
    except jwt.InvalidTokenError as e:
        logger.error(f'Invalid token: {str(e)}')
        raise Exception('Invalid token')
    except Exception as e:
        logger.error(f'Token validation failed: {str(e)}')
        raise

def generate_policy(principal_id, effect, resource, context=None):
    """Generate IAM policy for API Gateway"""
    auth_response = {
        'principalId': principal_id
    }
    
    if effect and resource:
        policy_document = {
            'Version': '2012-10-17',
            'Statement': [
                {
                    'Action': 'execute-api:Invoke',
                    'Effect': effect,
                    'Resource': resource
                }
            ]
        }
        auth_response['policyDocument'] = policy_document
    
    if context:
        auth_response['context'] = context
    
    return auth_response

def lambda_handler(event, context):
    """Main Lambda handler for JWT authorization"""
    try:
        logger.info(f'Authorization event: {json.dumps(event)}')
        
        # Extract token from Authorization header
        token = event.get('authorizationToken')
        method_arn = event.get('methodArn')
        
        if not token:
            logger.error('No authorization token provided')
            raise Exception('Unauthorized')
        
        # Validate token format (Bearer <token>)
        if not re.match(r'^Bearer [A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$', token):
            logger.error('Invalid token format')
            raise Exception('Unauthorized')
        
        # Validate JWT token
        decoded_token = validate_jwt_token(token)
        
        # Extract user information
        username = decoded_token.get('username')
        sub = decoded_token.get('sub')
        
        logger.info(f'Token validated successfully for user: {username}')
        
        # Generate allow policy
        policy = generate_policy(
            principal_id=username or sub,
            effect='Allow',
            resource=method_arn,
            context={
                'username': username,
                'sub': sub,
                'client_id': decoded_token.get('client_id')
            }
        )
        
        return policy
    
    except Exception as e:
        logger.error(f'Authorization failed: {str(e)}')
        # Return deny policy for any error
        return generate_policy(
            principal_id='user',
            effect='Deny',
            resource=method_arn
        )