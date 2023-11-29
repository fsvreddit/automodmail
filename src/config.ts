/* eslint-disable camelcase */
import {parseAllDocuments} from "yaml";
import Ajv, {JSONSchemaType} from "ajv";
import {dateComparatorPattern, numericComparatorPattern} from "./autoresponder.js";

export interface ResponseRule {
    subject?: string[],
    subject_regex?: string[],
    body?: string[],
    body_regex?: string[],
    author?: {
        post_karma?: string,
        comment_karma?: string,
        combined_karma?: string,
        account_age?: string,
        satisfy_any_threshold?: boolean,
        is_contributor?: boolean
        is_moderator?: boolean
        is_shadowbanned?: boolean
        is_banned?: boolean
    },
    mod_action?: {
        moderator_name?: string[],
        action_within?: string,
        action_reason?: string[],
    },
    priority?: number,
    reply?: string,
    mute?: number,
    archive?: boolean,
}

const schema: JSONSchemaType<ResponseRule[]> = {
    type: "array",
    items: {
        type: "object",
        properties: {
            subject: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            subject_regex: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            body: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            body_regex: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            author: {
                type: "object",
                properties: {
                    post_karma: {type: "string", nullable: true, pattern: numericComparatorPattern},
                    comment_karma: {type: "string", nullable: true, pattern: numericComparatorPattern},
                    combined_karma: {type: "string", nullable: true, pattern: numericComparatorPattern},
                    account_age: {type: "string", nullable: true, pattern: dateComparatorPattern},
                    satisfy_any_threshold: {type: "boolean", nullable: true},
                    is_contributor: {type: "boolean", nullable: true},
                    is_moderator: {type: "boolean", nullable: true},
                    is_shadowbanned: {type: "boolean", nullable: true},
                    is_banned: {type: "boolean", nullable: true},
                },
                nullable: true,
                additionalProperties: false,
            },
            mod_action: {
                type: "object",
                properties: {
                    moderator_name: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
                    action_within: {type: "string", nullable: true, pattern: dateComparatorPattern},
                    action_reason: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
                },
                nullable: true,
                additionalProperties: false,
            },
            priority: {type: "integer", nullable: true},
            reply: {type: "string", nullable: true},
            mute: {type: "integer", nullable: true},
            archive: {type: "boolean", nullable: true},
        },
        additionalProperties: false,
    },
};

export function parseRules (rules?: string): ResponseRule[] {
    if (!rules) {
        return [];
    }

    const documents = parseAllDocuments(rules, {
        strict: true,
    });

    const parsedRules = documents.map(x => x.toJSON() as ResponseRule).filter(x => x !== null);

    const ajv = new Ajv.default({
        coerceTypes: "array",
    });

    try {
        const validate = ajv.compile(schema);

        if (!validate(parsedRules)) {
            console.log(ajv.errorsText(validate.errors));
            throw new Error(ajv.errorsText(validate.errors));
        }

        for (const rule of parsedRules) {
            const checkInvalid = validateRule(rule);
            if (checkInvalid) {
                throw new Error(checkInvalid);
            }
        }

        return parsedRules;
    } catch (e) {
        if (e instanceof Error) {
            // See if we can humanise the errors
            if (e.message.includes("must NOT have additional properties")) {
                throw new Error(e.message.replace("must NOT have additional properties", "has unknown keys"));
            } else {
                throw e;
            }
        } else {
            throw e;
        }
    }
}

export function validateRule (rule: ResponseRule): string {
    if (!rule.reply && !rule.mute) {
        return "No actions specified. Rule must either reply or mute (or both)";
    }

    if (rule.body_regex) {
        try {
            if (rule.body_regex) {
                rule.body_regex.map(x => new RegExp(x));
            }
        } catch {
            return "Invalid body regex";
        }
    }

    if (rule.subject_regex) {
        try {
            if (rule.subject_regex) {
                rule.subject_regex.map(x => new RegExp(x));
            }
        } catch {
            return "Invalid subject regex";
        }
    }

    if (rule.body && rule.body_regex) {
        return "You can only specify one of: body, body_regex";
    }

    if (rule.subject && rule.subject_regex) {
        return "You can only specify one of: subject, subject_regex";
    }

    return "";
}
