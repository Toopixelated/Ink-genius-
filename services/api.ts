
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { openDB, type IDBPDatabase } from 'idb';
import type { InkGeniusDB } from '../types';

// === DATABASE SERVICE ===
class DatabaseService {
  private dbPromise: Promise<IDBPDatabase<InkGeniusDB>>;
  
  constructor() {
    this.dbPromise = openDB<InkGeniusDB>('inkgenius-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('designs')) {
          const store = db.createObjectStore('designs', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
        }
      }
    });
  }
  
  async saveDesign(design: Omit<InkGeniusDB['designs']['value'], 'id' | 'timestamp'>) {
    const db = await this.dbPromise;
    const id = Date.now().toString();
    const designData = {
      id,
      ...design,
      timestamp: new Date().toISOString()
    };
    await db.put('designs', designData);
    return id;
  }
  
  async loadDesign(id: string) {
    const db = await this.dbPromise;
    return db.get('designs', id);
  }
  
  async getAllDesigns() {
    const db = await this.dbPromise;
    return db.getAllFromIndex('designs', 'timestamp');
  }
  
  async deleteDesign(id: string) {
    const db = await this.dbPromise;
    await db.delete('designs', id);
  }
}

export const dbService = new DatabaseService();

// === AI SERVICE ===
class TattooAIService {
  private ai: GoogleGenAI;
  
  constructor(apiKey: string) {
    if (!apiKey) {
        throw new Error("API_KEY is not set. Please set it in your environment variables.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateDesign(prompt: string, style: string, imageData?: { data: string, mimeType: string }) {
    const enhancedPrompt = `A high-quality, professional tattoo design in a ${style} style. The subject is: "${prompt}". The design should have clean, bold lines suitable for a stencil, with appropriate shading for the specified style. The background should be solid white.`;
    
    // For now, as we don't have a model that takes image and text to generate a new image, we will only use text prompt
    const response = await this.ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: enhancedPrompt,
        config: {
            numberOfImages: 1,
            aspectRatio: '1:1',
            outputMimeType: 'image/png'
        }
    });
    
    if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64ImageBytes}`;
    } else {
        throw new Error('AI failed to generate a design.');
    }
  }

  async convertToStencil(imageData: { data: string, mimeType: string }) {
    const prompt = `Convert this image to a clean, black and white tattoo stencil. Remove all colors and shading, keeping only the essential black outlines. The lines must be bold and clear, suitable for transferring onto skin. The output must be an image.`;

    const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [
                { inlineData: { data: imageData.data, mimeType: imageData.mimeType } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePart?.inlineData) {
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    } else {
        throw new Error('Failed to convert image to stencil. The model did not return an image.');
    }
  }

  async suggestPlacement(designDescription: string, bodyPart: string) {
    const prompt = `For a tattoo described as "${designDescription}" to be placed on the ${bodyPart}, provide expert advice.`;
    
    const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    size: { type: Type.STRING, description: "Optimal size recommendations (e.g., '3-4 inches')." },
                    placement: { type: Type.STRING, description: "Specific placement advice considering anatomy and visibility." },
                    adjustments: { type: Type.STRING, description: "Any suggested design adjustments for that body part." },
                    painLevel: { type: Type.INTEGER, description: "Expected pain level on a scale of 1-10." },
                    healing: { type: Type.STRING, description: "Key healing considerations for the area." }
                }
            }
        },
    });
    
    return JSON.parse(response.text);
  }
}

export const aiService = new TattooAIService(process.env.API_KEY || '');
