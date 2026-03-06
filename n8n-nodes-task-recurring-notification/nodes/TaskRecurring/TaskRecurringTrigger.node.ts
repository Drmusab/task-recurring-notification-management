import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { signPayload } from '../../utils/helpers';

type TriggerEvent = 'task.created' | 'task.completed' | 'recurrence.executed' | 'reminder.fired';

export class TaskRecurringTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Task Recurring Trigger',
    name: 'taskRecurringTrigger',
    icon: 'file:taskRecurring.svg',
    group: ['trigger'],
    version: 1,
    description: 'Receive task lifecycle events from SiYuan plugin',
    defaults: {
      name: 'Task Recurring Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [{ name: 'taskRecurringApi', required: true }],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'task-recurring-events',
      },
    ],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        default: ['task.created'],
        options: [
          { name: 'On Task Created', value: 'task.created' },
          { name: 'On Task Completed', value: 'task.completed' },
          { name: 'On Recurring Executed', value: 'recurrence.executed' },
          { name: 'On Reminder Fired', value: 'reminder.fired' },
        ],
      },
      {
        displayName: 'Secret Key',
        name: 'secretKey',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        description: 'Optional override secret for HMAC signature validation',
      },
      {
        displayName: 'Allow Handshake',
        name: 'allowHandshake',
        type: 'boolean',
        default: true,
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default');
        const credentials = await this.getCredentials('taskRecurringApi');

        await this.helpers.requestWithAuthentication.call(this, 'taskRecurringApi', {
          method: 'POST',
          url: `${String(credentials.baseUrl).replace(/\/$/, '')}/api/webhooks/register`,
          body: {
            url: webhookUrl,
            events: this.getNodeParameter('events') as TriggerEvent[],
          },
          json: true,
        });

        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default');
        const credentials = await this.getCredentials('taskRecurringApi');

        await this.helpers.requestWithAuthentication.call(this, 'taskRecurringApi', {
          method: 'POST',
          url: `${String(credentials.baseUrl).replace(/\/$/, '')}/api/webhooks/unregister`,
          body: {
            url: webhookUrl,
          },
          json: true,
        });

        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as IDataObject;
    const headerSignature = String(this.getHeaderData()['x-task-signature'] ?? '');
    const credentials = await this.getCredentials('taskRecurringApi');
    const configuredSecret = (this.getNodeParameter('secretKey') as string) || String(credentials.secret ?? '');
    const allowHandshake = this.getNodeParameter('allowHandshake') as boolean;

    if (allowHandshake && body.type === 'handshake') {
      return {
        webhookResponse: {
          success: true,
          challenge: body.challenge,
        },
      };
    }

    if (configuredSecret) {
      const bodyString = JSON.stringify(body);
      const expectedSignature = signPayload(bodyString, configuredSecret);

      if (expectedSignature !== headerSignature) {
        throw new NodeOperationError(this.getNode(), 'Invalid webhook signature');
      }
    }

    const selectedEvents = this.getNodeParameter('events') as TriggerEvent[];
    const eventType = String(body.eventType ?? '');

    if (!selectedEvents.includes(eventType as TriggerEvent)) {
      return {
        webhookResponse: {
          success: true,
          ignored: true,
          reason: `Event ${eventType} is not selected`,
        },
        noWebhookResponse: false,
      };
    }

    return {
      workflowData: [[{ json: body }]],
      webhookResponse: {
        success: true,
      },
    };
  }
}
