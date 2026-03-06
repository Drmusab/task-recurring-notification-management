import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { operationFields, operationOptions } from './descriptions';
import { callTaskRecurringApi, retryProperties } from '../../utils/apiClient';
import type { TaskRecurringOperation } from '../../utils/types';

export class TaskRecurring implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Task Recurring Manager',
    name: 'taskRecurring',
    icon: 'file:taskRecurring.svg',
    group: ['transform'],
    version: 1,
    description: 'Manage recurring tasks in SiYuan backend',
    defaults: {
      name: 'Task Recurring Manager',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'taskRecurringApi',
        required: true,
      },
    ],
    properties: [operationOptions, ...operationFields, ...retryProperties],
  };

  methods = {
    loadOptions: {
      async getTaskIds(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const response = await callTaskRecurringApi<IDataObject>(
          this,
          0,
          'GET',
          'listTasks',
          '/api/tasks',
          {},
          { page: 1, pageSize: 100 },
        );

        const rawItems = response.data?.items;
        const tasks: unknown[] = Array.isArray(rawItems) ? rawItems : [];

        return tasks
          .filter((entry: unknown): entry is IDataObject => typeof entry === 'object' && entry !== null)
          .map((entry: IDataObject) => ({
            name: String(entry.title ?? entry.id ?? 'Untitled Task'),
            value: String(entry.id ?? ''),
          }))
          .filter((option: INodePropertyOptions) => String(option.value).length > 0);
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as TaskRecurringOperation;
        const baseData = items[itemIndex].json;
        const requestData: IDataObject = {
          ...baseData,
        };

        const response = await this.executeOperation(itemIndex, operation, requestData);
        returnData.push({ json: response as unknown as IDataObject, pairedItem: itemIndex });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            pairedItem: itemIndex,
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }

  private async executeOperation(
    this: IExecuteFunctions,
    itemIndex: number,
    operation: TaskRecurringOperation,
    requestData: IDataObject,
  ): Promise<Record<string, unknown>> {
    switch (operation) {
      case 'createTask':
        return callWithData(this, itemIndex, 'POST', operation, '/api/tasks', {
          ...requestData,
          title: this.getNodeParameter('title', itemIndex),
          description: this.getNodeParameter('description', itemIndex),
          dueAt: this.getNodeParameter('dueAt', itemIndex),
          tags: splitTags(this.getNodeParameter('tags', itemIndex) as string),
          recurrenceRule: this.getNodeParameter('recurrenceRule', itemIndex),
        });
      case 'updateTask': {
        const taskId = this.getNodeParameter('taskId', itemIndex) as string;
        return callWithData(this, itemIndex, 'PUT', operation, `/api/tasks/${taskId}`, {
          ...requestData,
          description: this.getNodeParameter('description', itemIndex),
          dueAt: this.getNodeParameter('dueAt', itemIndex),
          tags: splitTags(this.getNodeParameter('tags', itemIndex) as string),
          recurrenceRule: this.getNodeParameter('recurrenceRule', itemIndex),
          status: this.getNodeParameter('status', itemIndex),
        });
      }
      case 'completeTask': {
        const taskId = this.getNodeParameter('taskId', itemIndex) as string;
        return callWithData(this, itemIndex, 'POST', operation, `/api/tasks/${taskId}/complete`, requestData);
      }
      case 'deleteTask': {
        const taskId = this.getNodeParameter('taskId', itemIndex) as string;
        return callWithData(this, itemIndex, 'DELETE', operation, `/api/tasks/${taskId}`, requestData);
      }
      case 'getTask': {
        const taskId = this.getNodeParameter('taskId', itemIndex) as string;
        return callWithData(this, itemIndex, 'GET', operation, `/api/tasks/${taskId}`, requestData);
      }
      case 'listTasks':
        return callWithData(this, itemIndex, 'GET', operation, '/api/tasks', requestData, {
          status: this.getNodeParameter('status', itemIndex),
          tag: this.getNodeParameter('tag', itemIndex),
          fromDate: this.getNodeParameter('fromDate', itemIndex),
          toDate: this.getNodeParameter('toDate', itemIndex),
          page: this.getNodeParameter('page', itemIndex),
          pageSize: this.getNodeParameter('pageSize', itemIndex),
        });
      case 'triggerRecurrence':
        return callWithData(this, itemIndex, 'POST', operation, '/api/recurrence/trigger', {
          ...requestData,
          recurrenceRule: this.getNodeParameter('recurrenceRule', itemIndex),
        });
      case 'addReminder': {
        const taskId = this.getNodeParameter('taskId', itemIndex) as string;
        return callWithData(this, itemIndex, 'POST', operation, `/api/tasks/${taskId}/reminders`, {
          ...requestData,
          dueAt: this.getNodeParameter('dueAt', itemIndex),
        });
      }
      default:
        throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex });
    }
  }
}

async function callWithData(
  context: IExecuteFunctions | ILoadOptionsFunctions,
  itemIndex: number,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  operation: TaskRecurringOperation,
  endpoint: string,
  data: IDataObject,
  query?: IDataObject,
): Promise<Record<string, unknown>> {
  const response = await callTaskRecurringApi<Record<string, unknown>>(
    context,
    itemIndex,
    method,
    operation,
    endpoint,
    data,
    query,
  );

  return {
    success: response.success,
    data: response.data ?? {},
    error: response.error,
    operation,
    endpoint,
  };
}

function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}
