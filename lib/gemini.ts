import { GoogleGenAI, Type } from "@google/genai";

// Export interface so that it can be used throughout the app
export interface GeminiAnalysisResult {
  extractedText: string;
  tags: string[];
  summary: string;
}

// Global request queue and rate-limiting throttler to enforce 4 RPM max (limit is 5 RPM)
const requestQueue: (() => void)[] = [];
let queueProcessing = false;
let requestTimestamps: number[] = [];

async function acquireToken(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestQueue.push(resolve);
    processQueue();
  });
}

function processQueue() {
  if (queueProcessing || requestQueue.length === 0) return;
  queueProcessing = true;

  const runNext = async () => {
    if (requestQueue.length === 0) {
      queueProcessing = false;
      return;
    }

    const now = Date.now();
    // Filter timestamps to only keep those within the last 60 seconds
    requestTimestamps = requestTimestamps.filter(t => t > now - 60000);

    // Keep requests strictly at max 4 per minute (safer than 5) to prevent RESOURCE_EXHAUSTED
    if (requestTimestamps.length < 4) {
      const resolve = requestQueue.shift();
      if (resolve) {
        requestTimestamps.push(Date.now());
        resolve();
      }
      setTimeout(runNext, 50);
    } else {
      const oldest = requestTimestamps[0];
      const waitTime = (oldest + 60000) - now;
      console.log(`[Gemini Throttler] Dynamic Pace Protection: Waiting for ${Math.ceil(waitTime / 1000)}s to stay within Gemini API free-tier quotas...`);
      setTimeout(runNext, Math.max(100, waitTime));
    }
  };

  runNext();
}

function isRateLimitError(error: any): boolean {
  if (!error) return false;
  const errMsg = String(error.message || error);
  if (
    errMsg.includes('429') || 
    errMsg.includes('RESOURCE_EXHAUSTED') || 
    errMsg.includes('quota') || 
    errMsg.includes('Quota') ||
    errMsg.includes('rate limit')
  ) {
    return true;
  }
  try {
    const errStr = JSON.stringify(error);
    if (
      errStr.includes('429') || 
      errStr.includes('RESOURCE_EXHAUSTED') || 
      errStr.includes('quota') || 
      errStr.includes('Quota')
    ) {
      return true;
    }
  } catch (_) {}
  return false;
}

function isDailyQuotaExhaustedError(error: any): boolean {
  if (!error) return false;
  const errMsg = String(error.message || error);
  if (
    errMsg.includes('GenerateRequestsPerDay') || 
    errMsg.includes('free_tier_requests') ||
    errMsg.includes('limit: 20')
  ) {
    return true;
  }
  try {
    const errStr = JSON.stringify(error);
    if (
      errStr.includes('GenerateRequestsPerDay') || 
      errStr.includes('free_tier_requests') ||
      errStr.includes('limit: 20')
    ) {
      return true;
    }
  } catch (_) {}
  return false;
}

function getRetryDelay(error: any): number {
  let delayMs = 15000; // 15 seconds default fallback

  try {
    const errMsg = String(error.message || error);
    const match = errMsg.match(/retry in ([\d.]+)\s*s/i);
    if (match && match[1]) {
      const waitSec = parseFloat(match[1]);
      if (!isNaN(waitSec) && waitSec > 0) {
        return Math.ceil(waitSec * 1000) + 1000; // Adding 1 second padding
      }
    }

    const errObj = typeof error === 'object' ? error : null;
    const details = errObj?.details || errObj?.error?.details;
    if (Array.isArray(details)) {
      for (const detail of details) {
        if (detail?.retryDelay) {
          const sec = parseFloat(detail.retryDelay);
          if (!isNaN(sec) && sec > 0) {
            return Math.ceil(sec * 1000) + 1000;
          }
        }
      }
    }
  } catch (e) {
    console.error('[Gemini Retry] Failed parsing retryDelay:', e);
  }

  return delayMs;
}

export async function processScreenshotWithAI(base64Image: string, mimeType: string, model: string = "gemini-3.5-flash", language: string = "id", customApiKey?: string, customPrompt?: string): Promise<GeminiAnalysisResult> {
  const resolvedApiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!resolvedApiKey) {
    throw new Error('API_KEY_MISSING: Gemini API Key is missing. Please provide one in the settings.');
  }

  const ai = new GoogleGenAI({
    apiKey: resolvedApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: mimeType,
    },
  };

  const promptText = customPrompt?.trim()
    ? `${customPrompt.trim()} STRICTLY return a JSON object matching the required structure. Language: ${language}.`
    : `Analyze this screenshot. STRICTLY return a JSON object matching the required structure. Language: ${language}.`;

  const promptPart = {
    text: promptText,
  };

  const systemInstruction = "You are LensKeep, an advanced OCR and Visual Analysis Engine. Your primary job is to extract text with perfect accuracy and provide an insightful, concise context about the image. CRITICAL: You must strictly use the language provided by the user in the prompt (id or en).";

  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    await acquireToken();

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: [imagePart, promptPart],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedText: {
                type: Type.STRING,
                description: "string (the exact raw text found in the image. If no text, return an empty string)",
              },
              summary: {
                type: Type.STRING,
                description: "string (a concise 2-3 sentence description of the visual context)",
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Generate exactly 3 to 5 relevant lowercase tags, e.g., 'meme', 'receipt', 'code'",
              },
            },
            required: ["extractedText", "summary", "tags"],
          },
        },
      });

      const textResponse = response.text;
      if (!textResponse) {
        throw new Error("No response text received from Gemini.");
      }

      const data = JSON.parse(textResponse.trim()) as GeminiAnalysisResult;
      return data;
    } catch (error: any) {
      console.error(`[Gemini Throttler] Request attempt ${attempt}/${maxAttempts} failed:`, error);
      
      const errMsg = String(error.message || error);
      
      // Abort retry logic early if the API key is completely invalid or unauthorized to prevent 5 extra attempts
      if (
        errMsg.toLowerCase().includes('403') || 
        errMsg.toLowerCase().includes('401') || 
        errMsg.toLowerCase().includes('api_key_invalid') ||
        errMsg.toLowerCase().includes('not a valid api key')
      ) {
        throw new Error('API_KEY_INVALID: Your Gemini API Key is invalid or unauthorized.');
      }

      if (isDailyQuotaExhaustedError(error)) {
        throw new Error(`GEMINI_QUOTA_EXHAUSTED: You exceeded your daily free tier limit for model '${model}'. Please activate a paid API key or switch to a different model in the settings.`);
      }

      const isRateLimit = isRateLimitError(error);
      const isTransient = error?.status === 500 || error?.status === 503 || String(error).includes('503') || String(error).includes('500');

      if (isRateLimit) {
        // Enforce quota exceeded feedback immediately if it's candidate for failure 
        if (attempt >= maxAttempts) {
          throw new Error(`GEMINI_QUOTA_EXHAUSTED: You exceeded your quota for model '${model}'. Please activate a paid API key or switch to a different model in the settings.`);
        }
        const baseDelay = getRetryDelay(error);
        const backoffDelay = Math.ceil(baseDelay * Math.pow(1.3, attempt - 1) + Math.random() * 3000);
        console.warn(`[Gemini Retry] Throttled error hit. Queueing automatic retry ${attempt + 1}/${maxAttempts} in ${Math.round(backoffDelay / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else if (isTransient && attempt < maxAttempts) {
        const baseDelay = 3000;
        const backoffDelay = Math.ceil(baseDelay * Math.pow(1.5, attempt - 1) + Math.random() * 1000);
        console.warn(`[Gemini Retry] Transient error hit. Queueing automatic retry ${attempt + 1}/${maxAttempts} in ${Math.round(backoffDelay / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Failed to process screenshot using ${model} after maximum Gemini retries.`);
}
