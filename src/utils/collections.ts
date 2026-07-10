/** Devuelve una copia de la lista con el elemento de ese id parchado. */
export function patchById<T extends { id: string }>(items: T[], id: string, partial: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...partial } : item));
}
