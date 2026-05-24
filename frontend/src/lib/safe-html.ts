import DOMPurify from 'isomorphic-dompurify';

const CONFIG = {
  ALLOWED_TAGS: [
    'p','br','b','strong','i','em','u','s','del','ins','mark',
    'h1','h2','h3','h4','h5','h6',
    'ul','ol','li','blockquote','pre','code',
    'a','img','figure','figcaption',
    'table','thead','tbody','tr','th','td','colgroup','col',
    'div','span','hr','sup','sub',
  ],
  ALLOWED_ATTR: ['href','src','alt','title','target','rel','class','id','width','height','style','colspan','rowspan'],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, CONFIG);
}
