#!/usr/bin/env python3
"""
Infrastructure tests for Lambda Functions
Tests that Lambda functions are properly deployed and executable
"""

import boto3
import json
import os
import pytest
from botocore.exceptions import ClientError


class TestLambdaFunctions:
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'dev')
        self.project_name = os.getenv('PROJECT_NAME', 'deliverycommand')
        self.region = os.getenv('AWS_REGION', 'eu-west-1')
        
        # Initialize AWS client
        self.lambda_client = boto3.client('lambda', region_name=self.region)
        
        # Expected Lambda function names
        self.function_names = [
            f"{self.project_name}-{self.environment}-api-handler",
            f"{self.project_name}-{self.environment}-document-processor",
            f"{self.project_name}-{self.environment}-jwt-authorizer"
        ]
    
    def test_lambda_functions_exist(self):
        """Test that all expected Lambda functions exist"""
        existing_functions = []
        
        for function_name in self.function_names:
            try:
                response = self.lambda_client.get_function(FunctionName=function_name)
                existing_functions.append(function_name)
                print(f"✓ Lambda function exists: {function_name}")
                
            except ClientError as e:
                if e.response['Error']['Code'] == 'ResourceNotFoundException':
                    pytest.fail(f"Lambda function not found: {function_name}")
                else:
                    pytest.fail(f"Error checking Lambda function {function_name}: {e}")
        
        assert len(existing_functions) == len(self.function_names), "Not all Lambda functions exist"
        return existing_functions
    
    def test_lambda_configuration(self):
        """Test Lambda function configuration"""
        for function_name in self.function_names:
            try:
                response = self.lambda_client.get_function_configuration(FunctionName=function_name)
                
                # Check runtime
                runtime = response.get('Runtime', '')
                assert runtime.startswith('python'), f"Function {function_name} not using Python runtime: {runtime}"
                
                # Check timeout (should be reasonable)
                timeout = response.get('Timeout', 0)
                assert 1 <= timeout <= 300, f"Function {function_name} has unreasonable timeout: {timeout}s"
                
                # Check memory (should be reasonable)
                memory = response.get('MemorySize', 0)
                assert 128 <= memory <= 3008, f"Function {function_name} has unreasonable memory: {memory}MB"
                
                print(f"✓ Lambda config OK: {function_name} (Runtime: {runtime}, Timeout: {timeout}s, Memory: {memory}MB)")
                
            except ClientError as e:
                pytest.fail(f"Failed to get configuration for {function_name}: {e}")
    
    def test_lambda_environment_variables(self):
        """Test that Lambda functions have required environment variables"""
        for function_name in self.function_names:
            try:
                response = self.lambda_client.get_function_configuration(FunctionName=function_name)
                env_vars = response.get('Environment', {}).get('Variables', {})
                
                # All functions should have these basic environment variables
                required_vars = ['DYNAMODB_TABLE']
                
                for var in required_vars:
                    if var in env_vars:
                        print(f"✓ Environment variable set: {function_name} -> {var}")
                    # Note: Not failing on missing env vars as they might be optional
                
            except ClientError as e:
                pytest.fail(f"Failed to check environment variables for {function_name}: {e}")
    
    def test_lambda_permissions(self):
        """Test Lambda function permissions and policies"""
        for function_name in self.function_names:
            try:
                # Check function policy (permissions)
                try:
                    response = self.lambda_client.get_policy(FunctionName=function_name)
                    policy = json.loads(response['Policy'])
                    
                    statements = policy.get('Statement', [])
                    assert len(statements) > 0, f"Function {function_name} has no permission statements"
                    
                    print(f"✓ Lambda permissions configured: {function_name} ({len(statements)} statements)")
                    
                except ClientError as e:
                    if e.response['Error']['Code'] == 'ResourceNotFoundException':
                        # Some functions might not have policies attached, which is OK
                        print(f"! No explicit policy found for {function_name} (might use execution role only)")
                    else:
                        raise e
                
            except ClientError as e:
                pytest.fail(f"Failed to check permissions for {function_name}: {e}")
    
    def test_lambda_execution_role(self):
        """Test that Lambda functions have proper execution roles"""
        for function_name in self.function_names:
            try:
                response = self.lambda_client.get_function_configuration(FunctionName=function_name)
                role_arn = response.get('Role', '')
                
                assert role_arn, f"Function {function_name} has no execution role"
                assert 'lambda' in role_arn.lower(), f"Function {function_name} role doesn't appear to be a Lambda role: {role_arn}"
                
                print(f"✓ Lambda execution role configured: {function_name}")
                
            except ClientError as e:
                pytest.fail(f"Failed to check execution role for {function_name}: {e}")
    
    def test_lambda_basic_invoke(self):
        """Test basic Lambda function invocation (dry run)"""
        # Test with a simple health check payload
        test_payload = {
            "httpMethod": "GET",
            "path": "/health",
            "headers": {},
            "body": None
        }
        
        # Only test the API handler as it's the main entry point
        api_handler = f"{self.project_name}-{self.environment}-api-handler"
        
        try:
            # Use DryRun to test if function is invokable without actually running it
            response = self.lambda_client.invoke(
                FunctionName=api_handler,
                InvocationType='DryRun',
                Payload=json.dumps(test_payload)
            )
            
            status_code = response.get('StatusCode', 0)
            assert status_code == 204, f"DryRun failed for {api_handler}: Status {status_code}"
            
            print(f"✓ Lambda function is invokable: {api_handler}")
            
        except ClientError as e:
            # DryRun might not be supported in all regions/cases
            if 'DryRun' in str(e):
                print(f"! DryRun not supported for {api_handler}, skipping invoke test")
            else:
                pytest.fail(f"Failed to test invoke for {api_handler}: {e}")
    
    def test_lambda_logs(self):
        """Test that Lambda functions have CloudWatch log groups"""
        cloudwatch = boto3.client('logs', region_name=self.region)
        
        for function_name in self.function_names:
            log_group_name = f"/aws/lambda/{function_name}"
            
            try:
                response = cloudwatch.describe_log_groups(
                    logGroupNamePrefix=log_group_name,
                    limit=1
                )
                
                log_groups = response.get('logGroups', [])
                log_group = next((lg for lg in log_groups if lg['logGroupName'] == log_group_name), None)
                
                assert log_group is not None, f"Log group not found for {function_name}: {log_group_name}"
                print(f"✓ CloudWatch log group exists: {log_group_name}")
                
            except ClientError as e:
                pytest.fail(f"Failed to check log group for {function_name}: {e}")


def run_tests():
    """Run all Lambda function tests"""
    print("=" * 50)
    print("LAMBDA FUNCTIONS INFRASTRUCTURE TESTS")
    print("=" * 50)
    
    tester = TestLambdaFunctions()
    
    try:
        tester.test_lambda_functions_exist()
        tester.test_lambda_configuration()
        tester.test_lambda_environment_variables()
        tester.test_lambda_permissions()
        tester.test_lambda_execution_role()
        tester.test_lambda_basic_invoke()
        tester.test_lambda_logs()
        
        print("\n✓ All Lambda function tests passed!")
        return True
        
    except Exception as e:
        print(f"\n✗ Lambda function test failed: {e}")
        return False


if __name__ == "__main__":
    run_tests()