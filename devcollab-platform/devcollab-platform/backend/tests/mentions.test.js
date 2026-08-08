import { describe, expect, it } from 'vitest';
import { extractMentions } from '../src/services/mentions.js';

describe('mention extraction', () => {
  it('extracts usernames', () => expect(extractMentions('Hi @Alice and @bob')).toEqual(['alice','bob']));
  it('deduplicates mentions', () => expect(extractMentions('@a @a @b')).toEqual(['a','b']));
  it('ignores plain text', () => expect(extractMentions('hello world')).toEqual([]));
});
