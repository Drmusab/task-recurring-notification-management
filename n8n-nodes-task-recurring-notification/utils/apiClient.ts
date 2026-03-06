import type {
  IDataObject,
  IHttpRequestMethods,
  IHttpRequestOptions,
  INode,
  INodeProperties,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { buildEnvelope, digestPayload, signPayload } from './helpers';
import type { CredentialConfig, TaskRecurringApiResponse, TaskRecurringOperation } from './types';

interface RequestContext {
  continueOnFail: () => boolean;
  getNode: () => INode;
  getNodeParameter: (name: string, itemIndex: number, fallbackValue?: unknown) => unknown;
  getCredentials: (name: string) => Promise<CredentialConfig>;
  helpers: {
    requestWithAuthentication: (
      this: RequestContext,
      credentialsType: string,
      requestOptions: IHttpRequestOptions,
    ) => Promise<IDataObject | IDataObject[]>;
  };
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function callTaskRecurringApi<TData extends IDataObject>(
  context: RequestContext,
  itemIndex: number,
  method: IHttpRequestMethods,
  operation: TaskRecurringOperation,
  endpoint: string,
  data: IDataObject,
  query?: IDataObject,
): Promise<TaskRecurringApiResponse<TData>> {
  const credentials = await context.getCredentials('taskRecurringApi');
  const payload = buildEnvelope(operation, data);
  const bodyString = JSON.stringify(payload);

  const headers: IDataObject = {
    'Content-Type': 'application/json',
    'X-Task-Event-Id': payload.eventId,
    'X-Task-Digest': digestPayload(bodyString),
  };

  if (credentials.secret) {
    headers['X-Task-Signature'] = signPayload(bodyString, credentials.secret);
  }

  const retries = Number(context.getNodeParameter('retryCount', itemIndex, 2));
  const timeout = Number(context.getNodeParameter('timeout', itemIndex, 10000));

  const requestOptions: IHttpRequestOptions = {
    method,
    url: `${credentials.baseUrl.replace(/\/$/, '')}${endpoint}`,
    body: payload,
    qs: query,
    json: true,
    timeout,
    headers,
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await context.helpers.requestWithAuthentication.call(
        context,
        'taskRecurringApi',
        requestOptions,
      );

      const normalized = Array.isArray(response) ? response[0] : response;
      const typed = normalized as TaskRecurringApiResponse<TData>;

      if (!typed.success) {
        throw new NodeOperationError(context.getNode(), typed.error ?? 'Unknown API error', {
          itemIndex,
        });
      }

      return typed;
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        throw new NodeApiError(context.getNode(), error as IDataObject, {
          itemIndex,
          message: 'Task Recurring API request failed',
        });
      }

      const statusCode =
        typeof error === 'object' && error !== null && 'httpCode' in error
          ? Number((error as { httpCode?: number }).httpCode)
          : 0;

      if (!RETRYABLE_STATUS.has(statusCode)) {
        throw new NodeApiError(context.getNode(), error as IDataObject, {
          itemIndex,
          message: 'Task Recurring API request failed with non-retryable error',
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }

  throw new NodeOperationError(context.getNode(), 'Unexpected request state', { itemIndex });
}

export const retryProperties: INodeProperties[] = [
  {
    displayName: 'Retry Count',
    name: 'retryCount',
    type: 'number',
    default: 2,
    typeOptions: {
      minValue: 0,
      maxValue: 5,
    },
    description: 'Number of retries for retryable HTTP errors',
  },
  {
    displayName: 'Timeout (ms)',
    name: 'timeout',
    type: 'number',
    default: 10000,
    typeOptions: {
      minValue: 1000,
      maxValue: 120000,
    },
    description: 'HTTP timeout in milliseconds',
  },
];
