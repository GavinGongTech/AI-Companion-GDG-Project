import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGamificationData, addXP, updateStreak } from './gamification';

const { mockDb, mockBatch, mockFieldValue } = vi.hoisted(() => {
  const mockDb = {
    collection: vi.fn(),
    doc: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    batch: vi.fn(),
  };
  const mockBatch = {
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(true),
  };
  mockDb.collection.mockReturnValue(mockDb);
  mockDb.doc.mockReturnValue(mockDb);
  mockDb.batch.mockReturnValue(mockBatch);

  return { 
    mockDb, 
    mockBatch,
    mockFieldValue: {
      increment: vi.fn((n) => ({ type: 'increment', value: n }))
    }
  };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: mockFieldValue
}));

describe('gamification service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collection.mockReturnValue(mockDb);
    mockDb.doc.mockReturnValue(mockDb);
  });

  describe('getGamificationData', () => {
    it('returns default data if user has no stats', async () => {
      mockDb.get.mockResolvedValue({ exists: false });
      const data = await getGamificationData('user1');
      expect(data.xp).toBe(0);
      expect(data.level).toBe(1);
      expect(data.achievements).toHaveLength(6);
      expect(data.achievements.every(a => !a.unlocked)).toBe(true);
    });

    it('calculates level and streak correctly', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({
          xp: 150,
          streak: 5,
          lastActivityDate: today,
          unlockedAchievements: ['first_quiz'],
          achievementDates: { first_quiz: '2023-01-01' }
        })
      });

      const data = await getGamificationData('user1');
      expect(data.level).toBe(2);
      expect(data.xpIntoLevel).toBe(50);
      expect(data.streak).toBe(5);
      expect(data.achievements.find(a => a.id === 'first_quiz')?.unlocked).toBe(true);
    });

    it('unlocks new achievements', async () => {
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({
          xp: 0,
          quizCount: 1, // Should unlock first_quiz
          unlockedAchievements: []
        })
      });

      const data = await getGamificationData('user1');
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ unlockedAchievements: expect.arrayContaining(['first_quiz']) }),
        { merge: true }
      );
      expect(data.achievements.find(a => a.id === 'first_quiz')?.unlocked).toBe(true);
    });

    it('handles errors gracefully', async () => {
      mockDb.get.mockRejectedValue(new Error('Firestore down'));
      const data = await getGamificationData('user1');
      expect(data.xp).toBe(0);
      expect(data.level).toBe(1);
    });
  });

  describe('addXP', () => {
    it('increments XP and lastActivity', async () => {
      await addXP('user1', 50, 'ask_question');
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          xp: { type: 'increment', value: 50 },
          lastActivity: expect.any(String)
        }),
        { merge: true }
      );
    });

    it('increments quizCount for quiz_correct reason', async () => {
      await addXP('user1', 10, 'quiz_correct');
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          quizCount: { type: 'increment', value: 1 }
        }),
        { merge: true }
      );
    });

    it('logs warning on failure', async () => {
      mockDb.set.mockRejectedValue(new Error('Write failed'));
      await addXP('user1', 50, 'test');
      // No crash
    });
  });

  describe('updateStreak', () => {
    it('increments streak if last activity was yesterday', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({ lastActivityDate: yesterday, streak: 3 })
      });

      await updateStreak('user1');

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          streak: 4,
          xp: { type: 'increment', value: 20 }
        }),
        { merge: true }
      );
    });

    it('sets streak to 1 if last activity was long ago', async () => {
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({ lastActivityDate: '2000-01-01', streak: 10 })
      });

      await updateStreak('user1');

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ streak: 1 }),
        { merge: true }
      );
    });

    it('does nothing if already active today', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockDb.get.mockResolvedValue({
        exists: true,
        data: () => ({ lastActivityDate: today })
      });

      await updateStreak('user1');

      expect(mockDb.set).not.toHaveBeenCalled();
    });

    it('logs warning on failure', async () => {
      mockDb.get.mockRejectedValue(new Error('Read failed'));
      await updateStreak('user1');
      // No crash
    });
  });
});
