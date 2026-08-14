import { describe, it, expect, vi, afterEach } from 'vitest';
import { latestService } from './latestService';
import * as classifier from '../query/queryClassifier';
import { sql } from '../../config/services';
import z from 'zod';

vi.mock('../query/queryClassifier', () => ({
  classifyQueryFields: vi.fn(),
  buildWhereClause: vi.fn(),
}));
vi.mock('../../config/services', () => ({
  sql: vi.fn(),
}));

describe('latestService', () => {
  const shape = {
    championFighting: z.string().optional(),
    championPlayed: z.string().optional(),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('queries and returns the latest game when both champion fields are provided', async () => {
    const parsed = { championFighting: 'Ahri', championPlayed: 'Yasuo' };
    const mockWhere = ['some_where_clause'];
    const mockWhereClause = 'WHERE condition';

    const mockClassify = vi.mocked(classifier.classifyQueryFields);
    const mockBuild = vi.mocked(classifier.buildWhereClause);
    const mockSql = vi.mocked(sql);

    mockClassify.mockReturnValue({ where: mockWhere, values: {} } as any);
    mockBuild.mockReturnValue(mockWhereClause as any);

    const mockGame = {
      match_id: 'NA1_123',
      game_creation: new Date(),
      champion_played: 'Yasuo',
      champion_fighting: 'Ahri',
      role: 'MID',
      kda: '5/2/3',
      is_win: true,
    };
    mockSql.mockResolvedValue([mockGame] as any);

    const result = await latestService(shape, parsed);

    expect(mockClassify).toHaveBeenCalledWith(shape, parsed);
    expect(mockBuild).toHaveBeenCalledWith(mockWhere);
    expect(mockSql).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      championFighting: 'Ahri',
      championPlayed: 'Yasuo',
      matchId: 'NA1_123',
    });
  });

  it('throws when no games found', async () => {
    const parsed = { championFighting: 'Ahri', championPlayed: 'Yasuo' };
    vi.mocked(classifier.classifyQueryFields).mockReturnValue({ where: [], values: {} } as any);
    vi.mocked(classifier.buildWhereClause).mockReturnValue('WHERE 1=1' as any);
    vi.mocked(sql).mockResolvedValue([] as any);

    await expect(latestService(shape, parsed)).rejects.toThrow();
  });
});