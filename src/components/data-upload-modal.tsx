"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs'
import { Button } from '@/src/components/ui/button'
import { Upload } from 'lucide-react'
import { CSVUploadTab } from './csv-upload-tab'
import { TranscriptUploadTab } from './transcript-upload-tab'

interface DataUploadModalProps {
  children?: React.ReactNode
  trigger?: React.ReactNode
}

export function DataUploadModal({ children, trigger }: DataUploadModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'csv' | 'transcript'>('transcript')

  const defaultTrigger = (
    <Button variant="outline" className="gap-2">
      <Upload className="h-4 w-4" />
      Upload Data
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Data Files
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <Tabs 
            value={activeTab} 
            onValueChange={(value) => setActiveTab(value as 'csv' | 'transcript')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv">CSV Files</TabsTrigger>
              <TabsTrigger value="transcript">Transcript Files</TabsTrigger>
            </TabsList>
            
            <TabsContent value="csv" className="mt-6">
              <CSVUploadTab onUploadSuccess={() => setIsOpen(false)} />
            </TabsContent>
            
            <TabsContent value="transcript" className="mt-6">
              <TranscriptUploadTab onUploadSuccess={() => setIsOpen(false)} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}