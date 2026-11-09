import unittest
from preparar_corpus_rag import build,chunks,needs_ocr


class CorpusTest(unittest.TestCase):
    def test_detects_broken_font_even_when_text_is_long(self):
        self.assertTrue(needs_ocr(('Texto\x03 corrupto '*50)))
        self.assertFalse(needs_ocr('Temperatura 10 °C a 20 °C. '*30))

    def test_verified_excerpt_replaces_wrong_ocr_and_is_source_bound(self):
        page={'source_file':'iniap-manual-produccion-maiz-2007.pdf','page':7,'source_sha256':'a'*64,'text':'Temperatura 100C a 200C. '*10,'extraction':'ocr'}
        review={'source_file':page['source_file'],'page':7,'source_sha256':'a'*64,'excerpts':['Temperatura entre 10 °C y 20 °C.']}
        result=build([page],[review])
        self.assertEqual(len(result),1)
        self.assertNotIn('100C',result[0]['text'])
        self.assertTrue(result[0]['metadata']['verified_excerpt'])
        self.assertEqual(result,build([page],[review]))
        review['source_sha256']='b'*64
        with self.assertRaises(ValueError): build([page],[review])

    def test_chunks_are_bounded_without_losing_text_end(self):
        text='Una oración sobre suelo y riego. '*100+'Fin del documento.'
        parts=list(chunks(text))
        self.assertTrue(all(len(part)<=650 for part in parts))
        self.assertTrue(parts[-1].endswith('Fin del documento.'))


if __name__=='__main__': unittest.main()
