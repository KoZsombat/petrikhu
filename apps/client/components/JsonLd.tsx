/**
 * Structured data (schema.org JSON-LD) for search engines. React escapes `</script>` inside the text, so the
 * serialized JSON cannot break out of the element; a data block is not executed, so the CSP does not apply.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json">{JSON.stringify(data)}</script>
}
