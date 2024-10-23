/* eslint-disable camelcase */
import { parseAllDocuments } from "yaml";
import Ajv, { JSONSchemaType } from "ajv";
import { dateComparatorPattern, numericComparatorPattern } from "./autoresponder.js";
import { ModActionType } from "@devvit/public-api";
import _ from "lodash";

export interface SearchOption {
    search_method?: string;
    case_sensitive?: boolean;
    negate?: boolean;
}

export interface ResponseRule {
    rule_friendly_name?: string;
    is_reply?: boolean;
    is_first_user_reply?: boolean;
    subject?: string[];
    subject_options?: SearchOption;
    notsubject?: string[];
    notsubject_options?: SearchOption;
    body?: string[];
    body_options?: SearchOption;
    notbody?: string[];
    notbody_options?: SearchOption;
    body_shorter_than?: number;
    body_longer_than?: number;
    subjectandbody?: string[];
    subjectandbody_options?: SearchOption;
    notsubjectandbody?: string[];
    notsubjectandbody_options?: SearchOption;
    subject_shorter_than?: number;
    subject_longer_than?: number;
    moderators_exempt?: boolean;
    admins_exempt?: boolean;
    author?: {
        name?: string[];
        name_options?: SearchOption;
        notname?: string[];
        notname_options?: SearchOption;
        post_karma?: string;
        comment_karma?: string;
        combined_karma?: string;
        account_age?: string;
        satisfy_any_threshold?: boolean;
        flair_text?: string[];
        flair_text_options?: SearchOption;
        notflair_text?: string[];
        notflair_text_options?: SearchOption;
        flair_css_class?: string[];
        flair_css_class_options?: SearchOption;
        notflair_css_class?: string[];
        notflair_css_class_options?: SearchOption;
        is_participant?: boolean;
        is_contributor?: boolean;
        is_moderator?: boolean;
        is_shadowbanned?: boolean;
        is_banned?: boolean;
        set_flair?: {
            override_flair?: boolean;
            set_flair_text?: string;
            set_flair_css_class?: string;
            set_flair_template_id?: string;
        };
    };
    mod_action?: {
        moderator_name?: string[];
        mod_action_type?: ModActionType[];
        action_within?: string;
        action_reason?: string[];
        action_reason_options?: SearchOption;
        still_in_queue?: boolean;
    };
    sub_visibility?: "public" | "private" | "restricted";
    priority?: number;
    reply?: string;
    private_reply?: string;
    mute?: number;
    archive?: boolean;
    unban?: boolean;
    approve_user?: boolean;
    verbose_logs?: boolean;
    signoff?: boolean;
}

const matchSearchMethod = ["includes-word", "includes", "starts-with", "ends-with", "full-exact", "regex"];

/**
 * Ajv schema used to validate response rules.
 */
const schema: JSONSchemaType<ResponseRule[]> = {
    type: "array",
    items: {
        type: "object",
        properties: {
            rule_friendly_name: { type: "string", minLength: 1, nullable: true },
            is_reply: { type: "boolean", nullable: true },
            is_first_user_reply: { type: "boolean", nullable: true },
            subject: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
            subject_options: {
                type: "object",
                properties: {
                    search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                    case_sensitive: { type: "boolean", nullable: true },
                    negate: { type: "boolean", nullable: true },
                },
                nullable: true,
                additionalProperties: false,
            },
            notsubject: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
            notsubject_options: {
                type: "object",
                properties: {
                    search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                    case_sensitive: { type: "boolean", nullable: true },
                    negate: { type: "boolean", nullable: true },
                },
                nullable: true,
                additionalProperties: false,
            },
            body: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
            body_options: {
                type: "object",
                properties: {
                    search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                    case_sensitive: { type: "boolean", nullable: true },
                    negate: { type: "boolean", nullable: true },
                },
                nullable: true,
                additionalProperties: false,
            },
            notbody: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
            notbody_options: {
                type: "object",
                properties: {
                    search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                    case_sensitive: { type: "boolean", nullable: true },
                    negate: { type: "boolean", nullable: true },
                },
                nullable: true,
                additionalProperties: false,
            },
            body_shorter_than: { type: "integer", nullable: true },
            body_longer_than: { type: "integer", nullable: true },
            subjectandbody: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
            subjectandbody_options: {
                type: "object",
                properties: {
                    search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                    case_sensitive: { type: "boolean", nullable: true },
                    negate: { type: "boolean", nullable: true },
                },
                nullable: true,
                additionalProperties: false,
            },
            notsubjectandbody: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
            notsubjectandbody_options: {
                type: "object",
                properties: {
                    search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                    case_sensitive: { type: "boolean", nullable: true },
                    negate: { type: "boolean", nullable: true },
                },
                nullable: true,
                additionalProperties: false,
            },
            subject_shorter_than: { type: "integer", nullable: true },
            subject_longer_than: { type: "integer", nullable: true },
            moderators_exempt: { type: "boolean", nullable: true },
            admins_exempt: { type: "boolean", nullable: true },
            author: {
                type: "object",
                properties: {
                    name: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
                    name_options: {
                        type: "object",
                        properties: {
                            search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                            case_sensitive: { type: "boolean", nullable: true },
                            negate: { type: "boolean", nullable: true },
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                    notname: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
                    notname_options: {
                        type: "object",
                        properties: {
                            search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                            case_sensitive: { type: "boolean", nullable: true },
                            negate: { type: "boolean", nullable: true },
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                    post_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
                    comment_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
                    combined_karma: { type: "string", nullable: true, pattern: numericComparatorPattern },
                    account_age: { type: "string", nullable: true, pattern: dateComparatorPattern },
                    satisfy_any_threshold: { type: "boolean", nullable: true },
                    flair_text: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
                    flair_text_options: {
                        type: "object",
                        properties: {
                            search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                            case_sensitive: { type: "boolean", nullable: true },
                            negate: { type: "boolean", nullable: true },
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                    notflair_text: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
                    notflair_text_options: {
                        type: "object",
                        properties: {
                            search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                            case_sensitive: { type: "boolean", nullable: true },
                            negate: { type: "boolean", nullable: true },
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                    flair_css_class: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
                    flair_css_class_options: {
                        type: "object",
                        properties: {
                            search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                            case_sensitive: { type: "boolean", nullable: true },
                            negate: { type: "boolean", nullable: true },
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                    notflair_css_class: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
                    notflair_css_class_options: {
                        type: "object",
                        properties: {
                            search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                            case_sensitive: { type: "boolean", nullable: true },
                            negate: { type: "boolean", nullable: true },
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                    is_participant: { type: "boolean", nullable: true },
                    is_contributor: { type: "boolean", nullable: true },
                    is_moderator: { type: "boolean", nullable: true },
                    is_shadowbanned: { type: "boolean", nullable: true },
                    is_banned: { type: "boolean", nullable: true },
                    set_flair: {
                        type: "object",
                        properties: {
                            override_flair: { type: "boolean", nullable: true },
                            set_flair_text: { type: "string", nullable: true },
                            set_flair_css_class: { type: "string", nullable: true },
                            set_flair_template_id: { type: "string", nullable: true, pattern: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" },
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                },
                nullable: true,
                additionalProperties: false,
            },
            mod_action: {
                type: "object",
                properties: {
                    moderator_name: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
                    mod_action_type: { type: "array", items: { type: "string", nullable: true, enum: ["banuser", "unbanuser", "spamlink", "removelink", "approvelink", "spamcomment", "removecomment", "approvecomment", "editflair", "lock", "unlock", "muteuser", "unmuteuser", "addremovalreason"], minLength: 1 }, nullable: true },
                    action_within: { type: "string", nullable: true, pattern: dateComparatorPattern },
                    action_reason: { type: "array", items: { type: "string", minLength: 1 }, nullable: true },
                    action_reason_options: {
                        type: "object",
                        properties: {
                            search_method: { type: "string", nullable: true, enum: matchSearchMethod },
                            case_sensitive: { type: "boolean", nullable: true },
                            negate: { type: "boolean", nullable: true },
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                    still_in_queue: { type: "boolean", nullable: true },
                },
                nullable: true,
                additionalProperties: false,
            },
            sub_visibility: { type: "string", nullable: true, enum: ["public", "private", "restricted"] },
            priority: { type: "integer", nullable: true },
            reply: { type: "string", nullable: true },
            private_reply: { type: "string", nullable: true },
            mute: { type: "integer", nullable: true },
            archive: { type: "boolean", nullable: true },
            unban: { type: "boolean", nullable: true },
            approve_user: { type: "boolean", nullable: true },
            verbose_logs: { type: "boolean", nullable: true },
            signoff: { type: "boolean", nullable: true },
        },
        additionalProperties: false,
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processNode (node: any, nodeName: string) {
    const nodeNameRegex = /^(body_regex|subject_regex|~?subject|~?body|~?subject\+body|~?body\+subject|~?name|~?flair_text|~?flair_css_class|action_reason)(?: \(([\w\s,-]+)\))?$/;
    const matches = nodeNameRegex.exec(nodeName);
    if (!matches || matches.length !== 3) {
        return;
    }

    let properName = matches[1];
    let searchOptions = matches[2] as string | undefined ?? "";
    const negate = properName.startsWith("~");

    if (negate) {
        properName = properName.replace("~", "not");
    }

    let searchOptionList = searchOptions.split(",").map(x => x.trim());
    const caseSensitive = searchOptionList.includes("case-sensitive") || searchOptionList.includes("case_sensitive");
    if (caseSensitive) {
        searchOptionList = searchOptionList.filter(x => x !== "case-sensitive" && x !== "case_sensitive");
    }

    searchOptions = searchOptionList.join(", ");

    let options: SearchOption | undefined;
    if (searchOptions || caseSensitive || negate) {
        options = {
            search_method: searchOptions.length > 0 ? searchOptions : "includes",
            negate,
            case_sensitive: caseSensitive,
        };
    }

    if (properName.endsWith("subject+body") || properName.endsWith("body+subject")) {
        properName = (negate ? "not" : "") + "subjectandbody";
    }

    if (properName === nodeName && !options) {
        // Nothing to do, node is already properly formatted.
        return;
    }

    console.log(properName, options);

    if (properName !== nodeName) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        node[properName] = node[nodeName];
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete, @typescript-eslint/no-unsafe-member-access
        delete node[nodeName];
    }

    if (options) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        node[`${properName}_options`] = options;
    }
}

/**
 * Parses Modmail Automator rules written in YAML and returns structured objects.
 * @param rules A string containing YAML
 * @returns an array of ResponseRule objects that define the configuration for Modmail Automator
 */
export function parseRules (rules?: string): ResponseRule[] {
    if (!rules) {
        return [];
    }

    const documents = parseAllDocuments(rules, { strict: true });
    const parsedRules = _.compact(documents.map(x => x.toJSON() as ResponseRule | null));

    for (const rule of parsedRules) {
        for (const node in rule) {
            processNode(rule, node);
        }
        if (rule.author) {
            for (const node in rule.author) {
                processNode(rule.author, node);
            }
        }
        if (rule.mod_action) {
            for (const node in rule.mod_action) {
                processNode(rule.mod_action, node);
            }
        }
    }

    const ajv = new Ajv.default({
        coerceTypes: "array",
    });

    const validate = ajv.compile(schema);

    if (!validate(parsedRules)) {
        if (validate.errors) {
            const additionalPropertyItem = validate.errors.find(x => x.keyword === "additionalProperties");
            if (additionalPropertyItem) {
                const propName = additionalPropertyItem.params.additionalProperty as string;
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
    if (!rule.reply && !rule.private_reply && !rule.mute && !rule.author?.is_moderator) {
        return "No actions specified. Rule must either reply, private_reply or mute (or both)";
    }

    if (rule.body && rule.body_options?.search_method === "regex") {
        try {
            rule.body.map(x => new RegExp(x));
        } catch {
            return "Invalid body regex";
        }
    }

    if (rule.notbody && rule.notbody_options?.search_method === "regex") {
        try {
            rule.notbody.map(x => new RegExp(x));
        } catch {
            return "Invalid ~body regex";
        }
    }

    if (rule.subject && rule.subject_options?.search_method === "regex") {
        try {
            rule.subject.map(x => new RegExp(x));
        } catch {
            return "Invalid subject regex";
        }
    }

    if (rule.notsubject && rule.notsubject_options?.search_method === "regex") {
        try {
            rule.notsubject.map(x => new RegExp(x));
        } catch {
            return "Invalid ~subject regex";
        }
    }

    if (rule.subjectandbody && rule.subjectandbody_options?.search_method === "regex") {
        try {
            rule.subjectandbody.map(x => new RegExp(x));
        } catch {
            return "Invalid subject+body regex";
        }
    }

    if (rule.notsubjectandbody && rule.notsubjectandbody_options?.search_method === "regex") {
        try {
            rule.notsubjectandbody.map(x => new RegExp(x));
        } catch {
            return "Invalid ~subject+body regex";
        }
    }

    if (rule.author) {
        if (rule.author.name && rule.author.name_options?.search_method === "regex") {
            try {
                rule.author.name.map(x => new RegExp(x));
            } catch {
                return "Invalid author name regex";
            }
        }

        if (rule.author.notname && rule.author.notname_options?.search_method === "regex") {
            try {
                rule.author.notname.map(x => new RegExp(x));
            } catch {
                return "Invalid author ~name regex";
            }
        }

        if (rule.author.flair_text && rule.author.flair_text_options?.search_method === "regex") {
            try {
                rule.author.flair_text.map(x => new RegExp(x));
            } catch {
                return "Invalid author ~name regex";
            }
        }

        if (rule.author.notflair_text && rule.author.notflair_text_options?.search_method === "regex") {
            try {
                rule.author.notflair_text.map(x => new RegExp(x));
            } catch {
                return "Invalid author ~name regex";
            }
        }

        if (rule.author.flair_css_class && rule.author.flair_css_class_options?.search_method === "regex") {
            try {
                rule.author.flair_css_class.map(x => new RegExp(x));
            } catch {
                return "Invalid author ~name regex";
            }
        }

        if (rule.author.notflair_css_class && rule.author.notflair_css_class_options?.search_method === "regex") {
            try {
                rule.author.notflair_css_class.map(x => new RegExp(x));
            } catch {
                return "Invalid author ~name regex";
            }
        }
    }

    if (rule.mod_action && !rule.mod_action.mod_action_type && !rule.mod_action.action_reason) {
        return "When specifying a mod action, you must have an action type or action reason or both defined.";
    }

    if (rule.unban && !rule.author?.is_banned) {
        return "You can only have an unban action if there is an author check for is_banned = true";
    }

    if (rule.moderators_exempt && rule.author?.is_moderator) {
        return "You cannot have a rule where moderators are exempt but you're also checking that the author is a mod";
    }

    if (rule.author?.is_participant && rule.author.is_moderator) {
        return "You cannot specify is_participant and is_moderator to be true at the same time";
    }

    if (rule.mute && rule.mute !== 3 && rule.mute !== 7 && rule.mute !== 28) {
        return "Mute must be either 3, 7 or 28 days";
    }

    return "";
}
