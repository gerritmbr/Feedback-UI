import React from 'react';
import { useFeedbackData } from "@/src/components/feedback-data-context"; // Import the useFeedbackData hook
import { DataUploadModal } from "@/src/components/data-upload-modal";
import { ReportButton } from "@/src/components/report-button";

interface HeaderProps {
  // onDataUploaded callback is no longer needed since we use context
}

const Header: React.FC<HeaderProps> = () => {
  const { hasLocalData } = useFeedbackData();

  return (
    <header className="border-b">
      <div className="px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Feedback Evaluation</h1>
        
        <div className="flex items-center gap-2">
          <ReportButton />
          <DataUploadModal 
            trigger={
              <button className="relative inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
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
                {hasLocalData && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></span>
                )}
              </button>
            }
          />
        </div>
      </div>
    </header>
  );
};

export default Header;