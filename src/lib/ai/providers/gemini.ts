/**
 * Google Gemini Provider
 */

import type { ProviderRequest, ProviderResponse } from './types';

// Lazily initialize Gemini client
let GoogleGenerativeAI: any = null;

async function getGenerativeModel(modelName: string): Promise<any> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  // Dynamic import to avoid issues if package not installed
  if (!GoogleGenerativeAI) {
    try {
      const geminiModule = await import('@google/generative-ai');
      GoogleGenerativeAI = geminiModule.GoogleGenerativeAI;
    } catch (error) {
      throw new Error('Gemini SDK not installed. Run: npm install @google/generative-ai');
    }
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Call Google Gemini API
 */
export async function callGemini(request: ProviderRequest): Promise<ProviderResponse> {
  const startTime = Date.now();

  const model = await getGenerativeModel(request.model);

  // Configure generation parameters
  const generationConfig = {
    maxOutputTokens: request.maxTokens,
    temperature: request.temperature,
  };

  // Gemini combines system prompt with user prompt
  const fullPrompt = request.systemPrompt
    ? `${request.systemPrompt}\n\n---\n\n${request.prompt}`
    : request.prompt;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig,
  });

  const response = await result.response;
  const text = response.text();

  // Gemini provides usage metadata differently
  const usageMetadata = response.usageMetadata || {};

  return {
    content: text,
    usage: {
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
    },
    model: request.model,
    provider: 'gemini',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Stream response from Google Gemini API
 */
export async function streamGemini(
  request: ProviderRequest,
  onChunk: (chunk: string) => void
): Promise<ProviderResponse> {
  const startTime = Date.now();

  const model = await getGenerativeModel(request.model);

  const generationConfig = {
    maxOutputTokens: request.maxTokens,
    temperature: request.temperature,
  };

  const fullPrompt = request.systemPrompt
    ? `${request.systemPrompt}\n\n---\n\n${request.prompt}`
    : request.prompt;

  const result = await model.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig,
  });

  let fullContent = '';

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      fullContent += chunkText;
      onChunk(chunkText);
    }
  }

  // Get final response for usage data
  const response = await result.response;
  const usageMetadata = response.usageMetadata || {};

  return {
    content: fullContent,
    usage: {
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
    },
    model: request.model,
    provider: 'gemini',
    latencyMs: Date.now() - startTime,
  };
}
