'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ReportDataContextType {
  hasDownloadedBefore: boolean;
  showSuccessBanner: boolean;
  setHasDownloadedBefore: (value: boolean) => void;
  setShowSuccessBanner: (value: boolean) => void;
  markAsDownloaded: () => void;
  showSuccessMessage: () => void;
}

const ReportDataContext = createContext<ReportDataContextType | undefined>(undefined);

export const useReportData = () => {
  const context = useContext(ReportDataContext);
  if (!context) {
    throw new Error('useReportData must be used within a ReportDataProvider');
  }
  return context;
};

interface ReportDataProviderProps {
  children: ReactNode;
}

export const ReportDataProvider = ({ children }: ReportDataProviderProps) => {
  const [hasDownloadedBefore, setHasDownloadedBefore] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('report-downloaded');
    if (stored === 'true') {
      setHasDownloadedBefore(true);
    }
  }, []);

  const markAsDownloaded = () => {
    setHasDownloadedBefore(true);
    localStorage.setItem('report-downloaded', 'true');
  };

  const showSuccessMessage = () => {
    setShowSuccessBanner(true);
    setTimeout(() => {
      setShowSuccessBanner(false);
    }, 3000);
  };

  const value = {
    hasDownloadedBefore,
    showSuccessBanner,
    setHasDownloadedBefore,
    setShowSuccessBanner,
    markAsDownloaded,
    showSuccessMessage,
  };

  return (
    <ReportDataContext.Provider value={value}>
      {children}
    </ReportDataContext.Provider>
  );
};