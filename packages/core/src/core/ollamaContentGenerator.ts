/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
  Part,
  Content,
  PartListUnion,
} from '@google/genai';
import { FinishReason } from '@google/genai';
import { partListUnionToString } from './geminiRequest.js';
import type { ContentGenerator } from './contentGenerator.js';
import { getErrorMessage } from '../utils/errors.js';
import { toContents } from '../code_assist/converter.js';

type OllamaOptions = {
  baseUrl: string;
  model: string;
};

interface OllamaRequestConfig {
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
  systemInstruction?: string | Content;
}

interface OllamaResponse {
  choices?: Array<{
    message?: { content?: string };
    delta?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OllamaContentGenerator implements ContentGenerator {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OllamaOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.model = options.model;
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const contents = toContents(request.contents || []);
    const requestConfig = (
      request as unknown as { config?: OllamaRequestConfig }
    ).config;
    const genConfig = requestConfig?.generationConfig;
    const systemInstruction = requestConfig?.systemInstruction;

    const messages = [
      ...(systemInstruction
        ? [
            {
              role: 'system',
              content:
                typeof systemInstruction === 'string'
                  ? systemInstruction
                  : this.partsToContent(
                      (systemInstruction as Content)?.parts || [],
                    ),
            },
          ]
        : []),
      ...this.toOpenAiMessages(contents),
    ];

    const body = {
      model: request.model || this.model,
      messages,
      stream: false,
      temperature: genConfig?.temperature,
      top_p: genConfig?.topP,
      max_tokens: genConfig?.maxOutputTokens,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama request failed (${response.status}): ${await response.text()}`,
      );
    }

    const data = await response.json();
    return this.fromOpenAiResponse(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const resp = await this.generateContent(request, userPromptId);
    async function* stream(): AsyncGenerator<GenerateContentResponse> {
      yield resp;
    }
    return stream();
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    const contents = toContents(request.contents || []);
    const allParts: Part[] = contents.flatMap((c) => c.parts || []);
    const text = partListUnionToString(allParts as unknown as PartListUnion);
    const estimatedTokens = Math.max(1, Math.ceil(text.length / 4));
    return {
      totalTokens: estimatedTokens,
    } as CountTokensResponse;
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('Embedding is not supported for Ollama backends yet.');
  }

  private toOpenAiMessages(contents: Content[]) {
    return contents.map((content) => ({
      role: content.role === 'user' ? 'user' : 'assistant',
      content: this.partsToContent(content.parts || []),
    }));
  }

  private partsToContent(parts: Part[]): string {
    return parts
      .map((part) => {
        if (part.text) return part.text;
        if (part.functionCall) {
          return `Function call ${part.functionCall.name}: ${JSON.stringify(part.functionCall.args ?? {})}`;
        }
        if (part.functionResponse) {
          return `Function response ${part.functionResponse.name}: ${JSON.stringify(part.functionResponse.response ?? {})}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  private fromOpenAiResponse(data: OllamaResponse): GenerateContentResponse {
    const choice = data?.choices?.[0];
    const text: string =
      choice?.message?.content ??
      choice?.delta?.content ??
      getErrorMessage(choice);
    const finishReason =
      choice?.finish_reason === 'length'
        ? FinishReason.MAX_TOKENS
        : FinishReason.STOP;

    const response: GenerateContentResponse = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text }],
          },
          finishReason,
        },
      ],
      usageMetadata: data?.usage
        ? {
            promptTokenCount: data.usage.prompt_tokens,
            candidatesTokenCount: data.usage.completion_tokens,
            totalTokenCount: data.usage.total_tokens,
          }
        : undefined,
    } as GenerateContentResponse;

    return response;
  }
}
