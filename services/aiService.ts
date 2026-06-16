import { GoogleGenAI } from "@google/genai";

/**
 * 获取 API Key 的安全方法
 * 优先从 LocalStorage 获取（用户手动输入），其次从环境变量获取
 */
const getApiKey = () => {
  // 1. Try local storage (User provided)
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('filmlog_gemini_key') : null;
  if (localKey) return localKey;

  // 2. Try Environment Variable (Build/Deploy time configuration)
  const envKey = process.env.API_KEY;
  
  if (!envKey) {
    console.warn("Gemini API Key is missing in both LocalStorage and Environment Variables.");
  }
  return envKey || "";
};

export const aiService = {
  /**
   * 建议拍摄笔记
   */
  async suggestShootingNotes(filmModel: string, location: string, format: string): Promise<string> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API_KEY_MISSING");

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `你是一位专业的摄影师。用户正在使用 ${filmModel} 胶片（${format} 画幅）在 ${location || '户外'} 拍摄。请根据胶片特性和环境，提供 3 条简短、专业的拍摄建议或预设思路（如曝光补偿、光影捕捉等）。语言请简洁，控制在 100 字以内。`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      return response.text || '';
    } catch (error) {
      console.error("AI Suggestion Error:", error);
      throw error;
    }
  },

  /**
   * 建议冲洗参数
   */
  async suggestDevNotes(filmModel: string, developer: string, method: string): Promise<string> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API_KEY_MISSING");

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `胶片型号：${filmModel}，显影液：${developer || '未指定'}，冲洗方式：${method}。请提供该组合的专业冲洗建议，包括可能的迫冲建议、摇晃频率的影响或注意事项。语言请简洁，100 字以内。`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      return response.text || '';
    } catch (error) {
      console.error("AI Dev Suggestion Error:", error);
      throw error;
    }
  }
};