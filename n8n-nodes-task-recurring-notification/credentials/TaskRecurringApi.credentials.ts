import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class TaskRecurringApi implements ICredentialType {
  name = 'taskRecurringApi';

  displayName = 'Task Recurring API';

  documentationUrl = 'https://github.com/Drmusab/task-recurring-notification-management';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:6806',
      required: true,
      description: 'Base URL for SiYuan plugin backend API',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Auth Mode',
      name: 'authMode',
      type: 'options',
      default: 'apiKey',
      options: [
        { name: 'API Key Header', value: 'apiKey' },
        { name: 'Bearer Token', value: 'bearerToken' },
      ],
    },
    {
      displayName: 'Secret',
      name: 'secret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'Optional HMAC secret for request signing and trigger validation',
    },
    {
      displayName: 'Workspace ID',
      name: 'workspaceId',
      type: 'string',
      default: '',
      description: 'Optional workspace identifier sent with requests',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'headerAuth',
    properties: {
      Authorization: '={{$credentials.authMode === "bearerToken" ? `Bearer ${$credentials.apiKey}` : undefined}}',
      'X-API-Key': '={{$credentials.authMode === "apiKey" ? $credentials.apiKey : undefined}}',
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/api/health',
      method: 'GET',
    },
  };
}
