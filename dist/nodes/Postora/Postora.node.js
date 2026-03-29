"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Postora = void 0;
class Postora {
    constructor() {
        this.description = {
            displayName: 'Postora',
            name: 'postora',
            icon: 'file:postora.png',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: 'Publish content to social media platforms via Postora',
            defaults: {
                name: 'Postora',
            },
            inputs: ['main'],
            outputs: ['main'],
            credentials: [
                {
                    name: 'postoraApi',
                    required: true,
                },
            ],
            properties: [
                // ── Resource ──
                {
                    displayName: 'Resource',
                    name: 'resource',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        { name: 'Post', value: 'post' },
                        { name: 'Media', value: 'media' },
                        { name: 'Account', value: 'account' },
                    ],
                    default: 'post',
                },
                // ── Post Operations ──
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['post'] } },
                    options: [
                        { name: 'Create', value: 'create', description: 'Create and publish a post', action: 'Create a post' },
                        { name: 'Get Status', value: 'getStatus', description: 'Get post status and results', action: 'Get post status' },
                        { name: 'List', value: 'list', description: 'List recent posts', action: 'List posts' },
                    ],
                    default: 'create',
                },
                // ── Media Operations ──
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['media'] } },
                    options: [
                        { name: 'Upload', value: 'upload', description: 'Upload a media file', action: 'Upload media' },
                    ],
                    default: 'upload',
                },
                // ── Account Operations ──
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['account'] } },
                    options: [
                        { name: 'List', value: 'list', description: 'List connected accounts', action: 'List accounts' },
                    ],
                    default: 'list',
                },
                // ═══════════════════════════════════
                // Post → Create fields (reordered: Platform first)
                // ═══════════════════════════════════
                {
                    displayName: 'Platform',
                    name: 'platform',
                    type: 'options',
                    options: [
                        { name: 'Facebook', value: 'facebook' },
                        { name: 'Instagram', value: 'instagram' },
                        { name: 'TikTok', value: 'tiktok' },
                        { name: 'Twitter / X', value: 'twitter' },
                        { name: 'LinkedIn', value: 'linkedin' },
                        { name: 'Pinterest', value: 'pinterest' },
                        { name: 'YouTube', value: 'youtube' },
                        { name: 'Threads', value: 'threads' },
                        { name: 'Bluesky', value: 'bluesky' },
                        { name: 'Reddit', value: 'reddit' },
                    ],
                    default: 'facebook',
                    required: true,
                    displayOptions: { show: { resource: ['post'], operation: ['create'] } },
                    description: 'Target platform for the post',
                },
                {
                    displayName: 'Social Accounts',
                    name: 'socialAccounts',
                    type: 'multiOptions',
                    noDataExpression: true,
                    typeOptions: {
                        loadOptionsMethod: 'getAccounts',
                        loadOptionsDependsOn: ['platform'],
                    },
                    default: [],
                    required: true,
                    displayOptions: { show: { resource: ['post'], operation: ['create'] } },
                    description: 'Select accounts to post to (filtered by chosen platform)',
                },
                {
                    displayName: 'Caption',
                    name: 'caption',
                    type: 'string',
                    typeOptions: { rows: 4 },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['post'], operation: ['create'] } },
                    description: 'The post caption / text content',
                },
                {
                    displayName: 'Media Source',
                    name: 'mediaSource',
                    type: 'options',
                    options: [
                        { name: 'None', value: 'none' },
                        { name: 'URL', value: 'url' },
                        { name: 'Binary Data', value: 'binary' },
                    ],
                    default: 'none',
                    displayOptions: { show: { resource: ['post'], operation: ['create'] } },
                    description: 'How to attach media to the post',
                },
                {
                    displayName: 'Media URLs',
                    name: 'mediaUrls',
                    type: 'string',
                    default: '',
                    displayOptions: { show: { resource: ['post'], operation: ['create'], mediaSource: ['url'] } },
                    description: 'Comma-separated media URLs (images or videos). The API will download and attach them to the post.',
                },
                {
                    displayName: 'Binary Property',
                    name: 'mediaBinaryProperty',
                    type: 'string',
                    default: 'data',
                    displayOptions: { show: { resource: ['post'], operation: ['create'], mediaSource: ['binary'] } },
                    description: 'Name of the binary property containing the media file(s). For multiple files, use comma-separated names (e.g., data,data1,data2).',
                },
                {
                    displayName: 'Schedule At',
                    name: 'scheduledAt',
                    type: 'dateTime',
                    default: '',
                    displayOptions: { show: { resource: ['post'], operation: ['create'] } },
                    description: 'Schedule post for a future time (ISO 8601). Leave empty to post immediately.',
                },
                {
                    displayName: 'Additional Options',
                    name: 'additionalOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: { show: { resource: ['post'], operation: ['create'] } },
                    options: [
                        // YouTube options
                        {
                            displayName: 'YouTube Title',
                            name: 'youtubeTitle',
                            type: 'string',
                            default: '',
                            description: 'Title for YouTube videos',
                        },
                        {
                            displayName: 'YouTube Privacy',
                            name: 'youtubePrivacy',
                            type: 'options',
                            options: [
                                { name: 'Public', value: 'public' },
                                { name: 'Unlisted', value: 'unlisted' },
                                { name: 'Private', value: 'private' },
                            ],
                            default: 'public',
                            description: 'YouTube video privacy setting',
                        },
                        {
                            displayName: 'YouTube Category',
                            name: 'youtubeCategory',
                            type: 'string',
                            default: '22',
                            description: 'YouTube category ID (default: People & Blogs)',
                        },
                        // TikTok options
                        {
                            displayName: 'TikTok Privacy',
                            name: 'tiktokPrivacy',
                            type: 'options',
                            options: [
                                { name: 'Public', value: 'PUBLIC_TO_EVERYONE' },
                                { name: 'Friends', value: 'MUTUAL_FOLLOW_FRIENDS' },
                                { name: 'Followers', value: 'FOLLOWER_OF_CREATOR' },
                                { name: 'Only Me', value: 'SELF_ONLY' },
                            ],
                            default: 'PUBLIC_TO_EVERYONE',
                            description: 'TikTok video privacy level',
                        },
                        {
                            displayName: 'TikTok Allow Comments',
                            name: 'tiktokAllowComments',
                            type: 'boolean',
                            default: false,
                        },
                        {
                            displayName: 'TikTok Allow Duet',
                            name: 'tiktokAllowDuet',
                            type: 'boolean',
                            default: false,
                        },
                        {
                            displayName: 'TikTok Allow Stitch',
                            name: 'tiktokAllowStitch',
                            type: 'boolean',
                            default: false,
                        },
                        // Pinterest options
                        {
                            displayName: 'Pinterest Board ID',
                            name: 'pinterestBoardId',
                            type: 'string',
                            default: '',
                            description: 'Pinterest board to pin to',
                        },
                        {
                            displayName: 'Pinterest Title',
                            name: 'pinterestTitle',
                            type: 'string',
                            default: '',
                        },
                        // Reddit options
                        {
                            displayName: 'Reddit Subreddit',
                            name: 'redditSubreddit',
                            type: 'string',
                            default: '',
                            description: 'Subreddit name (without r/)',
                        },
                        {
                            displayName: 'Reddit Title',
                            name: 'redditTitle',
                            type: 'string',
                            default: '',
                        },
                    ],
                },
                // ═══════════════════════════════════
                // Post → Get Status fields
                // ═══════════════════════════════════
                {
                    displayName: 'Post ID',
                    name: 'postId',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['post'], operation: ['getStatus'] } },
                    description: 'The ID of the post to check',
                },
                // ═══════════════════════════════════
                // Post → List fields
                // ═══════════════════════════════════
                {
                    displayName: 'Status Filter',
                    name: 'statusFilter',
                    type: 'options',
                    displayOptions: { show: { resource: ['post'], operation: ['list'] } },
                    options: [
                        { name: 'All', value: '' },
                        { name: 'Pending', value: 'pending' },
                        { name: 'Processing', value: 'processing' },
                        { name: 'Completed', value: 'completed' },
                        { name: 'Failed', value: 'failed' },
                    ],
                    default: '',
                },
                {
                    displayName: 'Limit',
                    name: 'limit',
                    type: 'number',
                    typeOptions: { minValue: 1, maxValue: 100 },
                    default: 20,
                    displayOptions: { show: { resource: ['post'], operation: ['list'] } },
                },
                // ═══════════════════════════════════
                // Media → Upload fields
                // ═══════════════════════════════════
                {
                    displayName: 'Binary Property',
                    name: 'binaryPropertyName',
                    type: 'string',
                    default: 'data',
                    required: true,
                    displayOptions: { show: { resource: ['media'], operation: ['upload'] } },
                    description: 'Name of the binary property containing the file to upload',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getAccounts() {
                    const credentials = await this.getCredentials('postoraApi');
                    const baseUrl = credentials.baseUrl;
                    const apiKey = credentials.apiKey;
                    // Get the currently selected platform
                    const platform = this.getCurrentNodeParameter('platform');
                    let url = `${baseUrl}/api/v1/accounts`;
                    if (platform) {
                        url += `?platform=${encodeURIComponent(platform)}`;
                    }
                    const response = await this.helpers.httpRequest({
                        method: 'GET',
                        url,
                        headers: { 'x-api-key': apiKey },
                        json: true,
                    });
                    if (!response?.accounts || !Array.isArray(response.accounts)) {
                        return [];
                    }
                    return response.accounts.map((account) => ({
                        name: `${account.platform_username || 'Unknown'}=${account.platform_user_id || account.id}`,
                        value: account.id,
                    }));
                },
            },
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const resource = this.getNodeParameter('resource', 0);
        const operation = this.getNodeParameter('operation', 0);
        const credentials = await this.getCredentials('postoraApi');
        const baseUrl = credentials.baseUrl;
        for (let i = 0; i < items.length; i++) {
            try {
                let responseData;
                // ── Account → List ──
                if (resource === 'account' && operation === 'list') {
                    responseData = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${baseUrl}/api/v1/accounts`,
                        headers: { 'x-api-key': credentials.apiKey },
                        json: true,
                    });
                }
                // ── Post → Create ──
                else if (resource === 'post' && operation === 'create') {
                    const platform = this.getNodeParameter('platform', i);
                    const caption = this.getNodeParameter('caption', i);
                    const socialAccounts = this.getNodeParameter('socialAccounts', i);
                    const mediaSource = this.getNodeParameter('mediaSource', i, 'none');
                    const mediaUrls = mediaSource === 'url'
                        ? this.getNodeParameter('mediaUrls', i, '')
                            .split(',').map(s => s.trim()).filter(Boolean)
                        : [];
                    const scheduledAt = this.getNodeParameter('scheduledAt', i, '');
                    const additionalOptions = this.getNodeParameter('additionalOptions', i, {});
                    const body = {
                        caption,
                        platforms: [platform],
                    };
                    if (socialAccounts.length)
                        body.account_ids = socialAccounts;
                    if (mediaUrls.length)
                        body.media_urls = mediaUrls;
                    // Binary data → base64 (supports multiple comma-separated property names)
                    if (mediaSource === 'binary') {
                        const binaryProp = this.getNodeParameter('mediaBinaryProperty', i, 'data');
                        const binaryProps = binaryProp.split(',').map(p => p.trim()).filter(Boolean);
                        const base64Files = [];
                        for (const prop of binaryProps) {
                            const bd = this.helpers.assertBinaryData(i, prop);
                            const buf = await this.helpers.getBinaryDataBuffer(i, prop);
                            base64Files.push(`data:${bd.mimeType};base64,${buf.toString('base64')}`);
                        }
                        body.media_base64 = base64Files;
                    }
                    if (scheduledAt)
                        body.scheduled_at = scheduledAt;
                    // Platform-specific metadata
                    if (additionalOptions.youtubeTitle)
                        body.youtube_title = additionalOptions.youtubeTitle;
                    if (additionalOptions.youtubePrivacy)
                        body.youtube_privacy = additionalOptions.youtubePrivacy;
                    if (additionalOptions.youtubeCategory)
                        body.youtube_category = additionalOptions.youtubeCategory;
                    if (additionalOptions.tiktokPrivacy)
                        body.tiktok_privacy = additionalOptions.tiktokPrivacy;
                    if (additionalOptions.tiktokAllowComments !== undefined)
                        body.tiktok_allow_comments = additionalOptions.tiktokAllowComments;
                    if (additionalOptions.tiktokAllowDuet !== undefined)
                        body.tiktok_allow_duet = additionalOptions.tiktokAllowDuet;
                    if (additionalOptions.tiktokAllowStitch !== undefined)
                        body.tiktok_allow_stitch = additionalOptions.tiktokAllowStitch;
                    if (additionalOptions.pinterestBoardId)
                        body.pinterest_board_id = additionalOptions.pinterestBoardId;
                    if (additionalOptions.pinterestTitle)
                        body.pinterest_title = additionalOptions.pinterestTitle;
                    if (additionalOptions.redditSubreddit)
                        body.reddit_subreddit = additionalOptions.redditSubreddit;
                    if (additionalOptions.redditTitle)
                        body.reddit_title = additionalOptions.redditTitle;
                    responseData = await this.helpers.httpRequest({
                        method: 'POST',
                        url: `${baseUrl}/api/v1/post`,
                        headers: {
                            'x-api-key': credentials.apiKey,
                            'Content-Type': 'application/json',
                        },
                        body,
                        json: true,
                    });
                }
                // ── Post → Get Status ──
                else if (resource === 'post' && operation === 'getStatus') {
                    const postId = this.getNodeParameter('postId', i);
                    responseData = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${baseUrl}/api/v1/post/${postId}`,
                        headers: { 'x-api-key': credentials.apiKey },
                        json: true,
                    });
                }
                // ── Post → List ──
                else if (resource === 'post' && operation === 'list') {
                    const statusFilter = this.getNodeParameter('statusFilter', i, '');
                    const limit = this.getNodeParameter('limit', i, 20);
                    let url = `${baseUrl}/api/v1/posts?limit=${limit}`;
                    if (statusFilter)
                        url += `&status=${statusFilter}`;
                    responseData = await this.helpers.httpRequest({
                        method: 'GET',
                        url,
                        headers: { 'x-api-key': credentials.apiKey },
                        json: true,
                    });
                }
                // ── Media → Upload ──
                else if (resource === 'media' && operation === 'upload') {
                    const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i);
                    const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
                    const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
                    const boundary = '----n8nFormBoundary' + Math.random().toString(36).substring(2);
                    const fileName = binaryData.fileName || 'upload';
                    const mimeType = binaryData.mimeType || 'application/octet-stream';
                    const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
                    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
                    const multipartBody = Buffer.concat([header, buffer, footer]);
                    responseData = await this.helpers.httpRequest({
                        method: 'POST',
                        url: `${baseUrl}/api/v1/media/upload`,
                        headers: {
                            'x-api-key': credentials.apiKey,
                            'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        },
                        body: multipartBody,
                    });
                    // Parse JSON response if it comes back as a string
                    if (typeof responseData === 'string') {
                        try {
                            responseData = JSON.parse(responseData);
                        }
                        catch (_) { /* keep as-is */ }
                    }
                }
                if (Array.isArray(responseData)) {
                    returnData.push(...responseData.map((item) => ({ json: item })));
                }
                else {
                    returnData.push({ json: responseData ?? {} });
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: error.message },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                throw error;
            }
        }
        return [returnData];
    }
}
exports.Postora = Postora;
//# sourceMappingURL=Postora.node.js.map