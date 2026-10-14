import { test } from '@japa/runner'
import { detectFormat, isAccepted } from '../src/files/file_types.ts'
import { sanitizeRichText } from '../src/files/sanitize_html.ts'
import { field } from '../src/resources/fields.ts'

const bytes = (...values: (number | string)[]) =>
  Uint8Array.from(
    values.flatMap((value) =>
      typeof value === 'string' ? [...value].map((c) => c.charCodeAt(0)) : [value]
    )
  )

test.group('Upload types', () => {
  test('signed formats are detected from their bytes, whatever the name', ({ assert }) => {
    const png = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a)
    assert.equal(detectFormat(png, 'png')?.mime, 'image/png')
    assert.equal(detectFormat(png, 'photo.jpg')?.mime, 'image/png')
    assert.equal(detectFormat(bytes(0xff, 0xd8, 0xff, 0xe0), 'jpg')?.mime, 'image/jpeg')
    assert.equal(detectFormat(bytes('RIFF', 0, 0, 0, 0, 'WEBP'), 'webp')?.mime, 'image/webp')
    assert.equal(detectFormat(bytes('%PDF-1.7'), 'pdf')?.mime, 'application/pdf')
  })

  test('ZIP-based formats share a signature; the extension picks', ({ assert }) => {
    const zip = bytes('PK', 3, 4)
    assert.equal(
      detectFormat(zip, 'docx')?.mime,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    assert.equal(detectFormat(zip, 'zip')?.mime, 'application/zip')
  })

  test('text named as an image is not an image', ({ assert }) => {
    assert.isNull(detectFormat(bytes('hello world'), 'png'))
  })

  test('formats without a signature go by extension', ({ assert }) => {
    assert.equal(detectFormat(bytes('a,b\n1,2'), 'csv')?.mime, 'text/csv')
    assert.equal(detectFormat(bytes('<svg>'), 'svg')?.mime, 'image/svg+xml')
    assert.isNull(detectFormat(bytes('MZ'), 'exe'))
  })

  test('accept lists take exact types and wildcards', ({ assert }) => {
    assert.isTrue(isAccepted('image/png', ['image/*']))
    assert.isTrue(isAccepted('application/pdf', ['application/pdf']))
    assert.isFalse(isAccepted('image/svg+xml', ['image/jpeg', 'image/png']))
  })

  test('accept() and maxSize() are for file and image fields', ({ assert }) => {
    assert.containsSubset(field.file('manual').accept('application/pdf').maxSize('20mb').toJSON(), {
      accept: ['application/pdf'],
      maxSize: '20mb',
    })
    assert.isNull(field.image('photo').toJSON().accept)
  })
})

test.group('Rich text sanitising', () => {
  test("keeps Tiptap's StarterKit markup", ({ assert }) => {
    const html =
      '<h2>Title</h2><p>A <strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code></p>' +
      '<ul><li>one</li></ul><ol start="3"><li>three</li></ol><blockquote><p>q</p></blockquote>' +
      '<pre><code>x</code></pre><hr><p>a<br>b</p>'
    assert.equal(sanitizeRichText(html), html.replace('<hr>', '<hr />').replace('<br>', '<br />'))
  })

  test('removes scripts, handlers, styles and unsafe links', ({ assert }) => {
    assert.equal(
      sanitizeRichText(
        '<p style="x" onclick="y()">a</p><script>alert(1)</script><iframe src="//e"></iframe>' +
          '<a href="javascript:alert(1)">j</a><a href="//evil.example">p</a>'
      ),
      '<p>a</p><a>j</a><a>p</a>'
    )
  })

  test('links opening a new tab get rel noopener', ({ assert }) => {
    assert.equal(
      sanitizeRichText('<a href="https://example.com" target="_blank">x</a>'),
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">x</a>'
    )
  })
})
