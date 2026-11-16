import {normalizarTextoChat} from '../utils/chatText';

function inline(text,key) {
  return String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^\s)]+\))/g).map((part,index)=>{
    if(part.startsWith('**')&&part.endsWith('**'))return <strong key={`${key}:${index}`}>{part.slice(2,-2)}</strong>;
    if(part.startsWith('`')&&part.endsWith('`'))return <code key={`${key}:${index}`}>{part.slice(1,-1)}</code>;
    const link=/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(part);
    if(link){try{const url=new URL(link[2]);if(!url.username&&!url.password)return <a key={`${key}:${index}`} href={url.href} target="_blank" rel="noopener noreferrer">{link[1]}</a>;}catch{/* Texto escapado si el enlace no es válido. */}}
    return part;
  });
}
export default function ChatMessageContent({text}) {
  const lines=normalizarTextoChat(text).split('\n');const blocks=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();if(!line)continue;
    if(/^#{1,4}\s/.test(line)){blocks.push(<h3 key={i}>{inline(line.replace(/^#{1,4}\s+/,''),i)}</h3>);continue;}
    if(/^```/.test(line)){const start=i;const code=[];while(++i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i]);blocks.push(<pre key={start}>{code.join('\n')}</pre>);continue;}
    const ordered=/^\d+[.)]\s+/.test(line);const unordered=/^[-*•]\s+/.test(line);
    if(ordered||unordered){const start=i;const items=[];const pattern=ordered?/^\d+[.)]\s+/:/^[-*•]\s+/;
      do{items.push(<li key={i}>{inline(lines[i].trim().replace(pattern,''),i)}</li>);i++;}while(i<lines.length&&pattern.test(lines[i].trim()));i--;blocks.push(ordered?<ol key={start}>{items}</ol>:<ul key={start}>{items}</ul>);continue;}
    blocks.push(<p key={i}>{inline(line,i)}</p>);
  }
  return <div className="zeasys-chat-answer">{blocks}</div>;
}
