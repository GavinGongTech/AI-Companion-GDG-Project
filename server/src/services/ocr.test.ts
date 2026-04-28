import { describe, it, expect, vi, beforeEach } from 'vitest';
import vision from '@google-cloud/vision';
import { extractText, extractTextFromBase64, extractTextFromPDF } from './ocr';
import { readFile } from 'node:fs/promises';

vi.mock('@google-cloud/vision', () => {
  const textDetection = vi.fn();
  const documentTextDetection = vi.fn();
  return {
    default: {
      ImageAnnotatorClient: vi.fn().mockImplementation(function() {
        return {
          textDetection,
          documentTextDetection,
        };
      }),
    },
  };
});

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('ocr service', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new vision.ImageAnnotatorClient();
  });

  describe('extractText', () => {
    it('should extract text from an image path', async () => {
      const mockResult = [{
        textAnnotations: [{ description: 'Extracted text' }]
      }];
      mockClient.textDetection.mockResolvedValue(mockResult);

      const result = await extractText('/path/to/image.png');

      expect(result).toBe('Extracted text');
      expect(mockClient.textDetection).toHaveBeenCalledWith('/path/to/image.png');
    });

    it('should return empty string if no detections found', async () => {
      mockClient.textDetection.mockResolvedValue([{}]);
      const result = await extractText('/path/to/image.png');
      expect(result).toBe('');
    });
  });

  describe('extractTextFromBase64', () => {
    it('should extract text from base64 string', async () => {
      const mockResult = [{
        textAnnotations: [{ description: 'Base64 text' }]
      }];
      mockClient.textDetection.mockResolvedValue(mockResult);

      const result = await extractTextFromBase64('base64data');

      expect(result).toBe('Base64 text');
      expect(mockClient.textDetection).toHaveBeenCalledWith({
        image: { content: 'base64data' }
      });
    });
  });

  describe('extractTextFromPDF', () => {
    it('should extract text from a PDF path', async () => {
      const mockContent = Buffer.from('pdf content');
      vi.mocked(readFile).mockResolvedValue(mockContent);
      
      const mockResult = [{
        fullTextAnnotation: { text: 'PDF text' }
      }];
      mockClient.documentTextDetection.mockResolvedValue(mockResult);

      const result = await extractTextFromPDF('/path/to/doc.pdf');

      expect(result).toBe('PDF text');
      expect(readFile).toHaveBeenCalledWith('/path/to/doc.pdf');
      expect(mockClient.documentTextDetection).toHaveBeenCalledWith({
        image: { content: mockContent.toString('base64') }
      });
    });

    it('should return empty string if fullTextAnnotation is missing', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from('pdf content'));
      mockClient.documentTextDetection.mockResolvedValue([{}]);

      const result = await extractTextFromPDF('/path/to/doc.pdf');

      expect(result).toBe('');
    });
  });
});
