import { httpInvoke } from './api-client';

export interface ExternalTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  promptText: string;
  language: string;
  author: string;
  originalSourceUrl: string;
  argumentsJson: string;
  source: string;
  sourceLicense: string;
}

export async function importExternalTemplates() {
  return await httpInvoke<{ imported: number; total: number }>('visual_import_external_templates', {});
}

export async function getExternalTemplates() {
  return await httpInvoke<ExternalTemplate[]>('visual_search_templates', {});
}
