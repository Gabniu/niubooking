// Ownership: provider-neutral communication worker orchestration. It never bypasses Booking policy.

import { claimDueCommunicationJobs, completeCommunicationJob, type SqlExecutor } from "@bookingapp/database";
import type { CommunicationJob } from "@bookingapp/domain";

export interface CommunicationProvider {
  send(job: CommunicationJob): Promise<void>;
}

export interface CommunicationWorkerOptions {
  limit: number;
  now?: Date;
  isSuppressed?: (job: CommunicationJob) => Promise<boolean>;
  /** Resolve the current consented destination after claiming, without storing it in the outbox. */
  resolveRecipient?: (job: CommunicationJob) => Promise<string | null>;
}

export interface CommunicationBatchResult {
  claimed: number;
  sent: number;
  failed: number;
  suppressed: number;
}

export async function runCommunicationBatch(executor: SqlExecutor, provider: CommunicationProvider, options: CommunicationWorkerOptions): Promise<CommunicationBatchResult> {
  const jobs = await claimDueCommunicationJobs(executor, options.limit, options.now ?? new Date());
  const result: CommunicationBatchResult = { claimed: jobs.length, sent: 0, failed: 0, suppressed: 0 };
  for (const job of jobs) {
    if (options.isSuppressed && await options.isSuppressed(job)) {
      await completeCommunicationJob(executor, job.tenantId, job.id, "suppressed");
      result.suppressed += 1;
      continue;
    }
    try {
      const recipient = options.resolveRecipient ? await options.resolveRecipient(job) : job.recipient;
      if (options.resolveRecipient && !recipient) {
        await completeCommunicationJob(executor, job.tenantId, job.id, "suppressed");
        result.suppressed += 1;
        continue;
      }
      await provider.send(recipient ? { ...job, recipient } : job);
      await completeCommunicationJob(executor, job.tenantId, job.id, "sent");
      result.sent += 1;
    } catch {
      await completeCommunicationJob(executor, job.tenantId, job.id, "failed");
      result.failed += 1;
    }
  }
  return result;
}
