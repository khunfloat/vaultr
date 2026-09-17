/** Flip the checkbox on a task line (0-based). */
export function toggleTaskLine(source: string, line: number): string {
  const lines = source.split('\n')
  if (lines[line] === undefined) return source
  lines[line] = lines[line].replace(/\[([ xX])\]/, (_m, c: string) => (c === ' ' ? '[x]' : '[ ]'))
  return lines.join('\n')
}
