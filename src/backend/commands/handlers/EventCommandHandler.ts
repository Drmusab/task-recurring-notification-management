// @ts-nocheck
import { BaseCommandHandler } from "@backend/commands/handlers/BaseCommandHandler";
import { CommandResult } from "@backend/commands/types/CommandTypes";
import {
  CreateSubscriptionData,
  UpdateSubscriptionData,
  WebhookSubscription,
} from "@backend/events/types/SubscriptionTypes";
import { EventSubscriptionManager } from "@backend/events/EventSubscriptionManager";
import { WebhookError } from "@backend/webhook/types/Error";

/**
 * Event subscription command handler
 */
export class EventCommandHandler extends BaseCommandHandler {
  constructor(private subscriptionManager: EventSubscriptionManager) {
    super();
  }

  /**
   * Handle: v1/events/subscriptions/create
   */
  async handleCreateSubscription(
    data: CreateSubscriptionData,
    context: any
  ): Promise<CommandResult<Omit<WebhookSubscription, 'secret'>>> {
    try {
      const subscription = await this.subscriptionManager.create(context.workspaceId, data);

      // Return subscription WITHOUT secret (only shown once)
      const { secret, ...subscriptionWithoutSecret } = subscription;

      return this.success({
        ...subscriptionWithoutSecret,
        secret: '••••••••', // Masked
        _note: 'Secret is only shown once. Store it securely.',
      } as any);
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to create subscription');
    }
  }

  /**
   * Handle: v1/events/subscriptions/update
   */
  async handleUpdateSubscription(
    data: UpdateSubscriptionData,
    context: any
  ): Promise<CommandResult<Omit<WebhookSubscription, 'secret'>>> {
    try {
      const subscription = await this.subscriptionManager.update(context.workspaceId, data);

      const { secret, ...subscriptionWithoutSecret } = subscription;

      return this.success(subscriptionWithoutSecret);
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to update subscription');
    }
  }

  /**
   * Handle: v1/events/subscriptions/delete
   */
  async handleDeleteSubscription(
    data: { subscriptionId: string },
    context: any
  ): Promise<CommandResult> {
    try {
      const validation = this.validateRequired(data, ['subscriptionId']);
      if (!validation.valid) {
        throw new WebhookError('VALIDATION_ERROR', 'subscriptionId is required');
      }

      await this.subscriptionManager.delete(context.workspaceId, data.subscriptionId);

      return this.success({
        subscriptionId: data.subscriptionId,
        deletedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        return this.fromWebhookError(error);
      }
      return this.error('INTERNAL_ERROR', 'Failed to delete subscription');
    }
  }

  /**
   * Handle: v1/events/subscriptions/list
   */
  async handleListSubscriptions(data: any, context: any): Promise<CommandResult> {
    try {
      const subscriptions = this.subscriptionManager.list(context.workspaceId);

      // Mask secrets
      const masked = subscriptions.map((sub) => {
        const { secret, ...rest } = sub;
        return { ...rest, secret: '••••••••' };
      });

      return this.success({ subscriptions: masked });
    } catch (error) {
      return this.error('INTERNAL_ERROR', 'Failed to list subscriptions');
    }
  }
}
