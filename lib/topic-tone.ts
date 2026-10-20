/**
 * Every topic owns one of six colours, by its place in the notes: the first topic is green, the second blue, and so
 * on, the same wherever the topic appears (the plan, the path, a run, the recall map, the sheet). Colour here is a way
 * to find a topic again, never decoration and never the only cue: the name is always beside it.
 */
export const TONES = 6;

export type Tone = 1 | 2 | 3 | 4 | 5 | 6;

export function toneAt(index: number): Tone {
  return ((((index % TONES) + TONES) % TONES) + 1) as Tone;
}

/** The tone of a topic among its course's topics, in the order of the notes. */
export function toneOf(conceptId: string | undefined, concepts: Array<{ id: string; courseId?: string }>): Tone {
  if (!conceptId) return 1;
  const own = concepts.find((concept) => concept.id === conceptId);
  const course = own?.courseId ? concepts.filter((concept) => concept.courseId === own.courseId) : concepts;
  const index = course.findIndex((concept) => concept.id === conceptId);
  return toneAt(index < 0 ? 0 : index);
}
