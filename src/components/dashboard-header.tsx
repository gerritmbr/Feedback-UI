import React, { useState } from 'react';
import { useFeedbackData } from "@/src/components/feedback-data-context"; // Import the useFeedbackData hook
import UploadButton from "@/src/components/upload-button";
import UploadPopup from "@/src/components/upload-popup";
import { ReportButton } from "@/src/components/report-button";

interface HeaderProps {
  // onDataUploaded callback is no longer needed since we use context
}

const Header: React.FC<HeaderProps> = () => {
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const { hasLocalData, uploadTimestamp, refreshData } = useFeedbackData();

  const handleDataUploaded = () => {
    refreshData(); // This will reload data from localStorage
  };

  return (
    <header className="border-b">
      <div className="px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Feedback Evaluation</h1>
        
        <div className="flex items-center gap-2">
          <ReportButton />
          <UploadButton 
            onClick={() => setShowUploadPopup(true)}
            hasData={hasLocalData}
          />
        </div>
      </div>

      <UploadPopup
        isOpen={showUploadPopup}
        onClose={() => setShowUploadPopup(false)}
        onDataUploaded={handleDataUploaded}
      />
    </header>
  );
};

export default Header;