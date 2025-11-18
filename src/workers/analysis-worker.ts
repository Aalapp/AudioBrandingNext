import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/db';
import {
  generateConversationSnapshot,
  updateProjectSnapshot,
} from '../lib/snapshots';
import {
  buildExploratoryPrompt,
  callPerplexityExploratory,
  parseExploratoryResponse,
  PerplexityMessage,
  EXPLORATORY_SYSTEM_PROMPT,
  EXPLORATORY_RESPONSE_FORMAT,
} from '../lib/perplexity';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
});

export interface ExploratoryAnalysisJob {
  analysisId: string;
  projectId: string;
  seedPrompt?: string;
}

/**
 * Process exploratory analysis job
 */
export async function processExploratoryAnalysis(
  job: Job<ExploratoryAnalysisJob>
) {
  const { analysisId, projectId, seedPrompt } = job.data;

  try {
    // Update status to running
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'running' },
    });

    // Generate conversation snapshot
    const snapshot = await generateConversationSnapshot(projectId);

    // Build prompt
    const prompt = buildExploratoryPrompt(snapshot, seedPrompt);

    // Call Perplexity API
    const messages: PerplexityMessage[] = [
      {
        role: 'system',
        content: EXPLORATORY_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const perplexityResponse = await callPerplexityExploratory(messages, {
      responseFormat: EXPLORATORY_RESPONSE_FORMAT,
      temperature: 0.35,
      maxTokens: 4500,
    });

    // Parse response
    const findings = parseExploratoryResponse(perplexityResponse);

    // Update analysis with response
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        responseJson: findings,
        status: 'done',
        finishedAt: new Date(),
      },
    });

    // Update project findingsDraft
    await prisma.project.update({
      where: { id: projectId },
      data: {
        findingsDraft: findings,
        lastActivityAt: new Date(),
      },
    });

    // Create assistant message with findings summary
    await prisma.message.create({
      data: {
        projectId,
        senderId: null, // System/LLM message
        role: 'assistant',
        content: {
          type: 'analysis_complete',
          summary: 'Exploratory analysis completed',
          findings: findings,
        },
      },
    });

    // Update snapshot
    await updateProjectSnapshot(projectId);

    console.log(`Exploratory analysis completed for project ${projectId}`);
  } catch (error: any) {
    console.error(`Error processing exploratory analysis ${analysisId}:`, error);

    // Update analysis with failure
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'failed',
        failureReason: error.message || 'Unknown error',
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Create analysis worker
 */
export function createAnalysisWorker() {
  const worker = new Worker<ExploratoryAnalysisJob>(
    'analysis',
    async (job) => {
      if (job.name === 'exploratory-analysis') {
        return processExploratoryAnalysis(job);
      }
      throw new Error(`Unknown job type: ${job.name}`);
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
}

