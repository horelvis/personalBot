/**
 * Reads a text/event-stream body and yields the JSON of each event's data. Chunks may split an
 * event anywhere, even mid-line, so text is buffered until a blank line closes the event.
 */
export async function* readSseJson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n?/g, "\n");
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const data = dataOf(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (data !== null) yield JSON.parse(data);
      }
      if (done) break;
    }
    const data = dataOf(buffer);
    if (data !== null) yield JSON.parse(data);
  } finally {
    reader.releaseLock();
  }
}

function dataOf(block: string): string | null {
  const lines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""));
  return lines.length > 0 ? lines.join("\n") : null;
}
