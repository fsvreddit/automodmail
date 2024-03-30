/* eslint-disable camelcase */
import {addDays, addMinutes, addMonths, addWeeks, addYears} from "date-fns";
import {checkRule, checkTextMatch, meetsDateThreshold, meetsNumericThreshold} from "./autoresponder.js";
import {ResponseRule, parseRules} from "./config.js";

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
    matchText: string,
    method: string,
    expected: boolean,
}

test("Search methods", () => {
    const input = "The quick brown fox";

    const tests: SearchTest[] = [
        {matchText: "ick", method: "includes", expected: true},
        {matchText: "boo", method: "includes", expected: false},
        {matchText: "quick", method: "includes-word", expected: true},
        {matchText: "ick", method: "includes-word", expected: false},
        {matchText: "the", method: "starts-with", expected: true},
        {matchText: "quick", method: "starts-with", expected: false},
        {matchText: "fox", method: "ends-with", expected: true},
        {matchText: "quick", method: "ends-with", expected: false},
        {matchText: "the quick brown fox", method: "full-exact", expected: true},
        {matchText: "quick", method: "full-exact", expected: false},
        {matchText: "qu[ia]ck", method: "regex", expected: true},
        {matchText: "qu[ou]ck", method: "regex", expected: false},
    ];

    const expected = tests.map(test => ({method: test.method, expected: test.expected, negated: false, result: test.expected}));
    expected.push(...tests.map(test => ({method: test.method, expected: !test.expected, negated: true, result: !test.expected})));

    const results = tests.map(test => ({method: test.method, expected: test.expected, negated: false, result: checkTextMatch(input, [test.matchText], {search_method: test.method, negate: false, case_sensitive: false})}));
    results.push(...tests.map(test => ({method: test.method, expected: !test.expected, negated: true, result: checkTextMatch(input, [test.matchText], {search_method: test.method, negate: true, case_sensitive: false})})));

    expect(results).toEqual(expected);
});

test("Case sensitivity on Regex, Matching Case sensitive", () => {
    const result = checkTextMatch("Quick", ["Quick"], {case_sensitive: true, negate: false, search_method: "regex"});
    expect(result).toBeTruthy();
});

test("Case sensitivity on Regex, Matching Case insensitive", () => {
    const result = checkTextMatch("Quick", ["quick"], {case_sensitive: false, negate: false, search_method: "regex"});
    expect(result).toBeTruthy();
});

test("Case sensitivity on Regex, Non-matching Case Sensitive", () => {
    const result = checkTextMatch("Quick", ["quick"], {case_sensitive: true, negate: false, search_method: "regex"});
    expect(result).toBeFalsy();
});

test("Case sensitivity on Regex, Non-matching Case insensitive", () => {
    const result = checkTextMatch("Quick", ["quick"], {case_sensitive: false, negate: false, search_method: "regex"});
    expect(result).toBeTruthy();
});

test("Both subject and negated subject", async () => {
    const rule: ResponseRule = {
        subject: ["hello"],
        subject_options: {case_sensitive: false, negate: false, search_method: "includes"},
        notsubject: ["goodbye"],
        notsubject_options: {case_sensitive: false, negate: true, search_method: "includes"},
        mute: 3,
    };

    const resultNotMatching = await checkRule(undefined, "subname", rule, "hello and goodbye", "");
    expect(resultNotMatching.ruleMatched).toBeFalsy();
    expect(resultNotMatching.mute).toEqual(3);

    const resultMatching = await checkRule(undefined, "subname", rule, "hello and greetings", "");
    expect(resultMatching.ruleMatched).toBeTruthy();
    expect(resultMatching.mute).toEqual(3);
});

test("Reproduction scenario from dcltw", async () => {
    // https://www.reddit.com/r/fsvapps/comments/1aqrz9k/introducing_modmail_automator/kx652vx/
    const rules = `---
# Verification No Link
~body (includes-word): ["test", "this", "hello"]
subject: Verification Request
verbose_logs: true
author:
    is_banned: false
reply: |
    Rule Triggered - Verification No Link
---`;

    const parsedRules = parseRules(rules);
    expect(parsedRules.length).toEqual(1);

    const rule = parsedRules[0];
    console.log(rule);
    // eslint-disable-next-line no-await-in-loop
    const ruleResult = await checkRule(undefined, "testsub", rule, "Verification Request", "this is a test", undefined, false, false);
    console.log(ruleResult);

    expect(ruleResult.ruleMatched).toBeFalsy();
});

