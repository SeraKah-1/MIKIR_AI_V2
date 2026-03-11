
/**
 * ==========================================
 * GROQ CLOUD SERVICE (SMART CHUNKING + RAG)
 * ==========================================
 */

import { Question, QuizMode, ExamStyle, ModelOption } from "../types";
import { MikirCloud } from "./supabaseService";
import { getSupabaseConfig } from "./storageService";

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

export const fetchGroqModels = async (apiKey: string): Promise<ModelOption[]> => {
  try {
    const response = await fetch(GROQ_MODELS_URL, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) throw new Error("Gagal mengambil model Groq");

    const data = await response.json();
    
    // Transform Groq API response to ModelOption
    if (data && Array.isArray(data.data)) {
       return data.data
         .filter((m: any) => m && m.id && !m.id.includes('whisper')) // Exclude audio models & invalid
         .map((m: any) => ({
            id: m.id,
            label: m.id, // Use ID as label for now
            provider: 'groq',
            isVision: false 
         }))
         .sort((a: any, b: any) => a.id.localeCompare(b.id));
    }
    return [];
  } catch (error) {
    console.error("Groq Model Fetch Error:", error);
    return [];
  }
};

export const generateQuizGroq = async (
  apiKey: string,
  files: File[] | File | null,
  topic: string | undefined,
  modelId: string,
  questionCount: number,
  mode: QuizMode,
  examStyles: ExamStyle[] = [ExamStyle.C2_CONCEPT],
  onProgress: (status: string) => void,
  existingQuestionsContext: string[] = [],
  customPrompt: string = "" 
): Promise<{ questions: Question[], contextText: string }> => {

  const sbConfig = getSupabaseConfig();
  if (!sbConfig) {
    throw new Error("Supabase Config tidak ditemukan. Harap atur di Settings untuk menggunakan Groq RAG.");
  }

  onProgress("Menyiapkan dokumen untuk diproses di Cloud...");

  let filePath = null;
  const fileArray = Array.isArray(files) ? files : (files ? [files] : []);
  
  if (fileArray.length > 0) {
    const file = fileArray[0]; // For now, handle single file upload
    onProgress(`Mengunggah ${file.name} ke Supabase Storage...`);
    const uploadResult = await MikirCloud.storage.uploadFile(sbConfig, file);
    filePath = uploadResult.path;
  } else if (topic && topic.startsWith("uploads/") && topic.endsWith(".pdf")) {
    filePath = topic;
    topic = undefined;
  } else if (topic && topic.startsWith("https://generativelanguage.googleapis.com/v1beta/files/")) {
    throw new Error("Dokumen ini diunggah menggunakan Gemini. Harap gunakan model Gemini untuk membuat soal dari dokumen ini, atau unggah ulang dokumen untuk menggunakan Groq.");
  }

  onProgress("Memanggil Edge Function (generate-rag-quiz)...");

  try {
    const response = await MikirCloud.system.invokeEdgeFunction(sbConfig, 'generate-rag-quiz', {
      apiKey,
      filePath,
      topic,
      modelId,
      questionCount,
      mode,
      examStyles,
      customPrompt
    });

    if (!response || !response.questions) {
      throw new Error("Respon dari Edge Function tidak valid.");
    }

    const finalQuestions = response.questions.map((q: any, idx: number) => ({ ...q, id: idx + 1 }));
    return { questions: finalQuestions, contextText: response.contextText || "Processed via Edge Function" };
  } catch (error: any) {
    console.error("Groq Edge Function Error:", error);
    throw new Error(`Gagal membuat soal via Groq: ${error.message}`);
  }
};
