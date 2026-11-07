declare module 'pdf-parse/lib/pdf-parse.js' {
  const pdfParse: (data: Buffer) => Promise<{ text: string; info?: Record<string, unknown>; numpages?: number }>;
  export default pdfParse;
}
