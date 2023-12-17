import {Devvit} from "@devvit/public-api";
import {onModmailReceiveEvent} from "./autoresponder.js";
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
        type: "select",
        name: "locale",
        label: "Language to use for output",
        helpText: "Affects {{mod_action_timespan_to_now}} placeholder only at the present time",
        multiSelect: false,
        options: languageList.map(language => ({label: language.languageName, value: language.isoCode})),
        defaultValue: ["en"],
    },
]);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.configure({
    redditAPI: true,
});

export default Devvit;

