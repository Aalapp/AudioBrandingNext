import { Worker, Job } from 'bullmq';
import { prisma } from '../lib/db';
import { generateConversationSnapshot } from '../lib/snapshots';
import {
  buildRigidPrompt,
  callPerplexityRigid,
  RigidJSONResponse,
} from '../lib/perplexity-rigid';
import { composeMusic } from '../lib/elevenlabs';
import { generateJingleReportPDF } from '../lib/pdf-generator';
import Redis from 'ioredis';

/**
 * Sanitize prompt to avoid ElevenLabs ToS violations
 * Removes or rephrases financial/payment-related terms
 */
function sanitizeElevenLabsPrompt(prompt: string): string {
  // Replace financial/payment terms with neutral alternatives
  let sanitized = prompt;
  
  // Replace payment-related terms
  sanitized = sanitized.replace(/cash-register\s*['"]cha-ching['"]/gi, 'percussive chime');
  sanitized = sanitized.replace(/cha-ching/gi, 'bright chime');
  sanitized = sanitized.replace(/POS\s+systems?/gi, 'point-of-sale environments');
  sanitized = sanitized.replace(/transaction\s+jingle/gi, 'completion jingle');
  sanitized = sanitized.replace(/checkout\s+catalyst/gi, 'completion catalyst');
  sanitized = sanitized.replace(/\bcheckout\b/gi, 'completion');
  sanitized = sanitized.replace(/\bpayment\b/gi, 'completion');
  sanitized = sanitized.replace(/\bfinancial\b/gi, 'commercial');
  sanitized = sanitized.replace(/\btransaction\b/gi, 'completion');
  
  return sanitized.trim();
}

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required for BullMQ blocking operations
});

// Audio will be generated as 10 seconds based on composition_plan sections

export interface FinalizeJob {
  analysisId: string;
  projectId: string;
  exploratoryAnalysisId: string;
  useFindingsDraft: boolean;
  selectedIdeas?: number[];
}

/**
 * Upload buffer to S3
 */
async function uploadBufferToS3(
  buffer: Buffer,
  s3Key: string,
  contentType: string
): Promise<void> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    ...(process.env.S3_ENDPOINT && {
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    }),
  });

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'audiobranding-files',
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

/**
 * Process finalize job
 */
export async function processFinalizeJob(job: Job<FinalizeJob>) {
  const {
    analysisId,
    projectId,
    exploratoryAnalysisId,
    useFindingsDraft,
    selectedIdeas,
  } = job.data;

  try {
    // Update status to running
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: 'running' },
    });

    // Get project for brand name
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { brandName: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Generate conversation snapshot
    const snapshot = await generateConversationSnapshot(projectId);

    // Build rigid prompt
    const prompt = buildRigidPrompt(snapshot, useFindingsDraft);

    // Call Perplexity rigid API
    const rigidResponse = await callPerplexityRigid(prompt);

    // Save rigid response
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        responseJson: rigidResponse as any,
      },
    });

    // Generate audio using ElevenLabs with musical description (prompt-based)
    // Generate audio for all 5 descriptions
    if (rigidResponse.jingle) {
      const descriptions = [
        { key: 'description1', desc: rigidResponse.jingle.description1 },
        { key: 'description2', desc: rigidResponse.jingle.description2 },
        { key: 'description3', desc: rigidResponse.jingle.description3 },
        { key: 'description4', desc: rigidResponse.jingle.description4 },
        { key: 'description5', desc: rigidResponse.jingle.description5 },
      ];

      // Generate audio for each description
      for (let i = 0; i < descriptions.length; i++) {
        const { key, desc } = descriptions[i];
        const descriptionNumber = i + 1;

        if (!desc) {
          console.warn(`Missing ${key} in rigid response, skipping audio generation`);
          continue;
        }

        try {
          // Use the elevenlabs_prompt directly from the description
          if (!desc.elevenlabs_prompt || desc.elevenlabs_prompt.trim().length === 0) {
            throw new Error(`Description ${descriptionNumber} is missing elevenlabs_prompt`);
          }

          // Log original prompt for debugging
          console.log(`[Description ${descriptionNumber}] Original elevenlabs_prompt:`, desc.elevenlabs_prompt);
          
          // Sanitize prompt to avoid ElevenLabs ToS violations
          let musicalPrompt = sanitizeElevenLabsPrompt(desc.elevenlabs_prompt);
          
          // Log if sanitization changed anything
          if (musicalPrompt !== desc.elevenlabs_prompt) {
            console.log(`[Description ${descriptionNumber}] Prompt was sanitized (removed ToS violations)`);
            console.log(`[Description ${descriptionNumber}] Sanitized prompt:`, musicalPrompt);
          }

          console.log(`Generating audio ${descriptionNumber}/5 with ElevenLabs prompt (${musicalPrompt.length} chars)`);
          console.log(`Description ${descriptionNumber} preview:`, musicalPrompt.substring(0, 300) + '...');

          // Generate audio using ElevenLabs API with prompt
          const audioBuffer = await composeMusic({
            prompt: musicalPrompt,
            force_instrumental: true,
            music_length_ms: 10000, // 10 seconds
            output_format: 'mp3_44100_128', // MP3 format
          });

          console.log(`Audio ${descriptionNumber}/5 generated successfully, size: ${audioBuffer.length} bytes`);

          // Upload to S3 with unique key for each description
          const s3Key = `projects/${projectId}/artifacts/${analysisId}/audio-${descriptionNumber}.mp3`;
          await uploadBufferToS3(audioBuffer, s3Key, 'audio/mpeg');

          // Create artifact record
          await prisma.artifact.create({
            data: {
              analysisId,
              type: 'audio',
              s3Key,
              filename: `${project.brandName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-')}-jingle-${descriptionNumber}.mp3`,
              metadata: {
                duration_ms: 10000,
                source: 'elevenlabs',
                method: 'prompt',
                description_number: descriptionNumber,
                description_key: key,
                description_title: desc.title,
                description_feel: desc.feel,
                description_emotional_effect: desc.emotional_effect,
                elevenlabs_prompt: desc.elevenlabs_prompt,
                sanitized_prompt: musicalPrompt,
              },
            },
          });

          console.log(`Audio artifact ${descriptionNumber}/5 created for analysis ${analysisId}`);

          // Update progress: 20% per audio generation (20%, 40%, 60%, 80%, 100%)
          const progress = descriptionNumber * 20;
          
          // Get current responseJson to preserve it
          const currentAnalysis = await prisma.analysis.findUnique({
            where: { id: analysisId },
            select: { responseJson: true },
          });
          
          // Preserve existing responseJson and add/update metadata
          const currentResponseJson = (currentAnalysis?.responseJson as any) || rigidResponse;
          const updatedResponseJson = {
            ...currentResponseJson,
            _metadata: {
              ...(currentResponseJson._metadata || {}),
              progress,
              audioGenerationsCompleted: descriptionNumber,
              totalAudioGenerations: 5,
            },
          };
          
          await prisma.analysis.update({
            where: { id: analysisId },
            data: {
              responseJson: updatedResponseJson,
            },
          });
          console.log(`Progress updated to ${progress}% for analysis ${analysisId}`);
        } catch (error: any) {
          console.error(`Error generating audio ${descriptionNumber}/5 for analysis ${analysisId}:`, error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            descriptionNumber,
            descriptionKey: key,
            descriptionTitle: desc.title,
          });
          // Continue with next description even if one fails
          // Don't fail the entire job if audio generation fails
        }
      }
    } else {
      console.warn('No jingle descriptions found in rigid response, skipping audio generation');
    }

    // Generate PDF report
    try {
      const pdfBuffer = await generateJingleReportPDF(rigidResponse, project.brandName);

      // Upload PDF to S3
      const pdfS3Key = `projects/${projectId}/artifacts/${analysisId}/report.pdf`;
      await uploadBufferToS3(pdfBuffer, pdfS3Key, 'application/pdf');

      // Create PDF artifact
      await prisma.artifact.create({
        data: {
          analysisId,
          type: 'pdf',
          s3Key: pdfS3Key,
          filename: `${project.brandName.toLowerCase()}_jingle_report.pdf`,
          metadata: {},
        },
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      // Don't fail the entire job if PDF generation fails
    }

    // Update analysis status to done
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'done',
        finishedAt: new Date(),
      },
    });

    console.log(`Finalize completed for analysis ${analysisId}`);
  } catch (error: any) {
    console.error(`Error processing finalize job ${analysisId}:`, error);

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
 * Create finalize worker
 */
export function createFinalizeWorker() {
  const worker = new Worker<FinalizeJob>(
    'finalize',
    async (job) => {
      if (job.name === 'finalize-analysis') {
        return processFinalizeJob(job);
      }
      throw new Error(`Unknown job type: ${job.name}`);
    },
    {
      connection: redis,
      concurrency: 2, // Lower concurrency for expensive operations
    }
  );

  worker.on('completed', (job) => {
    console.log(`Finalize job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Finalize job ${job?.id} failed:`, err);
  });

  return worker;
}

