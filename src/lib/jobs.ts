import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
});

// Create queues
export const analysisQueue = new Queue('analysis', { connection: redis });
export const finalizeQueue = new Queue('finalize', { connection: redis });

/**
 * Get job status by ID
 */
export async function getJobStatus(queueName: 'analysis' | 'finalize', jobId: string) {
  const queue = queueName === 'analysis' ? analysisQueue : finalizeQueue;
  
  try {
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      name: job.name,
      state,
      progress,
      returnValue,
      failedReason,
      data: job.data,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    console.error(`Error getting job status for ${jobId}:`, error);
    return null;
  }
}

/**
 * Retry a failed job
 */
export async function retryJob(
  queueName: 'analysis' | 'finalize',
  jobId: string
): Promise<boolean> {
  const queue = queueName === 'analysis' ? analysisQueue : finalizeQueue;
  
  try {
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return false;
    }

    await job.retry();
    return true;
  } catch (error) {
    console.error(`Error retrying job ${jobId}:`, error);
    return false;
  }
}

/**
 * Check if a job is idempotent (already exists)
 */
export async function isJobIdempotent(
  queueName: 'analysis' | 'finalize',
  jobId: string
): Promise<boolean> {
  const queue = queueName === 'analysis' ? analysisQueue : finalizeQueue;
  
  try {
    const job = await queue.getJob(jobId);
    return job !== null;
  } catch (error) {
    return false;
  }
}

