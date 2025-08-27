// src/components/Documents/DocumentUpload.jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from 'react-query';
import { 
  Upload, 
  File, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  X,
  FileText,
  Download
} from 'lucide-react';
import { apiService, handleApiError } from '../../services/api';

const DocumentUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processingFiles, setProcessingFiles] = useState(new Set());

  // Upload mutation
  const uploadMutation = useMutation(
    ({ file, metadata }) => apiService.documents.upload(file, metadata),
    {
      onSuccess: (data, variables) => {
        const fileInfo = {
          id: data.data.documentId,
          name: variables.file.name,
          size: variables.file.size,
          status: 'processing',
          uploadedAt: new Date().toISOString(),
          processingResult: null,
        };
        
        setUploadedFiles(prev => [...prev, fileInfo]);
        setProcessingFiles(prev => new Set([...prev, fileInfo.id]));
        
        // Start polling for processing status
        pollProcessingStatus(fileInfo.id);
      },
      onError: (error) => {
        console.error('Upload failed:', handleApiError(error));
      },
    }
  );

  // Polling for processing status
  const pollProcessingStatus = async (documentId) => {
    const maxAttempts = 20; // 2 minutes with 6-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await apiService.documents.getProcessingStatus(documentId);
        const status = response.data.status;

        if (status === 'completed') {
          // Get extracted text
          const textResponse = await apiService.documents.getExtractedText(documentId);
          
          setUploadedFiles(prev =>
            prev.map(file =>
              file.id === documentId
                ? {
                    ...file,
                    status: 'completed',
                    processingResult: {
                      extractedText: textResponse.data.extractedText,
                      confidence: textResponse.data.confidence,
                      pageCount: textResponse.data.pageCount,
                    },
                  }
                : file
            )
          );
          setProcessingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(documentId);
            return newSet;
          });
        } else if (status === 'failed') {
          setUploadedFiles(prev =>
            prev.map(file =>
              file.id === documentId
                ? { ...file, status: 'failed', error: 'Processing failed' }
                : file
            )
          );
          setProcessingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(documentId);
            return newSet;
          });
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 6000); // Poll every 6 seconds
        } else {
          // Timeout
          setUploadedFiles(prev =>
            prev.map(file =>
              file.id === documentId
                ? { ...file, status: 'failed', error: 'Processing timeout' }
                : file
            )
          );
          setProcessingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(documentId);
            return newSet;
          });
        }
      } catch (error) {
        console.error('Error polling status:', error);
        setUploadedFiles(prev =>
          prev.map(file =>
            file.id === documentId
              ? { ...file, status: 'failed', error: 'Status check failed' }
              : file
          )
        );
        setProcessingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(documentId);
          return newSet;
        });
      }
    };

    poll();
  };

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach(file => {
      const metadata = {
        originalName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      };

      uploadMutation.mutate({ file, metadata });
    });
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
  });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    setProcessingFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Document Processing</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload meeting notes, emails, or documents to automatically extract actions using AWS Textract
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white shadow rounded-lg p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {isDragActive ? 'Drop files here' : 'Upload documents'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Drag and drop your meeting notes or documents here, or click to select files
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Supports PDF, DOC, DOCX up to 10MB each
          </p>
        </div>

        {uploadMutation.isLoading && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-4 h-4 spinner mr-3" />
              <span className="text-sm text-blue-800">Uploading files...</span>
            </div>
          </div>
        )}

        {uploadMutation.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
                <p className="mt-1 text-sm text-red-700">
                  {handleApiError(uploadMutation.error).message}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Uploaded Documents</h3>
            <p className="mt-1 text-sm text-gray-500">
              Track processing status and view extracted actions
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <FileText className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </h4>
                        {getStatusIcon(file.status)}
                        <span className="text-xs text-gray-500 capitalize">
                          {file.status}
                        </span>
                      </div>
                      
                      <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatFileSize(file.size)}</span>
                        <span>
                          Uploaded {new Date(file.uploadedAt).toLocaleString()}
                        </span>
                      </div>

                      {file.error && (
                        <p className="mt-2 text-sm text-red-600">{file.error}</p>
                      )}

                      {file.status === 'processing' && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-1">
                            Processing with AWS Textract...
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/3"></div>
                          </div>
                        </div>
                      )}

                      {file.status === 'completed' && file.processingResult && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-800">
                              Processing Complete
                            </span>
                            <div className="flex items-center space-x-3 text-xs text-green-600">
                              {file.processingResult.pageCount && (
                                <span>{file.processingResult.pageCount} pages</span>
                              )}
                              {file.processingResult.confidence && (
                                <span>{file.processingResult.confidence}% confidence</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-sm text-green-700">
                            <strong>Extracted Actions:</strong>
                            <div className="mt-1 p-2 bg-white rounded border max-h-32 overflow-y-auto text-xs">
                              {file.processingResult.extractedText || 'No actions extracted - document may need manual review'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => removeFile(file.id)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <FileText className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <h4 className="font-medium">Action Extraction Workflow</h4>
            <ul className="mt-1 space-y-1 text-xs">
              <li>• Upload triggers automatic processing via EventBridge</li>
              <li>• AWS Textract extracts text from meeting notes and documents</li>
              <li>• Extracted content can be parsed to auto-generate action items</li>
              <li>• Processing typically takes 30-60 seconds per document</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <Clock className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
          <div className="text-sm text-yellow-700">
            <h4 className="font-medium">Phase 7.2 Feature</h4>
            <p className="mt-1">
              Document processing and action extraction will be implemented in Phase 7.2. 
              The UI is ready - backend integration coming soon!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;