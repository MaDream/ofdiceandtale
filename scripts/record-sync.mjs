import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('dist/data/catalog.json','utf8'));
if(!catalog.updatedAt)throw Error('No successful Drive sync to record.');
const formatted=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'long',timeStyle:'medium'}).format(new Date(catalog.updatedAt));
const count=catalog.categories.reduce((total,category)=>total+category.items.length,0);
const readme=await readFile('README.md','utf8');
if(!readme.includes('<!-- sync:start -->')||!readme.includes('<!-- sync:end -->'))throw Error('README sync markers are missing.');
await writeFile('README.md',readme.replace(/<!-- sync:start -->[\s\S]*?<!-- sync:end -->/,'<!-- sync:start -->\nПоследняя успешная синхронизация: **'+formatted+' (МСК)**. Карточек: **'+count+'**.\n<!-- sync:end -->'));
