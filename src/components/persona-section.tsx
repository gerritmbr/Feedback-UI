// src/components/persona-section.tsx
/**
 * PersonaSection Component
 * 
 * This component provides the main interface for persona-based student matching.
 * It manages the persona network visualization and filtering of student match data
 * based on selected personas.
 * 
 * Key Features:
 * - Interactive persona network visualization
 * - Dynamic filtering of student match data based on selected personas
 * - Error handling for data fetching and processing
 * - Retry mechanism for failed data requests
 * - Export functionality for filtered results
 * 
 * Architecture:
 * - PersonaSection: Main container with data provider
 * - PersonaSectionContent: Core functionality and state management
 * - PersonaNetworkSection: Visualization component
 * - MatchPopup: Display filtered match results
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { PersonaDataProvider, usePersonaData } from "@/src/components/persona-data-context";
import { PersonaNetworkSection } from "./PersonaNetworkSection";
import { MatchButton } from "@/src/components/match-button";
import { MatchPopup } from "@/src/components/match-popup";
import { usePersonaNetworkData } from "./network/hooks/usePersonaNetworkData";

// Action-based selection callback type
type SelectionAction = {
  nodeId: string;
  action: 'add' | 'remove' | 'toggle';
};

// Enhanced Match interface with better type safety
interface Match {
  id: string;
  Name: string;
  Gender: 'Male' | 'Female' | string;
  Nationality: string;
  Major: string;
  Semester: number | string;
  [key: string]: string | number; // Allow additional fields
}

// Type for raw match data structure from JSON
type RawMatchData = Record<string, Match[]>;

// Error state types
type ErrorState = {
  fetchError: string | null;
  processingError: string | null;
  retryCount: number;
};

/**
 * PersonaSectionContent - Core component with data management
 * 
 * Handles:
 * - Persona network data processing with error handling
 * - Match data fetching with retry logic  
 * - Node selection state management
 * - Filtering logic based on selected personas
 * - Error display and recovery mechanisms
 */
function PersonaSectionContent() {
  const [isMatchPopupOpen, setIsMatchPopupOpen] = useState(false);
  const [matchData, setMatchData] = useState<Match[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  
  // Debug: Log when selectedNodeIds state changes
  useEffect(() => {
    console.log('🔄 PersonaSection: selectedNodeIds STATE changed:')
    console.log('  New state:', selectedNodeIds)
    console.log('  Size:', selectedNodeIds.size)
    console.log('  Array:', Array.from(selectedNodeIds))
    console.log('---')
  }, [selectedNodeIds]);

  /**
   * Action-based callback for handling node selection changes
   * Uses functional state updates to avoid stale closure issues
   */
  const handleNodeSelectionChange = useCallback((action: SelectionAction) => {
    console.log('📝 PersonaSection: handleNodeSelectionChange called')
    console.log('  Action:', action)
    
    setSelectedNodeIds(prevSelected => {
      console.log('  Current selectedNodeIds:', Array.from(prevSelected))
      
      const newSelected = new Set(prevSelected);
      
      switch (action.action) {
        case 'add':
          console.log('  ➕ Adding node:', action.nodeId)
          newSelected.add(action.nodeId);
          break;
        case 'remove':
          console.log('  ➖ Removing node:', action.nodeId)
          newSelected.delete(action.nodeId);
          break;
        case 'toggle':
          if (newSelected.has(action.nodeId)) {
            console.log('  🔄 Toggling OFF node:', action.nodeId)
            newSelected.delete(action.nodeId);
          } else {
            console.log('  🔄 Toggling ON node:', action.nodeId)
            newSelected.add(action.nodeId);
          }
          break;
        default:
          console.warn('  ⚠️ Unknown action:', action.action)
          return prevSelected; // No change for unknown actions
      }
      
      console.log('  New selectedNodeIds:', Array.from(newSelected))
      console.log('---')
      return newSelected;
    });
  }, []); // Remove selectedNodeIds from dependencies - it was causing stale closures!
  const [rawMatchData, setRawMatchData] = useState<RawMatchData>({});
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Access persona data from context
  const { nodesData, edgesData, isLoading: dataLoading, error: dataError } = usePersonaData();
  const { processPersonaNetworkData } = usePersonaNetworkData();

  // Enhanced fetch function with retry logic
  const fetchMatchData = useCallback(async (attempt: number = 0): Promise<void> => {
    try {
      setFetchError(null);
      const response = await fetch('/data/mock_matches.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fetchedObject = await response.json();
      
      // Validate JSON structure
      if (!fetchedObject || typeof fetchedObject !== 'object') {
        throw new Error('Invalid JSON structure');
      }
      
      // Store both raw and flattened data
      setRawMatchData(fetchedObject);
      const flatMatches: Match[] = Object.values(fetchedObject).flat() as Match[];
      setMatchData(flatMatches);
      setRetryCount(0);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Match data loaded successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';
      setFetchError(errorMessage);
      console.error('Could not fetch match data:', error);
      
      // Retry logic (up to 3 attempts)
      if (attempt < 2) {
        const retryDelay = 1000 * (attempt + 1);
        setTimeout(() => {
          setRetryCount(attempt + 1);
          fetchMatchData(attempt + 1);
        }, retryDelay);
      }
    }
  }, []);

  // Retry handler for manual retry
  const handleRetryFetch = useCallback((): void => {
    fetchMatchData(0);
  }, [fetchMatchData]);

  // Initialize data fetching on component mount
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('PersonaSection: Initializing match data fetch');
    }
    fetchMatchData();
  }, [fetchMatchData]);

  // Process persona network data to get PersonaNode objects with error handling
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  const personaNetworkData = useMemo(() => {
    if (dataLoading || dataError || !nodesData.length || !edgesData.length) {
      return null;
    }
    
    try {
      setProcessingError(null);
      const result = processPersonaNetworkData(nodesData, edgesData);
      if (!result || !result.nodes || !result.links) {
        throw new Error('Invalid processed data structure');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown processing error';
      setProcessingError(errorMessage);
      console.error('Error processing persona network data:', err);
      return null;
    }
  }, [nodesData, edgesData, dataLoading, dataError, processPersonaNetworkData]);

  // Enhanced filtering with validation and user feedback
  const filteredMatchData = useMemo(() => {
    // If no personas are selected, show all data
    if (selectedNodeIds.size === 0) {
      return matchData;
    }

    // If network data is not available, return empty array
    if (!personaNetworkData) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Network data not available for filtering');
      }
      return [];
    }

    // Get selected persona nodes and extract their labels
    const selectedPersonaNodes = personaNetworkData.nodes.filter(node => 
      selectedNodeIds.has(node.id) && node.type === 'persona'
    );
    
    if (selectedPersonaNodes.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('No valid persona nodes selected');
      }
      return [];
    }
    
    const selectedLabels = selectedPersonaNodes.map(node => node.label);
    
    // Match labels exactly against JSON keys with validation
    const filteredMatches: Match[] = [];
    const missingLabels: string[] = [];
    
    selectedLabels.forEach(label => {
      if (rawMatchData[label]) {
        filteredMatches.push(...rawMatchData[label]);
      } else {
        missingLabels.push(label);
      }
    });
    
    if (missingLabels.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn('No match data found for personas:', missingLabels);
    }
    
    // Remove duplicates based on ID (now standardized to lowercase 'id')
    // Only deduplicate if the same student appears in multiple selected personas
    const uniqueMatches = filteredMatches.filter((match, index, self) => 
      index === self.findIndex(m => m.id === match.id)
    );

    return uniqueMatches;
  }, [selectedNodeIds, matchData, rawMatchData, personaNetworkData]);

  const handleFindMatches = useCallback((): void => {
    setIsMatchPopupOpen(true);
  }, []);

  const handleClosePopup = useCallback((): void => {
    setIsMatchPopupOpen(false);
  }, []);

  const handleDownload = () => {
    // Download the filtered data if available, otherwise the original JSON
    if (filteredMatchData.length > 0 && selectedNodeIds.size > 0) {
      // Download filtered data as JSON
      const dataToDownload = {
        selectedPersonas: Array.from(selectedNodeIds),
        matchedStudents: filteredMatchData
      };
      const dataStr = JSON.stringify(dataToDownload, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const link = document.createElement("a");
      link.href = dataUri;
      link.download = "filtered_matches.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Download original data
      const link = document.createElement("a");
      link.href = "/data/mock_matches.json";
      link.download = "mock_matches.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Personas</CardTitle>
          <MatchButton onClick={handleFindMatches} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-2 overflow-hidden">
        {fetchError && (
          <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-red-800 font-medium text-sm">Failed to load match data</h4>
                <p className="text-red-600 text-xs mt-1">{fetchError}</p>
                {retryCount > 0 && (
                  <p className="text-red-500 text-xs mt-1">Retry attempt: {retryCount}/3</p>
                )}
              </div>
              <button
                onClick={handleRetryFetch}
                className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {processingError && (
          <div className="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-yellow-800 font-medium text-sm">Data processing error</h4>
            <p className="text-yellow-600 text-xs mt-1">{processingError}</p>
          </div>
        )}
        <PersonaNetworkSection 
          className="h-full" 
          selectedNodeIds={selectedNodeIds}
          onNodeSelectionChange={handleNodeSelectionChange}
        />
      </CardContent>

      <MatchPopup
        isOpen={isMatchPopupOpen}
        onClose={handleClosePopup}
        onDownload={handleDownload}
        data={filteredMatchData}
      />
    </Card>
  );
}

/**
 * PersonaSection - Main exported component
 * 
 * Provides the PersonaDataProvider context to enable data sharing
 * between the persona network visualization and match filtering logic.
 * 
 * This wrapper pattern ensures that:
 * - Context is available to all child components
 * - Data processing happens at the appropriate level
 * - State management is centralized and predictable
 */
export function PersonaSection() {
  return (
    <PersonaDataProvider>
      <PersonaSectionContent />
    </PersonaDataProvider>
  );
}