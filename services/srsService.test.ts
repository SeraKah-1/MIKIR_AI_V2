
import { describe, it, expect } from 'vitest';
import { NeuroSync } from './srsService';
import { SRSItem } from '../types';

describe('NeuroSync SRS Algorithm', () => {
  it('should reset repetition and interval when rating is 0 (Lupa)', () => {
    const mockItem: SRSItem = {
      keycard_id: 'test-keycard',
      item_id: 'test-item',
      item_type: 'quiz_question',
      content: {},
      easiness: 2.5,
      interval: 10,
      repetition: 5,
      next_review: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Rating 0 means "Again" (Lupa)
    const result = NeuroSync.calculateNextReview(mockItem, 0);

    expect(result.repetition).toBe(0);
    expect(result.interval).toBe(0);
    // Easiness should decrease when rating is 0
    expect(result.easiness).toBeLessThan(2.5);
  });
});
