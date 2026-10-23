import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await fs.cp('public','docs',{recursive:true});
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','docs']);
const changes=execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim();
if(changes){
 execFileSync('git',['commit','-m','Refresh validated public portfolio JSON']);
 execFileSync('git',['push']);
}
