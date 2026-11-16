const {test}=require('node:test');const assert=require('node:assert/strict');
const {nodeClass:Chain,contentText,grounding,nativeGemini,needsWeb}=require('../flowise-nodes/ZeaSysGeminiSearch/ZeaSysGeminiSearch.js');
test('conserva texto útil y no presenta pensamientos internos',()=>{assert.equal(contentText([{type:'thinking',thinking:'privado'},{type:'text',text:'Respuesta'}]),'Respuesta');});
test('metadatos web conservan enlaces únicos y el widget original separado del texto',()=>{
 const g=grounding({additional_kwargs:{groundingMetadata:{webSearchQueries:['maíz Ecuador'],groundingChunks:[{web:{uri:'https://www.iniap.gob.ec/',title:'INIAP'}},{web:{uri:'https://www.iniap.gob.ec/'}},{web:{uri:'javascript:alert(1)'}}],searchEntryPoint:{renderedContent:'<div>Google</div>'}}}});
 assert.equal(g.fuentes_web.length,1);assert.equal(g.busqueda_realizada,true);assert.equal(g.sugerencias_busqueda_html,'<div>Google</div>');
});
test('una pregunta puede recibir orientación de Gemini sin documentos',async()=>{
 let saved;const model={invoke:async messages=>{assert.match(messages[0][1],/conocimiento general/);return{content:'Te explico qué significa pH y cómo revisarlo.'};},bindTools:()=>{throw Error('Una definición no necesita documentos ni búsqueda.');}};
 const result=await new Chain({sessionId:'prueba'}).run({inputs:{model,memory:{getChatMessages:async()=>[],addChatMessages:async rows=>{saved=rows;}}}},'Pregunta del usuario: ¿Qué significa pH?\nContexto autorizado: {}');
 assert.match(result.text,/pH/);assert.equal(saved[0].text,'¿Qué significa pH?');assert.equal(result.zeasys.modo,'contexto_y_conocimiento');
});
test('una búsqueda no disponible permite una respuesta de conocimiento general sin afirmar búsqueda',async()=>{
 const model={bindTools:()=>({invoke:async()=>{throw Error('Google Search quota 429');}}),invoke:async messages=>{assert.match(messages[0][1],/búsqueda web no estuvo disponible/);return{content:'Puedo explicarte el proceso general, aunque falta comprobar la información actual.'};}};
 const r=await new Chain().run({inputs:{model}},'Pregunta');assert.equal(r.zeasys.busqueda_no_disponible,true);assert.equal(r.zeasys.busqueda_realizada,false);assert.match(r.text,/proceso general/);
});
test('fallo de credencial no se convierte en una respuesta inventada',async()=>{const model={invoke:async()=>{throw Error('API key invalid 401');},bindTools:()=>({invoke:async()=>{throw Error('API key invalid 401');}})};await assert.rejects(new Chain().run({inputs:{model}},'Pregunta'),/401/);});
test('respuesta vacía se informa como fallo recuperable',async()=>{const model={invoke:async()=>{},bindTools:()=>({invoke:async()=>({content:[]})})};await assert.rejects(new Chain().run({inputs:{model}},'Pregunta'),/no devolvió texto/);});
test('preguntas conceptuales usan Gemini directamente y las actuales admiten búsqueda',()=>{assert.equal(needsWeb('¿Qué significa pH?'),false);assert.equal(needsWeb('Busca una fuente actual sobre pH'),true);assert.equal(needsWeb('¿Qué enfermedades se han reportado en Manabí?'),true);});
test('los escapes internos de Flowise no contaminan la pregunta ni fuerzan búsquedas por palabras del contexto',()=>{
 assert.equal(needsWeb('Pregunta del usuario: ¿Qué significa pH?FLOWISE_NEWLINEResponde en español.FLOWISE_NEWLINEContexto autorizado: fuentes y datos actuales'),false);
});
test('la API nativa envía la clave en cabecera y conserva las fuentes sin pensamientos',async()=>{
 const original=global.fetch;global.fetch=async(url,request)=>{assert.equal(url.includes('clave-prueba'),false);assert.equal(request.headers['x-goog-api-key'],'clave-prueba');assert.ok(JSON.parse(request.body).tools[0].google_search);return{ok:true,json:async()=>({candidates:[{content:{parts:[{thought:true,text:'No mostrar'},{text:'Respuesta útil'}]},groundingMetadata:{webSearchQueries:['maíz']}}]})};};
 try{const r=await nativeGemini({apiKey:'clave-prueba',model:'gemini-prueba'},[['system','Reglas'],['user','Consulta']],true);assert.equal(r.content,'Respuesta útil');assert.equal(grounding(r).busqueda_realizada,true);}finally{global.fetch=original;}
});
