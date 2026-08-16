/** Convert [[wiki/links]] to markdown links before rendering. */
export function preprocessWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, path: string) => {
    const label = path.split("/").pop() ?? path;
    return `[${label}](wiki://${path})`;
  });
}
