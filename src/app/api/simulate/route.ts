import type { NextRequest } from 'next/server';
import { initializeBracket } from '@/lib/bracket';
import { runSimulation } from '@/lib/simulation';
import { SimulationEvent } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.' })}\n\n`,
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
          message: 'Bracket initialized. Starting simulation...',
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
