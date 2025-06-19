"use client"; // If this context is used in a client component in Next.js

import React, { createContext, useContext, useEffect, useState } from 'react';
import * as d3 from 'd3'; // Make sure d3 is imported here

// Define the Node and Link interfaces if they are specifically tied to the data loading/processing logic
// Otherwise, they might live in a separate types file or directly in network-section.tsx
interface Node extends d3.SimulationNodeDatum {
  id: string
  label: string
  content: string
  type: "question" | "answer" | "reason"
  color: string
  transcript_id: string
  multiplicity?: number
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node
  target: string | Node
  transcript_id?: string
  type?: "question_to_answer" | "answer_to_reason" | "same_transcript_answer" | "same_transcript_reason"
}

interface NetworkData {
  nodes: Node[]
  links: Link[]
}


// Data Loading of CSV
interface DataContextType {
  nodesData: any[];
  edgesData: any[];
  isLoading: boolean;
  error: string | null;
  dataSource: 'none' | 'local' | 'server';
  hasLocalData: boolean;
  uploadTimestamp: Date | null;
  refreshData: () => void;
  clearData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// Data loading functions
const hasLocalCSVData = () => {
  return localStorage.getItem('csv_nodes_data') && localStorage.getItem('csv_edges_data');
};

const getUploadTimestamp = () => {
  const timestamp = localStorage.getItem('csv_upload_timestamp');
  return timestamp ? new Date(parseInt(timestamp)) : null;
};

const loadCSVData = async () => {
  const nodesData = localStorage.getItem('csv_nodes_data');
  const edgesData = localStorage.getItem('csv_edges_data');

  if (nodesData && edgesData) {
    const parsedNodes = d3.csvParse(nodesData);
    const parsedEdges = d3.csvParse(edgesData);
    return [parsedNodes, parsedEdges];
  } else {
    // Make sure these paths are correct relative to your public directory
    const [serverNodes, serverEdges] = await Promise.all([
      d3.csv("/data/nodes.csv"),
      d3.csv("/data/edges.csv")
    ]);
    return [serverNodes, serverEdges];
  }
};

const validateCSVData = (nodesData: any[], edgesData: any[]) => {
  const errors = [];
  if (!nodesData || nodesData.length === 0) {
    errors.push('Nodes data is empty');
  }
  if (!edgesData || edgesData.length === 0) {
    errors.push('Edges data is empty');
  }
  return errors;
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodesData, setNodesData] = useState<any[]>([]);
  const [edgesData, setEdgesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'none' | 'local' | 'server'>('none');
  const [uploadTimestamp, setUploadTimestamp] = useState<Date | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [nodes, edges] = await loadCSVData();
      
      const validationErrors = validateCSVData(nodes, edges);
      if (validationErrors.length > 0) {
        throw new Error('Data validation failed: ' + validationErrors.join(', '));
      }
      
      setNodesData(nodes);
      setEdgesData(edges);
      setDataSource(hasLocalCSVData() ? 'local' : 'server');
      setUploadTimestamp(getUploadTimestamp());
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error loading CSV data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = () => {
    loadData();
  };

  const clearData = () => {
    localStorage.removeItem('csv_nodes_data');
    localStorage.removeItem('csv_edges_data');
    localStorage.removeItem('csv_upload_timestamp');
    setNodesData([]);
    setEdgesData([]);
    setDataSource('none');
    setUploadTimestamp(null);
  };

  useEffect(() => {
    loadData();
  }, []);

  const value: DataContextType = {
    nodesData,
    edgesData,
    isLoading,
    error,
    dataSource,
    uploadTimestamp,
    hasLocalData: dataSource === 'local',
    refreshData,
    clearData,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};