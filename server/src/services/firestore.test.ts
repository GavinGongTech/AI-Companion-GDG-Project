import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockBatch } = vi.hoisted(() => {
  const mockDb = {
    collection: vi.fn(),
    doc: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    count: vi.fn(),
    batch: vi.fn(),
    id: '',
  };

  mockDb.collection.mockReturnValue(mockDb);
  mockDb.doc.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.orderBy.mockReturnValue(mockDb);
  mockDb.limit.mockReturnValue(mockDb);
  mockDb.startAfter.mockReturnValue(mockDb);
  mockDb.count.mockReturnValue(mockDb);

  const mockBatch = {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(true),
  };
  mockDb.batch.mockReturnValue(mockBatch);

  return { mockDb, mockBatch };
});

vi.mock('../db/firebase', () => ({
  db: mockDb,
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
  },
}));

import { saveInteraction, saveClientEvent, ensureUserDoc } from './firestore';

describe('firestore service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the default return values for the mock
    mockDb.collection.mockReturnValue(mockDb);
    mockDb.doc.mockReturnValue(mockDb);
  });

  describe('saveInteraction', () => {
    it('should save interaction to per-user and global collections', async () => {
      const uid = 'user123';
      const params = {
        courseId: 'course1',
        content: 'test content',
        eventType: 'explain',
        response: { answer: 'text' },
        classifierTag: { conceptNode: 'A', errorType: 'B', confidence: 0.9 },
        requestMeta: { ip: '127.0.0.1' }
      };

      // Set ID property without breaking methods
      mockDb.id = 'event-id';

      const result = await saveInteraction(uid, params);

      expect(result).toBe('event-id');
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('saveClientEvent', () => {
    it('should save client event', async () => {
      const uid = 'user123';
      const params = {
        eventType: 'login',
        content: 'user logged in',
        meta: { method: 'google' },
        requestMeta: { userAgent: 'browser' }
      };
      mockDb.id = 'client-event-id';

      const result = await saveClientEvent(uid, params);

      expect(result).toBe('client-event-id');
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('ensureUserDoc', () => {
    it('should create user doc if it does not exist', async () => {
      const uid = 'user123';
      const email = 'test@example.com';
      const displayName = 'Test User';
      
      mockDb.get.mockResolvedValue({ exists: false });

      await ensureUserDoc(uid, email, displayName);

      expect(mockDb.set).toHaveBeenCalledWith({
        email,
        displayName,
        createdAt: 'mock-timestamp',
      });
    });

    it('should not create user doc if it already exists', async () => {
      mockDb.get.mockResolvedValue({ exists: true });

      await ensureUserDoc('uid', 'email', 'name');

      expect(mockDb.set).not.toHaveBeenCalled();
    });
  });
});
