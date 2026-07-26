import { Devvit } from "@devvit/public-api";
import { actOnMessageAfterDelay, onModmailReceiveEvent } from "./autoresponder.js";
import { appSettings, saveRulesToWikiPage } from "./settings.js";
import { SchedulerJob } from "./constants.js";
import { handleDeletedComment, handleDeletedPost } from "./deletions.js";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.addTrigger({
    event: "CommentDelete",
    onEvent: handleDeletedComment,
});

Devvit.addTrigger({
    event: "PostDelete",
    onEvent: handleDeletedPost,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.ActOnMessageAfterDelay,
    onRun: actOnMessageAfterDelay,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.SaveRulesToWikiPage,
    onRun: saveRulesToWikiPage,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
