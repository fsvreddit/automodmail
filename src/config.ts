import {parseAllDocuments} from "yaml";
import {stringOrStringArrayToStringArray} from "./utility.js";

export interface ResponseRule {
    subject?: string | string[],
    subject_regex?: string | string[],
    body?: string | string[],
    body_regex?: string | string[],
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
        moderator_name?: string | string[],
        action_within?: string,
        action_reason?: string | string[],
    },
    priority?: number,
    reply?: string,
    mute?: number,
    archive?: boolean,
}

export function getRules (rules?: string): ResponseRule[] {
    if (!rules) {
        return [];
    }

    const documents = parseAllDocuments(rules, {
        strict: true,
    });

    return documents.map(x => x.toJSON() as ResponseRule).filter(x => x !== null);
}

export function validateRule (rule: ResponseRule): string {
    if (!rule.reply && !rule.mute) {
        return "No actions specified. Rule must either reply or mute (or both)";
    }

    if (rule.body_regex) {
        try {
            const valuesToCheck = stringOrStringArrayToStringArray(rule.body_regex);
            if (valuesToCheck) {
                valuesToCheck.map(x => new RegExp(x));
            }
        } catch {
            return "Invalid body regex";
        }
    }

    if (rule.subject_regex) {
        try {
            const valuesToCheck = stringOrStringArrayToStringArray(rule.subject_regex);
            if (valuesToCheck) {
                valuesToCheck.map(x => new RegExp(x));
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
