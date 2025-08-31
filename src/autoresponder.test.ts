/* eslint-disable camelcase */
import { addDays, addMinutes, addMonths, addWeeks, addYears } from "date-fns";
import { applyReplyPlaceholders, checkRule, checkTextMatch, meetsDateThreshold, meetsNumericThreshold, RuleMatchContext } from "./autoresponder.js";
import { ResponseRule, parseRules } from "./config.js";
import { AppSettings } from "./settings.js";

test("Within numeric threshold less than", () => {
    const result = meetsNumericThreshold(5, "< 10");
    expect(result).toBeTruthy();
});

test("Within numeric threshold lteq", () => {
    const result = meetsNumericThreshold(5, "<= 10");
    expect(result).toBeTruthy();
});

test("Within numeric threshold greater than", () => {
    const result = meetsNumericThreshold(5, "> 3");
    expect(result).toBeTruthy();
});

test("Within numeric threshold gteq", () => {
    const result = meetsNumericThreshold(5, ">= 3");
    expect(result).toBeTruthy();
});

test("On numeric threshold boundary lteq", () => {
    const result = meetsNumericThreshold(5, "<= 5");
    expect(result).toBeTruthy();
});

test("On numeric threshold boundary gteq", () => {
    const result = meetsNumericThreshold(5, ">= 5");
    expect(result).toBeTruthy();
});

test("On numeric threshold boundary equals", () => {
    const result = meetsNumericThreshold(5, "= 5");
    expect(result).toBeTruthy();
});

test("Outside numeric threshold less than", () => {
    const result = meetsNumericThreshold(5, "< 3");
    expect(result).toBeFalsy();
});

test("Outside numeric threshold lteq", () => {
    const result = meetsNumericThreshold(5, "<= 3");
    expect(result).toBeFalsy();
});

test("Outside numeric threshold greater than", () => {
    const result = meetsNumericThreshold(5, "> 7");
    expect(result).toBeFalsy();
});

test("Outside numeric threshold gteq", () => {
    const result = meetsNumericThreshold(5, ">= 7");
    expect(result).toBeFalsy();
});

test("Outside numeric threshold boundary equals", () => {
    const result = meetsNumericThreshold(5, "= 4");
    expect(result).toBeFalsy();
});

test("Inside date threshold less than days", () => {
    const result = meetsDateThreshold(addDays(new Date(), -5), "< 10 days");
    expect(result).toBeTruthy();
});

test("Inside date threshold less than weeks", () => {
    const result = meetsDateThreshold(addDays(new Date(), -5), "< 10 weeks");
    expect(result).toBeTruthy();
});

test("Inside date threshold less than months", () => {
    const result = meetsDateThreshold(addWeeks(new Date(), -5), "< 3 months");
    expect(result).toBeTruthy();
});

test("Inside date threshold less than years", () => {
    const result = meetsDateThreshold(addWeeks(new Date(), -5), "< 3 years");
    expect(result).toBeTruthy();
});

test("Inside date threshold greater than days", () => {
    const result = meetsDateThreshold(addDays(new Date(), -5), "> 3 days");
    expect(result).toBeTruthy();
});

test("Inside date threshold greater than weeks", () => {
    const result = meetsDateThreshold(addWeeks(new Date(), -12), "> 10 weeks");
    expect(result).toBeTruthy();
});

test("Inside date threshold greater than months", () => {
    const result = meetsDateThreshold(addMonths(new Date(), -5), "> 3 months");
    expect(result).toBeTruthy();
});

test("Inside date threshold greater than years", () => {
    const result = meetsDateThreshold(addYears(new Date(), -5), "> 3 years");
    expect(result).toBeTruthy();
});

test("Inside date threshold with overridden less than operator", () => {
    const result = meetsDateThreshold(addMinutes(new Date(), -3), "15 minutes", "<");
    expect(result).toBeTruthy();
});

test("Outside date threshold less than", () => {
    const result = meetsDateThreshold(addDays(new Date(), -5), "< 4 days");
    expect(result).toBeFalsy();
});

test("Outside date threshold greater than", () => {
    const result = meetsDateThreshold(addDays(new Date(), -5), "> 6 days");
    expect(result).toBeFalsy();
});

interface SearchTest {
    matchText: string;
    method: string;
    expected: boolean;
}

test("Search methods", () => {
    const input = "The quick brown fox";

    const tests: SearchTest[] = [
        { matchText: "ick", method: "includes", expected: true },
        { matchText: "boo", method: "includes", expected: false },
        { matchText: "quick", method: "includes-word", expected: true },
        { matchText: "ick", method: "includes-word", expected: false },
        { matchText: "the", method: "starts-with", expected: true },
        { matchText: "quick", method: "starts-with", expected: false },
        { matchText: "fox", method: "ends-with", expected: true },
        { matchText: "quick", method: "ends-with", expected: false },
        { matchText: "the quick brown fox", method: "full-exact", expected: true },
        { matchText: "quick", method: "full-exact", expected: false },
        { matchText: "qu[ia]ck", method: "regex", expected: true },
        { matchText: "qu[ou]ck", method: "regex", expected: false },
    ];

    for (const test of tests) {
        let result = checkTextMatch(input, [test.matchText], { search_method: test.method, negate: false, case_sensitive: false });

        if (test.expected) {
            // eslint-disable-next-line vitest/valid-expect
            expect(result, JSON.stringify(test)).toBeTruthy();
        } else {
            // eslint-disable-next-line vitest/valid-expect
            expect(result, JSON.stringify(test)).toBeFalsy();
        }

        result = checkTextMatch(input, [test.matchText], { search_method: test.method, negate: true, case_sensitive: false });
        if (test.expected) {
            expect(result, `negated ${JSON.stringify(test)}`).toBeFalsy();
        } else {
            expect(result, `negated ${JSON.stringify(test)}`).toBeTruthy();
        }
    }
});

test("Case sensitivity on Regex, Matching Case sensitive", () => {
    const result = checkTextMatch("Quick", ["Quick"], { case_sensitive: true, negate: false, search_method: "regex" });
    expect(result).toBeTruthy();
});

test("Case sensitivity on Regex, Matching Case insensitive", () => {
    const result = checkTextMatch("Quick", ["quick"], { case_sensitive: false, negate: false, search_method: "regex" });
    expect(result).toBeTruthy();
});

test("Case sensitivity on Regex, Non-matching Case Sensitive", () => {
    const result = checkTextMatch("Quick", ["quick"], { case_sensitive: true, negate: false, search_method: "regex" });
    expect(result).toBeFalsy();
});

test("Case sensitivity on Regex, Non-matching Case insensitive", () => {
    const result = checkTextMatch("Quick", ["quick"], { case_sensitive: false, negate: false, search_method: "regex" });
    expect(result).toBeTruthy();
});

test("Both subject and negated subject", async () => {
    const rule: ResponseRule = {
        subject: ["hello"],
        subject_options: { case_sensitive: false, negate: false, search_method: "includes" },
        notsubject: ["goodbye"],
        notsubject_options: { case_sensitive: false, negate: true, search_method: "includes" },
        mute: 3,
    };

    const resultNotMatching = await checkRule(undefined, "subname", rule, "hello and goodbye", "", "username");
    expect(resultNotMatching.ruleMatched).toBeFalsy();
    expect(resultNotMatching.mute).toEqual(3);

    const resultMatching = await checkRule(undefined, "subname", rule, "hello and greetings", "", "username");
    expect(resultMatching.ruleMatched).toBeTruthy();
    expect(resultMatching.mute).toEqual(3);
});

test("Reproduction scenario from dcltw", async () => {
    // https://www.reddit.com/r/fsvapps/comments/1aqrz9k/introducing_modmail_automator/kx652vx/
    const rules = `---
# Verification No Link
~body (includes-word): ["test", "this", "hello"]
subject: Verification Request
author:
    is_banned: false
reply: |
    Rule Triggered - Verification No Link
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "Verification Request", "this is a test", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeFalsy();
});

test("subject+body matching subject", async () => {
    const rules = `---
# Subject and Body
subject+body: "test"
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "This is a test", "message body", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeTruthy();
});

test("subject+body matching body", async () => {
    const rules = `---
# Subject and Body
subject+body: "test"
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "message subject", "this is a test", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeTruthy();
});

test("subject+body matching both", async () => {
    const rules = `---
# Subject and Body
subject+body: "test"
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "this is a test", "this is a test", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeTruthy();
});

test("subject+body matching neither", async () => {
    const rules = `---
# Subject and Body
subject+body: "test"
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "message subject", "message body", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeFalsy();
});

test("~subject+body matching subject", async () => {
    const rules = `---
# Subject and Body
~subject+body: "test"
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "This is a test", "message body", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeFalsy();
});

test("~subject+body matching body", async () => {
    const rules = `---
# Subject and Body
~subject+body: "test"
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "message subject", "this is a test", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeFalsy();
});

test("~subject+body matching both", async () => {
    const rules = `---
# Subject and Body
~subject+body: "test"
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "this is a test", "this is a test", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeFalsy();
});

test("~subject+body matching neither", async () => {
    const rules = `---
# Subject and Body
~subject+body: "test"
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult = await checkRule(undefined, "testsub", rule, "message subject", "message body", "username", undefined, false, false);

    expect(ruleResult.ruleMatched).toBeTruthy();
});

test("Body shorter than", async () => {
    const rules = `---
body_shorter_than: 5
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult1 = await checkRule(undefined, "testsub", rule, "message subject", "a", "username", undefined, false, false);
    expect(ruleResult1.ruleMatched).toBeTruthy();

    const ruleResult2 = await checkRule(undefined, "testsub", rule, "message subject", "abcdef", "username", undefined, false, false);
    expect(ruleResult2.ruleMatched).toBeFalsy();
});

test("Body longer than", async () => {
    const rules = `---
body_longer_than: 5
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult1 = await checkRule(undefined, "testsub", rule, "message subject", "abcdef", "username", undefined, false, false);
    expect(ruleResult1.ruleMatched).toBeTruthy();

    const ruleResult2 = await checkRule(undefined, "testsub", rule, "message subject", "a", "username", undefined, false, false);
    expect(ruleResult2.ruleMatched).toBeFalsy();
});

test("Subject shorter than", async () => {
    const rules = `---
subject_shorter_than: 5
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult1 = await checkRule(undefined, "testsub", rule, "a", "message body", "username", undefined, false, false);
    expect(ruleResult1.ruleMatched).toBeTruthy();

    const ruleResult2 = await checkRule(undefined, "testsub", rule, "abcdef", "message body", "username", undefined, false, false);
    expect(ruleResult2.ruleMatched).toBeFalsy();
});

test("Subject longer than", async () => {
    const rules = `---
subject_longer_than: 5
mute: 28
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    const ruleResult1 = await checkRule(undefined, "testsub", rule, "abcdef", "message body", "username", undefined, false, false);
    expect(ruleResult1.ruleMatched).toBeTruthy();

    const ruleResult2 = await checkRule(undefined, "testsub", rule, "a", "message body", "username", undefined, false, false);
    expect(ruleResult2.ruleMatched).toBeFalsy();
});

test("applyReplyPlaceholders works correctly for target kind and permalink", () => {
    const input1 = "{{mod_action_target_kind}}";
    const input2 = "{{mod_action_target_permalink}}";

    const ruleMatchContext: RuleMatchContext = {
        ruleMatched: true,
        priority: 1,
        verboseLogs: [],
        includeSignoff: true,
        modActionTargetKind: "post",
        modActionTargetPermalink: "https://reddit.com/r/example/comments/abc123/example_post/",
    };

    const settings: AppSettings = {
        backupToWikiPage: false,
        includeSignoffForMods: true,
        locale: ["en"],
        secondsDelayBeforeSend: 0,
        commentString: "",
        rules: "",
        signoff: "",
        postString: "",
    };

    const output1 = applyReplyPlaceholders(input1, ruleMatchContext, "testuser", "testsubreddit", settings);
    const output2 = applyReplyPlaceholders(input2, ruleMatchContext, "testuser", "testsubreddit", settings);

    expect(output1).toEqual("post");
    expect(output2).toEqual("https://reddit.com/r/example/comments/abc123/example_post/");
});
