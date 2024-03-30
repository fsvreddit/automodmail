Like Automoderator, just for modmail. Allows sub mods to configure rules written in YAML to enable autoresponders, automate ban appeals and more. 

For full documentation, please see [this wiki page](https://www.reddit.com/r/fsvapps/wiki/auto-modmail).

Modmail Automator is open source. You can find it on Github [here](https://github.com/fsvreddit/automodmail).

## Version History

### v1.3

Bug fixes:
- Fixed ~body rule checks that were broken
- Fixed (includes-word) acting like (includes) was specified

### v1.2

- Exempts all admins from rules unless you specifically opt-in to it
- Allows both negated and positive checks on the same rule (e.g. subject: and ~subject:)
- Allows author ~name checks.
