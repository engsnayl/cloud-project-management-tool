// src/components/Documents/DocumentUpload.jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  File, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  X,
  FileText,
  Image,
  Paperclip,
  ArrowRight
} from 'lucide-react';
import apiService from '../../services/api';

const DocumentUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processingFiles, setProcessingFiles] = useState([]);
  const navigate = useNavigate();

  // Upload mutation for real S3 upload
  const uploadMutation = useMutation(
    async (formData) => {
      return apiService.documents.upload(formData);
    },
    {
      onSuccess: (data, variables) => {
        console.log('Upload successful:', data);
        // Move file from processing to uploaded and start status polling
        const fileId = variables.get('fileId');
        setProcessingFiles(prev => 
          prev.map(f => f.id === fileId ? 
            { ...f, status: 'processing', documentId: data.documentId, progress: 100 } : f
          )
        );
        
        // Start polling for processing status
        pollProcessingStatus(data.documentId, fileId);
      },
      onError: (error, variables) => {
        const fileId = variables.get('fileId');
        console.error('Upload failed:', error);
        setProcessingFiles(prev => 
          prev.map(f => f.id === fileId ? 
            { ...f, status: 'error', error: error.message } : f
          )
        );
      }
    }
  );

  // Function to poll processing status
  const pollProcessingStatus = async (documentId, fileId) => {
    const maxPolls = 30; // 5 minutes max polling
    let pollCount = 0;

    const poll = async () => {
      try {
        const statusData = await apiService.documents.getProcessingStatus(documentId);
        
        if (statusData.status === 'completed') {
          // Processing complete - get extracted suggestions
          const extractedData = await apiService.documents.getExtractedText(documentId);
          
          setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
          setUploadedFiles(prev => [...prev, {
            id: fileId,
            documentId,
            name: processingFiles.find(f => f.id === fileId)?.name || 'Unknown',
            status: 'completed',
            extractedSuggestions: extractedData.suggestions || [],
            totalSuggestions: extractedData.totalSuggestions || 0,
            processedAt: new Date().toISOString()
          }]);
          
        } else if (statusData.status === 'failed') {
          setProcessingFiles(prev => 
            prev.map(f => f.id === fileId ? 
              { ...f, status: 'error', error: 'Document processing failed' } : f
            )
          );
        } else if (pollCount < maxPolls) {
          // Still processing, continue polling
          setTimeout(poll, 10000); // Poll every 10 seconds
          pollCount++;
        } else {
          // Timeout
          setProcessingFiles(prev => 
            prev.map(f => f.id === fileId ? 
              { ...f, status: 'error', error: 'Processing timeout' } : f
            )
          );
        }
      } catch (error) {
        console.error('Status polling error:', error);
        setProcessingFiles(prev => 
          prev.map(f => f.id === fileId ? 
            { ...f, status: 'error', error: 'Failed to check processing status' } : f
          )
        );
      }
    };

    // Start polling after 5 seconds
    setTimeout(poll, 5000);
  };

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0
    }));

    setProcessingFiles(prev => [...prev, ...newFiles]);

    // Upload each file to S3
    newFiles.forEach(fileObj => {
      const formData = new FormData();
      formData.append('file', fileObj.file);
      formData.append('fileId', fileObj.id);
      formData.append('userId', 'engsnayl@gmail.com'); // Should come from auth context
      
      // Update progress during upload
      setProcessingFiles(prev => 
        prev.map(f => f.id === fileObj.id ? { ...f, progress: 25 } : f)
      );

      uploadMutation.mutate(formData);
    });
  }, []);

  const removeFile = (fileId, isCompleted = false) => {
    if (isCompleted) {
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    } else {
      setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const getFileIcon = (fileName) => {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return <FileText className="w-8 h-8 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-8 h-8 text-blue-500" />;
      case 'txt':
        return <File className="w-8 h-8 text-gray-500" />;
      default:
        return <Paperclip className="w-8 h-8 text-gray-400" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploading':
        return <Upload className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (file) => {
    switch (file.status) {
      case 'uploading':
        return `Uploading... ${file.progress}%`;
      case 'processing':
        return 'Extracting action items...';
      case 'completed':
        return `Extracted ${file.totalSuggestions || 0} suggestions`;
      case 'error':
        return file.error || 'Processing failed';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Upload</h1>
        <p className="text-gray-600">
          Upload documents to automatically extract action items using AI-powered text analysis.
          Supported formats: PDF, Word documents, and plain text files.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        {isDragActive ? (
          <p className="text-lg text-blue-600">Drop the files here...</p>
        ) : (
          <div>
            <p className="text-lg text-gray-600 mb-2">
              Drag & drop documents here, or click to select files
            </p>
            <p className="text-sm text-gray-500">
              PDF, Word documents, and text files up to 10MB
            </p>
          </div>
        )}
      </div>

      {/* Processing Files */}
      {processingFiles.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing Files</h2>
          <div className="space-y-4">
            {processingFiles.map((file) => (
              <div key={file.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.name)}
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(file.status)}
                    <span className="text-sm text-gray-600">
                      {getStatusText(file)}
                    </span>
                    <button
                      onClick={() => removeFile(file.id, false)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {file.status === 'uploading' && (
                  <div className="mt-3">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Files */}
      {uploadedFiles.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Processed Documents</h2>
          <div className="space-y-4">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.name)}
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        Processed {new Date(file.processedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {file.totalSuggestions} action items found
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Ready for review</p>
                    </div>
                    <button
                      onClick={() => navigate('/document-review')}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <span>Review Suggestions</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFile(file.id, true)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Preview of extracted suggestions */}
                {file.extractedSuggestions && file.extractedSuggestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Preview of extracted action items:
                    </p>
                    <div className="space-y-2">
                      {file.extractedSuggestions.slice(0, 3).map((suggestion, index) => (
                        <div key={index} className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                          <span className="font-medium">Line {suggestion.line_number}:</span> {suggestion.text}
                          {suggestion.confidence && (
                            <span className="ml-2 text-xs text-blue-600">
                              {Math.round(parseFloat(suggestion.confidence) * 100)}% confidence
                            </span>
                          )}
                        </div>
                      ))}
                      {file.extractedSuggestions.length > 3 && (
                        <p className="text-xs text-gray-500">
                          +{file.extractedSuggestions.length - 3} more suggestions...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Document Processing Workflow
        </h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p>1. <strong>Upload:</strong> Documents are securely uploaded to AWS S3</p>
          <p>2. <strong>Processing:</strong> ECS containers extract text and identify action items</p>
          <p>3. <strong>Analysis:</strong> NLP algorithms detect tasks, deadlines, and priorities</p>
          <p>4. <strong>Review:</strong> Human-in-the-loop approval for extracted suggestions</p>
          <p>5. <strong>Creation:</strong> Approved items become trackable actions</p>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-sm text-blue-700">
            <strong>Status:</strong> Document processing pipeline is active and ready.
            Your ECS cluster and Lambda functions are operational.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;// Cache bust: Wed Sep 24 07:22:43 AM UTC 2025
