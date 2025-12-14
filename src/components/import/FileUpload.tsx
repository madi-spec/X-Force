'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import type { ImportType } from '@/lib/import/types';

interface FileUploadProps {
  importType: ImportType;
  onImportTypeChange: (type: ImportType) => void;
  onFileUpload: (
    file: File,
    rawData: Record<string, string>[],
    columns: string[],
    sampleData: Record<string, string>[]
  ) => void;
}

export function FileUpload({ importType, onImportTypeChange, onFileUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    setIsProcessing(true);

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file');
      setIsProcessing(false);
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      setIsProcessing(false);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsProcessing(false);

        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }

        const data = results.data as Record<string, string>[];
        if (data.length === 0) {
          setError('The CSV file appears to be empty');
          return;
        }

        const columns = results.meta.fields || [];
        if (columns.length === 0) {
          setError('No columns found in CSV file');
          return;
        }

        // Get sample data (first 3 rows)
        const sampleData = data.slice(0, 3);

        onFileUpload(file, data, columns, sampleData);
      },
      error: (err) => {
        setIsProcessing(false);
        setError(`Failed to parse CSV: ${err.message}`);
      },
    });
  }, [onFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <div className="space-y-6">
      {/* Import Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What are you importing?
        </label>
        <div className="space-y-2">
          {[
            { id: 'deals' as const, label: 'Deals (with companies & contacts)', desc: 'Import deals along with their associated companies and contacts' },
            { id: 'companies' as const, label: 'Companies only', desc: 'Import company records without deals' },
            { id: 'contacts' as const, label: 'Contacts only', desc: 'Import contacts for existing companies' },
          ].map((option) => (
            <label
              key={option.id}
              className={`flex items-start p-4 rounded-lg border cursor-pointer transition-colors ${
                importType === option.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="importType"
                value={option.id}
                checked={importType === option.id}
                onChange={() => onImportTypeChange(option.id)}
                className="mt-1 mr-3"
              />
              <div>
                <span className="font-medium text-gray-900">{option.label}</span>
                <p className="text-sm text-gray-500 mt-0.5">{option.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* File Upload Zone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Upload your CSV file
        </label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isProcessing ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
              <p className="text-gray-600">Processing file...</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                {isDragging ? (
                  <FileSpreadsheet className="h-12 w-12 text-blue-500" />
                ) : (
                  <Upload className="h-12 w-12 text-gray-400" />
                )}
              </div>
              <p className="text-gray-600 mb-2">
                <span className="text-blue-600 font-medium">Click to upload</span>
                {' '}or drag and drop
              </p>
              <p className="text-sm text-gray-500">
                CSV files up to 10MB
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Upload Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Tips for CSV imports</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Your CSV should have column headers in the first row</li>
          <li>• Company name is required for deal imports</li>
          <li>• You can map any column to X-FORCE fields in the next step</li>
          <li>• Duplicate companies will be matched by name (case-insensitive)</li>
        </ul>
      </div>
    </div>
  );
}
