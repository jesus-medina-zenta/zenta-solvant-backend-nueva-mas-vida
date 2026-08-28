import { HtmlEscapeUtil } from './html-escape.util';

describe('HtmlEscapeUtil', () => {
  it('escapa "&" por "&amp;"', () => {
    expect(HtmlEscapeUtil.escape('a & b')).toBe('a &amp; b');
  });

  it('escapa "<" por "&lt;"', () => {
    expect(HtmlEscapeUtil.escape('a < b')).toBe('a &lt; b');
  });

  it('escapa ">" por "&gt;"', () => {
    expect(HtmlEscapeUtil.escape('a > b')).toBe('a &gt; b');
  });

  it('escapa \'"\' por "&quot;"', () => {
    expect(HtmlEscapeUtil.escape('a "b" c')).toBe('a &quot;b&quot; c');
  });

  it('escapa "\'" por "&#39;"', () => {
    expect(HtmlEscapeUtil.escape("a 'b' c")).toBe('a &#39;b&#39; c');
  });

  it('escapa un string con múltiples ocurrencias mezcladas en un solo pase', () => {
    expect(HtmlEscapeUtil.escape('<script>alert(1)</script><b>Juan</b>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;&lt;b&gt;Juan&lt;/b&gt;',
    );
  });

  it('devuelve el mismo string si no contiene caracteres especiales', () => {
    expect(HtmlEscapeUtil.escape('Juana Pérez')).toBe('Juana Pérez');
  });

  it('devuelve string vacío si recibe string vacío', () => {
    expect(HtmlEscapeUtil.escape('')).toBe('');
  });
});
