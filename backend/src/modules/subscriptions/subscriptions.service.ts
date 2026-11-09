import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { AppError } from '../../shared/types.js';
import { logger } from '../../shared/logger.js';

const isDev = () => (process.env.NODE_ENV || 'development') === 'development';

export class SubscriptionService {
  paymentsConfigured(): boolean {
    return Boolean(config.razorpay.keyId && config.razorpay.keySecret);
  }

  /** Local testing only: when no Razorpay keys are set on a development machine */
  devSimulationAllowed(): boolean {
    return isDev() && !this.paymentsConfigured();
  }

  getPlan() {
    return {
      plan: 'family_yearly',
      amountInr: config.subscription.amountInr,
      autoRenewDefault: true,
      recurring: this.recurringConfigured(),
      currency: 'INR',
      periodMonths: config.subscription.periodMonths,
      paymentsConfigured: this.paymentsConfigured(),
      devSimulation: this.devSimulationAllowed(),
      // Web-first model: purchases happen on the website only
      purchaseChannel: 'web',
    };
  }

  /** The person's current paid period, if any */
  async getActive(userId: string) {
    return prisma.subscription.findFirst({
      where: { userId, status: 'active', endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'desc' },
    });
  }

  async isActive(userId: string): Promise<boolean> {
    return Boolean(await this.getActive(userId));
  }

  /** Automatic renewal is charged by Razorpay only when a Subscriptions plan is configured */
  recurringConfigured(): boolean {
    return this.paymentsConfigured() && Boolean(config.razorpay.planId);
  }

  async getMine(userId: string) {
    const active = await this.getActive(userId);
    const autoRenew = Boolean(active?.autoRenew);
    // automatic: renewed without any action (Razorpay Subscriptions, or simulated locally)
    // reminder: one-time payments; we remind before the end date and they renew in one tap
    const renewalMode = active?.providerSubscriptionId || active?.provider === 'dev_simulated' ? 'automatic' : 'reminder';
    return {
      active: Boolean(active),
      startsAt: active?.startsAt?.toISOString() || null,
      endsAt: active?.endsAt?.toISOString() || null,
      provider: active?.provider || null,
      autoRenew,
      renewalMode: active ? renewalMode : null,
      renewsOn: active && autoRenew ? active.endsAt?.toISOString() || null : null,
      cancelledAt: active?.cancelledAt?.toISOString() || null,
      plan: this.getPlan(),
    };
  }

  /** Turn automatic yearly renewal on or off (it is on by default) */
  async setAutoRenew(userId: string, enabled: boolean) {
    const active = await this.getActive(userId);
    if (!active) throw new AppError('You have no active subscription.', 404, 'NOT_FOUND');

    if (active.providerSubscriptionId) {
      if (!enabled && active.autoRenew) {
        const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
        const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${active.providerSubscriptionId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
          body: JSON.stringify({ cancel_at_cycle_end: 1 }),
        });
        if (!res.ok) {
          logger.error('Razorpay subscription cancel failed:', res.status);
          throw new AppError('Could not turn off automatic renewal right now. Please try again.', 502, 'PAYMENT_FAILED');
        }
      }
      if (enabled && !active.autoRenew) {
        throw new AppError(
          'Automatic renewal was cancelled with the payment provider. You can renew again from this page when your plan ends.',
          409,
          'CONFLICT',
        );
      }
    }

    await prisma.subscription.updateMany({
      where: { userId, status: 'active', endsAt: { gt: new Date() } },
      data: { autoRenew: enabled, cancelledAt: enabled ? null : new Date(), renewalReminderAt: null },
    });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: enabled ? 'SUBSCRIPTION_AUTORENEW_ON' : 'SUBSCRIPTION_AUTORENEW_OFF',
        entityType: 'Subscription',
        entityId: active.id,
        details: JSON.stringify({ endsAt: active.endsAt }),
      },
    });
    return this.getMine(userId);
  }

  /**
   * Runs every hour:
   * - simulated (local) plans with auto-renew on are renewed when they end
   * - one-time paid plans with auto-renew on get a reminder 7 days before they end
   * Razorpay Subscriptions renewals arrive through the webhook instead.
   */
  async processRenewals() {
    const now = new Date();
    let renewed = 0;
    let reminded = 0;

    const dueSimulated = await prisma.subscription.findMany({
      where: {
        provider: 'dev_simulated',
        status: 'active',
        autoRenew: true,
        endsAt: { lte: now, gt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    for (const sub of dueSimulated) {
      if (await this.getActive(sub.userId)) continue; // already renewed
      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      endsAt.setMonth(endsAt.getMonth() + config.subscription.periodMonths);
      await prisma.$transaction([
        prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew: false } }),
        prisma.subscription.create({
          data: { userId: sub.userId, amountPaise: sub.amountPaise, status: 'active', provider: 'dev_simulated', startsAt, endsAt, autoRenew: true },
        }),
        prisma.notification.create({
          data: {
            recipientId: sub.userId,
            notificationType: 'system',
            title: 'Your Family Safety Circle renewed',
            message: `Your subscription renewed automatically for another ${config.subscription.periodMonths} months. You can turn off automatic renewal any time.`,
            relatedEntity: '/app/subscribe',
          },
        }),
      ]);
      renewed++;
    }

    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueReminders = await prisma.subscription.findMany({
      where: {
        provider: 'razorpay',
        providerSubscriptionId: null,
        status: 'active',
        autoRenew: true,
        renewalReminderAt: null,
        endsAt: { gt: now, lte: soon },
      },
    });
    for (const sub of dueReminders) {
      await prisma.$transaction([
        prisma.subscription.update({ where: { id: sub.id }, data: { renewalReminderAt: now } }),
        prisma.notification.create({
          data: {
            recipientId: sub.userId,
            notificationType: 'system',
            title: 'Your Family Safety Circle renews soon',
            message: `Your plan ends on ${sub.endsAt!.toDateString()}. Renew now to keep your family's donor list. Finding donors and posting requests stay free either way.`,
            relatedEntity: '/app/subscribe',
          },
        }),
      ]);
      reminded++;
    }
    if (renewed || reminded) logger.info(`Subscriptions: renewed ${renewed}, reminded ${reminded}`);
    return { renewed, reminded };
  }

  /** Local testing only: end my current simulated period now and run renewals */
  async devExpireAndRenew(userId: string) {
    if (!isDev()) throw new AppError('Not available.', 404, 'NOT_FOUND');
    await prisma.subscription.updateMany({
      where: { userId, status: 'active', provider: 'dev_simulated', endsAt: { gt: new Date() } },
      data: { endsAt: new Date(Date.now() - 60 * 1000) },
    });
    const result = await this.processRenewals();
    return { ...result, mine: await this.getMine(userId) };
  }

  /** Razorpay webhook: renewal charges and cancellations for Razorpay Subscriptions */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!config.razorpay.webhookSecret) throw new AppError('Webhook not configured.', 404, 'NOT_FOUND');
    if (!rawBody || !signature) throw new AppError('Missing signature.', 400, 'BAD_REQUEST');
    const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(rawBody).digest('hex');
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new AppError('Invalid signature.', 400, 'BAD_REQUEST');
    }
    const event = JSON.parse(rawBody.toString('utf8'));
    const subEntity = event?.payload?.subscription?.entity;
    const payEntity = event?.payload?.payment?.entity;
    const providerSubscriptionId: string | undefined = subEntity?.id;
    if (!providerSubscriptionId) return { ok: true };

    const latest = await prisma.subscription.findFirst({
      where: { providerSubscriptionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) return { ok: true };

    if (event.event === 'subscription.charged' && payEntity?.id) {
      const seen = await prisma.subscription.findFirst({ where: { providerPaymentId: payEntity.id } });
      if (seen) return { ok: true };
      const { startsAt, endsAt } = await this.periodFor(latest.userId);
      if (latest.status === 'created') {
        await prisma.subscription.update({
          where: { id: latest.id },
          data: { status: 'active', providerPaymentId: payEntity.id, startsAt, endsAt, autoRenew: true },
        });
      } else {
        await prisma.subscription.create({
          data: {
            userId: latest.userId,
            amountPaise: Number(payEntity.amount) || latest.amountPaise,
            status: 'active',
            provider: 'razorpay',
            providerSubscriptionId,
            providerPaymentId: payEntity.id,
            startsAt,
            endsAt,
            autoRenew: true,
          },
        });
      }
    } else if (['subscription.cancelled', 'subscription.halted', 'subscription.completed'].includes(event.event)) {
      await prisma.subscription.updateMany({
        where: { providerSubscriptionId },
        data: { autoRenew: false, cancelledAt: new Date() },
      });
    }
    return { ok: true };
  }

  /** New paid period starts today, or when the current one ends (renewing early adds a full year) */
  private async periodFor(userId: string) {
    const active = await this.getActive(userId);
    const startsAt = active?.endsAt && active.endsAt > new Date() ? active.endsAt : new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + config.subscription.periodMonths);
    return { startsAt, endsAt };
  }

  /** Step 1: create a Razorpay order the website opens in Razorpay Checkout */
  async createOrder(userId: string) {
    if (!this.paymentsConfigured()) {
      throw new AppError('Online payment is not set up yet. Please try again later.', 503, 'PAYMENTS_NOT_CONFIGURED');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');

    const amountPaise = config.subscription.amountInr * 100;
    const sub = await prisma.subscription.create({
      data: { userId, amountPaise, currency: 'INR', status: 'created', provider: 'razorpay' },
    });

    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');

    // Automatic yearly renewal through Razorpay Subscriptions (needs RAZORPAY_PLAN_ID)
    if (this.recurringConfigured()) {
      const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          plan_id: config.razorpay.planId,
          total_count: 10,
          quantity: 1,
          customer_notify: 1,
          notes: { userId, plan: 'family_yearly' },
        }),
      });
      const rzSub: any = await res.json().catch(() => ({}));
      if (!res.ok || !rzSub.id) {
        logger.error('Razorpay subscription failed:', rzSub?.error?.description || res.status);
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'failed' } });
        throw new AppError('Could not start the payment. Please try again.', 502, 'PAYMENT_FAILED');
      }
      await prisma.subscription.update({ where: { id: sub.id }, data: { providerSubscriptionId: rzSub.id } });
      return {
        mode: 'subscription' as const,
        subscriptionId: rzSub.id,
        orderId: null,
        keyId: config.razorpay.keyId,
        amountPaise,
        currency: 'INR',
        name: user.fullName || user.username || '',
        email: user.email,
        phone: user.phone || '',
      };
    }
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: sub.id.slice(0, 40),
        notes: { userId, plan: 'family_yearly' },
      }),
    });
    const order: any = await res.json().catch(() => ({}));
    if (!res.ok || !order.id) {
      logger.error('Razorpay order failed:', order?.error?.description || res.status);
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'failed' } });
      throw new AppError('Could not start the payment. Please try again.', 502, 'PAYMENT_FAILED');
    }

    await prisma.subscription.update({ where: { id: sub.id }, data: { providerOrderId: order.id } });

    return {
      mode: 'order' as const,
      subscriptionId: null,
      orderId: order.id,
      keyId: config.razorpay.keyId,
      amountPaise,
      currency: 'INR',
      name: user.fullName || user.username || '',
      email: user.email,
      phone: user.phone || '',
    };
  }

  /** Step 2: Razorpay Checkout returns a signature; only a valid signature activates the plan */
  async verifyPayment(userId: string, input: { orderId?: string; subscriptionId?: string; paymentId: string; signature: string }) {
    if (!this.paymentsConfigured()) {
      throw new AppError('Online payment is not set up yet.', 503, 'PAYMENTS_NOT_CONFIGURED');
    }
    if (input.subscriptionId) return this.verifySubscriptionPayment(userId, { ...input, subscriptionId: input.subscriptionId });
    if (!input.orderId) throw new AppError('Missing payment details.', 400, 'BAD_REQUEST');
    const orderId = input.orderId;
    const sub = await prisma.subscription.findUnique({ where: { providerOrderId: orderId } });
    if (!sub || sub.userId !== userId) {
      throw new AppError('We could not find this payment. Please contact support.', 404, 'NOT_FOUND');
    }
    if (sub.status === 'active') return this.getMine(userId);

    const expected = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${orderId}|${input.paymentId}`)
      .digest('hex');
    const valid =
      expected.length === input.signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
    if (!valid) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'failed' } });
      throw new AppError('Payment could not be verified. If money was deducted, it will be refunded by your bank.', 400, 'PAYMENT_INVALID');
    }

    const { startsAt, endsAt } = await this.periodFor(userId);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'active', providerPaymentId: input.paymentId, startsAt, endsAt },
    });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'SUBSCRIPTION_ACTIVATED',
        entityType: 'Subscription',
        entityId: sub.id,
        details: JSON.stringify({ orderId: input.orderId, paymentId: input.paymentId, endsAt }),
      },
    });
    return this.getMine(userId);
  }

  /** Razorpay Subscriptions checkout: signature is over payment_id|subscription_id */
  private async verifySubscriptionPayment(userId: string, input: { subscriptionId: string; paymentId: string; signature: string }) {
    const sub = await prisma.subscription.findFirst({
      where: { providerSubscriptionId: input.subscriptionId, userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new AppError('We could not find this payment. Please contact support.', 404, 'NOT_FOUND');
    if (sub.status === 'active') return this.getMine(userId);
    const expected = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${input.paymentId}|${input.subscriptionId}`)
      .digest('hex');
    const valid =
      expected.length === input.signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
    if (!valid) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'failed' } });
      throw new AppError('Payment could not be verified. If money was deducted, it will be refunded by your bank.', 400, 'PAYMENT_INVALID');
    }
    const { startsAt, endsAt } = await this.periodFor(userId);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'active', providerPaymentId: input.paymentId, startsAt, endsAt, autoRenew: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'SUBSCRIPTION_ACTIVATED',
        entityType: 'Subscription',
        entityId: sub.id,
        details: JSON.stringify({ subscriptionId: input.subscriptionId, paymentId: input.paymentId, endsAt }),
      },
    });
    return this.getMine(userId);
  }

  /** Local testing only (development machine, no Razorpay keys): activate without paying */
  async simulate(userId: string) {
    if (!this.devSimulationAllowed()) {
      throw new AppError('Not available.', 404, 'NOT_FOUND');
    }
    const { startsAt, endsAt } = await this.periodFor(userId);
    await prisma.subscription.create({
      data: {
        userId,
        amountPaise: config.subscription.amountInr * 100,
        status: 'active',
        provider: 'dev_simulated',
        startsAt,
        endsAt,
      },
    });
    logger.warn(`DEV: simulated subscription activated for user ${userId}`);
    return this.getMine(userId);
  }
}

export const subscriptionService = new SubscriptionService();
