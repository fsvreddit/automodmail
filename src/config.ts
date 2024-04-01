/* eslint-disable camelcase */
import {parseAllDocuments} from "yaml";
import Ajv, {JSONSchemaType} from "ajv";
import {dateComparatorPattern, numericComparatorPattern} from "./autoresponder.js";
import {ModActionType} from "@devvit/public-api";

export interface SearchOption {
    search_method?: string,
    case_sensitive?: boolean,
    negate?: boolean,
}

export interface ResponseRule {
    subject?: string[],
    subject_options?: SearchOption,
    notsubject?: string[],
    notsubject_options?: SearchOption,
    body?: string[],
    body_options?: SearchOption,
    notbody?: string[],
    notbody_options?: SearchOption,
    moderators_exempt?: boolean,
    admins_exempt?: boolean,
    author?: {
        name?: string[],
        name_options?: SearchOption,
        notname?: string[],
        notname_options?: SearchOption,
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
    verbose_logs?: boolean,
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
            subject: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            subject_options: {
                type: "object",
                properties: {
                    search_method: {type: "string", nullable: true, enum: matchSearchMethod},
                    case_sensitive: {type: "boolean", nullable: true},
                    negate: {type: "boolean", nullable: true},
                },
                nullable: true,
                additionalProperties: false,
            },
            notsubject: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            notsubject_options: {
                type: "object",
                properties: {
                    search_method: {type: "string", nullable: true, enum: matchSearchMethod},
                    case_sensitive: {type: "boolean", nullable: true},
                    negate: {type: "boolean", nullable: true},
                },
                nullable: true,
                additionalProperties: false,
            },
            body: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            body_options: {
                type: "object",
                properties: {
                    search_method: {type: "string", nullable: true, enum: matchSearchMethod},
                    case_sensitive: {type: "boolean", nullable: true},
                    negate: {type: "boolean", nullable: true},
                },
                nullable: true,
                additionalProperties: false,
            },
            notbody: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
            notbody_options: {
                type: "object",
                properties: {
                    search_method: {type: "string", nullable: true, enum: matchSearchMethod},
                    case_sensitive: {type: "boolean", nullable: true},
                    negate: {type: "boolean", nullable: true},
                },
                nullable: true,
                additionalProperties: false,
            },
            moderators_exempt: {type: "boolean", nullable: true},
            admins_exempt: {type: "boolean", nullable: true},
            author: {
                type: "object",
                properties: {
                    name: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
                    name_options: {
                        type: "object",
                        properties: {
                            search_method: {type: "string", nullable: true, enum: matchSearchMethod},
                            case_sensitive: {type: "boolean", nullable: true},
                            negate: {type: "boolean", nullable: true},
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
                    notname: {type: "array", items: {type: "string", minLength: 1}, nullable: true},
                    notname_options: {
                        type: "object",
                        properties: {
                            search_method: {type: "string", nullable: true, enum: matchSearchMethod},
                            case_sensitive: {type: "boolean", nullable: true},
                            negate: {type: "boolean", nullable: true},
                        },
                        nullable: true,
                        additionalProperties: false,
                    },
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
                    mod_action_type: {type: "string", nullable: true, enum: ["banuser", "unbanuser", "spamlink", "removelink", "approvelink", "spamcomment", "removecomment", "approvecomment", "editflair", "lock", "unlock", "muteuser", "unmuteuser", "addremovalreason"]},
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
            verbose_logs: {type: "boolean", nullable: true},
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
    const preprocessedRules: string[] = [];
    const searchTypeRegex = /^(subject|body|notsubject|notbody|(?:\t|\s+)(?:name|notname))?(?: \((.+)\))?:(.+)$/;
    for (let line of rules.split("\n")) {
        if (line.startsWith("subject_regex")) {
            line = line.replace("subject_regex", "subject (regex)");
        } else if (line.startsWith("body_regex")) {
            line = line.replace("body_regex", "body (regex)");
        } else if (line.trim().startsWith("name_regex")) {
            line = line.replace("name_regex", "name (regex)");
        } else if (line.trim().startsWith("~")) {
            line = line.replace("~", "not");
        }

        const matches = line.match(searchTypeRegex);
        if (matches && matches.length === 4) {
            const [, searchType, searchOptions, matchData] = matches;
            const searchOption: SearchOption = {};
            searchOption.negate = searchType === "notsubject" || searchType === "notbody" || searchType === "    notname";
            if (searchOptions) {
                searchOption.search_method = matchSearchMethod.find(x => searchOptions.includes(x));
                searchOption.case_sensitive = searchOptions.includes("case-sensitive");
            } else {
                searchOption.search_method = "includes";
                searchOption.case_sensitive = false;
            }

            const leadingSpaces = searchType === "    name" || searchType === "    notname" ? "        " : "    ";

            preprocessedRules.push(
                `${searchType}:${matchData}`,
                `${searchType}_options:`,
                `${leadingSpaces}search_method: ${JSON.stringify(searchOption.search_method)}`,
                `${leadingSpaces}negate: ${JSON.stringify(searchOption.negate)}`,
                `${leadingSpaces}case_sensitive: ${JSON.stringify(searchOption.case_sensitive)}`
            );
        } else {
            preprocessedRules.push(line);
        }
    }

    const documents = parseAllDocuments(preprocessedRules.join("\n"), {
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

    if (rule.body && rule.body_options && rule.body_options.search_method === "regex") {
        try {
            rule.body.map(x => new RegExp(x));
        } catch {
            return "Invalid body regex";
        }
    }

    if (rule.notbody && rule.notbody_options && rule.notbody_options.search_method === "regex") {
        try {
            rule.notbody.map(x => new RegExp(x));
        } catch {
            return "Invalid ~body regex";
        }
    }

    if (rule.subject && rule.subject_options && rule.subject_options.search_method === "regex") {
        try {
            rule.subject.map(x => new RegExp(x));
        } catch {
            return "Invalid subject regex";
        }
    }

    if (rule.notsubject && rule.notsubject_options && rule.notsubject_options.search_method === "regex") {
        try {
            rule.notsubject.map(x => new RegExp(x));
        } catch {
            return "Invalid ~subject regex";
        }
    }

    if (rule.author && rule.author.name && rule.author.name_options && rule.author.name_options.search_method === "regex") {
        try {
            rule.author.name.map(x => new RegExp(x));
        } catch {
            return "Invalid author name regex";
        }
    }

    if (rule.author && rule.author.notname && rule.author.notname_options && rule.author.notname_options.search_method === "regex") {
        try {
            rule.author.notname.map(x => new RegExp(x));
        } catch {
            return "Invalid author ~name regex";
        }
    }

    if (rule.mod_action && !rule.mod_action.mod_action_type && !rule.mod_action.action_reason) {
        return "When specifying a mod action, you must have an action type or action reason or both defined.";
    }

    if (rule.unban && (!rule.author || !rule.author.is_banned)) {
        return "You can only have an unban action if there is an author check for is_banned = true";
    }

    return "";
}
