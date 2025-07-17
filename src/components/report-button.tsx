'use client';

import React, { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { FileDown, Download } from 'lucide-react';
import { useReportData } from '@/src/components/report-data-context';
import { ReportDialog } from '@/src/components/report-dialog';

export const ReportButton = () => {
  const { hasDownloadedBefore, markAsDownloaded, showSuccessMessage } = useReportData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDialogOpen(true);
  };

  const handleDownloadConfirm = async () => {
    try {
      // Fetch the PDF file
      const response = await fetch('/data/Archive/insights_report.pdf');
      if (!response.ok) {
        throw new Error('Failed to fetch PDF');
      }
      
      // Create blob with proper PDF MIME type
      const blob = await response.blob();
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      
      // Create download URL
      const downloadUrl = URL.createObjectURL(pdfBlob);
      
      // Create and trigger download link
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = 'insights_report.pdf';
      downloadLink.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Clean up the blob URL
      URL.revokeObjectURL(downloadUrl);
      
      markAsDownloaded();
      showSuccessMessage();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <>
      <Button
        onClick={handleButtonClick}
        variant="outline"
        className="gap-2"
        type="button"
      >
        {hasDownloadedBefore ? (
          <>
            <Download className="h-4 w-4" />
            Download Report
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4" />
            Generate Report
          </>
        )}
      </Button>
      
      <ReportDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={handleDownloadConfirm}
      />
    </>
  );
};