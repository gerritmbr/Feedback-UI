import React from 'react';

const UploadButton = ({ onClick, hasData = false }) => {
  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
    >
      {/* Upload Icon */}
      <svg 
        className="w-4 h-4" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
        />
      </svg>
      
      Upload Data
      
      {/* Data Status Indicator */}
      {hasData && (
        <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></span>
      )}
    </button>
  );
};

// Alternative version with text indicator
const UploadButtonWithStatus = ({ onClick, hasData = false, uploadTimestamp = null }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
      >
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
          />
        </svg>
        {hasData ? 'Manage Data' : 'Upload Data'}
      </button>
      
      {hasData && uploadTimestamp && (
        <span className="text-xs text-gray-500">
          Uploaded {uploadTimestamp.toLocaleDateString()}
        </span>
      )}
    </div>
  );
};


export default UploadButton;
export { UploadButtonWithStatus };