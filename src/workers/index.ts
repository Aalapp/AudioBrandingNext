import { createAnalysisWorker } from './analysis-worker';
import { createFinalizeWorker } from './finalize-worker';

/**
 * Main worker entry point
 * Starts all background job workers
 */
export function startWorkers() {
  console.log('Starting background workers...');

  const analysisWorker = createAnalysisWorker();
  const finalizeWorker = createFinalizeWorker();

  console.log('Workers started successfully');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down workers...');
    await analysisWorker.close();
    await finalizeWorker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down workers...');
    await analysisWorker.close();
    await finalizeWorker.close();
    process.exit(0);
  });

  return {
    analysisWorker,
    finalizeWorker,
  };
}

// Start workers when this file is executed directly
// tsx will execute this when running: tsx src/workers/index.ts
startWorkers();

