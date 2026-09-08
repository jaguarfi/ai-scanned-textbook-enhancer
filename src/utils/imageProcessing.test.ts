import { describe, expect, it } from 'vitest';
import { calculateHashSimilarity, findDuplicatePairs, formatBytes } from './imageProcessing';
import { EnhancedImageItem } from '../types';

describe('imageProcessing', () => {
  it('calculates a percentage similarity from two hashes', () => {
    expect(calculateHashSimilarity('11111111', '11111111')).toBe(100);
    expect(calculateHashSimilarity('11111111', '00000000')).toBe(0);
    expect(calculateHashSimilarity('11110000', '11111111')).toBe(50);
  });

  it('formats byte sizes readably', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('finds duplicates using perceptual similarity and preserves the better image', () => {
    const images: EnhancedImageItem[] = [
      {
        id: 'a',
        name: 'original.png',
        fileType: 'image/png',
        originalUrl: 'a',
        originalWidth: 1200,
        originalHeight: 800,
        originalSize: 1200,
        status: 'idle',
        progress: 0,
        dHash: '1111111111111111111111111111111111111111111111111111111111111111',
        createdAt: 1,
      },
      {
        id: 'b',
        name: 'copy.png',
        fileType: 'image/png',
        originalUrl: 'b',
        originalWidth: 1000,
        originalHeight: 700,
        originalSize: 1000,
        status: 'enhanced',
        progress: 100,
        dHash: '1111111111111111111111111111111111111111111111111111111111111111',
        createdAt: 2,
      },
      {
        id: 'c',
        name: 'different.png',
        fileType: 'image/png',
        originalUrl: 'c',
        originalWidth: 800,
        originalHeight: 600,
        originalSize: 500,
        status: 'idle',
        progress: 0,
        dHash: '0000000000000000000000000000000000000000000000000000000000000000',
        createdAt: 3,
      },
    ];

    const duplicates = findDuplicatePairs(images, 82);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].recommendedKeepId).toBe('b');
    expect(duplicates[0].reason).toContain('already AI enhanced');
    expect(duplicates[0].similarity).toBe(100);
  });
});
