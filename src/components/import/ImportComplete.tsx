'use client';

import { CheckCircle, AlertTriangle, Download, RotateCcw, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ImportCompleteProps {
  results: {
    companies: number;
    contacts: number;
    deals: number;
    activities: number;
  };
  errors: Array<{ row: number; message: string }>;
  onReset: () => void;
}

export function ImportComplete({ results, errors, onReset }: ImportCompleteProps) {
  const totalImported = results.companies + results.contacts + results.deals + results.activities;
  const hasErrors = errors.length > 0;

  const downloadErrorLog = () => {
    const csv = ['Row,Error'];
    errors.forEach((err) => {
      csv.push(`${err.row},"${err.message.replace(/"/g, '""')}"`);
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-center">
      {/* Success Icon */}
      <div className="flex justify-center">
        {hasErrors ? (
          <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
        ) : (
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900">
          {hasErrors ? 'Import Completed with Errors' : 'Import Successful!'}
        </h3>
        <p className="text-gray-500 mt-1">
          {totalImported} records imported
          {hasErrors && `, ${errors.length} errors`}
        </p>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-xl mx-auto">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-3xl font-bold text-blue-600">{results.companies}</p>
          <p className="text-sm text-blue-700">Companies</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-3xl font-bold text-green-600">{results.contacts}</p>
          <p className="text-sm text-green-700">Contacts</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-3xl font-bold text-purple-600">{results.deals}</p>
          <p className="text-sm text-purple-700">Deals</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <p className="text-3xl font-bold text-orange-600">{results.activities}</p>
          <p className="text-sm text-orange-700">Activities</p>
        </div>
      </div>

      {/* Error Download */}
      {hasErrors && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-amber-800 mb-3">
            {errors.length} row{errors.length !== 1 ? 's' : ''} could not be imported
          </p>
          <button
            onClick={downloadErrorLog}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50"
          >
            <Download className="h-4 w-4" />
            Download Error Log
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          Import More
        </button>
        <Link
          href="/pipeline"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          View Pipeline
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
