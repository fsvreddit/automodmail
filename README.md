Like Automoderator, just for modmail. Allows sub mods to configure rules written in YAML to enable autoresponders, automate ban appeals and more. 

For full documentation, please see [this page](https://www.reddit.com/r/fsvapps/wiki/auto-modmail).

Modmail Automator is open source. You can find it on Github [here](https://github.com/fsvreddit/automodmail).

## Version History

For older releases please see the [full change log](https://github.com/fsvreddit/automodmail/blob/main/changelog.md).

### v1.9.1

- Add `sub_visibility` check, allowing rules to act based on whether the sub is public or private
- Allow more than one `mod_action_type` to be specified on the same rule
- Fix behaviour of `is_moderator` for mods without modmail permission
- Fix bug which prevents placeholders from being applied to user flairs
- Add `private_reply` action type

### v1.8

- Supports {{match}} placeholders on replies and when setting user flair
- Fixed a bug that prevents flairs from being set when override_flair is not specified.
