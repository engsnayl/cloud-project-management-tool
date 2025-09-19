# cloud-project-management-tool/containers/document-processor/document_processor.py
#!/usr/bin/env python3
"""
DeliveryCommand Document Processor
Containerized service for extracting action items from documents
"""

import os
import json
import boto3
import logging
from datetime import datetime
from typing import List, Dict, Optional
import re
from dataclasses import dataclass

# Document processing libraries
import PyPDF2
from docx import Document
import io

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ActionItem:
    """Represents a potential action item extracted from a document"""
    text: str
    confidence: float
    line_number: int
    context: str
    suggested_deadline: Optional[str] = None
    suggested_priority: str = "MEDIUM"
    suggested_assignee: Optional[str] = None

class DocumentProcessor:
    """Main document processing class"""
    
    def __init__(self):
        self.s3_client = boto3.client('s3')
        self.dynamodb = boto3.resource('dynamodb')
        self.eventbridge = boto3.client('events')
        
        # Environment variables
        self.table_name = os.getenv('DYNAMODB_TABLE_NAME')
        self.event_bus_name = os.getenv('EVENTBRIDGE_BUS_NAME')
        self.environment = os.getenv('ENVIRONMENT', 'dev')
        
        # Initialize DynamoDB table
        self.table = self.dynamodb.Table(self.table_name)
        
        # Action item patterns - simple but effective NLP
        self.action_patterns = [
            r'\b(?:complete|finish|deliver|implement|create|build|design|review|approve|test)\b.*?(?:by|before|until)\s+(\w+\s+\d{1,2})',
            r'\b(?:todo|action|task)\s*:?\s*(.{10,100})',
            r'\b(?:must|should|need to|required to)\s+(\w+.*?)(?:\.|$)',
            r'\b(?:deadline|due date|target date)\s*:?\s*(\w+\s+\d{1,2})',
            r'(?:^|\n)\s*[-*•]\s*(.{10,100}?)(?:\n|$)',  # Bullet points
            r'\b(?:assigned to|owner|responsible)\s*:?\s*(\w+(?:\s+\w+)?)',
        ]
        
        # Priority indicators
        self.priority_patterns = {
            'HIGH': [r'\b(?:urgent|critical|high priority|asap|immediately)\b'],
            'MEDIUM': [r'\b(?:important|medium priority|soon)\b'],
            'LOW': [r'\b(?:low priority|when possible|nice to have)\b']
        }
        
        # Date patterns
        self.date_patterns = [
            r'\b(\w+\s+\d{1,2}(?:,?\s+\d{4})?)\b',  # Month Day, Year
            r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b',  # MM/DD/YYYY
            r'\b(\d{4}-\d{2}-\d{2})\b',              # YYYY-MM-DD
        ]

    def download_document(self, bucket: str, key: str) -> bytes:
        """Download document from S3"""
        try:
            logger.info(f"Downloading {key} from {bucket}")
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()
        except Exception as e:
            logger.error(f"Error downloading document: {e}")
            raise

    def extract_text_from_pdf(self, content: bytes) -> str:
        """Extract text from PDF document"""
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            text = ""
            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    page_text = page.extract_text()
                    text += f"\n--- Page {page_num + 1} ---\n{page_text}"
                except Exception as e:
                    logger.warning(f"Error extracting text from page {page_num + 1}: {e}")
                    continue
            return text
        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            raise

    def extract_text_from_docx(self, content: bytes) -> str:
        """Extract text from Word document"""
        try:
            doc = Document(io.BytesIO(content))
            text = ""
            for para_num, paragraph in enumerate(doc.paragraphs):
                if paragraph.text.strip():
                    text += f"{paragraph.text}\n"
            return text
        except Exception as e:
            logger.error(f"Error processing DOCX: {e}")
            raise

    def extract_text_from_txt(self, content: bytes) -> str:
        """Extract text from plain text file"""
        try:
            return content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return content.decode('latin-1')
            except Exception as e:
                logger.error(f"Error decoding text file: {e}")
                raise

    def extract_text(self, content: bytes, file_type: str) -> str:
        """Extract text based on file type"""
        file_type = file_type.lower()
        
        if file_type == 'pdf':
            return self.extract_text_from_pdf(content)
        elif file_type in ['docx', 'doc']:
            return self.extract_text_from_docx(content)
        elif file_type in ['txt', 'text']:
            return self.extract_text_from_txt(content)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

    def detect_priority(self, text: str) -> str:
        """Detect priority level from text"""
        text_lower = text.lower()
        
        for priority, patterns in self.priority_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return priority
        
        return "MEDIUM"  # Default priority

    def extract_dates(self, text: str) -> List[str]:
        """Extract potential dates from text"""
        dates = []
        for pattern in self.date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)
        return dates

    def extract_action_items(self, text: str) -> List[ActionItem]:
        """Extract potential action items using NLP patterns"""
        action_items = []
        lines = text.split('\n')
        
        for line_num, line in enumerate(lines):
            line = line.strip()
            if len(line) < 10:  # Skip very short lines
                continue
                
            for pattern in self.action_patterns:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    # Extract the action text
                    action_text = match.group(1) if match.groups() else match.group(0)
                    action_text = action_text.strip()
                    
                    if len(action_text) < 10:  # Skip very short actions
                        continue
                    
                    # Calculate confidence based on pattern strength
                    confidence = self._calculate_confidence(line, pattern)
                    
                    # Extract dates from the context
                    context_window = self._get_context_window(lines, line_num)
                    dates = self.extract_dates(context_window)
                    suggested_deadline = dates[0] if dates else None
                    
                    # Determine priority
                    priority = self.detect_priority(context_window)
                    
                    # Create action item
                    action_item = ActionItem(
                        text=action_text,
                        confidence=confidence,
                        line_number=line_num + 1,
                        context=context_window,
                        suggested_deadline=suggested_deadline,
                        suggested_priority=priority
                    )
                    
                    action_items.append(action_item)
        
        # Remove duplicates and sort by confidence
        action_items = self._deduplicate_actions(action_items)
        action_items.sort(key=lambda x: x.confidence, reverse=True)
        
        return action_items[:10]  # Return top 10 actions

    def _calculate_confidence(self, text: str, pattern: str) -> float:
        """Calculate confidence score for an action item"""
        base_confidence = 0.5
        
        # Boost confidence for strong action verbs
        strong_verbs = ['complete', 'deliver', 'implement', 'must', 'required']
        if any(verb in text.lower() for verb in strong_verbs):
            base_confidence += 0.2
        
        # Boost confidence for deadlines
        if re.search(r'\b(?:by|before|until|deadline)\b', text.lower()):
            base_confidence += 0.2
        
        # Boost confidence for explicit action markers
        if re.search(r'\b(?:todo|action|task)\b', text.lower()):
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)

    def _get_context_window(self, lines: List[str], line_num: int, window_size: int = 2) -> str:
        """Get context around a line for better analysis"""
        start = max(0, line_num - window_size)
        end = min(len(lines), line_num + window_size + 1)
        return ' '.join(lines[start:end])

    def _deduplicate_actions(self, action_items: List[ActionItem]) -> List[ActionItem]:
        """Remove duplicate action items"""
        seen = set()
        unique_actions = []
        
        for action in action_items:
            # Simple deduplication based on text similarity
            action_key = action.text[:50].lower().strip()
            if action_key not in seen:
                seen.add(action_key)
                unique_actions.append(action)
        
        return unique_actions

    def store_suggestions(self, document_key: str, action_items: List[ActionItem], 
                         user_id: str) -> str:
        """Store action item suggestions in DynamoDB"""
        suggestion_id = f"SUGGESTION#{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Convert action items to dict format
        suggestions = []
        for item in action_items:
            suggestions.append({
                'text': item.text,
                'confidence': str(item.confidence),
                'line_number': item.line_number,
                'context': item.context[:200],  # Limit context length
                'suggested_deadline': item.suggested_deadline,
                'suggested_priority': item.suggested_priority,
                'suggested_assignee': item.suggested_assignee
            })
        
        # Store in DynamoDB
        try:
            self.table.put_item(
                Item={
                    'PK': suggestion_id,
                    'SK': 'METADATA',
                    'GSI1PK': 'PENDING_REVIEW',
                    'GSI1SK': datetime.now().isoformat(),
                    'document_key': document_key,
                    'user_id': user_id,
                    'status': 'PENDING_REVIEW',
                    'suggestions': suggestions,
                    'created_at': datetime.now().isoformat(),
                    'total_suggestions': len(suggestions)
                }
            )
            logger.info(f"Stored {len(suggestions)} suggestions with ID: {suggestion_id}")
            return suggestion_id
        except Exception as e:
            logger.error(f"Error storing suggestions: {e}")
            raise

    def send_completion_event(self, document_key: str, suggestion_id: str, 
                            user_id: str, total_suggestions: int):
        """Send completion event to EventBridge"""
        try:
            event = {
                'Source': 'deliverycommand.documents',
                'DetailType': 'Document Processing Completed',
                'Detail': json.dumps({
                    'document_key': document_key,
                    'suggestion_id': suggestion_id,
                    'user_id': user_id,
                    'total_suggestions': total_suggestions,
                    'status': 'COMPLETED',
                    'processor': 'ecs-container',
                    'timestamp': datetime.now().isoformat()
                }),
                'EventBusName': self.event_bus_name
            }
            
            self.eventbridge.put_events(Entries=[event])
            logger.info(f"Sent completion event for {document_key}")
        except Exception as e:
            logger.error(f"Error sending completion event: {e}")

    def process_document(self, bucket: str, key: str, user_id: str = "system") -> Dict:
        """Main document processing method"""
        try:
            logger.info(f"Starting document processing: {key}")
            
            # Download document
            content = self.download_document(bucket, key)
            
            # Determine file type
            file_type = key.split('.')[-1].lower()
            
            # Extract text
            text = self.extract_text(content, file_type)
            logger.info(f"Extracted {len(text)} characters of text")
            
            # Extract action items
            action_items = self.extract_action_items(text)
            logger.info(f"Found {len(action_items)} potential action items")
            
            # Store suggestions
            suggestion_id = self.store_suggestions(key, action_items, user_id)
            
            # Send completion event
            self.send_completion_event(key, suggestion_id, user_id, len(action_items))
            
            return {
                'status': 'SUCCESS',
                'suggestion_id': suggestion_id,
                'total_suggestions': len(action_items),
                'document_key': key
            }
            
        except Exception as e:
            logger.error(f"Error processing document {key}: {e}")
            raise

def main():
    """Main entry point for container"""
    # Get document info from environment variables (set by EventBridge)
    bucket = os.getenv('DOCUMENT_BUCKET')
    key = os.getenv('DOCUMENT_KEY')
    user_id = os.getenv('USER_ID', 'system')
    
    if not bucket or not key:
        logger.error("Missing required environment variables: DOCUMENT_BUCKET, DOCUMENT_KEY")
        exit(1)
    
    # Initialize processor
    processor = DocumentProcessor()
    
    # Process document
    try:
        result = processor.process_document(bucket, key, user_id)
        logger.info(f"Processing completed successfully: {result}")
        print(json.dumps(result))
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        exit(1)

if __name__ == "__main__":
    main()# Force rebuild - Fri Sep 19 07:41:49 AM UTC 2025
