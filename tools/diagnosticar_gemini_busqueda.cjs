/* Diagnóstico local sin imprimir, guardar ni poner la credencial en la URL. */
const path=require('node:path');
const flowHome=path.join(process.env.LOCALAPPDATA,'ZeaSys-Flowise-Local');
process.env.SECRETKEY_PATH=path.join(flowHome,'secrets');
const sqlite=require(path.join(flowHome,'node_modules/sqlite3'));
const utils=require(path.join(flowHome,'node_modules/flowise-components/dist/src/utils.js'));
const db=new sqlite.Database(path.join(flowHome,'data/database.sqlite'),sqlite.OPEN_READONLY);
const get=(sql,args=[])=>new Promise((resolve,reject)=>db.get(sql,args,(e,r)=>e?reject(e):resolve(r)));
(async()=>{
 const flow=JSON.parse((await get('select flowData from chat_flow where id=?',['27d477e0-66b5-4a51-aba0-dcfaf80728c1'])).flowData);
 const node=flow.nodes.find(n=>n.data.name==='chatGoogleGenerativeAI');
 const record=await get('select encryptedData from credential where id=?',[node.data.credential]);
 const credential=await utils.decryptCredentialData(record.encryptedData);
 const key=credential.googleGenerativeAPIKey;
 if(!key)throw Error('La credencial de Gemini no contiene una clave.');
 const headers={'Content-Type':'application/json','x-goog-api-key':key};
 const list=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers,signal:AbortSignal.timeout(15000)});
 const catalog=await list.json();console.log('Modelos disponibles:',(catalog.models||[]).filter(m=>/flash/i.test(m.name)&&m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name).join(', '));
 const model=process.argv[2]||node.data.inputs.modelName;
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers,body:JSON.stringify({contents:[{role:'user',parts:[{text:'Busca en el sitio oficial del INIAP Ecuador una guía de maíz de la Sierra y dime su título y año.'}]}],tools:[{google_search:{}}],generationConfig:{maxOutputTokens:600}}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 const error=String(data.error?.message||'').replaceAll(key,'[REDACTADO]').replace(/AIza[A-Za-z0-9_-]+/g,'[REDACTADO]');
 const candidate=data.candidates?.[0];console.log(JSON.stringify({model,status:response.status,error:error.slice(0,350),consultas:candidate?.groundingMetadata?.webSearchQueries?.length||0,fuentes:candidate?.groundingMetadata?.groundingChunks?.length||0,texto:candidate?.content?.parts?.filter(p=>p.text&&!p.thought).map(p=>p.text).join('\n').slice(0,800)}));
})().catch(error=>{console.error('Diagnóstico:',error.name);process.exitCode=1;}).finally(()=>db.close());
