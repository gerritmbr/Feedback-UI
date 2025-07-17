'use client';

import React from 'react';
import { CheckCircle } from 'lucide-react';

interface SuccessBannerProps {
  show: boolean;
}

export const SuccessBanner = ({ show }: SuccessBannerProps) => {
  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-full duration-300">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-800">Downloaded!</span>
        </div>
      </div>
    </div>
  );
};