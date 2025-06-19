import React, { useState, useRef } from 'react';

const UploadPopup = ({ isOpen, onClose, onDataUploaded }) => {
  const [nodesFile, setNodesFile] = useState(null);
  const [edgesFile, setEdgesFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  
  const nodesInputRef = useRef(null);
  const edgesInputRef = useRef(null);

  const handleNodesFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setNodesFile(file);
      setError('');
    } else if (file) {
      setError('Please select a valid CSV file for nodes data');
      e.target.value = '';
    }
  };

  const handleEdgesFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setEdgesFile(file);
      setError('');
    } else if (file) {
      setError('Please select a valid CSV file for edges data');
      e.target.value = '';
    }
  };

  const handleUpload = async () => {
    if (!nodesFile || !edgesFile) {
      setError('Please select both nodes and edges CSV files');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Read and parse CSV files
      const nodesText = await readFileAsText(nodesFile);
      const edgesText = await readFileAsText(edgesFile);

      // Store in localStorage
      localStorage.setItem('csv_nodes_data', nodesText);
      localStorage.setItem('csv_edges_data', edgesText);
      localStorage.setItem('csv_upload_timestamp', Date.now().toString());

      // Notify parent component
      onDataUploaded();
      
      // Close popup
      onClose();
      
    } catch (err) {
      setError('Error processing files: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  };

  const handleClear = () => {
    localStorage.removeItem('csv_nodes_data');
    localStorage.removeItem('csv_edges_data');
    localStorage.removeItem('csv_upload_timestamp');
    setNodesFile(null);
    setEdgesFile(null);
    if (nodesInputRef.current) nodesInputRef.current.value = '';
    if (edgesInputRef.current) edgesInputRef.current.value = '';
    onDataUploaded(); // Refresh the data state
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Upload CSV Data</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Nodes File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nodes CSV File
            </label>
            <input
              ref={nodesInputRef}
              type="file"
              accept=".csv"
              onChange={handleNodesFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {nodesFile && (
              <p className="text-sm text-green-600 mt-1">
                ✓ {nodesFile.name} selected
              </p>
            )}
          </div>

          {/* Edges File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Edges CSV File
            </label>
            <input
              ref={edgesInputRef}
              type="file"
              accept=".csv"
              onChange={handleEdgesFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {edgesFile && (
              <p className="text-sm text-green-600 mt-1">
                ✓ {edgesFile.name} selected
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={handleUpload}
              disabled={isUploading || !nodesFile || !edgesFile}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Upload & Save'}
            </button>
            <button
              onClick={handleClear}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
            >
              Clear Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPopup;