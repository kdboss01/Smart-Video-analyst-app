import { GoogleGenAI, Type } from "@google/genai";
import { MeetingAnalysisResult, SpeakerSegment, ActionItem, SentimentPoint } from "../types";

// Helper to convert file to Base64 (Keep for small images)
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getAiClient = () => {
    // @ts-ignore
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
}

// Helper to upload file using Files API (Supports large files > 2GB)
const uploadMediaFile = async (file: File, onProgress?: (status: string) => void): Promise<{uri: string, mimeType: string}> => {
    const ai = getAiClient();
    
    if (onProgress) onProgress("Uploading media to safe storage...");
    
    try {
        // Upload the file
        const uploadResult = await ai.files.upload({
            file: file,
            config: { 
                displayName: file.name, 
                mimeType: file.type 
            }
        });

        // Handle variable API response structure (wrapped in .file or direct)
        // @ts-ignore
        let fileData = uploadResult.file ?? uploadResult;

        // Validating the upload response
        if (!fileData || !fileData.name || !fileData.uri) {
            console.error("Invalid upload response:", uploadResult);
            throw new Error("Upload failed: Invalid response from Gemini API.");
        }
        
        // Poll for active state (required for videos/large audio)
        while (fileData.state === "PROCESSING") {
            if (onProgress) onProgress("Processing media file (this may take a moment)...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
                const getResult = await ai.files.get({ name: fileData.name });
                // @ts-ignore
                fileData = getResult.file ?? getResult;
            } catch (e) {
                console.warn("Error polling file status, retrying...", e);
                // Continue polling even if one request fails
            }
        }

        if (fileData.state === "FAILED") {
            throw new Error("File processing failed on Gemini servers.");
        }
        
        if (!fileData.uri) {
            throw new Error("File processing incomplete: Missing URI.");
        }

        return { uri: fileData.uri, mimeType: fileData.mimeType || file.type };
    } catch (error) {
        console.error("Media upload error:", error);
        throw error;
    }
};

// 1. COMPLEX ANALYSIS (Video Understanding + Thinking Mode)
// Uses Gemini 3 Pro Preview
export const analyzeMeetingMedia = async (file: File, onProgress?: (status: string) => void): Promise<MeetingAnalysisResult> => {
  const ai = getAiClient();
  
  // Use Files API for meeting media to support large files (500MB+)
  const { uri, mimeType } = await uploadMediaFile(file, onProgress);

  if (onProgress) onProgress("Deep Thinking & Analysis...");

  // Schema for structured output
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A professional title for the meeting." },
      summary: { type: Type.STRING, description: "A comprehensive executive summary." },
      keyDecisions: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "List of key decisions made." 
      },
      transcript: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            speaker: { type: Type.STRING },
            timestamp: { type: Type.STRING, description: "Format HH:MM:SS" },
            text: { type: Type.STRING }
          }
        }
      },
      actionItems: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            task: { type: Type.STRING },
            owner: { type: Type.STRING },
            status: { type: Type.STRING, enum: ['Pending', 'In Progress', 'Done'] },
            dueDate: { type: Type.STRING }
          }
        }
      },
      sentimentData: {
        type: Type.ARRAY,
        description: "Analyze the sentiment flow of the meeting at 1-minute intervals.",
        items: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING },
            score: { type: Type.NUMBER, description: "Float between -1.0 (Negative) and 1.0 (Positive)" },
            mood: { type: Type.STRING }
          }
        }
      },
      topics: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["title", "summary", "transcript", "actionItems", "sentimentData", "topics"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // MUST use 3 Pro for Video + Thinking
    contents: {
      parts: [
        { 
            fileData: { 
                fileUri: uri, 
                mimeType: mimeType 
            } 
        },
        {
          text: `Analyze this meeting recording. 
          1. Provide a full transcript with speaker diarization (e.g., Speaker 1, Speaker 2).
          2. Generate a high-quality summary and extract action items.
          3. Analyze the visual context if video is provided (e.g., slides shown, screen sharing content) and incorporate into the notes.
          4. Perform sentiment analysis over time.
          5. Return ONLY JSON matching the schema.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      thinkingConfig: { thinkingBudget: 32768 }, // MUST use thinking mode for complex queries
      // Do not set maxOutputTokens when using thinking budget as per instructions
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  try {
    return JSON.parse(text) as MeetingAnalysisResult;
  } catch (e) {
    console.error("Failed to parse JSON", text);
    throw new Error("Failed to parse analysis results.");
  }
};

// 2. FAST CHAT (Low Latency)
// Uses Gemini 2.5 Flash Lite
export const chatWithMeetingContext = async (
  history: {role: string, content: string}[], 
  newMessage: string, 
  contextData: string
): Promise<string> => {
  const ai = getAiClient();
  
  // System instruction to act as a helpful assistant with context
  const systemInstruction = `You are a helpful meeting assistant. Answer questions based on the following meeting context data: 
  ${contextData.substring(0, 30000)}... (truncated if too long). 
  Be concise and helpful.`;

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash-lite', // MUST use Flash Lite for fast responses
    config: {
      systemInstruction: systemInstruction,
    },
    history: history.map(h => ({ role: h.role, parts: [{ text: h.content }] }))
  });

  const result = await chat.sendMessage({ message: newMessage });
  return result.text || "I couldn't generate a response.";
};

// 3. RESEARCH (Search Grounding)
// Uses Gemini 2.5 Flash + Google Search
export const researchTopic = async (query: string): Promise<{text: string, sources: any[]}> => {
  const ai = getAiClient();
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // MUST use Flash for search
    contents: query,
    config: {
      tools: [{ googleSearch: {} }] // MUST use Google Search tool
    }
  });

  const text = response.text || "No results found.";
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  return { text, sources };
};

// 4. IMAGE ANALYSIS
// Uses Gemini 3 Pro Image Preview
export const analyzeUploadedImage = async (file: File): Promise<string> => {
  const ai = getAiClient();
  const imgPart = await fileToGenerativePart(file);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview', // MUST use Pro Image Preview
    contents: {
      parts: [
        imgPart,
        { text: "Detailed analysis of this image content, text, and visual elements." }
      ]
    }
  });

  return response.text || "Could not analyze image.";
};
