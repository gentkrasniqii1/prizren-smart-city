import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { AIClassification } from '@prizren/shared-types';
import { parseAIClassification } from './ai-classification.schema';

const CLASSIFY_PROMPT = `You are a civic issue classifier for Prizren Smart City.
Analyze the report photo and optional citizen description.
Respond with ONLY valid JSON (no markdown) matching this shape:
{
  "category": "road_damage" | "lighting" | "waste" | "water" | "public_space" | "other",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": number between 0 and 1,
  "summary": string max 300 chars,
  "recommendedDepartment": string (Albanian municipal department name)
}`;

@Injectable()
export class AiClassificationService {
  private readonly logger = new Logger(AiClassificationService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    this.model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5-20251001';
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY missing — AI classification will no-op gracefully');
    }
  }

  async classifyReportPhoto(params: {
    photoUrl: string;
    description: string;
  }): Promise<AIClassification | null> {
    if (!this.client) {
      return null;
    }

    try {
      const image = await this.fetchImageAsBase64(params.photoUrl);
      if (!image) {
        return null;
      }

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mediaType,
                  data: image.data,
                },
              },
              {
                type: 'text',
                text: `${CLASSIFY_PROMPT}\n\nCitizen description:\n${params.description}`,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        this.logger.warn('Claude returned no text content');
        return null;
      }

      const parsedJson = this.extractJson(textBlock.text);
      const validated = parseAIClassification(parsedJson);
      if (!validated) {
        this.logger.warn(`Claude JSON failed Zod validation: ${textBlock.text.slice(0, 200)}`);
        return null;
      }
      return validated;
    } catch (error) {
      this.logger.error(
        `AI classification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private extractJson(text: string): unknown {
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  private async fetchImageAsBase64(
    url: string,
  ): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' } | null> {
    const res = await fetch(url);
    if (!res.ok) {
      this.logger.warn(`Failed to download report photo: HTTP ${res.status}`);
      return null;
    }
    const contentType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (!allowed.has(contentType)) {
      this.logger.warn(`Unsupported image content-type: ${contentType}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    // Cap ~4MB base64 payload safety
    if (buffer.byteLength > 4 * 1024 * 1024) {
      this.logger.warn('Report photo too large for vision request');
      return null;
    }
    return {
      data: buffer.toString('base64'),
      mediaType: contentType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
    };
  }
}
