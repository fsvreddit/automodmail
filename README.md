Like Automoderator, just for modmail. Allows sub mods to configure rules written in YAML to enable autoresponders, automate ban appeals and more. 

For full documentation, please see [this page](https://github.com/fsvreddit/automodmail/blob/main/redditWiki.md).

Modmail Automator is open source. [You can find it on Github here](https://github.com/fsvreddit/automodmail).

## Version History

For older releases please see the [full change log](https://github.com/fsvreddit/automodmail/blob/main/changelog.md).

### v1.11.0

- Add `is_nsfw` check within the `author` property
- Add `post_subreddit_karma`, `comment_subreddit_karma` and `combined_subreddit_karma` checks within the `author` property
- Add `time_since_last_new_conversation` and `time_since_last_user_message` checks
- Fix output of `{{author}}` and `{{subreddit}}` placeholders if u/ or r/ are prepended
- Add `{{flair_text}}` placeholder
