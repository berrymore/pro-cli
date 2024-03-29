export interface Template {
  destination: string;
  source?: string;
  content?: string;
}

export interface TemplateRenderer {
  render(path: string, context?: object): Promise<string>;

  renderString(content: string, context?: object): Promise<string>;

  renderTemplates(templates: Template[], context?: object): Promise<Template[]>;
}
