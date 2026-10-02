"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostoraTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const webhookLifecycle_1 = require("../shared/webhookLifecycle");
// n8n reads parameters straight off the stored node, and throws for one it has never stored,
// so every read here passes the property's own default as the fallback.
function eventsForCategories(context, categories) {
    const events = [];
    if (categories.includes("post"))
        events.push("post.completed");
    if (categories.includes("message")) {
        events.push(...context.getNodeParameter("messageEvents", ["message.received"]));
    }
    if (categories.includes("comment")) {
        events.push(...context.getNodeParameter("commentEvents", ["comment.received"]));
    }
    // "All Platforms" alongside a specific platform is harmless — Postora matches a payload
    // against the whole list and delivers once per subscription — so only exact repeats are dropped.
    return [...new Set(events)];
}
// Versions 1 and 3 list every event in one flat "Events" multi-select, which puts Threads
// beside WhatsApp under the message family even though Postora only ever emits Threads
// activity as a comment envelope. Versions 2 and 4 ask for the category first so the
// impossible pairings are not offered at all. Each version keeps reading what it saved.
function resolveSubscribedEvents(context) {
    const events = context.getNodeParameter("events", []);
    const typeVersion = context.getNode().typeVersion || 1;
    if (typeVersion === 1)
        return events;
    if (typeVersion === 3) {
        if (events.length > 0)
            return events;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), "Select at least one Event before activating the Postora Trigger.");
    }
    const categories = context.getNodeParameter("eventCategories", []);
    if (categories.length > 0)
        return eventsForCategories(context, categories);
    // Adding this node from the triggers side panel writes the chosen event straight into
    // `events`, which the category versions hide. Honouring it here is what makes the panel
    // entries produce the subscription they name. Any category selection takes precedence
    // over it, so the two can never combine into a subscription nobody asked for — clearing
    // every category does fall back to it again rather than erroring.
    if (events.length > 0)
        return events;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), "Select at least one Event Category, and at least one platform inside it, before activating the Postora Trigger.");
}
// Fallbacks of "" rather than throwing: a version 1 or 2 node never stored either parameter.
function readFilters(context) {
    return {
        platform: context.getNodeParameter("platform", "") || "",
        socialAccountId: context.getNodeParameter("socialAccountId", "") || "",
    };
}
// A filter left at "All" is omitted rather than sent empty: the dispatcher treats an absent
// filter as accept-all, which is also what every subscription registered before filters
// existed looks like.
function registrationBody(callbackUrl, events, filters) {
    const body = { webhook_url: callbackUrl, events };
    if (filters.platform)
        body.platform = filters.platform;
    if (filters.socialAccountId)
        body.social_account_id = filters.socialAccountId;
    return body;
}
const ACCOUNT_PLATFORMS = ["facebook", "instagram", "threads", "whatsapp"];
const MESSAGE_PLATFORMS = ["whatsapp", "instagram", "facebook"];
const COMMENT_PLATFORMS = ["facebook", "instagram", "threads"];
// An account is on exactly one platform, so choosing one already says which platform to hear
// from; the separate Platform filter that version 3 had was the same choice made twice. What
// the Account list shows is therefore derived from the events selected above it. With nothing
// selected yet it shows every account that can emit a message or a comment.
function platformsImpliedBy(events) {
    const implied = new Set();
    for (const event of events) {
        const [family, platform] = event.split(".");
        const whole = family === "message" ? MESSAGE_PLATFORMS : family === "comment" ? COMMENT_PLATFORMS : [];
        if (platform === "received")
            whole.forEach((name) => implied.add(name));
        else if (whole.includes(platform))
            implied.add(platform);
    }
    return implied.size > 0 ? [...implied] : ACCOUNT_PLATFORMS;
}
function selectedEventsForAccountList(context) {
    const categories = context.getCurrentNodeParameter("eventCategories") ?? [];
    const events = [];
    if (categories.includes("message")) {
        events.push(...(context.getCurrentNodeParameter("messageEvents") ?? ["message.received"]));
    }
    if (categories.includes("comment")) {
        events.push(...(context.getCurrentNodeParameter("commentEvents") ?? ["comment.received"]));
    }
    return events;
}
class PostoraTrigger {
    constructor() {
        this.description = {
            displayName: "Postora Trigger",
            name: "postoraTrigger",
            icon: "file:../Postora/postora.svg",
            group: ["trigger"],
            version: [1, 2, 3, 4],
            defaultVersion: 4,
            subtitle: '={{ ($parameter["eventCategories"] || $parameter["events"] || []).join(", ") }}',
            description: "Starts a workflow when Postora sends an event",
            defaults: {
                name: "Postora Trigger",
            },
            inputs: [],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            credentials: [
                {
                    name: "postoraApi",
                    required: true,
                },
            ],
            webhooks: [
                {
                    name: "default",
                    httpMethod: "POST",
                    path: "postora",
                },
            ],
            properties: [
                {
                    // First on purpose: n8n builds the triggers side panel from the first property named
                    // "Events" without checking @version, so this list is what the panel shows for every
                    // version. Only version 3 nodes display it; a panel click on a version 4 node stores
                    // its one event here and resolveSubscribedEvents honours it.
                    displayName: "Events",
                    name: "events",
                    type: "multiOptions",
                    options: [
                        {
                            name: "Comment (All Platforms)",
                            value: "comment.received",
                            action: "Comment (All Platforms)",
                            description: "A comment or reply reached Facebook, Instagram or Threads",
                        },
                        {
                            name: "Comment (Facebook)",
                            value: "comment.facebook",
                            action: "Comment (Facebook)",
                            description: "A comment was posted on a connected Facebook Page",
                        },
                        {
                            name: "Comment (Instagram)",
                            value: "comment.instagram",
                            action: "Comment (Instagram)",
                            description: "A comment was posted on a connected Instagram post",
                        },
                        {
                            name: "DM Message (All Platforms)",
                            value: "message.received",
                            action: "DM Message (All Platforms)",
                            description: "A direct message reached WhatsApp, Instagram or Facebook",
                        },
                        {
                            name: "DM Message (Facebook)",
                            value: "message.facebook",
                            action: "DM Message (Facebook)",
                            description: "A direct message reached a connected Facebook Page",
                        },
                        {
                            name: "DM Message (Instagram)",
                            value: "message.instagram",
                            action: "DM Message (Instagram)",
                            description: "A direct message reached a connected Instagram account",
                        },
                        {
                            name: "DM Message (WhatsApp)",
                            value: "message.whatsapp",
                            action: "DM Message (WhatsApp)",
                            description: "A message reached a connected WhatsApp account",
                        },
                        {
                            name: "Post Completed",
                            value: "post.completed",
                            action: "Post Completed",
                            description: "A scheduled or queued Postora post finished publishing",
                        },
                        {
                            name: "Reply / Mention (Threads)",
                            value: "comment.threads",
                            action: "Reply / Mention (Threads)",
                            description: "A reply or mention was received on Threads",
                        },
                    ],
                    default: ["comment.received"],
                    displayOptions: { show: { "@version": [3] } },
                },
                {
                    displayName: "Event Category",
                    name: "eventCategories",
                    type: "multiOptions",
                    options: [
                        {
                            name: "Post Completed",
                            value: "post",
                            description: "A scheduled or queued Postora post finished publishing",
                        },
                        {
                            name: "Message Received",
                            value: "message",
                            description: "A direct message reached a connected WhatsApp, Instagram or Facebook account",
                        },
                        {
                            name: "Comment Received",
                            value: "comment",
                            description: "A comment, reply or mention reached a connected Facebook, Instagram or Threads account",
                        },
                    ],
                    default: [],
                    description: "Pick as many categories as the workflow should react to. Each one adds its own platform selector below.",
                    displayOptions: { show: { "@version": [2, 4] } },
                },
                {
                    displayName: "Message Platforms",
                    name: "messageEvents",
                    type: "multiOptions",
                    options: [
                        { name: "All Platforms", value: "message.received" },
                        { name: "WhatsApp", value: "message.whatsapp" },
                        { name: "Instagram", value: "message.instagram" },
                        { name: "Facebook", value: "message.facebook" },
                    ],
                    default: ["message.received"],
                    description: "Threads is absent on purpose: Postora never emits a Threads direct message, only comment-shaped events. Subscribe to those under Comment Received.",
                    displayOptions: { show: { "@version": [2, 4], eventCategories: ["message"] } },
                },
                {
                    displayName: "Comment Platforms",
                    name: "commentEvents",
                    type: "multiOptions",
                    options: [
                        { name: "All Platforms", value: "comment.received" },
                        { name: "Facebook", value: "comment.facebook" },
                        { name: "Instagram", value: "comment.instagram" },
                        { name: "Threads", value: "comment.threads" },
                    ],
                    default: ["comment.received"],
                    description: "WhatsApp is absent on purpose: it has no public comments. Threads covers both replies and mentions — read comment.kind to tell them apart.",
                    displayOptions: { show: { "@version": [2, 4], eventCategories: ["comment"] } },
                },
                {
                    displayName: "Platform",
                    name: "platform",
                    type: "options",
                    options: [
                        { name: "All", value: "" },
                        { name: "Facebook", value: "facebook" },
                        { name: "Instagram", value: "instagram" },
                        { name: "Threads", value: "threads" },
                        { name: "WhatsApp", value: "whatsapp" },
                    ],
                    default: "",
                    description: "Only message and comment events from this platform trigger the workflow. Post Completed events are not filtered.",
                    displayOptions: { show: { "@version": [3] } },
                },
                {
                    displayName: "Account Name or ID",
                    name: "socialAccountId",
                    type: "options",
                    typeOptions: {
                        loadOptionsMethod: "getAccounts",
                        loadOptionsDependsOn: ["platform", "eventCategories", "messageEvents", "commentEvents"],
                    },
                    default: "",
                    description: 'Only message and comment events on this account trigger the workflow. The list follows the platforms selected above. For comments, the account\'s Comments automation handler must be set to n8n in Postora (Messaging → Automation), otherwise no comment events are sent. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                    displayOptions: { show: { "@version": [3, 4] } },
                },
                {
                    // Deliberately NOT first in this array. n8n builds the triggers side panel from the
                    // first property named "Events" regardless of @version, so anything placed ahead of
                    // that list would take its place and empty the panel.
                    //
                    // Why it exists: activating a workflow is what registers the subscription with
                    // Postora. "Test workflow" registers one too, then deletes it the moment the editor
                    // stops listening, so a user who only ever tests sees their events arrive live and
                    // then nothing at all afterwards -- with no error, because from Postora's side there
                    // is simply no subscriber. That mismatch cost a support investigation on 2026-08-24.
                    displayName: "Test workflow only listens while this editor tab is open. Save and Activate the workflow to receive events continuously.",
                    name: "activationNotice",
                    type: "notice",
                    default: "",
                },
                {
                    // The flat list version 1 workflows still read. Version 2 nodes created from the
                    // side panel also stored their one event here, which resolveSubscribedEvents honours.
                    displayName: "Events",
                    name: "events",
                    type: "multiOptions",
                    options: [
                        {
                            name: "Comment Received (All Platforms)",
                            value: "comment.received",
                            action: "Comment Received (All Platforms)",
                        },
                        {
                            name: "Comment Received (Facebook)",
                            value: "comment.facebook",
                            action: "Comment Received (Facebook)",
                        },
                        {
                            name: "Comment Received (Instagram)",
                            value: "comment.instagram",
                            action: "Comment Received (Instagram)",
                        },
                        {
                            name: "Comment Received (Threads)",
                            value: "comment.threads",
                            action: "Comment Received (Threads)",
                        },
                        {
                            name: "Message Received (All Platforms)",
                            value: "message.received",
                            action: "Message Received (All Platforms)",
                        },
                        {
                            name: "Message Received (Facebook)",
                            value: "message.facebook",
                            action: "Message Received (Facebook)",
                        },
                        {
                            name: "Message Received (Instagram)",
                            value: "message.instagram",
                            action: "Message Received (Instagram)",
                        },
                        {
                            name: "Message Received (WhatsApp)",
                            value: "message.whatsapp",
                            action: "Message Received (WhatsApp)",
                        },
                        {
                            name: "Post Completed",
                            value: "post.completed",
                            action: "Post Completed",
                        },
                    ],
                    default: [],
                    displayOptions: { show: { "@version": [1] } },
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getAccounts() {
                    const credentials = await this.getCredentials("postoraApi");
                    const baseUrl = credentials.baseUrl;
                    // A version 3 node still carries its Platform field; a version 4 node implies the
                    // platforms from its category selection. One API call for everything, filtered here,
                    // because the API takes a single platform and the selection can name several.
                    const platform = this.getCurrentNodeParameter("platform") || "";
                    const platforms = platform ? [platform] : platformsImpliedBy(selectedEventsForAccountList(this));
                    const response = await this.helpers.httpRequestWithAuthentication.call(this, "postoraApi", { method: "GET", url: `${baseUrl}/api/v1/accounts`, json: true });
                    const accounts = Array.isArray(response?.accounts) ? response.accounts : [];
                    return [
                        { name: "All Accounts", value: "" },
                        ...accounts
                            .filter((account) => platforms.includes(account.platform))
                            .map((account) => ({
                            name: `${account.platform_username || account.name || account.id} (${account.platform})`,
                            value: account.id,
                        })),
                    ];
                },
            },
        };
        this.webhookMethods = {
            default: {
                // Answered from the server rather than from static data. A cached id alone says
                // nothing about what Postora is actually subscribed to, so editing the Events
                // selection used to leave the original subscription in place forever and the
                // workflow silently received the wrong events.
                async checkExists() {
                    const staticData = this.getWorkflowStaticData("node");
                    const webhookId = staticData.webhookId;
                    if (!webhookId)
                        return false;
                    const credentials = await this.getCredentials("postoraApi");
                    const events = resolveSubscribedEvents(this);
                    const filters = readFilters(this);
                    const callbackUrl = this.getNodeWebhookUrl("default");
                    // Without a callback URL every registration compares as mismatched, which would retire a
                    // perfectly good subscription and then fail in create() for the very same missing URL.
                    // Keep what is registered and let create() report the problem if it is ever reached.
                    if (!callbackUrl)
                        return true;
                    let listing;
                    try {
                        listing = await (0, webhookLifecycle_1.listWebhooks)(this, credentials.baseUrl);
                    }
                    catch (error) {
                        // Postora being unreachable is not evidence the registration is gone, and
                        // re-registering on every transient error would pile up duplicates.
                        this.logger?.warn("Postora unreachable during checkExists — assuming webhook still registered", { error });
                        return true;
                    }
                    const existing = (listing.webhooks || []).find((webhook) => webhook.id === webhookId);
                    const matches = Boolean(existing &&
                        existing.is_active !== false &&
                        existing.webhook_url === callbackUrl &&
                        (0, webhookLifecycle_1.sameEventSet)(existing.events || [], events) &&
                        (existing.platform || "") === filters.platform &&
                        (existing.social_account_id || "") === filters.socialAccountId);
                    if (matches)
                        return true;
                    // Returning false makes n8n call create(), which registers a fresh id. Without
                    // retiring the superseded row first, every Events edit would leave another live
                    // subscription pointing at this same workflow and duplicate its executions.
                    if (existing) {
                        try {
                            await (0, webhookLifecycle_1.unregisterWebhook)(this, credentials.baseUrl, webhookId);
                        }
                        catch (error) {
                            // A surviving subscription is not inert: it keeps the same callback URL, and
                            // Postora's post-event fan-out does not deduplicate by URL, so any event kept
                            // across the edit would run this workflow twice. Refuse to re-register rather
                            // than leave two live subscriptions behind.
                            if (!(0, webhookLifecycle_1.isAlreadyGone)(error)) {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Postora could not retire the previous webhook subscription (${webhookId}), so re-registering would deliver some events twice. Resolve the Postora API error and activate again.`, { description: error instanceof Error ? error.message : String(error) });
                            }
                        }
                    }
                    delete staticData.webhookId;
                    return false;
                },
                async create() {
                    const credentials = await this.getCredentials("postoraApi");
                    const events = resolveSubscribedEvents(this);
                    const callbackUrl = this.getNodeWebhookUrl("default");
                    if (!callbackUrl) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), "Postora webhook registration requires an n8n callback URL.");
                    }
                    const registration = await this.helpers.httpRequestWithAuthentication.call(this, "postoraApi", {
                        method: "POST",
                        url: `${credentials.baseUrl}/api/v1/webhooks`,
                        body: registrationBody(callbackUrl, events, readFilters(this)),
                    });
                    this.getWorkflowStaticData("node").webhookId = registration.webhook.id;
                    return true;
                },
                async delete() {
                    const staticData = this.getWorkflowStaticData("node");
                    const webhookId = staticData.webhookId;
                    if (!webhookId)
                        return true;
                    const credentials = await this.getCredentials("postoraApi");
                    try {
                        await (0, webhookLifecycle_1.unregisterWebhook)(this, credentials.baseUrl, webhookId);
                    }
                    catch (error) {
                        // Already gone on Postora's side is the outcome deactivation wanted.
                        if (!(0, webhookLifecycle_1.isAlreadyGone)(error))
                            throw error;
                    }
                    delete staticData.webhookId;
                    return true;
                },
            },
        };
    }
    async webhook() {
        return {
            workflowData: [[{ json: this.getBodyData() }]],
            webhookResponse: { status: 200 },
        };
    }
}
exports.PostoraTrigger = PostoraTrigger;
//# sourceMappingURL=PostoraTrigger.node.js.map