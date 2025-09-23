import React from 'react';

const DocumentReviewPage = () => {
  console.log('DocumentReviewPage rendering...');
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Document Review - Test Version</h1>
      <p>This is a minimal test component to verify routing works.</p>
      <div className="mt-4 p-4 bg-blue-50 rounded">
        <p>If you can see this, then routing and the component are working.</p>
        <p>The issue was likely with the useQuery hook or API calls.</p>
      </div>
    </div>
  );
};

export default DocumentReviewPage;
