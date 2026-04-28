import { describe, it, expect } from 'vitest';
import { shouldUseCourseRag } from './ragPolicy';

describe('ragPolicy service', () => {
  describe('shouldUseCourseRag', () => {
    it('should return false for null/undefined/empty input', () => {
      expect(shouldUseCourseRag(null)).toBe(false);
      expect(shouldUseCourseRag(undefined)).toBe(false);
      expect(shouldUseCourseRag('')).toBe(false);
      expect(shouldUseCourseRag('   ')).toBe(false);
    });

    it('should return true for long strings', () => {
      const longString = 'This is a very long string that should definitely trigger RAG because it is more than 24 characters long.';
      expect(shouldUseCourseRag(longString)).toBe(true);
    });

    it('should return false for short non-academic strings', () => {
      expect(shouldUseCourseRag('hello world')).toBe(false);
      expect(shouldUseCourseRag('hi')).toBe(false);
    });

    it('should return true for short academic strings matching regex', () => {
      expect(shouldUseCourseRag('solve integral')).toBe(true);
      expect(shouldUseCourseRag('derive this')).toBe(true);
      expect(shouldUseCourseRag('x^2 + y^2')).toBe(true);
      expect(shouldUseCourseRag('2 + 2')).toBe(true);
      expect(shouldUseCourseRag('theorem proof')).toBe(true);
    });

    it('should return true for short strings with math symbols', () => {
      expect(shouldUseCourseRag('∫x dx')).toBe(true);
      expect(shouldUseCourseRag('∑n')).toBe(true);
      expect(shouldUseCourseRag('√2')).toBe(true);
    });
  });
});
