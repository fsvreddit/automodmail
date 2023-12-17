/* eslint-disable camelcase */
import {parseAllDocuments} from "yaml";
import Ajv, {JSONSchemaType} from "ajv";
import {dateComparatorPattern, numericComparatorPattern} from "./autoresponder.js";
import {ModActionType} from "@devvit/public-api";

export interface ResponseRule {
    subject?: string[],
    notsubject?: string[],
    subject_regex?: string[],
    notsubject_regex?: string[],
    body?: string[],
    notbody?: string[],
    body_regex?: string[],
    notbody_regex?: string[],
    author?: {
        name?: string[],
        name_regex?: string[],
        post_karma?: string,
        comment_karma?: string,
        combined_karma?: string,
        account_age?: string,
        satisfy_any_threshold?: boolean,
        flair_text?: string,
        flair_css_class?: string,
        is_contributor?: boolean
        is_moderator?: boolean
        is_shadowbanned?: boolean
        is_banned?: boolean
    },
    mod_action?: {
        moderator_name?: string[],
        mod_action_type?: ModActionType,
        action_within?: string,
        action_reason?: string[],
    },
    priority?: number,
    reply?: string,
    mute?: number,
    archive?: boolean,
    unban?: boolean,
}

/**
 * Ajv schema used to validate response rules.
 */
const schema: JSONSchemaType<ResponseRule[]> = {
    type: "array",
    items: {
        type: "object",
        properties: {
            subject: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            notsubject: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            subject_regex: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            notsubject_regex: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            body: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            notbody: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            body_regex: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            notbody_regex: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            author: {
                type: "object",
                properties: {
                    name: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
                    name_regex: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
                    post_karma: {type: "string", nullable: true, pattern: numericComparatorPattern},
                    comment_karma: {type: "string", nullable: true, pattern: numericComparatorPattern},
                    combined_karma: {type: "string", nullable: true, pattern: numericComparatorPattern},
                    account_age: {type: "string", nullable: true, pattern: dateComparatorPattern},
                    satisfy_any_threshold: {type: "boolean", nullable: true},
                    flair_text: {type: "string", nullable: true, minLength: 1},
                    flair_css_class: {type: "string", nullable: true, minLength: 1},
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
                    mod_action_type: {type: "string", nullable: true, enum: ["banuser", "unbanuser", "spamlink", "removelink", "approvelink", "spamcomment", "removecomment", "approvecomment", "editflair", "lock", "unlock", "muteuser", "unmuteuser"]},
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
            unban: {type: "boolean", nullable: true},
        },
        additionalProperties: false,
    },
};

/**
 * Parses Modmail Automator rules written in YAML and returns structured objects.
 * @param rules A string containing YAML
 * @returns an array of ResponseRule objects that define the configuration for Modmail Automator
 */
export function parseRules (rules?: string): ResponseRule[] {
    if (!rules) {
        return [];
    }

    // Preprocess rules to replace ~ with not at the beginning of subject/body checks.
    const preprocessedRules = rules
        .split("\n")
        .map(line => line.startsWith("~subject") || line.startsWith("~body") ? `not${line.substring(1)}` : line)
        .join("\n");

    const documents = parseAllDocuments(preprocessedRules, {
        strict: true,
    });

    const parsedRules = documents.map(x => x.toJSON() as ResponseRule).filter(x => x !== null);

    const ajv = new Ajv.default({
        coerceTypes: "array",
    });

    const validate = ajv.compile(schema);

    if (!validate(parsedRules)) {
        if (validate.errors) {
            const additionalPropertyItem = validate.errors.find(x => x.keyword === "additionalProperties");
            if (additionalPropertyItem) {
                const propName = additionalPropertyItem.params["additionalProperty"] as string;
                const error = `data${additionalPropertyItem.instancePath} has invalid property ${propName}`;
                throw new Error(error);
            }
        }
        throw new Error(ajv.errorsText(validate.errors));
    }

    for (const rule of parsedRules) {
        const checkInvalid = validateRule(rule);
        if (checkInvalid) {
            throw new Error(checkInvalid);
        }
    }

    return parsedRules;
}

/**
 * Validates that a rule does not contain issues.
 * @param rule The rule to check
 * @returns An empty string if the rule is valid, or a string containing the issue with the rule if not.
 */
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

    if (rule.notbody && rule.notbody_regex) {
        return "You can only specify one of: ~body, ~body_regex";
    }

    if (rule.subject && rule.subject_regex) {
        return "You can only specify one of: subject, subject_regex";
    }

    if (rule.notsubject && rule.notsubject_regex) {
        return "You can only specify one of: ~subject, ~subject_regex";
    }

    if (rule.author && rule.author.name && rule.author.name_regex) {
        return "You can only specify one of: author.name, author.name_regex";
    }

    if (rule.mod_action && !rule.mod_action.mod_action_type && !rule.mod_action.action_reason) {
        return "When specifying a mod action, you must have an action type or action reason or both defined.";
    }

    if (rule.unban && (!rule.author || !rule.author.is_banned)) {
        return "You can only have an unban action if there is an author check for is_banned = true";
    }

    return "";
}
