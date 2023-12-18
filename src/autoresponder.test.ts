import {addDays, addMinutes, addMonths, addWeeks, addYears} from "date-fns";
import {meetsDateThreshold, meetsNumericThreshold} from "./autoresponder.js";

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
