import {Devvit} from "@devvit/public-api";
import {onModmailReceiveEvent} from "./autoresponder.js";
import {parseRules} from "./config.js";

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
]);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.configure({
    redditAPI: true,
});

export default Devvit;

