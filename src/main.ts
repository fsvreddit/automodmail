import {Devvit} from "@devvit/public-api";
import {actOnMessageAfterDelay, onModmailReceiveEvent} from "./autoresponder.js";
import {parseRules} from "./config.js";
import {languageList} from "./i18n.js";

Devvit.addSettings([
    {
        type: "paragraph",
        name: "rules",
        label: "Enter YAML autoresponse rules",
        onValidate: ({value}) => {
            try {
                parseRules(value);
            } catch (error) {
                if (error instanceof Error) {
                    return `Error parsing rules: ${error.message}`;
                } else {
                    return "Error parsing rules";
                }
            }
        },
    },
    {
        type: "paragraph",
        name: "signoff",
        label: "Enter text to accompany all autoresponses",
        helpText: "It is recommended that you use this to inform your users that the reply was automated.",
        defaultValue: "*This is an automatic response. If you need more assistance, please reply to this message and a human moderator will review your request.*",
    },
    {
        type: "number",
        name: "secondsDelayBeforeSend",
        label: "Number of seconds to wait before acting on modmails",
        helpText: "Acts on modmails after a delay, may be useful if you need other modmail bots to run first.",
        defaultValue: 0,
    },
    {
        type: "group",
        label: "Language Options",
        fields: [
            {
                type: "select",
                name: "locale",
                label: "Language to use for output",
                helpText: "Affects {{mod_action_timespan_to_now}} placeholder only at the present time",
                multiSelect: false,
                options: languageList.map(language => ({label: language.languageName, value: language.isoCode})),
                defaultValue: ["en"],
            },
            {
                type: "string",
                name: "postString",
                label: "Override text for 'post'",
                helpText: "If you prefer to use a different term to the default for the chosen language, enter it here.",
            },
            {
                type: "string",
                name: "commentString",
                label: "Override text for 'comment'",
                helpText: "If you prefer to use a different term to the default for the chosen language, enter it here.",
            },
        ],
    },
]);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.addSchedulerJob({
    name: "actOnMessageAfterDelay",
    onRun: actOnMessageAfterDelay,
});

Devvit.configure({
    redditAPI: true,
});

export default Devvit;

