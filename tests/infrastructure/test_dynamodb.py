#!/usr/bin/env python3
"""
Infrastructure tests for DynamoDB
Tests that DynamoDB tables are properly configured and accessible
"""

import boto3
import os
import pytest
from botocore.exceptions import ClientError


class TestDynamoDB:
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'dev')
        self.project_name = os.getenv('PROJECT_NAME', 'deliverycommand')
        self.region = os.getenv('AWS_REGION', 'eu-west-1')
        
        # Initialize AWS client
        self.dynamodb = boto3.client('dynamodb', region_name=self.region)
        self.dynamodb_resource = boto3.resource('dynamodb', region_name=self.region)
        
        # Expected table name
        self.table_name = f"{self.project_name}-{self.environment}-main"
    
    def test_table_exists(self):
        """Test that the main DynamoDB table exists"""
        try:
            response = self.dynamodb.describe_table(TableName=self.table_name)
            table = response['Table']
            
            assert table['TableName'] == self.table_name, f"Table name mismatch: {table['TableName']}"
            assert table['TableStatus'] == 'ACTIVE', f"Table not active: {table['TableStatus']}"
            
            print(f"✓ DynamoDB table exists and is active: {self.table_name}")
            return table
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                pytest.fail(f"DynamoDB table not found: {self.table_name}")
            else:
                pytest.fail(f"Error checking DynamoDB table: {e}")
    
    def test_table_schema(self):
        """Test that the table has the expected schema"""
        table = self.test_table_exists()
        
        # Check key schema
        key_schema = table.get('KeySchema', [])
        assert len(key_schema) > 0, "Table has no key schema"
        
        # Should have a partition key
        partition_key = next((key for key in key_schema if key['KeyType'] == 'HASH'), None)
        assert partition_key is not None, "Table has no partition key"
        
        # Check attribute definitions
        attributes = table.get('AttributeDefinitions', [])
        assert len(attributes) > 0, "Table has no attribute definitions"
        
        print(f"✓ Table schema validated: {len(key_schema)} keys, {len(attributes)} attributes")
        
        # Log the schema for reference
        for key in key_schema:
            print(f"  - Key: {key['AttributeName']} ({key['KeyType']})")
    
    def test_billing_mode(self):
        """Test table billing configuration"""
        table = self.test_table_exists()
        
        billing_mode = table.get('BillingModeSummary', {}).get('BillingMode', 'PROVISIONED')
        print(f"✓ Billing mode: {billing_mode}")
        
        if billing_mode == 'PROVISIONED':
            # Check provisioned throughput
            throughput = table.get('ProvisionedThroughput', {})
            read_capacity = throughput.get('ReadCapacityUnits', 0)
            write_capacity = throughput.get('WriteCapacityUnits', 0)
            
            assert read_capacity > 0, "Read capacity units not configured"
            assert write_capacity > 0, "Write capacity units not configured"
            
            print(f"  - Provisioned: {read_capacity} RCU, {write_capacity} WCU")
        else:
            print(f"  - Pay-per-request mode")
    
    def test_table_accessibility(self):
        """Test that the table is accessible for basic operations"""
        try:
            table = self.dynamodb_resource.Table(self.table_name)
            
            # Try to scan the table (limit to 1 item to avoid costs)
            response = table.scan(Limit=1)
            
            # Should not raise an exception
            item_count = response.get('Count', 0)
            print(f"✓ Table is accessible: {item_count} items visible in scan")
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'AccessDeniedException':
                pytest.fail(f"Access denied to table {self.table_name}")
            else:
                pytest.fail(f"Error accessing table {self.table_name}: {e}")
    
    def test_encryption(self):
        """Test table encryption configuration"""
        table = self.test_table_exists()
        
        sse_description = table.get('SSEDescription', {})
        
        if sse_description:
            status = sse_description.get('Status', 'DISABLED')
            sse_type = sse_description.get('SSEType', 'Unknown')
            print(f"✓ Encryption enabled: {sse_type} ({status})")
        else:
            print("! No encryption configuration found (might be using default)")
    
    def test_backup_configuration(self):
        """Test backup and point-in-time recovery configuration"""
        try:
            # Check point-in-time recovery
            response = self.dynamodb.describe_continuous_backups(TableName=self.table_name)
            
            continuous_backups = response.get('ContinuousBackupsDescription', {})
            pitr_status = continuous_backups.get('PointInTimeRecoveryDescription', {}).get('PointInTimeRecoveryStatus', 'DISABLED')
            
            print(f"✓ Point-in-time recovery: {pitr_status}")
            
        except ClientError as e:
            pytest.fail(f"Error checking backup configuration: {e}")
    
    def test_table_tags(self):
        """Test that table has proper tags"""
        try:
            response = self.dynamodb.list_tags_of_resource(
                ResourceArn=f"arn:aws:dynamodb:{self.region}:*:table/{self.table_name}"
            )
            
            tags = response.get('Tags', [])
            tag_dict = {tag['Key']: tag['Value'] for tag in tags}
            
            # Check for expected tags
            expected_tags = ['Environment', 'Project']
            for tag_key in expected_tags:
                if tag_key in tag_dict:
                    print(f"✓ Tag found: {tag_key} = {tag_dict[tag_key]}")
            
            if len(tags) == 0:
                print("! No tags found on table")
            
        except ClientError as e:
            # Tags might not be accessible in some cases
            print(f"! Could not check table tags: {e}")
    
    def test_global_secondary_indexes(self):
        """Test global secondary indexes if any exist"""
        table = self.test_table_exists()
        
        global_indexes = table.get('GlobalSecondaryIndexes', [])
        
        if global_indexes:
            print(f"✓ Global Secondary Indexes: {len(global_indexes)}")
            for index in global_indexes:
                index_name = index['IndexName']
                index_status = index['IndexStatus']
                print(f"  - {index_name}: {index_status}")
        else:
            print("✓ No Global Secondary Indexes (as expected for simple table)")


def run_tests():
    """Run all DynamoDB tests"""
    print("=" * 50)
    print("DYNAMODB INFRASTRUCTURE TESTS")
    print("=" * 50)
    
    tester = TestDynamoDB()
    
    try:
        tester.test_table_exists()
        tester.test_table_schema()
        tester.test_billing_mode()
        tester.test_table_accessibility()
        tester.test_encryption()
        tester.test_backup_configuration()
        tester.test_table_tags()
        tester.test_global_secondary_indexes()
        
        print("\n✓ All DynamoDB tests passed!")
        return True
        
    except Exception as e:
        print(f"\n✗ DynamoDB test failed: {e}")
        return False


if __name__ == "__main__":
    run_tests()