Like Automoderator, just for modmail. Allows sub mods to configure rules written in YAML to enable autoresponders, automate ban appeals and more. 

For full documentation, please see [this page](https://www.reddit.com/r/fsvapps/wiki/auto-modmail).

Modmail Automator is open source. You can find it on Github [here](https://github.com/fsvreddit/automodmail).

## Version History

For older releases please see the [full change log](https://github.com/fsvreddit/automodmail/blob/main/changelog.md).

### Next version

- Add `is_nsfw` check within the `author` property
- Add `post_subreddit_karma`, `comment_subreddit_karma` and `combined_subreddit_karma` checks within the `author` property
- Add `time_since_last_new_conversation` and `time_since_last_user_message` checks
- Fix output of {{author}} and {{subreddit}} placeholders if u/ or r/ are prepended

### v1.10.3

- Added further mitigations against duplicate messages

### v1.10.2

- Added mitigations to stop duplicate messages if the Developer Platform is having issues

### v1.10.1

- Added a user ignore list setting to app configuration so that you can ignore any messages from certain users across all rules.

### v1.10.0

- Add feature to allow mod notes to be added by Modmail Automator rules
- Add ability to check a user's social links
- Add `was_deleted` check to mod action checks
- When setting user flair text, the existing flair CSS class is respected
- App can now act on outgoing messages triggered by itself (e.g. when approving users)
- Update Devvit
