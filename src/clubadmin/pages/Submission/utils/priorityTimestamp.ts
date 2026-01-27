export function buildPriorityTimestamp(
    date: string,
    time?: string
): string {
    if (time) return `${date}T${time}:00Z`;
    return `${date}T00:00:00Z`;
}
