import importlib.util
from contextlib import closing
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parent / 'respaldo_local.py'
spec = importlib.util.spec_from_file_location('respaldo_local', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class BackupTest(unittest.TestCase):
    def fixture(self, folder):
        folder.mkdir(parents=True, exist_ok=True)
        (folder/'base.sql').write_text('SELECT 1;', encoding='utf-8')
        with closing(sqlite3.connect(folder/'flowise.sqlite')) as db:
            db.execute('CREATE TABLE prueba (id INTEGER)')
        module.write_manifest(folder)

    def test_detects_changed_and_missing_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder/'base.sql').write_text('SELECT 1;', encoding='utf-8')
            with closing(sqlite3.connect(folder/'flowise.sqlite')) as db:
                db.execute('CREATE TABLE prueba (id INTEGER)')
            entries = {name: module.digest(folder/name) for name in ('base.sql', 'flowise.sqlite')}
            (folder/'manifest.json').write_text(json.dumps({'archivos_sha256': entries}), encoding='utf-8')
            self.assertEqual(module.verify(folder), 2)
            (folder/'base.sql').write_text('alterado', encoding='utf-8')
            with self.assertRaises(ValueError): module.verify(folder)
            (folder/'base.sql').unlink()
            with self.assertRaises(ValueError): module.verify(folder)

    def test_refuses_copy_while_chroma_or_flowise_running(self):
        with patch.object(module, 'port_open', return_value=True), tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(RuntimeError, 'Detén Chroma y Flowise'):
                module.backup(Path(tmp), None)

    def test_prepare_restore_copies_only_verified_backup_to_new_private_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)/'source'
            self.fixture(folder)
            with patch.object(module, 'ROOT', Path(tmp)/'web'/'ZeaSys'), patch.object(module, 'LOCAL', Path(tmp)/'services'):
                restored = module.prepare_restore(folder, Path(tmp)/'private'/'restored')
                self.assertEqual(module.verify(restored), 2)
                self.assertEqual(module.digest(folder/'base.sql'), module.digest(restored/'base.sql'))
                with self.assertRaises(FileExistsError): module.prepare_restore(folder, restored)
                with self.assertRaises(ValueError): module.prepare_restore(folder, Path(tmp)/'web'/'expuesto')
                with self.assertRaises(ValueError): module.prepare_restore(folder, folder/'nested')

    def test_rejects_extra_files_and_invalid_manifest_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            self.fixture(folder)
            (folder/'extra.sql').write_text('contenido ajeno')
            with self.assertRaisesRegex(ValueError, 'no declarados'): module.verify(folder)
            (folder/'extra.sql').unlink()
            original = json.loads((folder/'manifest.json').read_text())
            for malformed in ([], {}, {'archivos_sha256': None}):
                (folder/'manifest.json').write_text(json.dumps(malformed))
                with self.assertRaises(ValueError): module.verify(folder)
            for name in ('../fuera', '/absoluto', 'C:/otra', 'a\\b', './base.sql', 'carpeta/../base.sql', 'manifest.json'):
                manifest = {**original['archivos_sha256'], name: 'a'*64}
                (folder/'manifest.json').write_text(json.dumps({'archivos_sha256':manifest}))
                with self.subTest(name=name), self.assertRaises(ValueError): module.verify(folder)

    def test_corruption_is_rejected_before_creating_restore_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder, target = Path(tmp)/'source', Path(tmp)/'restored'
            self.fixture(folder)
            (folder/'base.sql').write_text('alterado')
            with self.assertRaises(ValueError): module.prepare_restore(folder, target)
            self.assertFalse(target.exists())

if __name__ == '__main__': unittest.main()

