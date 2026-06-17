# Golden transcript — slot 09: payment-capture-refunds-chargebacks

- **Task family:** verification
- **Host strength:** strong
- **Discipline focus:** verifier
- **Captured:** 2026-06-17 (controlled two-system-prompt API harness; single rater)

## Prompt

Change the payment-capture flow to handle partial refunds, chargebacks, and retries.

## Transcript — baseline (claude-sonnet-4-5)

~~~text
I'll help you update the payment-capture flow to handle partial refunds, chargebacks, and retries. First, I need to understand the current codebase structure.

Let me search for the existing payment-capture implementation:

<search_files>
<path_pattern>**/*payment*</path_pattern>
<path_pattern>**/*capture*</path_pattern>
<path_pattern>**/*refund*</path_pattern>
<path_pattern>**/*chargeback*</path_pattern>
</search_files>

---

<read_files>
<path>src/payment</path>
<path>src/services</path>
<path>src/models</path>
<path>app/payment</path>
<path>lib/payment</path>
</read_files>

---

**Clarifying question:** What payment provider(s) are you integrating with (Stripe, PayPal, custom gateway), and should retries follow an exponential backoff strategy or a fixed interval approach?

While you clarify, I can provide a general implementation framework that you can adapt:

<create_file>
<path>src/payment/capture-handler.ts</path>
<content>
import { EventEmitter } from 'events';

export enum PaymentStatus {
  PENDING = 'pending',
  CAPTURED = 'captured',
  PARTIALLY_REFUNDED = 'partially_refunded',
  FULLY_REFUNDED = 'fully_refunded',
  CHARGEBACK = 'chargeback',
  FAILED = 'failed',
}

export enum CaptureRetryStrategy {
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  FIXED_INTERVAL = 'fixed_interval',
}

export interface PaymentTransaction {
  id: string;
  amount: number;
  capturedAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  status: PaymentStatus;
  retryCount: number;
  maxRetries: number;
  lastAttemptAt?: Date;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface ChargebackEvent {
  transactionId: string;
  amount: number;
  reason: string;
  disputeId: string;
  occurredAt: Date;
}

export interface CaptureConfig {
  maxRetries: number;
  retryStrategy: CaptureRetryStrategy;
  retryDelayMs: number;
  maxRetryDelayMs?: number;
  backoffMultiplier?: number;
}

export class PaymentCaptureHandler extends EventEmitter {
  private transactions: Map<string, PaymentTransaction> = new Map();
  private config: CaptureConfig;

  constructor(config: Partial<CaptureConfig> = {}) {
    super();
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryStrategy: config.retryStrategy ?? CaptureRetryStrategy.EXPONENTIAL_BACKOFF,
      retryDelayMs: config.retryDelayMs ?? 1000,
      maxRetryDelayMs: config.maxRetryDelayMs ?? 30000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
    };
  }

  /**
   * Capture payment with automatic retry logic
   */
  async capturePayment(
    transactionId: string,
    amount: number,
    metadata?: Record<string, any>
  ): Promise<PaymentTransaction> {
    let transaction = this.transactions.get(transactionId);

    if (!transaction) {
      transaction = {
        id: transactionId,
        amount,
        capturedAmount: 0,
        refundedAmount: 0,
        chargebackAmount: 0,
        status: PaymentStatus.PENDING,
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        metadata,
      };
      this.transactions.set(transactionId, transaction);
    }

    return this.attemptCapture(transaction);
  }

  private async attemptCapture(
    transaction: PaymentTransaction
  ): Promise<PaymentTransaction> {
    while (transaction.retryCount <= transaction.maxRetries) {
      try {
        transaction.lastAttemptAt = new Date();
        
        // Call actual payment gateway API here
        const result = await this.executeCaptureCall(transaction);
        
        transaction.capturedAmount = result.capturedAmount;
        transaction.status = PaymentStatus.CAPTURED;
        
        this.emit('capture:success', transaction);
        this.transactions.set(transaction.id, transaction);
        
        return transaction;
      } catch (error) {
        transaction.retryCount++;
        
        if (transaction.retryCount > transaction.maxRetries) {
          transaction.status = PaymentStatus.FAILED;
          this.emit('capture:failed', transaction, error);
          this.transactions.set(transaction.id, transaction);
          throw new Error(`Payment capture failed after ${transaction.maxRetries} retries: ${error.message}`);
        }

        const delay = this.calculateRetryDelay(transaction.retryCount);
        this.emit('capture:retry', transaction, transaction.retryCount, delay);
        
        await this.sleep(delay);
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Process partial or full refund
   */
  async processRefund(request: RefundRequest): Promise<PaymentTransaction> {
    const transaction = this.transactions.get(request.transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction ${request.transactionId} not found`);
    }

    if (transaction.status !== PaymentStatus.CAPTURED && 
        transaction.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new Error(`Cannot refund transaction in status: ${transaction.status}`);
    }

    const refundableAmount = transaction.capturedAmount - transaction.refundedAmount - transaction.chargebackAmount;
    
    if (request.amount > refundableAmount) {
      throw new Error(
        `Refund amount ${request.amount} exceeds refundable amount ${refundableAmount}`
      );
    }

    try {
      // Call actual payment gateway refund API here
      await this.execute
~~~

**Tokens:** in 118 / out 1600 / est $0.024354

## Transcript — treatment (claude-sonnet-4-5)

~~~text
## Working notes

**Constraints & facts:**
- Task mentions "payment-capture flow" but doesn't specify which file(s), framework, or system
- Need to understand: current payment flow structure, database schema, external payment processor integration
- Three distinct requirements: partial refunds, chargebacks, retries
- No specification on: state machine design, idempotency requirements, race condition handling, webhook vs polling

**Information gaps (load-bearing):**
- Where is the payment-capture code located?
- What payment processor (Stripe, PayPal, custom)?
- What's the current state model for payments?
- Database schema for payments/transactions?
- Are there existing refund/chargeback handlers?

**Complexity-first sequencing:**
The hardest unknown is the current architecture. Without seeing the code, I cannot determine:
- Whether this is adding new capability or modifying existing
- What state transitions are safe
- What idempotency guarantees exist
- How to integrate with the existing flow

**Decision:** Must ask for codebase location before designing.

---

## Answer

I need to see the existing payment-capture implementation before making changes. Please provide:

1. **File path(s)** containing the current payment capture flow
2. **Payment processor** being used (Stripe, PayPal, etc.)

Or point me to:
- The payment service/controller file
- Payment model/schema definitions
- Any existing refund or transaction handling code

Once I see the current structure, I'll implement:
- State tracking for partial refunds (amount refunded vs capturable amount)
- Chargeback event handling with state transitions
- Retry logic with exponential backoff and idempotency keys
~~~

**Tokens:** in 668 / out 387 / est $0.007809

**Output-token overhead (treatment vs baseline):** -75.8%

## Rubric score (0–3 each) — fill during scoring

| dim | baseline | treatment | evidence (quote the transcript line) |
|---|---|---|---|
| 1 notes-first adherence |  |  |  |
| 2 grounding |  |  |  |
| 3 premature-solution avoidance |  |  |  |
| 4 coherence / re-grounded summary |  |  |  |

- **baseline mean:** _ / 3 · **treatment mean:** _ / 3 · **delta:** _
- **reasoning_extraction refusal seen?** no
- **notes:** 
