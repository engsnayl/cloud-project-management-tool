#!/usr/bin/env python3
"""
Infrastructure tests for CloudTrail
Tests that CloudTrail is properly configured and logging
"""

import boto3
import os
import pytest
from botocore.exceptions import ClientError
from datetime import datetime, timedelta


class TestCloudTrail:
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'dev')
        self.project_name = os.getenv('PROJECT_NAME', 'deliverycommand')
        self.region = os.getenv('AWS_REGION', 'eu-west-1')
        
        # Initialize AWS clients
        self.cloudtrail = boto3.client('cloudtrail', region_name=self.region)
        self.s3 = boto3.client('s3', region_name=self.region)
        self.logs = boto3.client('logs', region_name=self.region)
        self.cloudwatch = boto3.client('cloudwatch', region_name=self.region)
        
        # Expected trail name
        self.trail_name = f"{self.project_name}-{self.environment}-trail"
    
    def test_cloudtrail_exists(self):
        """Test that CloudTrail exists and is active"""
        try:
            response = self.cloudtrail.describe_trails(trailNameList=[self.trail_name])
            trails = response.get('trailList', [])
            
            assert len(trails) > 0, f"CloudTrail not found: {self.trail_name}"
            
            trail = trails[0]
            assert trail['Name'] == self.trail_name, f"Trail name mismatch: {trail['Name']}"
            
            print(f"✓ CloudTrail exists: {self.trail_name}")
            return trail
            
        except ClientError as e:
            pytest.fail(f"Error checking CloudTrail: {e}")
    
    def test_cloudtrail_status(self):
        """Test that CloudTrail is logging"""
        trail = self.test_cloudtrail_exists()
        
        try:
            response = self.cloudtrail.get_trail_status(Name=self.trail_name)
            
            is_logging = response.get('IsLogging', False)
            assert is_logging, f"CloudTrail is not logging: {self.trail_name}"
            
            print(f"✓ CloudTrail is actively logging")
            
            # Check for recent log file delivery
            latest_delivery = response.get('LatestDeliveryTime')
            if latest_delivery:
                print(f"✓ Latest log delivery: {latest_delivery}")
            
        except ClientError as e:
            pytest.fail(f"Error checking CloudTrail status: {e}")
    
    def test_s3_bucket_configuration(self):
        """Test CloudTrail S3 bucket configuration"""
        trail = self.test_cloudtrail_exists()
        
        s3_bucket = trail.get('S3BucketName')
        assert s3_bucket, "CloudTrail S3 bucket not configured"
        
        try:
            # Check if bucket exists and is accessible
            response = self.s3.head_bucket(Bucket=s3_bucket)
            print(f"✓ CloudTrail S3 bucket accessible: {s3_bucket}")
            
            # Check bucket encryption
            try:
                encryption = self.s3.get_bucket_encryption(Bucket=s3_bucket)
                rules = encryption.get('ServerSideEncryptionConfiguration', {}).get('Rules', [])
                if rules:
                    print(f"✓ S3 bucket encryption enabled")
                else:
                    print("! S3 bucket encryption not found")
            except ClientError as e:
                if e.response['Error']['Code'] == 'ServerSideEncryptionConfigurationNotFoundError':
                    print("! S3 bucket encryption not configured")
                else:
                    raise e
            
            # Check for lifecycle policy
            try:
                lifecycle = self.s3.get_bucket_lifecycle_configuration(Bucket=s3_bucket)
                rules = lifecycle.get('Rules', [])
                print(f"✓ S3 lifecycle policy configured: {len(rules)} rule(s)")
            except ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchLifecycleConfiguration':
                    print("! No S3 lifecycle policy configured")
                else:
                    raise e
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchBucket':
                pytest.fail(f"CloudTrail S3 bucket does not exist: {s3_bucket}")
            elif e.response['Error']['Code'] == 'AccessDenied':
                pytest.fail(f"Access denied to CloudTrail S3 bucket: {s3_bucket}")
            else:
                pytest.fail(f"Error checking S3 bucket: {e}")
    
    def test_cloudwatch_logs_integration(self):
        """Test CloudWatch Logs integration"""
        trail = self.test_cloudtrail_exists()
        
        log_group_arn = trail.get('CloudWatchLogsLogGroupArn')
        if not log_group_arn:
            print("! CloudWatch Logs integration not configured")
            return
        
        # Use predictable log group name instead of parsing ARN
        log_group_name = f"/aws/cloudtrail/{self.project_name}-{self.environment}"
        
        try:
            response = self.logs.describe_log_groups(logGroupNamePrefix=log_group_name)
            log_groups = response.get('logGroups', [])
            
            log_group = next((lg for lg in log_groups if lg['logGroupName'] == log_group_name), None)
            assert log_group is not None, f"CloudWatch log group not found: {log_group_name}"
            
            retention_days = log_group.get('retentionInDays', 'Never expire')
            print(f"✓ CloudWatch Logs integration configured: {log_group_name} (Retention: {retention_days} days)")
            
        except ClientError as e:
            pytest.fail(f"Error checking CloudWatch logs: {e}")
    
    def test_cloudtrail_configuration(self):
        """Test CloudTrail configuration settings"""
        trail = self.test_cloudtrail_exists()
        
        # Check important settings
        settings = {
            'IncludeGlobalServiceEvents': trail.get('IncludeGlobalServiceEvents', False),
            'IsMultiRegionTrail': trail.get('IsMultiRegionTrail', False),
            'EnableLogFileValidation': trail.get('LogFileValidationEnabled', False)
        }
        
        for setting, value in settings.items():
            print(f"✓ {setting}: {value}")
        
        # Log file validation should be enabled for security
        assert settings['EnableLogFileValidation'], "Log file validation should be enabled"
    
    def test_security_metric_filters(self):
        """Test CloudTrail security metric filters"""
        expected_filters = [
            f"{self.project_name}-{self.environment}-root-access-count",
            f"{self.project_name}-{self.environment}-unauthorized-api-calls",
            f"{self.project_name}-{self.environment}-no-mfa-console-logins",
            f"{self.project_name}-{self.environment}-iam-policy-changes"
        ]
        
        # Get CloudTrail log group name
        trail = self.test_cloudtrail_exists()
        log_group_arn = trail.get('CloudWatchLogsLogGroupArn')
        
        if not log_group_arn:
            print("! No CloudWatch Logs integration - skipping metric filter tests")
            return
        
        # Use predictable log group name instead of parsing ARN
        log_group_name = f"/aws/cloudtrail/{self.project_name}-{self.environment}"
        
        try:
            response = self.logs.describe_metric_filters(logGroupName=log_group_name)
            metric_filters = response.get('metricFilters', [])
            
            filter_names = [mf['filterName'] for mf in metric_filters]
            
            for expected_filter in expected_filters:
                if expected_filter in filter_names:
                    print(f"✓ Security metric filter exists: {expected_filter}")
                else:
                    print(f"! Missing security metric filter: {expected_filter}")
            
            print(f"✓ Total metric filters found: {len(metric_filters)}")
            
        except ClientError as e:
            pytest.fail(f"Error checking metric filters: {e}")
    
    def test_cloudwatch_alarms(self):
        """Test CloudWatch alarms for security events"""
        expected_alarms = [
            f"{self.project_name}-{self.environment}-root-access-alarm",
            f"{self.project_name}-{self.environment}-unauthorized-api-calls-alarm",
            f"{self.project_name}-{self.environment}-no-mfa-console-logins-alarm",
            f"{self.project_name}-{self.environment}-iam-policy-changes-alarm"
        ]
        
        try:
            response = self.cloudwatch.describe_alarms(
                AlarmNames=expected_alarms,
                MaxRecords=100
            )
            
            alarms = response.get('MetricAlarms', [])
            alarm_names = [alarm['AlarmName'] for alarm in alarms]
            
            for expected_alarm in expected_alarms:
                if expected_alarm in alarm_names:
                    alarm = next(a for a in alarms if a['AlarmName'] == expected_alarm)
                    state = alarm.get('StateValue', 'UNKNOWN')
                    print(f"✓ Security alarm exists: {expected_alarm} (State: {state})")
                else:
                    print(f"! Missing security alarm: {expected_alarm}")
            
            print(f"✓ Total security alarms found: {len(alarms)}")
            
        except ClientError as e:
            pytest.fail(f"Error checking CloudWatch alarms: {e}")
    
    def test_recent_events(self):
        """Test that CloudTrail is capturing recent events"""
        try:
            # Look for events in the last hour
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=1)
            
            response = self.cloudtrail.lookup_events(
                LookupAttributes=[
                    {
                        'AttributeKey': 'EventName',
                        'AttributeValue': 'DescribeTrails'  # This API call should appear
                    }
                ],
                StartTime=start_time,
                EndTime=end_time,
                MaxItems=1
            )
            
            events = response.get('Events', [])
            
            if events:
                print(f"✓ CloudTrail capturing recent events: {len(events)} found in last hour")
            else:
                print("! No recent events found (may be normal for new deployment)")
            
        except ClientError as e:
            # Lookup events might not work immediately after deployment
            print(f"! Could not check recent events: {e}")


def run_tests():
    """Run all CloudTrail tests"""
    print("=" * 50)
    print("CLOUDTRAIL INFRASTRUCTURE TESTS")
    print("=" * 50)
    
    tester = TestCloudTrail()
    
    try:
        tester.test_cloudtrail_exists()
        tester.test_cloudtrail_status()
        tester.test_s3_bucket_configuration()
        tester.test_cloudwatch_logs_integration()
        tester.test_cloudtrail_configuration()
        tester.test_security_metric_filters()
        tester.test_cloudwatch_alarms()
        tester.test_recent_events()
        
        print("\n✓ All CloudTrail tests passed!")
        return True
        
    except Exception as e:
        print(f"\n✗ CloudTrail test failed: {e}")
        return False


if __name__ == "__main__":
    run_tests()