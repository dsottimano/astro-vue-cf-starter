import { describe, it, expect } from 'vitest';
import { nextStep, stepApplies, parsePositiveNumber, esc } from './_wizard';

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('AT&T <b>x</b>')).toBe('AT&amp;T &lt;b&gt;x&lt;/b&gt;');
  });
});

describe('parsePositiveNumber', () => {
  it('parses plain and comma-formatted numbers', () => {
    expect(parsePositiveNumber('875000')).toBe(875000);
    expect(parsePositiveNumber('875,000')).toBe(875000);
    expect(parsePositiveNumber('$875000')).toBe(875000);
  });
  it('rejects non-numbers and negatives', () => {
    expect(parsePositiveNumber('abc')).toBeNull();
    expect(parsePositiveNumber('-5')).toBeNull();
  });
});

describe('stepApplies', () => {
  it('beds/baths/area apply only to house/condo', () => {
    expect(stepApplies('beds', { propertyType: 'house' })).toBe(true);
    expect(stepApplies('beds', { propertyType: 'lot' })).toBe(false);
  });
  it('lotSize applies only to lot/commercial', () => {
    expect(stepApplies('lotSize', { propertyType: 'lot' })).toBe(true);
    expect(stepApplies('lotSize', { propertyType: 'condo' })).toBe(false);
  });
});

describe('nextStep', () => {
  it('skips beds for a lot and lands on lotSize after currency', () => {
    expect(nextStep('currency', { propertyType: 'lot' })).toBe('lotSize');
  });
  it('skips lotSize for a house and lands on beds after currency', () => {
    expect(nextStep('currency', { propertyType: 'house' })).toBe('beds');
  });
  it('confirm is terminal', () => {
    expect(nextStep('confirm', {})).toBe('confirm');
  });
});
