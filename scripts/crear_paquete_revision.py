"""Entrega de código y datos públicos; nunca copia la base personal ni credenciales."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT=Path(__file__).resolve().parents[1]
TREES=['frontend-app/src','frontend-app/public','frontend-app/tests','backend-api/src','backend-api/tests','backend-api/public',
       'ml-engine/src','ml-engine/config','ml-engine/tests','ml-engine/scripts','assets','models','scripts','tools','database/migraciones','design-system']
FILES=['index.html','.htaccess','AGENTS.md','README.md','ml-engine/app.py','ml-engine/requirements.txt',
       'database/schema-demo.sql','documentacion/REVISION_DOCENTES.md','documentacion/ZeaSys-referencias-datos-20261109.docx',
       'documentacion/referencias-datos-sistema-20261109.json','documentacion/revision-integral-20261109.md',
       'documentacion/revision-rendimiento-20261109.md',
       'documentacion/revision-siembra-20261109.md',
       'documentacion/revision-siembra-modulos-20261109.md',
       'documentacion/revision-siembra-estructura-20261109.md',
       'documentacion/revision-portada-temas-20261109.md',
       'documentacion/revision-portada-responsive-20261109.md',
       'documentacion/revision-explicaciones-20261110.md',
       'documentacion/revision-siembra-lluvia-20261110.md',
       'documentacion/revision-siembra-ux-pro-max-20261110.md',
       'documentacion/auditoria-ui-20261109.json','documentacion/paleta-colores.md','documentacion/GUIA_INSTALACION.md',
       'documentacion/evaluacion-espac2025-choclo-20261109.json','documentacion/plan-bloques-1-7-6-2-20261108.md',
       'documentacion/chatbot-pdf-20261108.md','documentacion/datos-modelo-bloque7-20261108.md','documentacion/rendimiento-estabilidad-20261108.md',
       'documentacion/fuentes-maiz/perfil-candidato-espac2025.json','documentacion/fuentes-maiz/diccionario-transitorios2025.json',
       'rag-sources/SOURCES.md']
def main():
    target=ROOT/'ZeaSys-revision-docentes-20261109.zip'
    if target.exists(): raise FileExistsError('No se sobrescribe una entrega existente; verifica su huella antes de retirarla.')
    paths=set()
    for folder in TREES:
        paths.update(p for p in (ROOT/folder).rglob('*') if p.is_file())
    for folder,pattern in [('frontend-app','*.*'),('backend-api/data/referencias','*.json'),('backend-api/data','*.json'),('ml-engine/models','*.joblib'),('ml-engine/models','*.json'),('ml-engine/data','*.csv'),('ml-engine/data','*.json'),('rag-sources','*.pdf')]:
        paths.update(p for p in (ROOT/folder).glob(pattern) if p.is_file())
    paths.update(ROOT/f for f in FILES if (ROOT/f).is_file())
    allowed=[]
    for p in sorted(paths):
        rel=p.relative_to(ROOT); parts=rel.parts
        if any(x in parts for x in ['node_modules','__pycache__','test-results','playwright-report','uploads','cache','dist','.git']): continue
        if parts[0]=='tools' and p.suffix not in {'.py','.php','.ps1','.cjs','.js','.bat','.md'} and p.name not in {'preguntas_rag_verificadas.json','preguntas_documentales.json'}: continue
        if p.suffix.lower() in ['.log','.pyc','.sqlite','.db','.zip']: continue
        if p.name.startswith('.env') and p.name!='.env.example': continue
        if p.name in ['agropredict_db.sql','config.local.php']: continue
        if p.suffix in ['.js','.jsx','.ts','.tsx','.json','.php','.py','.md','.bat','.ps1']:
            content=p.read_text(encoding='utf-8-sig',errors='replace')
            if re.search(r'AIza[A-Za-z0-9_-]{35}|sk-(?:proj-)?[A-Za-z0-9_-]{40,}',content): raise ValueError(f'Posible credencial en {rel}; revisar antes de distribuir.')
        allowed.append(p)
    manifest={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in allowed}
    with zipfile.ZipFile(target,'x',zipfile.ZIP_DEFLATED,compresslevel=6,strict_timestamps=False) as archive:
        for p in allowed: archive.write(p,'ZeaSys/'+p.relative_to(ROOT).as_posix())
        archive.writestr('ZeaSys/MANIFIESTO-REVISION.json',json.dumps(manifest,indent=2))
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        names=archive.namelist()
        assert not any('/uploads/' in n or n.endswith('/.env') or n.endswith('/agropredict_db.sql') for n in names)
        for name,sha in manifest.items(): assert hashlib.sha256(archive.read('ZeaSys/'+name)).hexdigest()==sha
    sha=hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix('.zip.sha256').write_text(f'{sha}  {target.name}\n',encoding='ascii')
    print(json.dumps({'archivo':target.name,'archivos':len(allowed),'bytes':target.stat().st_size,'sha256':sha}))

if __name__=='__main__': main()
