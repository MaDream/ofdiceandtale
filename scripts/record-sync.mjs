import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('dist/data/catalog.json','utf8'));
if(!catalog.updatedAt)throw Error('No successful Drive sync to record.');
const formatted=new Date(catalog.updatedAt).toISOString().slice(0,19).replace('T',' ');
await writeFile('README.md','Last synchronized - '+formatted+' UTC\n');
