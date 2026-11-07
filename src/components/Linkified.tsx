const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g

/** Plain text with web links made clickable. Markdown comes later. */
export function Linkified({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-sky-400 hover:underline"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}
