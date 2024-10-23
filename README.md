Like Automoderator, just for modmail. Allows sub mods to configure rules written in YAML to enable autoresponders, automate ban appeals and more. 

For full documentation, please see [this page](https://www.reddit.com/r/fsvapps/wiki/auto-modmail).

Modmail Automator is open source. You can find it on Github [here](https://github.com/fsvreddit/automodmail).

## Version History

For older releases please see the [full change log](https://github.com/fsvreddit/automodmail/blob/main/changelog.md).

### Next

- Mute duration is now respected
- Fixed issue parsing YAML rules if top level indent is used
- Removed support for legacy "subject_regex" and "body_regex" rules (these were deprecated months ago).

### v1.9.2

- Fixed issue with {{author}} placeholder populating mod's name on mod-triggered rules
- Add `signoff` action, allowing signoffs to be suppressed on individual rules

### v1.9.1

- Add `sub_visibility` check, allowing rules to act based on whether the sub is public or private
- Allow more than one `mod_action_type` to be specified on the same rule
- Fix behaviour of `is_moderator` for mods without modmail permission
- Fix bug which prevents placeholders from being applied to user flairs
- Add `private_reply` action type
