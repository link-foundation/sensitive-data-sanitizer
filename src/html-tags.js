// HTML formatting tags split tokens (`SECRET_</span><span>REST`). Inline tags
// are dropped and block tags become line breaks. Only presentation attributes
// are allowed, so other attribute values (URLs, data-*) stay in the view.
export const inlineTags =
  'abbr|b|cite|code|del|em|font|i|ins|kbd|mark|q|s|samp|small|span|strong|sub|sup|tt|u|var';
const blockTags =
  'blockquote|br|dd|div|dt|h[1-6]|hr|li|ol|p|pre|table|tbody|td|th|thead|tr|ul';
export const htmlTag = String.raw`<\/?(?:${inlineTags}|${blockTags})(?:\s+(?:class|dir|lang|style)="[^"<>=]*")*\s*\/?>`;
