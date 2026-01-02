#!/usr/bin/env python3
"""
Infrastructure tests for API Gateway
Tests that API Gateway is properly configured and responding
"""

import boto3
import requests
import json
import os
import pytest
from botocore.exceptions import ClientError


class TestAPIGateway:
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'dev')
        self.project_name = os.getenv('PROJECT_NAME', 'deliverycommand')
        self.region = os.getenv('AWS_REGION', 'eu-west-1')
        
        # Initialize AWS clients
        self.apigateway = boto3.client('apigateway', region_name=self.region)
        self.lambda_client = boto3.client('lambda', region_name=self.region)
        
        # Expected API Gateway name
        self.api_name = f"{self.project_name}-{self.environment}-api"
        
    def test_api_gateway_exists(self):
        """Test that API Gateway exists"""
        try:
            # Get all REST APIs
            response = self.apigateway.get_rest_apis()
            apis = response.get('items', [])
            
            # Find our API
            api = next((api for api in apis if api['name'] == self.api_name), None)
            assert api is not None, f"API Gateway '{self.api_name}' not found"
            
            self.api_id = api['id']
            print(f"✓ API Gateway found: {self.api_name} (ID: {self.api_id})")
            return api
            
        except ClientError as e:
            pytest.fail(f"Failed to check API Gateway: {e}")
    
    def test_api_gateway_deployment(self):
        """Test that API Gateway is deployed"""
        api = self.test_api_gateway_exists()
        
        try:
            # Check deployments
            response = self.apigateway.get_deployments(restApiId=self.api_id)
            deployments = response.get('items', [])
            
            assert len(deployments) > 0, "No deployments found for API Gateway"
            print(f"✓ API Gateway has {len(deployments)} deployment(s)")
            
        except ClientError as e:
            pytest.fail(f"Failed to check API Gateway deployments: {e}")
    
    def test_api_gateway_stage(self):
        """Test that API Gateway stage exists"""
        api = self.test_api_gateway_exists()
        
        try:
            # Check stages
            response = self.apigateway.get_stages(restApiId=self.api_id)
            stages = response.get('item', [])
            
            # Look for our environment stage
            stage = next((s for s in stages if s['stageName'] == self.environment), None)
            assert stage is not None, f"Stage '{self.environment}' not found"
            
            print(f"✓ API Gateway stage '{self.environment}' exists")
            return stage
            
        except ClientError as e:
            pytest.fail(f"Failed to check API Gateway stages: {e}")
    
    def get_api_url(self):
        """Get the API Gateway URL"""
        api = self.test_api_gateway_exists()
        return f"https://{self.api_id}.execute-api.{self.region}.amazonaws.com/{self.environment}"
    
    def test_health_endpoint(self):
        """Test the health check endpoint"""
        api_url = self.get_api_url()
        health_url = f"{api_url}/api/v1/health"
        
        try:
            response = requests.get(health_url, timeout=10)
            
            # Should get a response (might be 401/403 due to auth, but should respond)
            assert response.status_code in [200, 401, 403], f"Health endpoint returned {response.status_code}"
            print(f"✓ Health endpoint responding: {response.status_code}")
            
        except requests.exceptions.RequestException as e:
            pytest.fail(f"Health endpoint not accessible: {e}")
    
    def test_api_endpoints_structure(self):
        """Test that expected API endpoints are configured"""
        api = self.test_api_gateway_exists()
        
        try:
            # Get resources
            response = self.apigateway.get_resources(restApiId=self.api_id)
            resources = response.get('items', [])
            
            # Expected paths
            expected_paths = ['/api', '/api/v1', '/api/v1/health', '/api/v1/actions', '/api/v1/projects']
            
            resource_paths = [r.get('path', '') for r in resources]
            
            for path in expected_paths:
                assert path in resource_paths, f"Expected API path '{path}' not found"
            
            print(f"✓ All expected API endpoints configured")
            
        except ClientError as e:
            pytest.fail(f"Failed to check API resources: {e}")
    
    def test_lambda_integration(self):
        """Test that Lambda functions are integrated with API Gateway"""
        api = self.test_api_gateway_exists()
        
        try:
            # Get resources and check for Lambda integrations
            response = self.apigateway.get_resources(restApiId=self.api_id)
            resources = response.get('items', [])
            
            lambda_integrations = 0
            
            for resource in resources:
                if 'resourceMethods' in resource:
                    for method in resource['resourceMethods']:
                        if method != 'OPTIONS':  # Skip CORS options
                            try:
                                integration = self.apigateway.get_integration(
                                    restApiId=self.api_id,
                                    resourceId=resource['id'],
                                    httpMethod=method
                                )
                                
                                if integration.get('type') == 'AWS_PROXY':
                                    lambda_integrations += 1
                                    
                            except ClientError:
                                continue
            
            assert lambda_integrations > 0, "No Lambda integrations found"
            print(f"✓ Found {lambda_integrations} Lambda integration(s)")
            
        except ClientError as e:
            pytest.fail(f"Failed to check Lambda integrations: {e}")


def run_tests():
    """Run all API Gateway tests"""
    print("=" * 50)
    print("API GATEWAY INFRASTRUCTURE TESTS")
    print("=" * 50)
    
    tester = TestAPIGateway()
    
    try:
        tester.test_api_gateway_exists()
        tester.test_api_gateway_deployment()
        tester.test_api_gateway_stage()
        tester.test_health_endpoint()
        tester.test_api_endpoints_structure()
        tester.test_lambda_integration()
        
        print("\n✓ All API Gateway tests passed!")
        return True
        
    except Exception as e:
        print(f"\n✗ API Gateway test failed: {e}")
        return False


if __name__ == "__main__":
    run_tests()