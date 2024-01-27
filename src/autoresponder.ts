import {OnTriggerEvent, ScheduledJobEvent, Subreddit, TriggerContext, User} from "@devvit/public-api";
import {ModMail} from "@devvit/protos";
import {ResponseRule, parseRules} from "./config.js";
import {addMinutes, addDays, addHours, addMonths, addWeeks, addYears, formatDistanceToNow, addSeconds} from "date-fns";
import {isBanned, isContributor, isModerator, replaceAll} from "./utility.js";
import {Language, languageFromString} from "./i18n.js";
import pluralize from "pluralize";
import _ from "lodash";

export const numericComparatorPattern = "^(<|>|<=|>=|=)?\\s?(\\d+)$";
export const dateComparatorPattern = "^(<|>|<=|>=)?\\s?(\\d+)\\s(minute|hour|day|week|month|year)s?$";

interface RuleMatchContext {
    ruleMatched: boolean,
    priority: number,
    reply?: string,
    mute?: number,
    archive?: boolean,
    unban?: boolean,
    modActionDate?: Date,
    modActionTargetPermalink?: string,
    modActionTargetKind?: "post" | "comment",
    verboseLogs: string[],
}

interface ModmailAction {
    conversationId: string,
    username: string,
    reply?: string,
    mute?: number
    archive?: boolean,
    unban?: boolean,
}

/**
 * Handles the Devvit trigger that fires on any new Modmail Receive events.
 * @param event The trigger event
 * @param context Context
 */
export async function onModmailReceiveEvent (event: OnTriggerEvent<ModMail>, context: TriggerContext) {
    console.log("Received modmail trigger event.");
    console.log(`Event Message ID: ${event.messageId}`);

    if (!event.messageAuthor) {
        return;
    }

    if (event.messageAuthor && event.messageAuthor.id === context.appAccountId) {
        console.log("Modmail event triggered by this app. Quitting.");
        return;
    }

    const conversationResponse = await context.reddit.modMail.getConversation({
        conversationId: event.conversationId,
    });

    if (!conversationResponse.conversation || !conversationResponse.conversation.id) {
        return;
    }

    // Ensure that the modmail has a participant i.e. is about a user, and not a sub to sub modmail or internal discussion
    if (!conversationResponse.conversation.participant || !conversationResponse.conversation.participant.name) {
        console.log("There is no participant for the modmail conversation e.g. internal mod discussion");
        return;
    }

    if (conversationResponse.conversation.participant.name !== event.messageAuthor.name) {
        console.log("Conversation author is not the same as participant - outgoing modmail");
        return;
    }

    const messagesInConversation = Object.values(conversationResponse.conversation.messages);

    const firstMessage = messagesInConversation[0];
    console.log(`First Message ID: ${firstMessage.id ?? "undefined"}`);

    // Check that the first message in the entire conversation was for this person.
    if (!firstMessage.id || !event.messageId.includes(firstMessage.id)) {
        console.log("Message isn't the very first. Quitting");
        return;
    }

    const rulesYaml = await context.settings.get<string>("rules");
    const rules = parseRules(rulesYaml);

    if (rules.length === 0) {
        console.log("No rules are defined. Quitting.");
        return;
    }

    let participant: User | undefined;
    try {
        // Doing this in a try/catch because otherwise the user might be shadowbanned.
        participant = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
    } catch {
        // Ignore - leave participant variable undefined.
    }

    const subject = conversationResponse.conversation.subject ?? "";
    const body = firstMessage.bodyMarkdown ?? "";
    const subreddit = await context.reddit.getCurrentSubreddit();

    let userIsModerator = false;
    if (participant) {
        userIsModerator = await isModerator(context, subreddit.name, participant.username);
    }

    let matchedRules = await Promise.all(rules.map(rule => checkRule(context, subreddit, rule, subject, body, participant, userIsModerator)));

    const rulesWithDebugInfo = matchedRules.filter(x => x.verboseLogs.length > 0);
    if (rulesWithDebugInfo.length > 0) {
        let debugOutput = "Modmail Automator logs\n\n";

        for (const rule of rulesWithDebugInfo) {
            debugOutput += "---\n\n";
            debugOutput += `Rule matched: ${JSON.stringify(rule.ruleMatched)}\n\n`;
            debugOutput += rule.verboseLogs.map(x => `* ${x}`).join("\n");
            debugOutput += "\n\n";

            if (rule.ruleMatched) {
                debugOutput += "Actions to take if this is the highest priority match:\n\n";
                if (rule.reply) {
                    debugOutput += "* Reply to user\n";
                }
                if (rule.archive) {
                    debugOutput += "* Archive message\n";
                }
                if (rule.mute) {
                    debugOutput += `* Mute for ${rule.mute} ${pluralize("day", rule.mute)} (note that Reddit may ignore this figure and mute for 3 days regardless)\n`;
                }
                if (rule.unban) {
                    debugOutput += "* Unban user\n";
                }
                debugOutput += "\n";
            }
        }

        await context.reddit.modMail.reply({
            body: debugOutput,
            conversationId: conversationResponse.conversation.id,
            isInternal: true,
            isAuthorHidden: false,
        });
    }

    // Sort by priority descending, take top 1.
    matchedRules = matchedRules.filter(x => x.ruleMatched).sort((a, b) => b.priority - a.priority);

    if (matchedRules.length === 0) {
        console.log("No rules matched.");
        return;
    }

    console.log("Matched a rule.");

    const firstMatchedRule = matchedRules[0];

    const action: ModmailAction = {
        conversationId: conversationResponse.conversation.id,
        username: event.messageAuthor.name,
        archive: firstMatchedRule.archive,
        mute: firstMatchedRule.mute,
        unban: firstMatchedRule.unban,
    };

    if (firstMatchedRule.reply) {
        let replyMessage = firstMatchedRule.reply;

        const signoff = await context.settings.get<string>("signoff");
        if (signoff) {
            replyMessage += `\n\n${signoff}`;
        }

        replyMessage = replaceAll(replyMessage, "{{author}}", event.messageAuthor.name);
        replyMessage = replaceAll(replyMessage, "{{subreddit}}", subreddit.name);
        let language: Language | undefined;
        if (firstMatchedRule.modActionDate || firstMatchedRule.modActionTargetKind) {
            const localeResult = await context.settings.get<string[]>("locale") ?? ["enUS"];
            language = languageFromString(localeResult[0]);
        }

        if (firstMatchedRule.modActionDate && language) {
            replyMessage = replaceAll(replyMessage, "{{mod_action_timespan_to_now}}", formatDistanceToNow(firstMatchedRule.modActionDate, {locale: language.locale}));
        }
        if (firstMatchedRule.modActionTargetPermalink) {
            replyMessage = replaceAll(replyMessage, "{{mod_action_target_permalink}}", firstMatchedRule.modActionTargetPermalink);
        }
        if (firstMatchedRule.modActionTargetKind && language) {
            let targetKind = await context.settings.get<string>(`${firstMatchedRule.modActionTargetKind}String`);
            if (!targetKind) {
                targetKind = firstMatchedRule.modActionTargetKind === "post" ? language.postWord : language.commentWord;
            }

            replyMessage = replaceAll(replyMessage, "{{mod_action_target_kind}}", targetKind);
        }

        action.reply = replyMessage;
    }

    const sendAfterDelay = await context.settings.get<number>("secondsDelayBeforeSend") ?? 0;
    if (sendAfterDelay) {
        console.log(`Delayed action enabled. Will action modmail in ${sendAfterDelay} ${pluralize("second", sendAfterDelay)}`);
        await context.scheduler.runJob({
            name: "actOnMessageAfterDelay",
            data: {action},
            runAt: addSeconds(new Date(), sendAfterDelay),
        });
    } else {
        await actOnRule(action, context);
    }
}

async function actOnRule (action: ModmailAction, context: TriggerContext) {
    if (action.reply) {
        await context.reddit.modMail.reply({
            body: action.reply,
            conversationId: action.conversationId,
            isInternal: false,
            isAuthorHidden: true,
        });
    }

    console.log("Replied to modmail");

    if (action.mute) {
        await context.reddit.modMail.muteConversation({
            conversationId: action.conversationId,
            numHours: action.mute * 24,
        });
        console.log("User muted");
    }

    if (action.archive) {
        await context.reddit.modMail.archiveConversation(action.conversationId);
        console.log("Conversation archived");
    }

    if (action.unban) {
        const subreddit = await context.reddit.getCurrentSubreddit();
        await context.reddit.unbanUser(action.username, subreddit.name);
        console.log("User unbanned");
    }
}

export async function actOnMessageAfterDelay (event: ScheduledJobEvent, context: TriggerContext) {
    if (!event.data) {
        console.log("Scheduler job's data not assigned");
        return;
    }

    const action = event.data.action as ModmailAction;
    await actOnRule(action, context);
}

function logDebug (verboseLogsEnabled: boolean | undefined, reason: string, verboseLogOutput: string[]) {
    console.log(reason);
    if (verboseLogsEnabled) {
        verboseLogOutput.push(reason);
    }
}

/**
 * Checks if a rule matches the modmail contents and user/modlog context
 * @param context Reddit TriggerContext object
 * @param subreddit The subreddit object
 * @param rule The rule object
 * @param subject The subject line from the modmail
 * @param body The body text from the modmail
 * @param participant A user object, or undefined if a shadowbanned/suspended user
 * @returns An object that describes if the rule matched, and if so provides extra context for the rule actions and how it matched
 */
async function checkRule (context: TriggerContext, subreddit: Subreddit, rule: ResponseRule, subject: string, body: string, participant: User | undefined, userIsModerator: boolean): Promise<RuleMatchContext> {
    const result: RuleMatchContext = {
        ruleMatched: false,
        priority: rule.priority ?? 0,
        reply: rule.reply,
        mute: rule.mute,
        archive: rule.archive,
        unban: rule.unban,
        verboseLogs: [],
    };

    if (rule.moderators_exempt !== false && userIsModerator) {
        logDebug(rule.verbose_logs, "Rule exempts moderators, and user is a mod.", result.verboseLogs);
        return result;
    }

    if (rule.subject) {
        if (!rule.subject.some(val => subject.toLowerCase().includes(val.toLowerCase()))) {
            logDebug(rule.verbose_logs, "Subject does not match.", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Subject matched successfully.", result.verboseLogs);
        }
    }

    if (rule.notsubject) {
        if (rule.notsubject.some(val => subject.toLowerCase().includes(val.toLowerCase()))) {
            logDebug(rule.verbose_logs, "~subject specified but matched text.", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "~subject specified, No matching text found.", result.verboseLogs);
        }
    }

    if (rule.subject_regex) {
        const regexes = rule.subject_regex.map(x => new RegExp(x, "i"));
        if (!regexes.some(x => x.test(subject))) {
            logDebug(rule.verbose_logs, "Subject regex does not match", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Subject regex matches", result.verboseLogs);
        }
    }

    if (rule.notsubject_regex) {
        const regexes = rule.notsubject_regex.map(x => new RegExp(x, "i"));
        if (regexes.some(x => x.test(subject))) {
            logDebug(rule.verbose_logs, "~subject regex specified but matched text", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "~subject regex specified, No matching text found.", result.verboseLogs);
        }
    }

    if (rule.body) {
        if (!rule.body.some(val => body.toLowerCase().includes(val.toLowerCase()))) {
            logDebug(rule.verbose_logs, "Body does not match.", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Body matched successfully.", result.verboseLogs);
        }
    }

    if (rule.notbody) {
        if (rule.notbody.some(val => body.toLowerCase().includes(val.toLowerCase()))) {
            logDebug(rule.verbose_logs, "~body specified but matched text.", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "~body specified, No matching text found.", result.verboseLogs);
        }
    }

    if (rule.body_regex) {
        const regexes = rule.body_regex.map(x => new RegExp(x));
        if (!regexes.some(x => x.test(body))) {
            logDebug(rule.verbose_logs, "Body regex does not match", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Body regex matches", result.verboseLogs);
        }
    }

    if (rule.notbody_regex) {
        const regexes = rule.notbody_regex.map(x => new RegExp(x));
        if (!regexes.some(x => x.test(body))) {
            logDebug(rule.verbose_logs, "~body regex specified but matched text", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "~bubject regex specified, No matching text found.", result.verboseLogs);
        }
    }

    if (rule.author) {
        if (participant) {
            // Most checks need the user to be not shadowbanned.
            if (rule.author.name) {
                if (!rule.author.name.some(name => name.toLowerCase() === participant.username.toLowerCase())) {
                    logDebug(rule.verbose_logs, "Author name doesn't match", result.verboseLogs);
                    return result;
                } else {
                    logDebug(rule.verbose_logs, "Author name matches", result.verboseLogs);
                }
            }

            if (rule.author.name_regex) {
                const regexes = rule.author.name_regex.map(x => new RegExp(x, "i"));
                if (!regexes.some(x => x.test(participant.username))) {
                    logDebug(rule.verbose_logs, "Author name regex doesn't match", result.verboseLogs);
                    return result;
                } else {
                    logDebug(rule.verbose_logs, "Author name regex matches", result.verboseLogs);
                }
            }

            const thresholdChecks: boolean[] = [];
            if (rule.author.post_karma) {
                const thresholdMatched = meetsNumericThreshold(participant.linkKarma, rule.author.post_karma);
                logDebug(rule.verbose_logs, `Post karma threshold matched: ${JSON.stringify(thresholdMatched)}`, result.verboseLogs);
                thresholdChecks.push(thresholdMatched);
            }
            if (rule.author.comment_karma) {
                const thresholdMatched = meetsNumericThreshold(participant.commentKarma, rule.author.comment_karma);
                logDebug(rule.verbose_logs, `Comment karma threshold matched: ${JSON.stringify(thresholdMatched)}`, result.verboseLogs);
                thresholdChecks.push(thresholdMatched);
            }
            if (rule.author.combined_karma) {
                const thresholdMatched = meetsNumericThreshold(participant.linkKarma + participant.commentKarma, rule.author.combined_karma);
                logDebug(rule.verbose_logs, `Combined karma threshold matched: ${JSON.stringify(thresholdMatched)}`, result.verboseLogs);
                thresholdChecks.push(thresholdMatched);
            }
            if (rule.author.account_age) {
                const thresholdMatched = meetsDateThreshold(participant.createdAt, rule.author.account_age);
                logDebug(rule.verbose_logs, `Account age threshold matched: ${JSON.stringify(thresholdMatched)}`, result.verboseLogs);
                thresholdChecks.push(thresholdMatched);
            }

            if (thresholdChecks.length > 0) {
                logDebug(rule.verbose_logs, `Number of threshold checks matched: ${_.compact(thresholdChecks).length} of ${thresholdChecks.length} run`, result.verboseLogs);
                // Satisfy Any Threshold: If no check came back true, quit.)
                if (rule.author.satisfy_any_threshold && !thresholdChecks.includes(true)) {
                    logDebug(rule.verbose_logs, "Satisfy any threshold is set to true, therefore threshold checks not passed.", result.verboseLogs);
                    return result;
                } else if (!rule.author.satisfy_any_threshold && thresholdChecks.includes(false)) {
                    logDebug(rule.verbose_logs, "Satisfy any threshold is set to false or unspecified, therefore threshold checks not passed.", result.verboseLogs);
                    return result;
                }
                logDebug(rule.verbose_logs, `Satisfy any threshold is set to ${JSON.stringify(rule.author.satisfy_any_threshold)} therefore threshold checks passed.`, result.verboseLogs);
            }

            if (rule.author.is_banned !== undefined) {
                const userIsBanned = await isBanned(context, subreddit.name, participant.username);
                if (rule.author.is_banned !== userIsBanned) {
                    logDebug(rule.verbose_logs, "User banned check failed, skipping rule.", result.verboseLogs);
                    return result;
                } else {
                    logDebug(rule.verbose_logs, "User banned check matched.", result.verboseLogs);
                }
            }

            if (rule.author.is_contributor !== undefined) {
                const userIsContributor = await isContributor(context, subreddit.name, participant.username);
                if (rule.author.is_contributor !== userIsContributor) {
                    logDebug(rule.verbose_logs, "Approved User check failed, skipping rule.", result.verboseLogs);
                    return result;
                } else {
                    logDebug(rule.verbose_logs, "Approved User check matched.", result.verboseLogs);
                }
            }

            if (rule.author.is_moderator !== undefined) {
                if (rule.author.is_moderator !== userIsModerator) {
                    logDebug(rule.verbose_logs, "Moderator check failed, skipping rule.", result.verboseLogs);
                    return result;
                } else {
                    logDebug(rule.verbose_logs, "Moderator check passed.", result.verboseLogs);
                }
            }

            if (rule.author.flair_text || rule.author.flair_css_class || rule.author.flair_css_class) {
                const flair = await participant.getUserFlairBySubreddit(subreddit.name);
                if (!flair) {
                    logDebug(rule.verbose_logs, "User does not have flair, but flair checks exist. Skipping rule.", result.verboseLogs);
                    return result;
                }

                if (rule.author.flair_text && rule.author.flair_text !== flair.flairText) {
                    logDebug(rule.verbose_logs, "Flair text check failed. Skipping rule.", result.verboseLogs);
                    return result;
                }

                if (rule.author.flair_css_class && rule.author.flair_css_class !== flair.flairCssClass) {
                    logDebug(rule.verbose_logs, "Flair text check failed. Skipping rule.", result.verboseLogs);
                    return result;
                }

                logDebug(rule.verbose_logs, "Flair matched.", result.verboseLogs);
            }
        }

        if (rule.author.is_shadowbanned !== undefined) {
            if (rule.author.is_shadowbanned !== (participant === undefined)) {
                logDebug(rule.verbose_logs, "Shadowban check failed, skipping rule.", result.verboseLogs);
                return result;
            } else {
                logDebug(rule.verbose_logs, "Shadowban check passed.", result.verboseLogs);
            }
        }
    }

    if (rule.mod_action && participant) {
        let modLog = await context.reddit.getModerationLog({
            subredditName: subreddit.name,
            moderatorUsernames: rule.mod_action.moderator_name,
            type: rule.mod_action.mod_action_type,
            limit: 200,
        }).all();

        modLog = modLog.filter(x => x.target && x.target.author === participant.username);

        if (rule.mod_action.action_within) {
            modLog = modLog.filter(x => rule.mod_action && rule.mod_action.action_within && meetsDateThreshold(x.createdAt, rule.mod_action.action_within, "<"));
            console.log(`After removing old entries: ${modLog.length} log entries still found`);
        }

        if (rule.mod_action.action_reason) {
            modLog = modLog.filter(logEntry => rule.mod_action?.action_reason?.some(reason => `${logEntry.details ?? ""} ${logEntry.description ?? ""}`.toLowerCase().includes(reason.toLowerCase())));
            console.log(`After removing non-matching reasons: ${modLog.length} log entries still found`);
        }

        if (modLog.length === 0) {
            logDebug(rule.verbose_logs, "No matching mod log entry!", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, `Found ${modLog.length} matching ${pluralize("entry", modLog.length)} in mod log.`, result.verboseLogs);
        }

        result.modActionDate = modLog[0].createdAt;
        if (modLog[0].target) {
            result.modActionTargetPermalink = modLog[0].target.permalink;
            if (modLog[0].target.id.startsWith("t1")) {
                result.modActionTargetKind = "comment";
            } else if (modLog[0].target.id.startsWith("t3")) {
                result.modActionTargetKind = "post";
            }
        }
    }

    // All checks passed.
    result.ruleMatched = true;

    return result;
}

/**
 * A function to compare a number to a text input
 * @param input The numeric input
 * @param threshold The threshold to meet e.g. < 10
 * @returns True or false
 */
export function meetsNumericThreshold (input: number, threshold: string): boolean {
    const regex = new RegExp(numericComparatorPattern);
    const matches = threshold.match(regex);
    if (!matches || matches.length !== 3) {
        return false;
    }

    const operator = matches[1];
    const value = parseInt(matches[2]);

    switch (operator) {
        case "":
        case "=":
            return input === value;
        case "<":
            return input < value;
        case "<=":
            return input <= value;
        case ">":
            return input > value;
        case ">=":
            return input >= value;
        default:
            return false;
    }
}

/**
 * A function to compare a number to a text input
 * @param input The date input
 * @param threshold The threshold to meet e.g. < 10 years
 * @param defaultOperator The operator to use if none is specified
 * @returns True or false
 */
export function meetsDateThreshold (input: Date, threshold: string, defaultOperator?: string): boolean {
    const regex = new RegExp(dateComparatorPattern);
    const matches = threshold.match(regex);
    if (!matches || matches.length !== 4) {
        return false;
    }

    let operator: string | undefined = matches[1];
    if (!operator && defaultOperator) {
        operator = defaultOperator;
    }
    const value = parseInt(matches[2]);
    const interval = matches[3];

    let comparisonDate: Date | undefined;
    switch (interval) {
        case "minute":
            comparisonDate = addMinutes(new Date(), -value);
            break;
        case "hour":
            comparisonDate = addHours(new Date(), -value);
            break;
        case "day":
            comparisonDate = addDays(new Date(), -value);
            break;
        case "week":
            comparisonDate = addWeeks(new Date(), -value);
            break;
        case "month":
            comparisonDate = addMonths(new Date(), -value);
            break;
        case "year":
            comparisonDate = addYears(new Date(), -value);
            break;
    }

    if (!comparisonDate) {
        return false;
    }

    switch (operator) {
        case "<":
            return comparisonDate < input;
        case "<=":
            return comparisonDate <= input;
        case ">":
            return comparisonDate > input;
        case ">=":
            return comparisonDate >= input;
        default:
            return false;
    }
}
