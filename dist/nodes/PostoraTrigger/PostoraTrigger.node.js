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
// Version 1 listed every event in one flat "Events" multi-select, which put Threads beside
// WhatsApp under the message family even though Postora only ever emits Threads activity as
// a comment envelope. Version 2 asks for the category first so the impossible pairings are
// not offered at all. Version 1 nodes keep reading their saved "events" selection.
function resolveSubscribedEvents(context) {
    const events = context.getNodeParameter("events", []);
    if ((context.getNode().typeVersion || 1) < 2)
        return events;
    const categories = context.getNodeParameter("eventCategories", []);
    if (categories.length > 0)
        return eventsForCategories(context, categories);
    // Adding this node from the triggers side panel writes the chosen event straight into
    // `events`, which version 2 hides. Honouring it here is what makes those nine panel
    // entries produce the subscription they name. Picking a category replaces it outright,
    // so a stale hidden value can never survive a later edit.
    if (events.length > 0)
        return events;
    throw new Error("Select at least one Event Category, and at least one platform inside it, before activating the Postora Trigger.");
}
class PostoraTrigger {
    constructor() {
        this.description = {
            displayName: "Postora Trigger",
            name: "postoraTrigger",
            icon: "fa:bolt",
            group: ["trigger"],
            version: [1, 2],
            defaultVersion: 2,
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
                    displayOptions: { show: { "@version": [2] } },
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
                    displayOptions: { show: { "@version": [2], eventCategories: ["message"] } },
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
                    displayOptions: { show: { "@version": [2], eventCategories: ["comment"] } },
                },
                {
                    // Two jobs. It is the parameter version 1 workflows still read, and — because n8n
                    // builds the triggers side panel from the first property named "Event"/"Events"
                    // without checking @version — it is also the list of entries that panel shows for
                    // every version. The nine options below are therefore the nine panel triggers, and
                    // resolveSubscribedEvents honours the one a panel click writes.
                    displayName: "Events",
                    name: "events",
                    type: "multiOptions",
                    options: [
                        {
                            name: "Post Completed",
                            value: "post.completed",
                            action: "Post Completed",
                        },
                        {
                            name: "Message Received (All Platforms)",
                            value: "message.received",
                            action: "Message Received (All Platforms)",
                        },
                        {
                            name: "Message Received (WhatsApp)",
                            value: "message.whatsapp",
                            action: "Message Received (WhatsApp)",
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
                    ],
                    default: [],
                    displayOptions: { show: { "@version": [1] } },
                },
            ],
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
                    const callbackUrl = this.getNodeWebhookUrl("default");
                    // Without a callback URL every registration compares as mismatched, which would retire a
                    // perfectly good subscription and then fail in create() for the very same missing URL.
                    // Keep what is registered and let create() report the problem if it is ever reached.
                    if (!callbackUrl)
                        return true;
                    let listing;
                    try {
                        listing = await this.helpers.httpRequestWithAuthentication.call(this, "postoraApi", { method: "GET", url: `${credentials.baseUrl}/api/v1/webhooks` });
                    }
                    catch {
                        // Postora being unreachable is not evidence the registration is gone, and
                        // re-registering on every transient error would pile up duplicates.
                        return true;
                    }
                    const existing = (listing.webhooks || []).find((webhook) => webhook.id === webhookId);
                    const matches = Boolean(existing &&
                        existing.is_active !== false &&
                        existing.webhook_url === callbackUrl &&
                        (0, webhookLifecycle_1.sameEventSet)(existing.events || [], events));
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
                                throw new Error(`Postora could not retire the previous webhook subscription (${webhookId}), so re-registering would deliver some events twice. Resolve the Postora API error and activate again.`);
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
                        throw new Error("Postora webhook registration requires an n8n callback URL.");
                    }
                    const registration = await this.helpers.httpRequestWithAuthentication.call(this, "postoraApi", {
                        method: "POST",
                        url: `${credentials.baseUrl}/api/v1/webhooks`,
                        body: { webhook_url: callbackUrl, events },
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
                    await (0, webhookLifecycle_1.unregisterWebhook)(this, credentials.baseUrl, webhookId);
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