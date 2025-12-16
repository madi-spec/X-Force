'use client';

import { useState } from 'react';
import { Code, FileText } from 'lucide-react';

interface AIPromptEditorProps {
  promptTemplate: string;
  schemaTemplate: string;
  onPromptChange: (value: string) => void;
  onSchemaChange: (value: string) => void;
}

export function AIPromptEditor({
  promptTemplate,
  schemaTemplate,
  onPromptChange,
  onSchemaChange,
}: AIPromptEditorProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'schema'>('prompt');

  // Extract variables from prompt (format: {{variableName}})
  const variables = promptTemplate.match(/\{\{(\w+)\}\}/g) || [];
  const uniqueVariables = [...new Set(variables)];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'prompt'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          Prompt Template
        </button>
        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'schema'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Code className="h-4 w-4" />
          Response Schema
        </button>
      </div>

      {/* Variables Reference */}
      {uniqueVariables.length > 0 && activeTab === 'prompt' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-xs font-medium text-blue-700 mb-2">Available Variables</h4>
          <div className="flex flex-wrap gap-2">
            {uniqueVariables.map((variable) => (
              <code
                key={variable}
                className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono"
              >
                {variable}
              </code>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">
            These variables will be replaced with actual values at runtime.
          </p>
        </div>
      )}

      {/* Editor */}
      {activeTab === 'prompt' ? (
        <div>
          <textarea
            value={promptTemplate}
            onChange={(e) => onPromptChange(e.target.value)}
            className="w-full h-[500px] p-4 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Enter your prompt template..."
            spellCheck={false}
          />
          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <span>{promptTemplate.length.toLocaleString()} characters</span>
            <span>~{Math.ceil(promptTemplate.length / 4).toLocaleString()} tokens (estimate)</span>
          </div>
        </div>
      ) : (
        <div>
          <textarea
            value={schemaTemplate}
            onChange={(e) => onSchemaChange(e.target.value)}
            className="w-full h-[500px] p-4 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Enter your response schema (JSON format expected from AI)..."
            spellCheck={false}
          />
          <p className="text-xs text-gray-500 mt-2">
            This schema describes the expected JSON structure of the AI response.
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Tips</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Use <code className="bg-gray-200 px-1 rounded">{'{{variableName}}'}</code> syntax for dynamic values</li>
          <li>• Be specific about the expected JSON structure in your prompt</li>
          <li>• Include examples when possible for better AI responses</li>
          <li>• Test changes thoroughly before deploying to production</li>
        </ul>
      </div>
    </div>
  );
}
