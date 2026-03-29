"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostoraApi = void 0;
class PostoraApi {
    constructor() {
        this.name = 'postoraApi';
        this.displayName = 'Postora API';
        this.documentationUrl = 'https://postora.cloud/docs/api';
        this.properties = [
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                required: true,
                description: 'Your Postora API key. Find it in Settings → API Keys at postora.cloud.',
            },
            {
                displayName: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'https://api.postora.cloud/functions/v1/n8n-api',
                description: 'Postora API base URL. Only change if using a self-hosted instance.',
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    'x-api-key': '={{$credentials.apiKey}}',
                },
            },
        };
    }
}
exports.PostoraApi = PostoraApi;
//# sourceMappingURL=PostoraApi.credentials.js.map