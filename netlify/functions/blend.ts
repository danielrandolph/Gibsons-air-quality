import type { Handler } from '@netlify/functions';
import { blend, type SourceReading } from '../../src/blend';
import { handler as purpleAirHandler } from './purpleair';
import { handler as iqairHandler } from './iqair';
import { handler as aqhiHandler } from './aqhi';
import { handler as openaqHandler } from './openaq';

async function invoke(fn: Handler): Promise<SourceReading> {
  const result = await fn({} as any, {} as any, undefined as any);
  const res = result as { body: string };
  return JSON.parse(res.body);
}

export const handler: Handler = async () => {
  const [purpleair, iqair, aqhi, openaq] = await Promise.all([
    invoke(purpleAirHandler),
    invoke(iqairHandler),
    invoke(aqhiHandler),
    invoke(openaqHandler),
  ]);

  const result = blend([purpleair, iqair, aqhi, openaq]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...result, generatedAt: new Date().toISOString() }),
  };
};
