import { describe, it, expect } from 'vitest';
import { fetchDailySeries } from '../../services/nasaPower';

const shouldRunLiveTest = process.env.RUN_LIVE_TESTS === 'true';

describe('Live NASA POWER API Integration Test', () => {
  it.skipIf(!shouldRunLiveTest)(
    'fetches live multi-year daily records directly from NASA POWER endpoint',
    async () => {
      // Test with a 1-month range to keep live verification fast
      const series = await fetchDailySeries({
        startApiFormat: '20230101',
        endApiFormat: '20230131',
        maxRetries: 1
      });

      expect(series.tier).toBe('live');
      expect(series.dates.length).toBe(31);
      expect(series.t2m[0]).not.toBeNull();
      expect(typeof series.t2m[0]).toBe('number');
    },
    20000
  );
});
