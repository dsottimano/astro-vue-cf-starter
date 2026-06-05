import { describe, it, expect } from 'vitest';
import { inlineKeyboard, locationKeyboard } from './_telegram';

describe('keyboard builders', () => {
  it('inlineKeyboard maps [label, data] tuples into Telegram buttons', () => {
    const kb = inlineKeyboard([
      [
        ['House', 'pt:house'],
        ['Condo', 'pt:condo'],
      ],
    ]);
    expect(kb).toEqual({
      inline_keyboard: [
        [
          { text: 'House', callback_data: 'pt:house' },
          { text: 'Condo', callback_data: 'pt:condo' },
        ],
      ],
    });
  });

  it('locationKeyboard requests location and is one-time', () => {
    const kb = locationKeyboard();
    expect(kb.keyboard[0][0].request_location).toBe(true);
    expect(kb.resize_keyboard).toBe(true);
    expect(kb.one_time_keyboard).toBe(true);
  });
});
