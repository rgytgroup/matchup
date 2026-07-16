/**
 * Interfaz del proveedor de IA de análisis (Gemini por defecto).
 * Devuelve TEXTO JSON crudo; la validación contra el schema vive en AnalysisService.
 */
export const ANALYSIS_PROVIDER = Symbol('ANALYSIS_PROVIDER');

export interface AnalysisProvider {
  generateReportJson(prompt: string, photoUrls: string[]): Promise<string>;
  moderate(prompt: string, photoUrls: string[]): Promise<string>;
}
