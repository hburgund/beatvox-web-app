import { describe, it, expect } from 'vitest';
import { placeLabel } from './geocode';

describe('placeLabel', () => {
  it('names the place, then the bigger places it is in', () => {
    expect(placeLabel({ name: 'Brooklyn', city: 'New York', state: 'New York', country: 'United States' }).label).toBe(
      'Brooklyn · New York, United States',
    );
  });
  it('leaves out a bigger place with the same name', () => {
    expect(placeLabel({ name: 'Lisbon', city: 'Lisbon', country: 'Portugal' }).label).toBe('Lisbon · Portugal');
  });
  it('uses the street and number when a place has no name', () => {
    expect(placeLabel({ housenumber: '12', street: 'Main St', city: 'Leeds' }).label).toBe('12 Main St · Leeds');
  });
});
