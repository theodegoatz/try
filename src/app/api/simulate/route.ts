import type { NextRequest } from 'next/server';
import { initializeBracket } from '@/lib/bracket';
import { runSimulation, getProvider } from '@/lib/simulation';
import { SimulationEvent } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  const provider = getProvider();

  if (!provider) {
    const msg = [
      'No AI provider configured.',
      'Option 1 (FREE): Get a Google Gemini key at https://aistudio.google.com/app/apikey — add GEMINI_API_KEY to .env.local',
      'Option 2 (Paid): Get an Anthropic key at https://console.anthropic.com — add ANTHROPIC_API_KEY to .env.local',
    ].join(' ');

    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SimulationEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        const bracket = initializeBracket();

        send({
          type: 'status',
          message: `Bracket initialized. Starting simulation with ${provider === 'gemini' ? 'Google Gemini 2.0 Flash (free)' : 'Anthropic Claude Haiku'}...`,
          bracketState: bracket,
        });

        for await (const event of runSimulation(bracket)) {
          send(event);

          if (event.type === 'simulation_complete') {
            break;
          }
        }
      } catch (error) {
        send({
          type: 'error',
          message: `Simulation failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
