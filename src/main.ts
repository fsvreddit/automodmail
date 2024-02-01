import {Devvit} from "@devvit/public-api";
import {actOnMessageAfterDelay, onModmailReceiveEvent} from "./autoresponder.js";
import {devvitSettings} from "./settings.js";

Devvit.addSettings(devvitSettings);

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

