import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('dist/data/catalog.json','utf8'));
if(!catalog.updatedAt)throw Error('No successful Drive sync to record.');
const formatted=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(catalog.updatedAt));
await writeFile('README.md','Last synchronized - '+formatted+'\n');
