/** Unisce classi CSS ignorando valori falsy. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
