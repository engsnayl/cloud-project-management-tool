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
  Image,
  Paperclip
} from 'lucide-react';

const DocumentUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [processingFiles, setProcessingFiles] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
      extractedActions: []
    }));

    setProcessingFiles(prev => [...prev, ...newFiles]);

    // Simulate upload and processing
    newFiles.forEach(fileObj => {
      // Simulate upload progress
      let progress = 0;
      const uploadInterval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(uploadInterval);
          
          // Move to processing
          setProcessingFiles(prev => 
            prev.map(f => 
              f.id === fileObj.id 
                ? { ...f, status: 'processing', progress: 100 }
                : f
            )
          );

          // Simulate processing completion
          setTimeout(() => {
            const mockActions = [
              `Review ${fileObj.name} contents`,
              `Follow up on items mentioned in ${fileObj.name}`,
              `Create action items based on ${fileObj.name}`
            ];

            setProcessingFiles(prev => prev.filter(f => f.id !== fileObj.id));
            setUploadedFiles(prev => [...prev, {
              ...fileObj,
              status: 'completed',
              progress: 100,
              extractedActions: mockActions,
              processedAt: new Date().toISOString()
            }]);
          }, 2000 + Math.random() * 3000);
        } else {
          setProcessingFiles(prev => 
            prev.map(f => 
              f.id === fileObj.id ? { ...f, progress } : f
            )
          );
        }
      }, 200);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText className="w-6 h-6 text-red-500" />;
      case 'doc':
      case 'docx':
        return <File className="w-6 h-6 text-blue-500" />;
      case 'txt':
        return <FileText className="w-6 h-6 text-gray-500" />;
      default:
        return <Paperclip className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploading':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <div className="p-6" style={{ marginLeft: '256px' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Processing</h1>
          <p className="text-gray-600">
            Upload meeting notes and documents to automatically extract actions using AWS Textract
          </p>
        </div>

        {/* Upload Area */}
        <div className="mb-8">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Upload documents
            </h3>
            <p className="text-gray-500 mb-4">
              Drag and drop your meeting notes or documents here, or click to select files
            </p>
            <p className="text-sm text-gray-400">
              Supports PDF, DOC, DOCX up to 10MB each
            </p>
          </div>
        </div>

        {/* Processing Files */}
        {processingFiles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing</h2>
            <div className="space-y-4">
              {processingFiles.map((fileObj) => (
                <div key={fileObj.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(fileObj.name)}
                      <div>
                        <p className="font-medium text-gray-900">{fileObj.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(fileObj.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(fileObj.status)}
                      <span className="text-sm text-gray-600 capitalize">{fileObj.status}</span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${fileObj.progress}%` }}
                    />
                  </div>
                  
                  {fileObj.status === 'processing' && (
                    <p className="text-sm text-gray-500 mt-2">
                      Extracting actions from document...
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Files */}
        {uploadedFiles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Processed Documents</h2>
            <div className="space-y-4">
              {uploadedFiles.map((fileObj) => (
                <div key={fileObj.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(fileObj.name)}
                      <div>
                        <p className="font-medium text-gray-900">{fileObj.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(fileObj.size)} • Processed {new Date(fileObj.processedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(fileObj.status)}
                      <button
                        onClick={() => removeFile(fileObj.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Extracted Actions */}
                  {fileObj.extractedActions.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                      <h4 className="font-medium text-gray-900 mb-2">Extracted Actions ({fileObj.extractedActions.length})</h4>
                      <div className="space-y-2">
                        {fileObj.extractedActions.map((action, index) => (
                          <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{action}</span>
                          </div>
                        ))}
                      </div>
                      <button className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        Convert to Actions →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How Document Processing Works</h3>
          <div className="text-blue-800 space-y-2 text-sm">
            <p>• Documents are uploaded to secure S3 storage</p>
            <p>• AWS Textract processes documents via EventBridge</p>
            <p>• AI extracts meeting notes and documents</p>
            <p>• System auto-generates action items</p>
            <p>• Actions are created with owners per document</p>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Phase 7.2 Feature:</strong> Action extraction will be implemented in Phase 7.2. The UI is ready - backend integration coming soon!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;