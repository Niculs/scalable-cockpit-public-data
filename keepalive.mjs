import {execFileSync} from 'node:child_process';
const date=new Date();
const latest=Number(execFileSync('git',['log','-1','--format=%ct'],{encoding:'utf8'}).trim())*1000;
if(date.getTime()-latest>28*24*60*60*1000){
 execFileSync('git',['config','user.name','github-actions[bot]']);
 execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
 execFileSync('git',['commit','--allow-empty','-m','Keep automatic public data publishing active']);
 execFileSync('git',['push']);
}
