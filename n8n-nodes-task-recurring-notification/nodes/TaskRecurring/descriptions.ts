import type { INodeProperties } from 'n8n-workflow';

export const operationOptions: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  options: [
    { name: 'Create Task', value: 'createTask', action: 'Create a task' },
    { name: 'Update Task', value: 'updateTask', action: 'Update a task' },
    { name: 'Complete Task', value: 'completeTask', action: 'Complete a task' },
    { name: 'Delete Task', value: 'deleteTask', action: 'Delete a task' },
    { name: 'Get Task', value: 'getTask', action: 'Get a task' },
    { name: 'List Tasks', value: 'listTasks', action: 'List tasks' },
    { name: 'Trigger Recurrence', value: 'triggerRecurrence', action: 'Trigger recurrence' },
    { name: 'Add Reminder', value: 'addReminder', action: 'Add reminder' },
  ],
  default: 'createTask',
};

const taskIdField: INodeProperties = {
  displayName: 'Task ID',
  name: 'taskId',
  type: 'string',
  required: true,
  default: '',
  description: 'Task identifier',
};

export const operationFields: INodeProperties[] = [
  {
    displayName: 'Title',
    name: 'title',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { operation: ['createTask'] } },
  },
  {
    displayName: 'Description',
    name: 'description',
    type: 'string',
    typeOptions: { rows: 3 },
    default: '',
    displayOptions: { show: { operation: ['createTask', 'updateTask'] } },
  },
  {
    ...taskIdField,
    displayOptions: {
      show: {
        operation: ['updateTask', 'completeTask', 'deleteTask', 'getTask', 'addReminder'],
      },
    },
  },
  {
    displayName: 'Due At',
    name: 'dueAt',
    type: 'dateTime',
    default: '',
    displayOptions: { show: { operation: ['createTask', 'updateTask', 'addReminder'] } },
  },
  {
    displayName: 'Tags',
    name: 'tags',
    type: 'string',
    default: '',
    description: 'Comma-separated tags',
    displayOptions: { show: { operation: ['createTask', 'updateTask'] } },
  },
  {
    displayName: 'Recurrence Rule',
    name: 'recurrenceRule',
    type: 'string',
    default: '',
    description: 'RRULE string',
    displayOptions: { show: { operation: ['createTask', 'updateTask', 'triggerRecurrence'] } },
  },
  {
    displayName: 'Status',
    name: 'status',
    type: 'string',
    default: '',
    displayOptions: { show: { operation: ['updateTask', 'listTasks'] } },
  },
  {
    displayName: 'Tag Filter',
    name: 'tag',
    type: 'string',
    default: '',
    displayOptions: { show: { operation: ['listTasks'] } },
  },
  {
    displayName: 'From Date',
    name: 'fromDate',
    type: 'dateTime',
    default: '',
    displayOptions: { show: { operation: ['listTasks'] } },
  },
  {
    displayName: 'To Date',
    name: 'toDate',
    type: 'dateTime',
    default: '',
    displayOptions: { show: { operation: ['listTasks'] } },
  },
  {
    displayName: 'Page',
    name: 'page',
    type: 'number',
    default: 1,
    typeOptions: { minValue: 1 },
    displayOptions: { show: { operation: ['listTasks'] } },
  },
  {
    displayName: 'Page Size',
    name: 'pageSize',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1, maxValue: 500 },
    displayOptions: { show: { operation: ['listTasks'] } },
  },
];
