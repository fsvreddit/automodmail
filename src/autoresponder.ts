import {OnTriggerEvent, Subreddit, TriggerContext, User} from "@devvit/public-api";
import {ModMail} from "@devvit/protos";
import {ResponseRule, parseRules} from "./config.js";
import {Duration, add, formatDistanceToNow} from "date-fns";
import {isBanned, isContributor, isModerator, replaceAll} from "./utility.js";

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
    modActionTargetPermalink?: string
    modActionTargetKind?: string
}

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

    if (!conversationResponse.conversation) {
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

    let matchedRules = await Promise.all(rules.map(rule => checkRule(context, subreddit, rule, subject, body, participant)));

    // Sort by priority descending, take top 1.
    matchedRules = matchedRules.filter(x => x.ruleMatched).sort((a, b) => b.priority - a.priority);

    if (matchedRules.length === 0) {
        console.log("No rules matched.");
        return;
    }

    console.log("Matched a rule.");

    const firstMatchedRule = matchedRules[0];

    if (firstMatchedRule.reply) {
        let replyMessage = firstMatchedRule.reply;

        const signoff = await context.settings.get<string>("signoff");
        if (signoff) {
            replyMessage += `\n\n${signoff}`;
        }

        replyMessage = replaceAll(replyMessage, "{{author}}", event.messageAuthor.name);
        replyMessage = replaceAll(replyMessage, "{{subreddit}}", subreddit.name);
        if (firstMatchedRule.modActionDate) {
            replyMessage = replaceAll(replyMessage, "{{mod_action_timespan_to_now}}", formatDistanceToNow(firstMatchedRule.modActionDate));
        }
        if (firstMatchedRule.modActionTargetPermalink) {
            replyMessage = replaceAll(replyMessage, "{{mod_action_target_permalink}}", firstMatchedRule.modActionTargetPermalink);
        }
        if (firstMatchedRule.modActionTargetKind) {
            replyMessage = replaceAll(replyMessage, "{{mod_action_target_kind}}", firstMatchedRule.modActionTargetKind);
        }

        await context.reddit.modMail.reply({
            body: replyMessage,
            conversationId: event.conversationId,
            isInternal: false,
            isAuthorHidden: true,
        });

        console.log("Replied to modmail");
    }

    if (firstMatchedRule.mute) {
        await context.reddit.modMail.muteConversation({
            conversationId: event.conversationId,
            numHours: firstMatchedRule.mute * 24,
        });
        console.log("User muted");
    }

    if (firstMatchedRule.archive) {
        await context.reddit.modMail.archiveConversation(event.conversationId);
        console.log("Conversation archived");
    }

    if (firstMatchedRule.unban) {
        await context.reddit.unbanUser(event.messageAuthor.name, subreddit.name);
        console.log("User unbanned");
    }
}

async function checkRule (context: TriggerContext, subreddit: Subreddit, rule: ResponseRule, subject: string, body: string, participant: User | undefined): Promise<RuleMatchContext> {
    const result: RuleMatchContext = {
        ruleMatched: false,
        priority: rule.priority ?? 0,
        reply: rule.reply,
        mute: rule.mute,
        archive: rule.archive,
        unban: rule.unban,
    };

    if (rule.subject && !rule.subject.some(val => subject.toLowerCase().includes(val.toLowerCase()))) {
        console.log("Subject does not match.");
        return result;
    }

    if (rule.notsubject && rule.notsubject.some(val => subject.toLowerCase().includes(val.toLowerCase()))) {
        console.log("~Subject does not match.");
        return result;
    }

    if (rule.subject_regex) {
        const regexes = rule.subject_regex.map(x => new RegExp(x, "i"));
        if (!regexes.some(x => x.test(subject))) {
            console.log("Subject regex does not match");
            return result;
        }
    }

    if (rule.notsubject_regex) {
        const regexes = rule.notsubject_regex.map(x => new RegExp(x, "i"));
        if (regexes.some(x => x.test(subject))) {
            console.log("~Subject regex does not match");
            return result;
        }
    }

    if (rule.body && !rule.body.some(val => body.toLowerCase().includes(val.toLowerCase()))) {
        console.log("Body does not match.");
        return result;
    }

    if (rule.notbody && rule.notbody.some(val => body.toLowerCase().includes(val.toLowerCase()))) {
        console.log("Body does not match.");
        return result;
    }

    if (rule.body_regex) {
        const regexes = rule.body_regex.map(x => new RegExp(x));
        if (!regexes.some(x => x.test(body))) {
            console.log("Body regex does not match");
            return result;
        }
    }

    if (rule.notbody_regex) {
        const regexes = rule.notbody_regex.map(x => new RegExp(x));
        if (!regexes.some(x => x.test(body))) {
            console.log("Body regex does not match");
            return result;
        }
    }

    if (rule.author) {
        if (participant) {
            // Most checks need the user to be not shadowbanned.
            if (rule.author.name && !rule.author.name.some(name => name.toLowerCase() === participant.username.toLowerCase())) {
                console.log("Author name doesn't match");
                return result;
            }

            if (rule.author.name_regex) {
                const regexes = rule.author.name_regex.map(x => new RegExp(x, "i"));
                if (!regexes.some(x => x.test(participant.username))) {
                    console.log("Author name regex doesn't match");
                    return result;
                }
            }

            const thresholdChecks: boolean[] = [];
            if (rule.author.post_karma) {
                thresholdChecks.push(meetsNumericThreshold(participant.linkKarma, rule.author.post_karma));
            }
            if (rule.author.comment_karma) {
                thresholdChecks.push(meetsNumericThreshold(participant.commentKarma, rule.author.comment_karma));
            }
            if (rule.author.combined_karma) {
                thresholdChecks.push(meetsNumericThreshold(participant.linkKarma + participant.commentKarma, rule.author.combined_karma));
            }
            if (rule.author.account_age) {
                thresholdChecks.push(meetsDateThreshold(participant.createdAt, rule.author.account_age));
            }

            if (thresholdChecks.length > 0) {
                // Satisfy Any Threshold: If no check came back true, quit.
                if (rule.author.satisfy_any_threshold && !thresholdChecks.includes(true)) {
                    console.log("Satisfy Any Threshold: No threshold checks passed.");
                    return result;
                } else if (!rule.author.satisfy_any_threshold && thresholdChecks.includes(false)) {
                    console.log("Satisfy Any Threshold: Not all threshold checks passed.");
                    return result;
                }
            }

            if (rule.author.is_banned !== undefined) {
                const userIsBanned = await isBanned(context, subreddit.name, participant.username);
                if (rule.author.is_banned !== userIsBanned) {
                    console.log("User banned check failed, skipping rule.");
                    return result;
                }
            }

            if (rule.author.is_contributor !== undefined) {
                const userIsContributor = await isContributor(context, subreddit.name, participant.username);
                if (rule.author.is_contributor !== userIsContributor) {
                    console.log("Contributor check failed, skipping rule.");
                    return result;
                }
            }

            if (rule.author.is_moderator !== undefined) {
                const userIsModerator = await isModerator(context, subreddit.name, participant.username);
                if (rule.author.is_moderator !== userIsModerator) {
                    console.log("Moderator check failed, skipping rule.");
                    return result;
                }
            }

            if (rule.author.flair_text || rule.author.flair_css_class || rule.author.flair_css_class) {
                const flair = await participant.getUserFlairBySubreddit(subreddit.name);
                if (!flair) {
                    console.log("User does not have flair, but flair checks exist. Skipping rule.");
                    return result;
                }

                if (rule.author.flair_text && rule.author.flair_text !== flair.flairText) {
                    console.log("Flair text check failed. Skipping rule.");
                    return result;
                }

                if (rule.author.flair_css_class && rule.author.flair_css_class !== flair.flairCssClass) {
                    console.log("Flair text check failed. Skipping rule.");
                    return result;
                }
            }
        }

        if (rule.author.is_shadowbanned !== undefined) {
            if (rule.author.is_shadowbanned !== (participant === undefined)) {
                console.log("Shadowban check failed, skipping rule.");
                return result;
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

        console.log(modLog.length);

        modLog = modLog.filter(x => x.target && x.target.author === participant.username);

        if (rule.mod_action.action_within) {
            modLog = modLog.filter(x => rule.mod_action && rule.mod_action.action_within && meetsDateThreshold(x.createdAt, rule.mod_action.action_within, ">"));
            console.log(`After removing old entries: ${modLog.length} log entries still found`);
        }

        console.log(modLog);

        if (rule.mod_action.action_reason) {
            modLog = modLog.filter(logEntry => rule.mod_action?.action_reason?.some(reason => `${logEntry.details ?? ""} ${logEntry.description ?? ""}`.toLowerCase().includes(reason.toLowerCase())));
            console.log(`After removing non-matching reasons: ${modLog.length} log entries still found`);
        }

        console.log(modLog);

        if (modLog.length === 0) {
            console.log("No matching mod log entry!");
            return result;
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

function meetsNumericThreshold (input: number, threshold: string): boolean {
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

function meetsDateThreshold (input: Date, threshold: string, defaultOperator?: string): boolean {
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

    let duration: Duration | undefined;
    switch (interval) {
        case "minute":
            duration = {minutes: value};
            break;
        case "hour":
            duration = {hours: value};
            break;
        case "day":
            duration = {days: value};
            break;
        case "week":
            duration = {weeks: value};
            break;
        case "month":
            duration = {months: value};
            break;
        case "year":
            duration = {years: value};
            break;
    }

    if (!duration) {
        return false;
    }

    switch (operator) {
        case "<":
            return add(input, duration) < new Date();
        case "<=":
            return add(input, duration) <= new Date();
        case ">":
            return add(input, duration) > new Date();
        case ">=":
            return add(input, duration) >= new Date();
        default:
            return false;
    }
}
